import {createHmac,timingSafeEqual} from 'node:crypto';
import type {ExecutionProvider,ProviderConnectionState} from './contracts';

const requiredBrokerVariables=['BROKER_PROVIDER','BROKER_API_URL','BROKER_API_KEY','BROKER_ACCOUNT_ID','BROKER_WEBHOOK_SECRET'] as const;
let executionProvider:ExecutionProvider|null=null;

export function getExecutionProvider(){return executionProvider;}

export function registerExecutionProvider(provider:ExecutionProvider){
	if(executionProvider)throw new Error('EXECUTION_PROVIDER_ALREADY_REGISTERED');
	executionProvider=provider;
}

export async function getExecutionProviderStatus(){
	const configuredVariables=Object.fromEntries(requiredBrokerVariables.map(name=>[name,Boolean(process.env[name]?.trim())]));
	const missingConfiguration=requiredBrokerVariables.filter(name=>!configuredVariables[name]);
	const enabled=process.env.REAL_EXECUTION_ENABLED==='true';
	let state:ProviderConnectionState='DISABLED';
	if(enabled){
		if(missingConfiguration.length)state='NOT_CONFIGURED';
		else if(!executionProvider)state='CONFIGURED';
		else{
			try{state=(await executionProvider.healthCheck()).connected?'CONNECTED':'ERROR'}
			catch{state='ERROR'}
		}
	}
	return {
		state,
		enabled,
		providerName:process.env.BROKER_PROVIDER?.trim()||null,
		adapterRegistered:!!executionProvider,
		configuredVariables,
		missingConfiguration,
		checkedAt:new Date().toISOString(),
	};
}

export function verifyHmacSha256(rawBody:string,signature:string,secret:string){
	const supplied=signature.startsWith('sha256=')?signature.slice(7):signature;
	if(!/^[a-fA-F0-9]{64}$/.test(supplied)||!secret)return false;
	const expected=createHmac('sha256',secret).update(rawBody,'utf8').digest();
	const actual=Buffer.from(supplied,'hex');
	return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

export async function getExecutionProviderOrThrow(){
	const status=await getExecutionProviderStatus();
	if(status.state!=='CONNECTED'||!executionProvider)throw new Error('REAL_EXECUTION_UNAVAILABLE');
	return executionProvider;
}
