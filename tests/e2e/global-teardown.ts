import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFile,unlink} from 'node:fs/promises';
import {PrismaClient} from '@prisma/client';
import {cleanup} from './global-setup';

type State={userId:string;adminId:string;legacyUserId:string;investorId:string;registrationEmail:string;instrumentIds:string[];paymentMethodId?:string};

export default async function globalTeardown(){
	const stateFile=join(tmpdir(),'aurevia-e2e-state.json');
	let state:State;
	try{state=JSON.parse(await readFile(stateFile,'utf8')) as State}
	catch{return}
	const db=new PrismaClient();
	try{await cleanup(db,state)}
	finally{
		await db.$disconnect();
		await unlink(stateFile).catch(()=>undefined);
	}
}
