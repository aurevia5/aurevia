'use client';

import {create} from 'zustand';
import {createJSONStorage,persist} from 'zustand/middleware';
import {DEFAULT_WATCHLIST} from '@/lib/live-market';

export type MarketWatchlist={id:string;name:string;symbols:string[]};

type MarketWatchlistState={
  watchlists:MarketWatchlist[];
  activeWatchlistId:string;
  selectedSymbol:string;
  setActiveWatchlist:(id:string)=>void;
  selectSymbol:(id:string)=>void;
  createWatchlist:(name:string)=>void;
  deleteActiveWatchlist:()=>void;
  addSymbol:(symbol:string)=>void;
  removeSymbol:(symbol:string)=>void;
  reorderSymbol:(from:string,to:string)=>void;
};

const initialWatchlist:MarketWatchlist={id:'market-default',name:'Mi lista de control',symbols:DEFAULT_WATCHLIST};

export const useMarketWatchlists=create<MarketWatchlistState>()(persist((set,get)=>({
  watchlists:[initialWatchlist],
  activeWatchlistId:initialWatchlist.id,
  selectedSymbol:'DJI',
  setActiveWatchlist:id=>set({activeWatchlistId:id}),
  selectSymbol:selectedSymbol=>set({selectedSymbol}),
  createWatchlist:name=>set(state=>{
    const id=`list-${Date.now().toString(36)}`;
    return {watchlists:[...state.watchlists,{id,name:name.trim(),symbols:[]}],activeWatchlistId:id};
  }),
  deleteActiveWatchlist:()=>set(state=>{
    if(state.watchlists.length<2)return state;
    const watchlists=state.watchlists.filter(list=>list.id!==state.activeWatchlistId);
    return {watchlists,activeWatchlistId:watchlists[0].id};
  }),
  addSymbol:symbol=>set(state=>({watchlists:state.watchlists.map(list=>list.id===state.activeWatchlistId&&!list.symbols.includes(symbol)?{...list,symbols:[...list.symbols,symbol]}:list)})),
  removeSymbol:symbol=>set(state=>({watchlists:state.watchlists.map(list=>list.id===state.activeWatchlistId?{...list,symbols:list.symbols.filter(item=>item!==symbol)}:list)})),
  reorderSymbol:(from,to)=>set(state=>({watchlists:state.watchlists.map(list=>{
    if(list.id!==state.activeWatchlistId)return list;
    const symbols=[...list.symbols];
    const source=symbols.indexOf(from),target=symbols.indexOf(to);
    if(source<0||target<0||source===target)return list;
    symbols.splice(source,1);symbols.splice(target,0,from);
    return {...list,symbols};
  })})),
}),{name:'aurevia-live-market-watchlists',storage:createJSONStorage(()=>localStorage),partialize:state=>({watchlists:state.watchlists,activeWatchlistId:state.activeWatchlistId,selectedSymbol:state.selectedSymbol})}));

export function getActiveWatchlist(state:MarketWatchlistState){
  return state.watchlists.find(list=>list.id===state.activeWatchlistId)||state.watchlists[0];
}