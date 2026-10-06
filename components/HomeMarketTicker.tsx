'use client';

import {useEffect,useState} from 'react';
import {io} from 'socket.io-client';

type TickerItem={id:string;symbol:string;price:number;change?:number};

export default function HomeMarketTicker(){
  const [items,setItems]=useState<TickerItem[]>([]);
  const [status,setStatus]=useState<'loading'|'ready'|'unavailable'>('loading');

  useEffect(()=>{
    let active=true;
    fetch('/api/market').then(async response=>{
      if(!response.ok)throw new Error('Market feed unavailable');
      return response.json();
    }).then((data:TickerItem[])=>{
      if(!active)return;
      setItems(data.slice(0,6).map(item=>({...item,price:Number(item.price)})));
      setStatus('ready');
    }).catch(()=>{if(active)setStatus('unavailable')});
    const socket=io();
    const onUpdate=(updates:TickerItem[])=>setItems(current=>current.map(item=>{
      const update=updates.find(candidate=>candidate.symbol===item.symbol);
      return update?{...item,price:Number(update.price),change:update.change}:item;
    }));
    socket.on('market:update',onUpdate);
    return()=>{active=false;socket.off('market:update',onUpdate);socket.disconnect()};
  },[]);

  return <div className="ticker-scroll"><div className="ticker-items">
    {items.map(item=><div className="ticker-item" key={item.id}><span>{item.symbol}</span><b>{item.price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:item.price<10?4:2})}</b><i className={item.change===undefined?'':item.change>=0?'ticker-positive':'ticker-negative'}>{item.change===undefined?'—':`${item.change>=0?'+':''}${(item.change*100).toFixed(2)}%`}</i></div>)}
    {!items.length&&<span className="ticker-empty">{status==='loading'?'Loading demo instruments':status==='unavailable'?'Demo market feed unavailable':'No demo instruments configured'}</span>}
  </div></div>;
}