import type {MarketBar,MarketQuote} from './contracts';

export type AlpacaCryptoMarketDataOptions={baseUrl:string;apiKey:string;fetcher?:typeof fetch};

export class AlpacaCryptoMarketDataProvider {
	readonly name='alpaca-crypto-market-data';
	private readonly options:AlpacaCryptoMarketDataOptions;
	constructor(options:AlpacaCryptoMarketDataOptions){this.options=options}
	async getQuote(symbol:string):Promise<MarketQuote>{
		const response=await this.request(`/v1beta3/crypto/us/latest/quotes?symbols=${encodeURIComponent(symbol)}`);
		const item=Array.isArray(response)&&response[0] ? response[0] : response;
		return {symbol,price:Number(item.price??item.bid??0),bid:Number(item.bid??null),ask:Number(item.ask??null),open:Number(item.open??null),high:Number(item.high??null),low:Number(item.low??null),previousClose:Number(item.previous_close??null),volume:Number(item.volume??null),marketStatus:'OPEN',source:this.name,asOf:new Date().toISOString()};
	}
	async getBars(symbol:string,from:string,to:string,interval:string):Promise<MarketBar[]>{
		const response=await this.request(`/v1beta3/crypto/us/historical/bars?symbols=${encodeURIComponent(symbol)}&start=${encodeURIComponent(from)}&end=${encodeURIComponent(to)}&timeframe=${encodeURIComponent(interval)}`);
		return (Array.isArray(response)?response:[]).map((item:any)=>({time:String(item.timestamp??item.time),open:Number(item.open),high:Number(item.high),low:Number(item.low),close:Number(item.close),volume:Number(item.volume??0)}));
	}
	async healthCheck(){return {connected:true,checkedAt:new Date().toISOString()}}
	private async request(path:string){
		const response=await (this.options.fetcher??fetch)(`${this.options.baseUrl.replace(/\/$/,'')}${path}`,{headers:{'x-api-key':this.options.apiKey}});
		if(!response.ok)throw new Error(`ALPACA_MARKET_DATA_ERROR:${response.status}`);
		return response.json();
	}
}
