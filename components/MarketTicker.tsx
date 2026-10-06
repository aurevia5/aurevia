'use client';

import {useEffect,useState} from 'react';
import {io} from 'socket.io-client';

type MarketTickerItem={symbol:string;price:number;change?:number};

export default function MarketTicker({initial}:{initial:MarketTickerItem[]}){
	const [markets,setMarkets]=useState(initial);
	useEffect(()=>{
		const socket=io();
		const onUpdate=(updates:MarketTickerItem[])=>setMarkets(updates);
		socket.on('market:update',onUpdate);
		return()=>{socket.off('market:update',onUpdate);socket.disconnect()};
	},[]);
	return <div className="market-ticker-track" aria-label="Configured simulated market instruments">{markets.map(market=><article key={market.symbol} className="market-ticker-card"><div className="market-ticker-head"><span>{market.symbol}</span><small>SIM</small></div><b>{market.price.toLocaleString(undefined,{maximumFractionDigits:4})}</b>{market.change===undefined?<span className="market-ticker-source">Simulated price</span>:<span className={`market-ticker-change ${market.change>=0?'is-up':'is-down'}`}>Last tick {market.change>=0?'+':''}{(market.change*100).toFixed(2)}%</span>}</article>)}</div>;
}
