import {NextResponse} from 'next/server';
import {z} from 'zod';
import {AccountMode,NotificationType} from '@prisma/client';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {createNotification} from '@/lib/notifications';

const schema=z.object({accountMode:z.nativeEnum(AccountMode)});

export async function PATCH(req:Request){
	try{
		const user=await requireUser();
		const {accountMode}=schema.parse(await req.json());
		const updated=await db.$transaction(async tx=>{
			const current=await tx.user.findUniqueOrThrow({where:{id:user.id},select:{accountMode:true}});
			const changed=await tx.user.update({where:{id:user.id},data:{accountMode},select:{accountMode:true,updatedAt:true}});
			if(current.accountMode!==accountMode){
				await tx.auditLog.create({data:{actorId:user.id,action:'ACCOUNT_MODE_CHANGED',entity:'USER',entityId:user.id,metadata:{from:current.accountMode,to:accountMode}}});
				await createNotification(tx,{userId:user.id,type:NotificationType.ACCOUNT,title:'Account mode changed',message:`Your active account is now ${accountMode}. Balances and activity remain separate by mode.`,dedupeKey:`account-mode:${user.id}:${changed.updatedAt.toISOString()}`,actionUrl:'/dashboard'});
			}
			return {accountMode:changed.accountMode};
		});
		return NextResponse.json(updated);
	}catch{
		return NextResponse.json({error:'Unable to update account mode.'},{status:400});
	}
}