import {NextResponse} from 'next/server';
import {NotificationType} from '@prisma/client';
import {z,ZodError} from 'zod';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {createNotification} from '@/lib/notifications';

const schema=z.object({name:z.string().trim().min(2).max(120),phone:z.string().trim().max(40).optional(),country:z.string().trim().min(2).max(80),address:z.string().trim().max(500).optional(),twoFactorEnabled:z.boolean()});

export async function GET(){
	try{
		const user=await requireUser();
		const profile=await db.user.findUnique({where:{id:user.id},select:{id:true,email:true,name:true,phone:true,phoneVerified:true,country:true,avatarKey:true,twoFactorEnabled:true,role:true,status:true,kycStatus:true,verifiedAt:true,verifiedChannel:true,kyc:{select:{address:true}}}});
		if(!profile)return NextResponse.json({error:'Profile not found.'},{status:404});
		const {avatarKey,kyc,...safeProfile}=profile;
		return NextResponse.json({...safeProfile,address:kyc?.address||null,hasAvatar:!!avatarKey},{headers:{'Cache-Control':'private, no-store'}});
	}catch(error){
		return NextResponse.json({error:error instanceof Error&&error.message==='UNAUTHORIZED'?'Unauthorized':'Unable to load profile.'},{status:error instanceof Error&&error.message==='UNAUTHORIZED'?401:503});
	}
}

export async function PATCH(request:Request){
	try{
		const user=await requireUser();
		const input=schema.parse(await request.json());
		const updated=await db.$transaction(async tx=>{
			const current=await tx.user.findUniqueOrThrow({where:{id:user.id},select:{twoFactorEnabled:true}});
			const profile=await tx.user.update({where:{id:user.id},data:{name:input.name,phone:input.phone||null,country:input.country,twoFactorEnabled:input.twoFactorEnabled},select:{id:true,email:true,name:true,phone:true,phoneVerified:true,country:true,twoFactorEnabled:true,role:true,status:true,kycStatus:true,verifiedAt:true,verifiedChannel:true,updatedAt:true}});
			if(input.address!==undefined)await tx.kycProfile.upsert({where:{userId:user.id},update:{address:input.address||null},create:{userId:user.id,address:input.address||null}});
			if(current.twoFactorEnabled!==profile.twoFactorEnabled)await createNotification(tx,{userId:user.id,type:NotificationType.SECURITY,title:'Security setting updated',message:`Your two-factor setting flag is now ${profile.twoFactorEnabled?'on':'off'}. A second-factor challenge is not configured in this application.`,dedupeKey:`security:${user.id}:two-factor:${profile.updatedAt.toISOString()}`,actionUrl:'/settings#security'});
			return profile;
		});
		return NextResponse.json(updated,{headers:{'Cache-Control':'private, no-store'}});
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Check the profile fields and try again.'},{status:400});
		if(error instanceof Error&&error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
		return NextResponse.json({error:'Unable to save profile.'},{status:503});
	}
}
