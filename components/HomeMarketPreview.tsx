'use client';

import {useEffect,useState} from 'react';
import {io} from 'socket.io-client';
import PriceChart from '@/components/PriceChart';

type MarketItem={id:string;symbol:string;name:string;price:number;change?:number};

export default function HomeMarketPreview(){
  const [markets,setMarkets]=useState<MarketItem[]>([]);
  const [selected,setSelected]=useState('');
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');

  useEffect(()=>{
    let active=true;
    fetch('/api/market')
      .then(async response=>{
        if(!response.ok)throw new Error('Market data unavailable');
        return response.json();
      })
      .then((data:MarketItem[])=>{
        if(!active)return;
        const normalized=data.map(item=>({...item,price:Number(item.price)}));
        setMarkets(normalized);
        setSelected(normalized.find(item=>item.symbol==='BTC/USD')?.id||normalized[0]?.id||'');
        setStatus('ready');
      })
      .catch(()=>{if(active)setStatus('error')});

    const socket=io();
    const onUpdate=(updates:MarketItem[])=>setMarkets(current=>current.map(item=>{
      const update=updates.find(candidate=>candidate.symbol===item.symbol);
      return update?{...item,price:Number(update.price),change:update.change}:item;
    }));
    socket.on('market:update',onUpdate);
    return()=>{active=false;socket.off('market:update',onUpdate);socket.disconnect()};
  },[]);

  const current=markets.find(item=>item.id===selected);
  const visibleMarkets=markets.slice(0,4);

  return <div className="market-stage" aria-label="Simulated market preview">
    <div className="market-stage-top">
      <div className="market-source"><span className="source-dot"/>Demo environment <span>Simulated market data</span></div>
      <span className="market-time">MARKET VIEW <b>01</b></span>
    </div>
    <div className="market-stage-instrument">
      <div>
        <p className="eyebrow">Selected instrument</p>
        <h2>{current?.symbol||'Market overview'}</h2>
      </div>
      <div className="market-stage-price" aria-live="polite">
        {current?current.price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:current.price<10?4:2}):status==='error'?'Unavailable':'Loading'}
        <small>Latest simulated price · USD</small>
      </div>
    </div>
    <div className="market-stage-chart">
      {current?<PriceChart price={current.price}/>:<div className="market-chart-empty" role="status">{status==='error'?'Market data is unavailable right now':'Loading demo market data'}</div>}
      <div className="chart-axis-labels"><span>DEMO PRICE</span><span>MARKET FEED</span></div>
    </div>
    <div className="market-stage-footer">
      <div className="market-pair-list" aria-label="Available demo instruments">
        {visibleMarkets.map(item=><button key={item.id} type="button" className={item.id===selected?'is-selected':''} aria-pressed={item.id===selected} onClick={()=>setSelected(item.id)}>
          <span>{item.symbol}</span><b>{item.price.toLocaleString(undefined,{maximumFractionDigits:4})}</b>
        </button>)}
        {!visibleMarkets.length&&<span className="muted">No demo instruments available</span>}
      </div>
      <span className="market-feed-status">{status==='ready'?'SIMULATED FEED':'FEED '+status.toUpperCase()}</span>
    </div>
  </div>;
}