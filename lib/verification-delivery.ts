import {randomInt,createHmac,timingSafeEqual} from 'node:crypto';
import {VerificationChannel} from '@prisma/client';
import {verificationConfig} from './config';

type Contact={email:string;phone:string|null;name:string|null};

function provider(channel:VerificationChannel){
	const prefix=channel==='EMAIL'?'VERIFICATION_EMAIL':'VERIFICATION_SMS';
	const url=process.env[`${prefix}_API_URL`];
	const key=process.env[`${prefix}_API_KEY`];
	if(!url||!key)return null;
	try{
		const parsed=new URL(url);
		const host=parsed.hostname.replace(/^\[|\]$/g,'').toLowerCase();
		const isLoopback=['localhost','127.0.0.1','::1'].includes(host);
		const localTestHttp=parsed.protocol==='http:'&&isLoopback&&process.env.AUREVIA_E2E_ALLOW_HTTP_PROVIDER==='1';
		if((parsed.protocol!=='https:'&&!localTestHttp)||parsed.username||parsed.password)return null;
		return {url:parsed.toString(),key};
	}catch{
		return null;
	}
}

export function hasConfiguredVerificationProvider(){
	return Boolean(provider(VerificationChannel.EMAIL)||provider(VerificationChannel.SMS));
}

export function availableVerificationChannel(phone:string|null){
	if(provider(VerificationChannel.EMAIL))return VerificationChannel.EMAIL;
	if(phone&&provider(VerificationChannel.SMS))return VerificationChannel.SMS;
	return null;
}

export function registrationVerificationChannel(phone:string|null,phoneRequired=process.env.PHONE_VERIFICATION_REQUIRED==='true'){
	if(phoneRequired)return phone&&provider(VerificationChannel.SMS)?VerificationChannel.SMS:null;
	return provider(VerificationChannel.EMAIL)?VerificationChannel.EMAIL:null;
}

export function generateVerificationCode(){
	return randomInt(100000,1000000).toString();
}

export function hashVerificationCode(userId:string,code:string){
	const secret=process.env.VERIFICATION_CODE_SECRET||process.env.NEXTAUTH_SECRET;
	if(!secret)throw new Error('VERIFICATION_SECRET_UNAVAILABLE');
	return createHmac('sha256',secret).update(`${userId}:${code}`).digest('hex');
}

export function verificationCodeMatches(userId:string,code:string,hash:string){
	const actual=Buffer.from(hashVerificationCode(userId,code),'hex');
	const expected=Buffer.from(hash,'hex');
	return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

export async function deliverVerificationCode(channel:VerificationChannel,contact:Contact,code:string){
	const configured=provider(channel);
	if(!configured)return false;
	const destination=channel===VerificationChannel.EMAIL?contact.email:contact.phone;
	if(!destination)return false;
	const subject='Verify your Aurevia Invest account';
	const text=`Your Aurevia Invest verification code is ${code}. It expires in ${verificationConfig.expiresInMinutes} minutes. If you did not request it, you can ignore this message.`;
	try{
		const response=await fetch(configured.url,{method:'POST',headers:{authorization:`Bearer ${configured.key}`,'content-type':'application/json'},body:JSON.stringify({channel:channel.toLowerCase(),to:destination,name:contact.name,subject,text}),signal:AbortSignal.timeout(8000)});
		return response.ok;
	}catch{
		return false;
	}
}