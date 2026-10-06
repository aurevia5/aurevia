import {afterEach,describe,expect,it,vi} from 'vitest';
import {getMarketAsset,getMarketHistory,getMarketQuote,MarketDataError} from '../lib/live-market';

function chartResponse(price=41000){
	const now=Math.floor(Date.now()/1000);
	return {
		chart:{result:[{
			meta:{regularMarketPrice:price,chartPreviousClose:40000,regularMarketChange:price-40000,regularMarketChangePercent:(price/40000-1)*100,regularMarketOpen:40500,regularMarketTime:now,fiftyTwoWeekLow:25000,fiftyTwoWeekHigh:60000,currency:'USD'},
			timestamp:[now-60,now],
			indicators:{quote:[{open:[40000,40500],high:[40500,41500],low:[39900,40400],close:[40400,price],volume:[12,34]}]},
		}],error:null},
	};
}

afterEach(()=>vi.unstubAllGlobals());

describe('live Yahoo market service',()=>{
	it('parses a live quote and history candles from provider OHLCV',async()=>{
		const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(chartResponse()),{status:200,headers:{'content-type':'application/json'}}));
		vi.stubGlobal('fetch',fetcher);
		const asset=getMarketAsset('DJI')!;
		const quote=await getMarketQuote(asset);
		expect(quote.price).toBe(41000);
		expect(quote.change).toBe(1000);
		expect(quote.changePercent).toBe(2.5);
		expect(quote.fiftyTwoWeekLow).toBe(25000);
		const history=await getMarketHistory(asset,'1d');
		expect(history.candles).toHaveLength(2);
		expect(history.candles[1]).toMatchObject({open:40500,high:41500,low:40400,close:41000,volume:34});
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('maps provider throttling to a retryable service error',async()=>{
		vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:429})));
		await expect(getMarketQuote(getMarketAsset('MERV')!)).rejects.toMatchObject({status:503});
	});

	it('rejects unknown symbols at lookup',()=>{
		expect(getMarketAsset('NOT-A-REAL-SYMBOL')).toBeUndefined();
	});
});