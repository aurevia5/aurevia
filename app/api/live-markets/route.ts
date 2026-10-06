import {NextResponse} from 'next/server';
import {getMarketAsset,getMarketQuote,MARKET_ASSETS,MarketDataError} from '@/lib/live-market';

export const dynamic='force-dynamic';
export const revalidate=0;

export async function GET(request:Request){
  const parameters=new URL(request.url).searchParams;
  const requested=(parameters.get('symbols')||'DJI,SPX,NASDAQ,SP100,NDX,DAX,IBEX,NIKKEI,BTC,EURGBP').split(',').map(value=>value.trim().toUpperCase()).filter(Boolean).slice(0,20);
  const assets=requested.length?requested.map(getMarketAsset):MARKET_ASSETS.slice(0,10);
  if(assets.some(asset=>!asset))return NextResponse.json({error:'One or more symbols are unsupported.'},{status:400});
  const quotes=await Promise.all(assets.map(async asset=>{
    try{return await getMarketQuote(asset!)}
    catch(error){return {asset:asset!,error:error instanceof MarketDataError?error.message:'Live quote unavailable.'}}
  }));
  return NextResponse.json({quotes,source:'Yahoo Finance'}, {headers:{'Cache-Control':'public, s-maxage=5, stale-while-revalidate=10'}});
}