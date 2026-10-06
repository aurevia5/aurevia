import {randomBytes,randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {loadEnvConfig} from '@next/env';
import {AccountMode,EntryType,PrismaClient,Role,UserStatus,NotificationType} from '@prisma/client';
import bcrypt from 'bcryptjs';

export default async function globalSetup(){
	loadEnvConfig(process.cwd());
	const databaseUrl=process.env.DATABASE_URL;
	if(!databaseUrl)throw new Error('Playwright E2E requires an isolated local DATABASE_URL.');
	const databaseHost=new URL(databaseUrl).hostname;
	if(!['localhost','127.0.0.1','::1'].includes(databaseHost))throw new Error('Refusing to create Playwright fixtures in a non-local database.');

	const db=new PrismaClient();
	const runId=randomUUID();
	const userId=`e2e-user-${runId}`;
	const adminId=`e2e-admin-${runId}`;
	const legacyUserId=`e2e-legacy-user-${runId}`;
	const userEmail=`aurevia-e2e-${runId}@example.invalid`;
	const adminEmail=`aurevia-e2e-admin-${runId}@example.invalid`;
	const legacyUserEmail=`aurevia-e2e-legacy-${runId}@example.invalid`;
	const userPassword=`Aa1!${randomBytes(20).toString('hex')}`;
	const adminPassword=`Aa1!${randomBytes(20).toString('hex')}`;
	const legacyUserPassword=`Aa1!${randomBytes(20).toString('hex')}`;
	const registrationEmail=`aurevia-e2e-registration-${runId}@example.invalid`;
	const registrationPassword=`Aa1!${randomBytes(20).toString('hex')}`;
	const userAccountCode=`USER:${userId}:DEMO:USD`;
	const systemAccountCode=`SYSTEM:E2E:${runId}:USD`;
	const seedReference=`E2E:SEED:${runId}`;
	const symbols=[`E2E${runId.slice(0,6).toUpperCase()}A/USD`,`E2E${runId.slice(0,6).toUpperCase()}B/USD`];
	const instrumentIds:string[]=[];
	const stateFile=process.env.AUREVIA_E2E_STATE_FILE;
	if(!stateFile)throw new Error('Playwright E2E state file was not configured.');

	const state={runId,userId,adminId,legacyUserId,userEmail,adminEmail,legacyUserEmail,userPassword,adminPassword,legacyUserPassword,registrationEmail,registrationPassword,userAccountCode,systemAccountCode,seedReference,instrumentIds,symbols};
	process.env.AUREVIA_E2E_USER_EMAIL=userEmail;
	process.env.AUREVIA_E2E_USER_PASSWORD=userPassword;
	process.env.AUREVIA_E2E_ADMIN_EMAIL=adminEmail;
	process.env.AUREVIA_E2E_ADMIN_PASSWORD=adminPassword;
	process.env.AUREVIA_E2E_LEGACY_USER_EMAIL=legacyUserEmail;
	process.env.AUREVIA_E2E_LEGACY_USER_PASSWORD=legacyUserPassword;
	process.env.AUREVIA_E2E_REGISTRATION_EMAIL=registrationEmail;
	process.env.AUREVIA_E2E_REGISTRATION_PASSWORD=registrationPassword;
	process.env.AUREVIA_E2E_INSTRUMENT_A=symbols[0];
	process.env.AUREVIA_E2E_INSTRUMENT_B=symbols[1];

	try{
		await db.user.create({data:{id:userId,email:userEmail,name:'Temporary E2E User',country:'Test',passwordHash:await bcrypt.hash(userPassword,10),accountMode:AccountMode.DEMO,status:UserStatus.ACTIVE,verifiedAt:new Date()}});
		await db.user.create({data:{id:adminId,email:adminEmail,name:'Temporary E2E Administrator',country:'Test',passwordHash:await bcrypt.hash(adminPassword,10),role:Role.ADMIN,accountMode:AccountMode.DEMO,status:UserStatus.ACTIVE,verifiedAt:new Date()}});
		await db.user.create({data:{id:legacyUserId,email:legacyUserEmail,name:'Legacy E2E User',country:'Test',passwordHash:await bcrypt.hash(legacyUserPassword,10),accountMode:AccountMode.DEMO,status:UserStatus.ACTIVE}});
		const instruments=await Promise.all(symbols.map((symbol,index)=>db.instrument.create({data:{symbol,name:`E2E simulated instrument ${index+1}`,baseAsset:`E2E${index+1}`,quoteAsset:'USD',price:index===0?10:20,enabled:true}})));
		instrumentIds.push(...instruments.map(instrument=>instrument.id));
		await db.$transaction(async tx=>{
			const userAccount=await tx.ledgerAccount.create({data:{userId,accountMode:AccountMode.DEMO,code:userAccountCode,name:'Disposable E2E demo account',currency:'USD'}});
			const systemAccount=await tx.ledgerAccount.create({data:{accountMode:AccountMode.DEMO,code:systemAccountCode,name:'Disposable E2E demo source',currency:'USD'}});
			await tx.ledgerTransaction.create({data:{reference:seedReference,description:'Temporary Playwright DEMO-only fixture',entries:{create:[{accountId:systemAccount.id,type:EntryType.DEBIT,amount:1000},{accountId:userAccount.id,type:EntryType.CREDIT,amount:1000}]}}});
			for(const [index,title] of ['E2E unread notification one','E2E unread notification two'].entries()){
				await tx.notification.create({data:{userId,type:NotificationType.SYSTEM,title,message:'Disposable Playwright notification fixture.',dedupeKey:`e2e:${runId}:notification:${index}`}});
			}
		});
		const cleanupState={runId,userId,adminId,legacyUserId,registrationEmail,userAccountCode,systemAccountCode,seedReference,instrumentIds};
		await writeFile(stateFile,JSON.stringify(cleanupState),{encoding:'utf8',mode:0o600});
	}catch(error){
		await cleanup(db,state).catch(()=>undefined);
		throw error;
	}finally{
		await db.$disconnect();
	}
}

export async function cleanup(db:PrismaClient,state:{userId:string;adminId:string;legacyUserId?:string;registrationEmail?:string;userAccountCode:string;systemAccountCode:string;instrumentIds:string[];seedReference:string}){
	const registeredUser=state.registrationEmail?await db.user.findUnique({where:{email:state.registrationEmail},select:{id:true}}):null;
	const userIds=[state.userId,state.adminId,...(state.legacyUserId?[state.legacyUserId]:[]),...(registeredUser?[registeredUser.id]:[])];
	const accounts=await db.ledgerAccount.findMany({where:{OR:[{userId:{in:userIds}},{code:state.systemAccountCode}]},select:{id:true}});
	const accountIds=accounts.map(account=>account.id);
	if(accountIds.length){
		await db.ledgerTransaction.deleteMany({where:{entries:{some:{accountId:{in:accountIds}}}}});
		await db.ledgerEntry.deleteMany({where:{accountId:{in:accountIds}}});
		await db.ledgerAccount.deleteMany({where:{id:{in:accountIds}}});
	}
	await db.ledgerTransaction.deleteMany({where:{reference:state.seedReference}});
	await db.user.deleteMany({where:{id:{in:userIds}}});
	if(state.instrumentIds.length)await db.instrument.deleteMany({where:{id:{in:state.instrumentIds}}});
}
