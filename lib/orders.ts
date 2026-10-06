import {db} from './db';
import {balance,ensureSystemAccount,ensureUserLedger,postDoubleEntry} from './ledger';
import {AccountMode,NotificationType,OrderSide,OrderStatus,OrderType,Prisma} from '@prisma/client';
import {createNotification} from '@/lib/notifications';

export type PlaceOrderInput={instrumentId:string;side:OrderSide;type:OrderType;quantity:number;price?:number;stopPrice?:number};

function executable(type:OrderType,side:OrderSide,market:number,price?:number,stopPrice?:number){
 if(type===OrderType.MARKET)return true;
 if(type===OrderType.LIMIT)return price!==undefined&&(side===OrderSide.BUY?market<=price:market>=price);
 return stopPrice!==undefined&&(side===OrderSide.BUY?market>=stopPrice:market<=stopPrice);
}

export async function executeOrderTx(tx:Prisma.TransactionClient,orderId:string,fill:number){
 const order=await tx.order.findUnique({where:{id:orderId},include:{instrument:true}});
 if(!order||order.status!==OrderStatus.OPEN)throw new Error('ORDER_NOT_OPEN');
 if(order.accountMode!==AccountMode.DEMO)throw new Error('REAL_EXECUTION_UNAVAILABLE');
 const qty=Number(order.quantity)-Number(order.filledQuantity); if(qty<=0)throw new Error('ORDER_FILLED');
 const leverage=Math.max(1,Number(order.instrument.leverage));
 const notional=new Prisma.Decimal(fill).mul(qty);
 const margin=notional.div(leverage);
 const fee=notional.mul(order.instrument.takerFee);
 const userAcct=await ensureUserLedger(tx,order.userId,order.accountMode);
 const available=await balance(tx,userAcct.id);
 const required=margin.plus(fee);
 if(available.lt(required))throw new Error('INSUFFICIENT_FUNDS');
 const fees=await ensureSystemAccount(tx,'SYSTEM:FEES','Trading Fees');
 const clearing=await ensureSystemAccount(tx,'SYSTEM:CLEARING','Clearing');
 await postDoubleEntry(tx,{reference:`TRADE:FEE:${order.id}`,description:`${order.side} ${order.instrument.symbol} trading fee`,debitAccountId:userAcct.id,creditAccountId:fees.id,amount:fee});
 await postDoubleEntry(tx,{reference:`TRADE:MARGIN:${order.id}`,description:`${order.side} ${order.instrument.symbol} margin reservation`,debitAccountId:userAcct.id,creditAccountId:clearing.id,amount:margin});
 await tx.execution.create({data:{orderId:order.id,quantity:qty,price:fill,fee}});
 await tx.order.update({where:{id:order.id},data:{filledQuantity:{increment:qty},averageFillPrice:fill,fee:{increment:fee},status:OrderStatus.FILLED}});
 const existing=await tx.position.findFirst({where:{userId:order.userId,instrumentId:order.instrumentId,accountMode:order.accountMode,status:'OPEN'}});
 if(existing){
   if(existing.side!==order.side)throw new Error('OPPOSITE_POSITION_MUST_BE_CLOSED_FIRST');
   const oldQty=new Prisma.Decimal(existing.quantity),newQty=oldQty.plus(qty),oldMargin=new Prisma.Decimal(existing.margin);
   const avg=new Prisma.Decimal(existing.entryPrice).mul(oldQty).plus(new Prisma.Decimal(fill).mul(qty)).div(newQty);
   await tx.position.update({where:{id:existing.id},data:{quantity:newQty,entryPrice:avg,margin:oldMargin.plus(margin),leverage:order.instrument.leverage}});
 }else{
  await tx.position.create({data:{userId:order.userId,instrumentId:order.instrumentId,accountMode:order.accountMode,side:order.side,quantity:qty,entryPrice:fill,leverage:order.instrument.leverage,margin}});
 }
 await createNotification(tx,{userId:order.userId,type:NotificationType.TRADE,title:'Demo order filled',message:`Your ${order.side.toLowerCase()} order for ${order.instrument.symbol} filled ${qty} at ${fill}. This was simulated trading.`,dedupeKey:`order:${order.id}:filled`,relatedEntity:'ORDER',relatedId:order.id,actionUrl:'/trade'});
 return tx.order.findUnique({where:{id:order.id},include:{executions:true,instrument:true}});
}

export async function placeOrder(userId:string,accountMode:AccountMode,input:PlaceOrderInput){
 if(accountMode!==AccountMode.DEMO)throw new Error('REAL_EXECUTION_UNAVAILABLE');
 if(!Number.isFinite(input.quantity)||input.quantity<=0)throw new Error('INVALID_QUANTITY');
 if(input.type===OrderType.LIMIT&&(!Number.isFinite(input.price)||Number(input.price)<=0))throw new Error('LIMIT_PRICE_REQUIRED');
 if(input.type===OrderType.STOP&&(!Number.isFinite(input.stopPrice)||Number(input.stopPrice)<=0))throw new Error('STOP_PRICE_REQUIRED');
 return db.$transaction(async tx=>{
   const inst=await tx.instrument.findUnique({where:{id:input.instrumentId}}); if(!inst||!inst.enabled)throw new Error('INSTRUMENT_UNAVAILABLE');
   const market=Number(inst.price); const price=input.price===undefined?undefined:Number(input.price); const stop=input.stopPrice===undefined?undefined:Number(input.stopPrice);
  const order=await tx.order.create({data:{userId,instrumentId:inst.id,accountMode,side:input.side,type:input.type,quantity:input.quantity,price,stopPrice:stop,status:OrderStatus.OPEN}});
  await createNotification(tx,{userId,type:NotificationType.TRADE,title:'Demo order submitted',message:`Your ${input.side.toLowerCase()} ${input.type.toLowerCase()} order for ${inst.symbol} was submitted in the simulated account.`,dedupeKey:`order:${order.id}:submitted`,relatedEntity:'ORDER',relatedId:order.id,actionUrl:'/trade'});
   if(!executable(input.type,input.side,market,price,stop))return order;
   return executeOrderTx(tx,order.id,market);
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function processOpenOrders(){
 const orders=await db.order.findMany({where:{status:OrderStatus.OPEN,accountMode:AccountMode.DEMO},include:{instrument:true},take:500,orderBy:{createdAt:'asc'}});
 for(const o of orders){
   const p=Number(o.instrument.price); const hit=executable(o.type,o.side,p,o.price===null?undefined:Number(o.price),o.stopPrice===null?undefined:Number(o.stopPrice));
   if(!hit)continue;
   try{await db.$transaction(tx=>executeOrderTx(tx,o.id,p),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}
  catch(e){if(e instanceof Error&&['INSUFFICIENT_FUNDS','OPPOSITE_POSITION_MUST_BE_CLOSED_FIRST','ORDER_NOT_OPEN','ORDER_FILLED'].includes(e.message))await db.$transaction(async tx=>{const rejected=await tx.order.updateMany({where:{id:o.id,status:OrderStatus.OPEN},data:{status:OrderStatus.REJECTED}});if(rejected.count)await createNotification(tx,{userId:o.userId,type:NotificationType.TRADE,title:'Demo order rejected',message:`Your ${o.side.toLowerCase()} order for ${o.instrument.symbol} was rejected in the simulated account.`,dedupeKey:`order:${o.id}:rejected`,relatedEntity:'ORDER',relatedId:o.id,actionUrl:'/trade'});});}
 }
}
