import {NextResponse} from 'next/server';
import {NotificationType,SupportAuthor,SupportStatus} from '@prisma/client';
import {z,ZodError} from 'zod';
import {requireAdmin} from '@/lib/auth';
import {db} from '@/lib/db';
import {jsonSafe} from '@/lib/serializers';
import {createNotification} from '@/lib/notifications';

const schema=z.discriminatedUnion('action',[
	z.object({action:z.literal('reply'),conversationId:z.string().min(1),message:z.string().trim().min(1).max(4000)}),
	z.object({action:z.literal('resolve'),conversationId:z.string().min(1)}),
]);

export async function GET(){
	try{
		await requireAdmin();
		const conversations=await db.supportConversation.findMany({include:{user:{select:{id:true,email:true,name:true}},transaction:{select:{id:true,type:true,accountMode:true,status:true,amount:true,currency:true}},messages:{orderBy:{createdAt:'desc'},take:5,select:{id:true,authorType:true,body:true,createdAt:true}}},orderBy:{lastMessageAt:'desc'},take:200});
		return NextResponse.json(jsonSafe(conversations.map(({attachmentKey,...conversation})=>({...conversation,hasAttachment:!!attachmentKey}))),{headers:{'Cache-Control':'private, no-store'}});
	}catch{
		return NextResponse.json({error:'Forbidden'},{status:403});
	}
}

export async function PATCH(req:Request){
	try{
		const admin=await requireAdmin();
		const input=schema.parse(await req.json());
		const result=await db.$transaction(async tx=>{
			const conversation=await tx.supportConversation.findUnique({where:{id:input.conversationId}});
			if(!conversation)throw new Error('CONVERSATION_NOT_FOUND');
			if(input.action==='resolve'){
				if(conversation.status===SupportStatus.RESOLVED)return conversation;
				const updated=await tx.supportConversation.update({where:{id:conversation.id},data:{status:SupportStatus.RESOLVED}});
				await tx.auditLog.create({data:{actorId:admin.id,action:'SUPPORT_RESOLVED',entity:'SUPPORT',entityId:conversation.id}});
				await createNotification(tx,{userId:conversation.userId,type:NotificationType.SUPPORT,title:'Support conversation resolved',message:`Your support conversation “${conversation.subject}” was marked resolved.`,dedupeKey:`support:${conversation.id}:resolved`,relatedEntity:'SUPPORT',relatedId:conversation.id,actionUrl:'/support'});
				return updated;
			}
			const message=await tx.supportMessage.create({data:{conversationId:conversation.id,authorType:SupportAuthor.ADMIN,authorId:admin.id,body:input.message}});
			const updated=await tx.supportConversation.update({where:{id:conversation.id},data:{status:SupportStatus.AWAITING_USER,lastMessageAt:new Date()}});
			await tx.auditLog.create({data:{actorId:admin.id,action:'SUPPORT_RESPONSE',entity:'SUPPORT',entityId:conversation.id}});
			await createNotification(tx,{userId:conversation.userId,type:NotificationType.SUPPORT,title:'Admin replied to your support ticket',message:`An administrator replied to “${conversation.subject}”.`,dedupeKey:`support:${conversation.id}:message:${message.id}`,relatedEntity:'SUPPORT',relatedId:conversation.id,actionUrl:'/support'});
			return updated;
		});
		return NextResponse.json(jsonSafe(result));
	}catch(error){
		if(error instanceof ZodError)return NextResponse.json({error:'Invalid support response.'},{status:400});
		if(error instanceof Error&&error.message==='CONVERSATION_NOT_FOUND')return NextResponse.json({error:'Conversation not found.'},{status:404});
		return NextResponse.json({error:'Unable to update the support conversation.'},{status:400});
	}
}