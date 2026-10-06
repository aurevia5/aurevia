import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {createPrivateSignedUrl,PrivateStorageError} from '@/lib/private-storage';

export async function GET(_request:Request,{params}:{params:{id:string}}){
	try{
		const user=await requireUser();
		const conversation=await db.supportConversation.findFirst({where:{id:params.id,userId:user.id,accountMode:user.accountMode},select:{attachmentKey:true}});
		if(!conversation)return NextResponse.json({error:'Support ticket not found.'},{status:404});
		if(!conversation.attachmentKey)return NextResponse.json({error:'No attachment is included.'},{status:404});
		return NextResponse.json({url:await createPrivateSignedUrl(conversation.attachmentKey)},{headers:{'Cache-Control':'private, no-store'}});
	}catch(error){
		if(error instanceof Error&&error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
		if(error instanceof PrivateStorageError)return NextResponse.json({error:error.message},{status:error.status});
		return NextResponse.json({error:'Attachment is unavailable.'},{status:503});
	}
}