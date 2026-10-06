import {NextResponse} from 'next/server';
import {z,ZodError} from 'zod';
import {NotificationType} from '@prisma/client';
import {requireAdmin} from '@/lib/auth';
import {db} from '@/lib/db';
import {createNotification} from '@/lib/notifications';
const schema=z.object({userId:z.string(),status:z.enum(['ACTIVE','FROZEN']).optional(),role:z.enum(['USER','ADMIN']).optional(),kycStatus:z.enum(['PENDING','APPROVED','REJECTED','NEEDS_CHANGES']).optional(),reviewNote:z.string().trim().max(500).optional()});
export async function GET(){try{await requireAdmin();return NextResponse.json(await db.user.findMany({select:{id:true,email:true,name:true,country:true,phone:true,role:true,status:true,kycStatus:true,accountMode:true,createdAt:true,kyc:{select:{legalName:true,dob:true,address:true,idType:true,idNumber:true,submittedAt:true,reviewedAt:true,reviewNote:true}}},orderBy:{createdAt:'desc'},take:200}));}catch{return NextResponse.json({error:'Forbidden'},{status:403})}}
export async function PATCH(req:Request){
	try{
		const admin=await requireAdmin();
		const input=schema.parse(await req.json());
		if(input.userId===admin.id&&(input.status==='FROZEN'||input.role==='USER'))throw new Error('CANNOT_DISABLE_CURRENT_ADMIN');
		const updated=await db.$transaction(async tx=>{
			const current=await tx.user.findUniqueOrThrow({where:{id:input.userId},select:{kycStatus:true}});
			const kycChanged=input.kycStatus!==undefined&&input.kycStatus!==current.kycStatus;
			if(input.kycStatus!==undefined&&!kycChanged)throw new Error('KYC_STATUS_UNCHANGED');
			const user=await tx.user.update({where:{id:input.userId},data:{status:input.status,role:input.role,kycStatus:input.kycStatus},select:{id:true,email:true,name:true,role:true,status:true,kycStatus:true,accountMode:true,createdAt:true}});
			if(kycChanged)await tx.kycProfile.updateMany({where:{userId:user.id},data:{reviewedAt:new Date(),reviewNote:input.reviewNote||null}});
			await tx.auditLog.create({data:{actorId:admin.id,action:kycChanged?`KYC_${input.kycStatus}`:'USER_UPDATE',entity:'USER',entityId:user.id,metadata:{...input,reviewNote:input.reviewNote||null}}});
			if(kycChanged){
				const status=input.kycStatus!;
				const title=status==='APPROVED'?'Identity verification approved':status==='REJECTED'?'Identity verification rejected':status==='NEEDS_CHANGES'?'Additional verification required':'Identity verification status updated';
				const message=`Your identity verification status is ${status.toLowerCase().replaceAll('_',' ')}.${input.reviewNote?` Admin note: ${input.reviewNote}`:''}`;
				await createNotification(tx,{userId:user.id,type:NotificationType.KYC,title,message,dedupeKey:`kyc:${user.id}:${status}:${user.createdAt.toISOString()}:${new Date().toISOString()}`,actionUrl:'/kyc'});
			}
			return user;
		});
		return NextResponse.json(updated);
	}catch(error){
		if(error instanceof Error&&error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
		if(error instanceof Error&&error.message==='FORBIDDEN')return NextResponse.json({error:'Forbidden'},{status:403});
		if(error instanceof ZodError)return NextResponse.json({error:'Invalid review details.'},{status:400});
		if(error instanceof Error&&error.message==='KYC_STATUS_UNCHANGED')return NextResponse.json({error:'This verification status was already recorded.'},{status:409});
		return NextResponse.json({error:'Unable to update this account.'},{status:400});
	}
}
