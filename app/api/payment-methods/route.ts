import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {jsonSafe} from '@/lib/serializers';

export async function GET(){
	try{
		const user=await requireUser();
		const demo=user.accountMode==='DEMO';
		const methods=await db.paymentMethod.findMany({where:{enabled:true,demoOnly:demo},orderBy:{displayOrder:'asc'},select:{id:true,name:true,currencies:true,destination:true,instructions:true,minimumAmount:true,maximumAmount:true,depositEnabled:true,withdrawalEnabled:true,requiresNetwork:true,demoOnly:true}});
		return NextResponse.json(jsonSafe(methods.map(method=>demo?{...method,destination:null,instructions:'Demo request only. Do not send real funds. Any demo balance change requires administrator review.'}:method)));
	}catch{
		return NextResponse.json({error:'Unauthorized'},{status:401});
	}
}