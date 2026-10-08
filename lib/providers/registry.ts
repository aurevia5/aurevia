import {createHmac,timingSafeEqual} from 'node:crypto';
import type {ExecutionProvider,ProviderConnectionState} from './contracts';
import {getServerConfiguration} from '@/lib/config/env';

let executionProvider:ExecutionProvider|null=null;

export function getExecutionProvider(){return executionProvider;}

export function registerExecutionProvider(provider:ExecutionProvider){
	if(executionProvider)throw new Error('EXECUTION_PROVIDER_ALREADY_REGISTERED');
	executionProvider=provider;
}

export async function getExecutionProviderStatus(){
	const config=getServerConfiguration().execution;
	const configuredVariables={
		BROKER_PROVIDER:Boolean(config.provider),
		BROKER_API_URL:Boolean(config.brokerApiUrl),
		BROKER_API_KEY:Boolean(config.brokerApiKey),
		BROKER_ACCOUNT_ID:Boolean(config.brokerAccountId),
		BROKER_WEBHOOK_SECRET:Boolean(config.brokerWebhookSecret),
		ALPACA_BROKER_BASE_URL:Boolean(config.alpacaBaseUrl),
		ALPACA_BROKER_CLIENT_ID:Boolean(config.alpacaClientId),
		ALPACA_BROKER_CLIENT_SECRET:Boolean(config.alpacaClientSecret),
	};
	const missingConfiguration=Object.entries(configuredVariables).filter(([,configured])=>!configured).map(([name])=>name);
	let state:ProviderConnectionState='DISABLED';
	if(config.realEnabled){
		if(missingConfiguration.length)state='NOT_CONFIGURED';
		else if(!executionProvider)state='CONFIGURED';
		else{
			try{state=(await executionProvider.healthCheck()).connected?'CONNECTED':'ERROR'}
			catch{state='ERROR'}
		}
	}
	return {
		state,
		enabled:config.realEnabled,
		providerName:config.provider,
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
