import {NextResponse} from 'next/server';
import {AccountMode,FundingStatus,FundingType,NotificationType,Prisma} from '@prisma/client';
import {z,ZodError} from 'zod';
import {requireAdmin} from '@/lib/auth';
import {db} from '@/lib/db';
import {createNotification} from '@/lib/notifications';
import {jsonSafe} from '@/lib/serializers';

const schema=z.object({id:z.string().min(1),settlementReference:z.string().trim().min(3).max(180),note:z.string().trim().max(500).optional()});

export async function POST(req:Request){
	try{
		const admin=await requireAdmin();
		const input=schema.parse(await req.json());
		const request=await db.$transaction(async tx=>{
			const current=await tx.fundingRequest.findUnique({where:{id:input.id}});
			if(!current||current.type!==FundingType.WITHDRAWAL||current.accountMode!==AccountMode.REAL||current.status!==FundingStatus.APPROVED||current.settlementReference)throw new Error('WITHDRAWAL_NOT_SETTLEABLE');
			const settledAt=new Date();
			const adminNote=[current.adminNote,input.note].filter(Boolean).join('\n')||null;
			const changed=await tx.fundingRequest.updateMany({where:{id:current.id,type:FundingType.WITHDRAWAL,accountMode:AccountMode.REAL,status:FundingStatus.APPROVED,settlementReference:null},data:{status:FundingStatus.COMPLETED,settlementReference:input.settlementReference,settledAt,verifiedAt:settledAt,adminNote}});
			if(changed.count!==1)throw new Error('WITHDRAWAL_ALREADY_SETTLED');
			const updated=await tx.fundingRequest.findUniqueOrThrow({where:{id:current.id}});
			await tx.auditLog.create({data:{actorId:admin.id,action:'WITHDRAWAL_SETTLED',entity:'FUNDING',entityId:updated.id,metadata:{settlementReference:updated.settlementReference,amount:updated.amount.toString(),currency:updated.currency,accountMode:updated.accountMode,note:input.note||null}}});
			await createNotification(tx,{userId:updated.userId,type:NotificationType.WITHDRAWAL,title:'Withdrawal settlement recorded',message:`Your real-account withdrawal was marked settled by an administrator. Reference: ${input.settlementReference}.`,dedupeKey:`funding:${updated.id}:settled`,relatedEntity:'FUNDING',relatedId:updated.id,actionUrl:`/wallet/transactions/${updated.id}`});
			return updated;
		},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
		const {receiptKey,...safeRequest}=request;
		return NextResponse.json(jsonSafe({request:{...safeRequest,hasReceipt:!!receiptKey}}),{headers:{'Cache-Control':'private, no-store'}});
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Enter a valid settlement reference and note.'},{status:400});
		if(error instanceof Error&&error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
		if(error instanceof Error&&error.message==='FORBIDDEN')return NextResponse.json({error:'Forbidden'},{status:403});
		if(error instanceof Error&&['WITHDRAWAL_NOT_SETTLEABLE','WITHDRAWAL_ALREADY_SETTLED'].includes(error.message))return NextResponse.json({error:error.message.replaceAll('_',' ').toLowerCase()},{status:409});
		return NextResponse.json({error:'Unable to record withdrawal settlement.'},{status:500});
	}
}