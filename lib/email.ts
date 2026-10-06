import nodemailer from 'nodemailer';

export type EmailDelivery={sent:boolean;reason?:'not-configured'|'failed'};

let warnedAboutConfiguration=false;

export function isSmtpConfigured(){
	const port=Number(process.env.SMTP_PORT||587);
	return !!process.env.SMTP_HOST?.trim()&&!!process.env.SMTP_USER?.trim()&&!!process.env.SMTP_PASSWORD&&!!process.env.SMTP_FROM?.trim()&&Number.isInteger(port)&&port>0&&port<=65535;
}

function createTransport(){
	const host=process.env.SMTP_HOST?.trim();
	const user=process.env.SMTP_USER?.trim();
	const password=process.env.SMTP_PASSWORD;
	const port=Number(process.env.SMTP_PORT||587);
	const from=process.env.SMTP_FROM?.trim();
	if(!host||!user||!password||!from||!isSmtpConfigured()){
		if(!warnedAboutConfiguration){console.warn('SMTP delivery is not configured; no email was sent.');warnedAboutConfiguration=true;}
		return null;
	}
	return {transport:nodemailer.createTransport({host,port,secure:port===465,requireTLS:port!==465,auth:{user,pass:password}}),from};
}

export async function sendEmail(input:{to:string;subject:string;text:string}):Promise<EmailDelivery>{
	const configuration=createTransport();
	if(!configuration)return {sent:false,reason:'not-configured'};
	try{
		await configuration.transport.sendMail({from:configuration.from,to:input.to,subject:input.subject.replace(/[\r\n]+/g,' ').slice(0,200),text:input.text});
		return {sent:true};
	}catch(error){
		const code=error&&typeof error==='object'&&'code' in error?String(error.code):'SMTP_ERROR';
		console.error(`SMTP delivery failed (${/^[A-Z0-9_]{2,32}$/.test(code)?code:'SMTP_ERROR'}).`);
		return {sent:false,reason:'failed'};
	}
}

export function sendSupportEmail(subject:string,text:string){
	const recipient=process.env.SUPPORT_EMAIL?.trim();
	if(!recipient){console.warn('Support email was not sent: SUPPORT_EMAIL is not configured.');return Promise.resolve<EmailDelivery>({sent:false,reason:'not-configured'});}
	return sendEmail({to:recipient,subject,text});
}

export function sendComplaintEmail(subject:string,text:string){
	const recipient=process.env.COMPLAINTS_EMAIL?.trim();
	if(!recipient){console.warn('Complaint email was not sent: COMPLAINTS_EMAIL is not configured.');return Promise.resolve<EmailDelivery>({sent:false,reason:'not-configured'});}
	return sendEmail({to:recipient,subject,text});
}