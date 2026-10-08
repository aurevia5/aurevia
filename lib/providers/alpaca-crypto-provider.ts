import type {ExecutionProvider,ProviderBalance,ProviderOrder,ProviderOrderRequest,ProviderOrderState,ProviderPosition,ProviderReconciliation,SignedProviderWebhook} from './contracts';
import {getServerConfiguration} from '@/lib/config/env';
import {verifyHmacSha256} from './registry';

export type AlpacaCryptoClientOptions={
	baseUrl:string;
	clientId:string;
	clientSecret:string;
	accountId:string;
	fetcher?:typeof fetch;
};

type AlpacaOrderResponse={
	id?:string;
	client_order_id?:string;
	asset_id?:string;
	symbol?:string;
	status?:string;
	filled_qty?:string;
	filled_at?:string|null;
	created_at?:string;
	updated_at?:string;
	qty?:string;
	filled_quantity?:string;
	order_type?:string;
};

type NormalizedAlpacaOrder={
	id:string;
	clientOrderId:string;
	status:string;
	createdAt:string;
	updatedAt:string;
};

function assertSandbox(baseUrl:string){
	try{
		const host=new URL(baseUrl).hostname;
		if(!host.endsWith('.sandbox.alpaca.markets')&&!host.endsWith('.sandbox.alpaca.markets')&&host!=='broker-api.sandbox.alpaca.markets')throw new Error('SANDBOX_ONLY');
	}catch{
		throw new Error('SANDBOX_ONLY');
	}
}

export function buildAlpacaCryptoClient(options:AlpacaCryptoClientOptions){
	assertSandbox(options.baseUrl);
	const fetcher=options.fetcher??fetch;
	const credentials=Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64');
	const request=async(path:string,init:RequestInit={}):Promise<unknown>=>{
		const response=await fetcher(`${options.baseUrl.replace(/\/$/, '')}${path}`,{
			...init,
			headers:{'authorization':`Basic ${credentials}`,'content-type':'application/json',...(init.headers??{})},
		});
		if(!response.ok)throw new Error(`ALPACA_CRYPTO_API_ERROR:${response.status}`);
		return response.json();
	};
	return {
		async submitOrder(input:{clientOrderId:string;assetId:string;symbol:string;side:'buy'|'sell';type:'market'|'limit'|'stop_limit';timeInForce:'gtc'|'ioc';qty:string;limitPrice?:string;stopPrice?:string}):Promise<NormalizedAlpacaOrder>{
			const body:{client_order_id:string;symbol:string;side:'buy'|'sell';type:string;time_in_force:string;qty:string;asset_id:string;limit_price?:string;stop_price?:string}={
				client_order_id:input.clientOrderId,
				symbol:input.symbol,
				asset_id:input.assetId,
				side:input.side,
				type:input.type,
				time_in_force:input.timeInForce,
				qty:input.qty,
			};
			if(input.limitPrice)body.limit_price=input.limitPrice;
			if(input.stopPrice)body.stop_price=input.stopPrice;
			const response=await request(`/v1/trading/accounts/${options.accountId}/orders`,{method:'POST',body:JSON.stringify(body)}) as AlpacaOrderResponse;
			return {id:response.id??'',clientOrderId:response.client_order_id??input.clientOrderId,status:response.status??'accepted',createdAt:response.created_at??new Date().toISOString(),updatedAt:response.updated_at??new Date().toISOString()};
		},
		async getOrder(orderId:string):Promise<NormalizedAlpacaOrder>{
			const response=await request(`/v1/trading/accounts/${options.accountId}/orders/${orderId}`) as AlpacaOrderResponse;
			return {id:response.id??'',clientOrderId:response.client_order_id??'',status:response.status??'accepted',createdAt:response.created_at??new Date().toISOString(),updatedAt:response.updated_at??new Date().toISOString()};
		},
		async cancelOrder(orderId:string):Promise<NormalizedAlpacaOrder>{
			const response=await request(`/v1/trading/accounts/${options.accountId}/orders/${orderId}`,{method:'DELETE'}) as AlpacaOrderResponse;
			return {id:response.id??'',clientOrderId:response.client_order_id??'',status:response.status??'cancelled',createdAt:response.created_at??new Date().toISOString(),updatedAt:response.updated_at??new Date().toISOString()};
		},
		async getOrders():Promise<NormalizedAlpacaOrder[]>{
			const data=await request(`/v1/trading/accounts/${options.accountId}/orders?status=all`) as {orders?:AlpacaOrderResponse[]};
			return (data.orders??[]).map(response=>({id:response.id??'',clientOrderId:response.client_order_id??'',status:response.status??'accepted',createdAt:response.created_at??new Date().toISOString(),updatedAt:response.updated_at??new Date().toISOString()}));
		},
	};
};

export type AlpacaCryptoProviderOptions=AlpacaCryptoClientOptions&{webhookSecret:string};

export class AlpacaCryptoProvider implements ExecutionProvider {
	readonly name='alpaca-crypto-sandbox';
	private readonly client:ReturnType<typeof buildAlpacaCryptoClient>;
	private readonly webhookSecret:string;
	constructor(options:AlpacaCryptoProviderOptions){
		this.client=buildAlpacaCryptoClient(options);
		this.webhookSecret=options.webhookSecret;
	}
	async healthCheck(){
		try{
			await this.client.getOrders();
			return {connected:true,checkedAt:new Date().toISOString()};
		}catch{
			return {connected:false,checkedAt:new Date().toISOString()};
		}
	}
	async submitOrder(request:ProviderOrderRequest,idempotencyKey:string):Promise<ProviderOrder>{
		const response=await this.client.submitOrder({
			clientOrderId:request.clientOrderId,
			assetId:request.assetId??'',
			symbol:request.symbol,
			side:request.side==='BUY'?'buy':'sell',
			type:request.type==='MARKET'?'market':request.type==='LIMIT'?'limit':'stop_limit',
			timeInForce:request.timeInForce??'gtc',
			qty:request.quantity,
			limitPrice:request.limitPrice,
			stopPrice:request.stopPrice,
		});
		return normalizeOrder(response,idempotencyKey);
	}
	async cancelOrder(providerOrderId:string,idempotencyKey:string):Promise<ProviderOrder>{
		return normalizeOrder(await this.client.cancelOrder(providerOrderId),idempotencyKey);
	}
	async getOrderStatus(providerOrderId:string):Promise<ProviderOrder>{
		return normalizeOrder(await this.client.getOrder(providerOrderId),'status');
	}
	async getPositions(accountId:string):Promise<ProviderPosition[]>{
		throw new Error('CRYPTO_POSITION_RECONCILIATION_NOT_IMPLEMENTED');
	}
	async getBalances(accountId:string):Promise<ProviderBalance[]>{
		throw new Error('CRYPTO_BALANCE_RECONCILIATION_NOT_IMPLEMENTED');
	}
	async reconcile(accountId:string):Promise<ProviderReconciliation>{
		throw new Error('CRYPTO_RECONCILIATION_NOT_IMPLEMENTED');
	}
	verifyWebhook(rawBody:string,signature:string){return Promise.resolve(verifyHmacSha256(rawBody,signature,this.webhookSecret))}
	parseWebhook(rawBody:string):Promise<SignedProviderWebhook>{return Promise.resolve({eventId:'',eventType:'',providerOrderId:'',occurredAt:new Date().toISOString()})}
}

function normalizeOrder(response:NormalizedAlpacaOrder,idempotencyKey:string):ProviderOrder{
	return {
		providerOrderId:response.id,
		clientOrderId:response.clientOrderId||idempotencyKey,
		state:normalizeState(response.status),
		acceptedAt:response.createdAt,
		updatedAt:response.updatedAt,
		executions:[],
	};
}

function normalizeState(value:string|undefined):ProviderOrderState{
	const status=value?.toLowerCase();
	if(status==='accepted'||status==='pending')return 'ACCEPTED';
	if(status==='partially_filled')return 'PARTIALLY_FILLED';
	if(status==='filled')return 'FILLED';
	if(status==='rejected'||status==='invalid')return 'REJECTED';
	if(status==='canceled'||status==='cancelled')return 'CANCELLED';
	return 'ACCEPTED';
}

export function createAlpacaCryptoProviderFromEnvironment(){
	const config=getServerConfiguration().execution;
	if(!config.realEnabled||!config.alpacaConfigured||!config.provider||!config.alpacaBaseUrl||!config.alpacaClientId||!config.alpacaClientSecret||!config.brokerAccountId)return null;
	return new AlpacaCryptoProvider({
		baseUrl:config.alpacaBaseUrl,
		clientId:config.alpacaClientId,
		clientSecret:config.alpacaClientSecret,
		accountId:config.brokerAccountId,
		webhookSecret:config.brokerWebhookSecret,
	});
}
