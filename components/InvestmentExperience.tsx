'use client';

import {FormEvent,useCallback,useEffect,useState} from 'react';
import {ArrowUpRight,RefreshCw,ShieldCheck} from 'lucide-react';
import Nav from '@/components/Nav';

type Opportunity={id:string;title:string;category:string;description:string;assetSymbol:string|null;minimumAmount:string;maximumAmount:string|null;targetReturnPercent:string|null;durationDays:number;startsAt:string|null;maturesAt:string|null;riskLevel:string;status:string;demoEligible:boolean;realEligible:boolean;requiresApproval:boolean;targetPrice:string|null;stopPrice:string|null};
type Request={id:string;opportunityId:string;accountMode:'DEMO'|'REAL';amount:string;status:string;requestedAt:string;activatedAt:string|null;maturesAt:string|null;settlementReference:string|null;simulatedPayout:string|null;opportunity:{title:string;category:string;riskLevel:string;targetReturnPercent:string|null;durationDays:number}};
type Payload={accountMode:'DEMO'|'REAL';availableBalance:string;opportunities:Opportunity[];requests:Request[]};

function amount(value:string|number|null|undefined){return value===null||value===undefined?'Not set':`$${Number(value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function statusText(value:string){return value.replaceAll('_',' ');}
function dateText(value:string|null){return value?new Date(value).toLocaleDateString():'Set on activation';}

export default function InvestmentExperience(){
 const [data,setData]=useState<Payload|null>(null);
 const [amounts,setAmounts]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');

 const load=useCallback(async(showLoading=false)=>{
  if(showLoading)setLoading(true);
  try{
   const response=await fetch('/api/investments',{cache:'no-store'});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'Unable to load investments.');
   setData(result);setError('');
  }catch(exception){setError(exception instanceof Error?exception.message:'Unable to load investments.');}
  finally{if(showLoading)setLoading(false);}
 },[]);

 useEffect(()=>{void load(true);},[load]);

 async function submit(event:FormEvent<HTMLFormElement>,opportunity:Opportunity){
  event.preventDefault();if(busy)return;
  const value=Number(amounts[opportunity.id]);
  if(!Number.isFinite(value)||value<=0){setError('Enter a valid investment amount.');return;}
  setBusy(opportunity.id);setError('');setNotice('');
  try{
   const response=await fetch('/api/investments',{method:'POST',headers:{'content-type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({opportunityId:opportunity.id,amount:value})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'Unable to submit this request.');
   setNotice(data?.accountMode==='DEMO'?'DEMO request recorded. Virtual cash is reserved pending review.':'REAL request recorded. No money moved and this does not confirm an external investment.');
   setAmounts(current=>({...current,[opportunity.id]:''}));
   await load();
  }catch(exception){setError(exception instanceof Error?exception.message:'Unable to submit this request.');}
  finally{setBusy('');}
 }

 return <><Nav/><main className="account-page">
  <header className="account-heading"><div><span className="account-kicker">INVESTMENT OPPORTUNITIES</span><h1>Investments</h1><p>Review terms, risk, and status before submitting a request.</p></div><span className={`status-pill ${data?.accountMode==='REAL'?'mode-real':'mode-demo'}`}>{data?`${data.accountMode} ACCOUNT`:'Loading account'}</span></header>
  {data?.accountMode==='DEMO'?<div className="account-callout mb-4"><span>Simulated only. DEMO requests reserve virtual USD and any payout entered by an administrator is not a real investment result.</span></div>:data?.accountMode==='REAL'?<div className="account-callout mb-4"><span>REAL requests require approved identity verification and administrator review. This application does not execute investments or move REAL funds.</span></div>:null}
  {notice&&<p className="mb-3 text-sm text-profit" role="status">{notice}</p>}{error&&<div className="account-callout mb-3" role="alert"><span>{error}</span><button type="button" className="text-link" onClick={()=>void load(true)}><RefreshCw size={14}/> Retry</button></div>}
  <section className="account-panel card p-5"><div className="account-panel-title"><div><h2>Available opportunities</h2><p className="account-panel-subtitle">Target figures are projections, not guaranteed outcomes.</p></div>{data&&<span className="muted text-sm">Available cash {amount(data.availableBalance)}</span>}</div>
   {loading&&!data?<p className="account-empty" role="status">Loading opportunities…</p>:data?.opportunities.length?<div className="mt-4 grid gap-4 lg:grid-cols-2">{data.opportunities.map(opportunity=>{
    const value=Number(amounts[opportunity.id]||0);const target=opportunity.targetReturnPercent===null?null:value*(1+Number(opportunity.targetReturnPercent)/100);
    return <article className="investment-opportunity" key={opportunity.id}>
     <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="account-kicker">{opportunity.category}{opportunity.assetSymbol?` · ${opportunity.assetSymbol}`:''}</span><h3>{opportunity.title}</h3></div><span className="status-pill">{opportunity.riskLevel.replaceAll('_',' ')}</span></div>
     <p className="investment-description">{opportunity.description}</p>
     <dl className="investment-terms"><div><dt>Minimum</dt><dd>{amount(opportunity.minimumAmount)}</dd></div><div><dt>Maximum</dt><dd>{amount(opportunity.maximumAmount)}</dd></div><div><dt>Duration</dt><dd>{opportunity.durationDays} days</dd></div><div><dt>Start</dt><dd>{dateText(opportunity.startsAt)}</dd></div><div><dt>Maturity</dt><dd>{dateText(opportunity.maturesAt)}</dd></div><div><dt>Target return</dt><dd>{opportunity.targetReturnPercent===null?'Not specified':`${Number(opportunity.targetReturnPercent).toFixed(2)}% target`}</dd></div></dl>
     {(opportunity.targetPrice||opportunity.stopPrice)&&<p className="investment-levels">Reference levels only: target {amount(opportunity.targetPrice)} · stop {amount(opportunity.stopPrice)}</p>}
     <form className="investment-request-form" onSubmit={event=>void submit(event,opportunity)}><label className="account-label">Amount (USD)<input className="input" inputMode="decimal" type="number" min={Number(opportunity.minimumAmount)} max={opportunity.maximumAmount?Number(opportunity.maximumAmount):undefined} step="0.01" required value={amounts[opportunity.id]||''} onChange={event=>setAmounts(current=>({...current,[opportunity.id]:event.target.value}))}/></label><div className="investment-projection"><span>Illustrative target amount</span><b>{target===null?'Not available':amount(target)}</b><small>Projection only · no guarantee</small></div><button className="btn bg-gold text-black" disabled={busy===opportunity.id}>{busy===opportunity.id?'Submitting…':'Request investment'} <ArrowUpRight size={15}/></button></form>
     {data?.accountMode==='REAL'&&<p className="investment-disclosure"><ShieldCheck size={14}/> Submission is a request only. No funds are transferred.</p>}
    </article>;
   })}</div>:<p className="account-empty">No opportunities are currently available for this account mode.</p>}
  </section>
  <section className="account-panel card p-5 mt-4"><div className="account-panel-title"><div><h2>Investment activity</h2><p className="account-panel-subtitle">Requests are private to this account mode.</p></div><button type="button" className="text-link" onClick={()=>void load(true)}><RefreshCw size={14}/> Refresh</button></div>
   {data?.requests.length?<div className="investment-request-list">{data.requests.map(item=><article className="investment-request-row" key={item.id}><div><b>{item.opportunity.title}</b><span>{item.opportunity.category} · {amount(item.amount)} · {item.accountMode}</span><small>Requested {new Date(item.requestedAt).toLocaleString()}{item.maturesAt?` · Matures ${new Date(item.maturesAt).toLocaleDateString()}`:''}</small>{item.settlementReference&&<small>Reference recorded: {item.settlementReference}{item.accountMode==='REAL'?' · not independently verified':''}</small>}</div><span className={`status-pill ${item.accountMode==='DEMO'?'mode-demo':'mode-real'}`}>{statusText(item.status)}</span></article>)}</div>:<p className="account-empty">No investment requests yet.</p>}
  </section>
 </main></>;
}