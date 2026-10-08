import {NextResponse} from 'next/server';
import {AccountMode,InvestmentStatus,Prisma} from '@prisma/client';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {balance} from '@/lib/ledger';
import {getUserActivity} from '@/lib/activity';
import {getAccountTier} from '@/lib/production-policy';
import {jsonSafe} from '@/lib/serializers';
import {filterSupportedMarketAssets} from '@/lib/live-market';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const user=await requireUser();
    const mode=user.accountMode as AccountMode;
    const account=await db.ledgerAccount.findUnique({where:{code:`USER:${user.id}:${mode}:USD`},select:{id:true}});
    const [positions,orders,investments,notifications,profile,marketInstruments]=await Promise.all([
      db.position.findMany({where:{userId:user.id,accountMode:mode,status:'OPEN'},include:{instrument:true},orderBy:{openedAt:'desc'},take:8}),
      db.order.findMany({where:{userId:user.id,accountMode:mode},include:{instrument:{select:{symbol:true,name:true}}},orderBy:{createdAt:'desc'},take:8}),
      db.investmentRequest.findMany({where:{userId:user.id,accountMode:mode},include:{opportunity:{select:{title:true,category:true,riskLevel:true,assetSymbol:true,targetReturnPercent:true,durationDays:true}}},orderBy:{requestedAt:'desc'},take:6}),
      db.notification.findMany({where:{userId:user.id},orderBy:{createdAt:'desc'},take:6}),
      db.user.findUnique({where:{id:user.id},select:{id:true,email:true,name:true,avatarKey:true,role:true,status:true,accountMode:true,kycStatus:true,verifiedAt:true,verifiedChannel:true,phoneVerified:true,phone:true,country:true,createdAt:true,kyc:{select:{submittedAt:true}},kycDocuments:{where:{kind:'IDENTITY_DOCUMENT',status:'APPROVED'},select:{id:true}}}}),
      db.instrument.findMany({where:{enabled:true},orderBy:{symbol:'asc'},take:12}),
    ]);
    const supportedMarketInstruments=filterSupportedMarketAssets(marketInstruments);
    const cash=account?await balance(db,account.id):new Prisma.Decimal(0);
    const positionValue=mode===AccountMode.DEMO?positions.reduce((sum,p)=>sum.plus(p.quantity.mul(p.instrument.price)),new Prisma.Decimal(0)):new Prisma.Decimal(0);
    const invested=mode===AccountMode.DEMO?investments.filter(i=>[InvestmentStatus.PENDING_APPROVAL,InvestmentStatus.APPROVED,InvestmentStatus.ACTIVE,InvestmentStatus.PAUSED,InvestmentStatus.COMPLETED].some(status=>status===i.status)).reduce((sum,i)=>sum.plus(i.amount),new Prisma.Decimal(0)):new Prisma.Decimal(0);
    const unrealized=mode===AccountMode.DEMO?positions.reduce((sum,p)=>sum.plus((p.side==='BUY'?p.instrument.price.minus(p.entryPrice):p.entryPrice.minus(p.instrument.price)).mul(p.quantity)),new Prisma.Decimal(0)):new Prisma.Decimal(0);
    const activity=await getUserActivity(user.id,mode,'all',8);
    const recentActivity=activity.items.map(item=>({id:item.id,category:item.category,action:item.action,timestamp:item.timestamp,asset:item.asset,amount:item.amount,status:item.status,source:item.sourceLabel,pnl:item.pnl,adminInitiated:item.adminInitiated,link:item.link}));
    const tier=getAccountTier({accountMode:mode,kycStatus:profile?.kycStatus||'PENDING',verificationDocuments:profile?.kycDocuments?.length||0,verificationSubmitted:!!profile?.kyc?.submittedAt});
    const safeProfile={...profile,...tier};
    return NextResponse.json(jsonSafe({accountMode:mode,cash,positionValue,invested,unrealized,portfolioValue:cash.plus(positionValue).plus(invested),openOrders:orders.filter(o=>o.status==='OPEN').length,activePositions:positions.length,activity:recentActivity,orders,positions,investments,notifications,profile:safeProfile,marketInstruments:supportedMarketInstruments.map(i=>({id:i.id,symbol:i.symbol,name:i.name,price:Number(i.price),changePercent:0,updatedAt:i.updatedAt.toISOString()}))}),{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    return NextResponse.json({error:error instanceof Error&&error.message==='UNAUTHORIZED'?'Unauthorized':'Unable to load dashboard.'},{status:error instanceof Error&&error.message==='UNAUTHORIZED'?401:503,headers:{'Cache-Control':'private, no-store'}});
  }
}
