import {NextResponse} from 'next/server';
import {z,ZodError} from 'zod';
import {NotificationType} from '@prisma/client';
import {requireAdmin} from '@/lib/auth';
import {db} from '@/lib/db';
import {createNotification} from '@/lib/notifications';
const schema=z.object({userId:z.string(),status:z.enum(['ACTIVE','FROZEN']).optional(),role:z.enum(['USER','ADMIN']).optional(),kycStatus:z.enum(['PENDING','APPROVED','REJECTED','NEEDS_CHANGES']).optional(),withdrawalEnabled:z.boolean().optional(),accountRestricted:z.boolean().optional(),restrictionReason:z.string().trim().max(500).optional(),reviewNote:z.string().trim().max(500).optional()});
export async function GET(){try{await requireAdmin();const users=await db.user.findMany({select:{id:true,email:true,name:true,country:true,phone:true,role:true,status:true,kycStatus:true,accountMode:true,withdrawalEnabled:true,accountRestricted:true,restrictionReason:true,createdAt:true,kyc:{select:{legalName:true,dob:true,address:true,idType:true,idNumber:true,submittedAt:true,reviewedAt:true,reviewNote:true}},kycDocuments:{select:{id:true,kind:true,filename:true,mimeType:true,size:true,status:true,uploadedAt:true,reviewedAt:true,reviewNote:true},orderBy:{uploadedAt:'desc'}}},orderBy:{createdAt:'desc'},take:200});return NextResponse.json(users,{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'Forbidden'},{status:403})}}
export async function PATCH(req:Request){
	try{
		const admin=await requireAdmin();
		const input=schema.parse(await req.json());
		if(input.userId===admin.id&&(input.status==='FROZEN'||input.role==='USER'))throw new Error('CANNOT_DISABLE_CURRENT_ADMIN');
		const updated=await db.$transaction(async tx=>{
			const current=await tx.user.findUniqueOrThrow({where:{id:input.userId},select:{kycStatus:true,withdrawalEnabled:true,accountRestricted:true,restrictionReason:true,kyc:{select:{submittedAt:true}},kycDocuments:{where:{kind:'IDENTITY_DOCUMENT',status:'APPROVED'},select:{id:true},take:1}}});
			const kycChanged=input.kycStatus!==undefined&&input.kycStatus!==current.kycStatus;
			const restrictionChanged=(input.withdrawalEnabled!==undefined&&input.withdrawalEnabled!==current.withdrawalEnabled)||(input.accountRestricted!==undefined&&input.accountRestricted!==current.accountRestricted)||(input.restrictionReason!==undefined&&input.restrictionReason!==current.restrictionReason);
			if(input.kycStatus!==undefined&&!kycChanged)throw new Error('KYC_STATUS_UNCHANGED');
			if(input.kycStatus==='APPROVED'&&(!current.kyc?.submittedAt||!current.kycDocuments.length))throw new Error('APPROVED_IDENTITY_DOCUMENT_REQUIRED');
			const user=await tx.user.update({where:{id:input.userId},data:{status:input.status,role:input.role,kycStatus:input.kycStatus,withdrawalEnabled:input.withdrawalEnabled,accountRestricted:input.accountRestricted,...(input.accountRestricted===false?{restrictionReason:null}:input.restrictionReason!==undefined?{restrictionReason:input.restrictionReason||null}:{})},select:{id:true,email:true,name:true,role:true,status:true,kycStatus:true,accountMode:true,createdAt:true,withdrawalEnabled:true,accountRestricted:true,restrictionReason:true}});
			if(kycChanged)await tx.kycProfile.updateMany({where:{userId:user.id},data:{reviewedAt:new Date(),reviewNote:input.reviewNote||null}});
			await tx.auditLog.create({data:{actorId:admin.id,action:kycChanged?`KYC_${input.kycStatus}`:restrictionChanged?'USER_ACCOUNT_RESTRICTION':'USER_UPDATE',entity:'USER',entityId:user.id,metadata:{...input,reviewNote:input.reviewNote||null}}});
			if(kycChanged){
				const status=input.kycStatus!;
				const title=status==='APPROVED'?'Identity profile approved by administrator':status==='REJECTED'?'Identity profile rejected by administrator':status==='NEEDS_CHANGES'?'Additional identity information requested':'Identity profile review updated';
				const message=`An administrator marked your identity profile ${status.toLowerCase().replaceAll('_',' ')}. This is not an external identity-provider, AML/sanctions, or regulatory verification.${input.reviewNote?` Admin note: ${input.reviewNote}`:''}`;
				await createNotification(tx,{userId:user.id,type:NotificationType.KYC,title,message,dedupeKey:`kyc:${user.id}:${status}:${user.createdAt.toISOString()}:${new Date().toISOString()}`,actionUrl:'/kyc'});
			}
			if(restrictionChanged)await createNotification(tx,{userId:user.id,type:NotificationType.SECURITY,title:'Account access updated',message:user.accountRestricted?`An administrator restricted account access.${user.restrictionReason?` Reason: ${user.restrictionReason}`:''}`:!user.withdrawalEnabled?'Withdrawals are currently disabled for your account.':'Account restrictions were updated by an administrator.',dedupeKey:`account-control:${user.id}:${Date.now()}`,actionUrl:'/tier'});
			return user;
		});
		return NextResponse.json(updated);
	}catch(error){
		if(error instanceof Error&&error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
		if(error instanceof Error&&error.message==='FORBIDDEN')return NextResponse.json({error:'Forbidden'},{status:403});
		if(error instanceof ZodError)return NextResponse.json({error:'Invalid review details.'},{status:400});
		if(error instanceof Error&&error.message==='KYC_STATUS_UNCHANGED')return NextResponse.json({error:'This verification status was already recorded.'},{status:409});
		if(error instanceof Error&&error.message==='APPROVED_IDENTITY_DOCUMENT_REQUIRED')return NextResponse.json({error:'Approve an identity document before approving account verification.'},{status:409});
		return NextResponse.json({error:'Unable to update this account.'},{status:400});
	}
}
