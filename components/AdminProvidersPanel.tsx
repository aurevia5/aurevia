'use client';

import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';

type ProviderStatus={
	checkedAt:string;
	realExecution:{status:string;enabled:boolean;provider:string|null;adapterRegistered:boolean;configuredVariables:Record<string,boolean>;missingConfiguration:string[];executionPathEnabled:boolean};
	marketData:{status:string;provider:string;usedForOrderExecution:boolean};
	funding:{status:string;provider:string|null;realDepositsCreditOnlyOnProviderConfirmation:boolean};
	investments:{status:string;provider:string|null;realLifecycleActionsEnabled:boolean};
	identity:{status:string;provider:string|null;adminReviewAvailable:boolean};
	webhooks:{brokerAdapterRegistered:boolean;signatureVerificationAvailable:boolean};
};

export default function AdminProvidersPanel(){
	const [data,setData]=useState<ProviderStatus|null>(null);
	const [error,setError]=useState('');
	const [loading,setLoading]=useState(true);
	async function load(){
		setLoading(true);
		try{
			const response=await fetch('/api/admin/providers/status',{cache:'no-store'});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Provider status is unavailable.');
			setData(result);setError('');
		}catch(exception){setError(exception instanceof Error?exception.message:'Provider status is unavailable.');}
		finally{setLoading(false);}
	}
	useEffect(()=>{void load()},[]);
	return <section id="providers" className="card p-4 sm:p-5">
		<header className="flex flex-wrap items-start justify-between gap-3">
			<div><h2 className="font-bold">Provider readiness</h2><p className="mt-1 text-sm muted">Provider health is informational; REAL order submission stays disabled until a provider-specific execution path is reviewed and enabled.</p></div>
			<button className="btn min-h-11 bg-white/5" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>Refresh</button>
		</header>
		{error?<p className="mt-3 text-sm text-loss" role="alert">{error}</p>:loading&&!data?<p className="mt-3 muted">Checking provider readiness…</p>:data&&<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			<article className="rounded-xl border border-white/10 p-3"><h3 className="font-semibold">REAL execution</h3><p className="mt-1 text-sm">Status: <b>{data.realExecution.status}</b></p><p className="text-sm">Provider: {data.realExecution.provider||'None selected'}</p><p className="text-sm">Order path: {data.realExecution.executionPathEnabled?'Enabled':'Disabled'}</p><p className="mt-2 text-xs muted">Configuration is reported by variable name only: {Object.entries(data.realExecution.configuredVariables).map(([name,present])=>`${name} ${present?'set':'missing'}`).join(' · ')}</p></article>
			<article className="rounded-xl border border-white/10 p-3"><h3 className="font-semibold">Market data</h3><p className="mt-1 text-sm">Status: <b>{data.marketData.status}</b></p><p className="text-sm">{data.marketData.provider}</p><p className="text-xs muted">Order execution source: {data.marketData.usedForOrderExecution?'Yes':'No'}</p></article>
			<article className="rounded-xl border border-white/10 p-3"><h3 className="font-semibold">REAL funding</h3><p className="mt-1 text-sm">Status: <b>{data.funding.status}</b></p><p className="text-sm">Provider: {data.funding.provider||'None connected'}</p><p className="text-xs muted">Ledger credits require provider confirmation.</p></article>
			<article className="rounded-xl border border-white/10 p-3"><h3 className="font-semibold">REAL investments</h3><p className="mt-1 text-sm">Status: <b>{data.investments.status}</b></p><p className="text-sm">Provider: {data.investments.provider||'None connected'}</p><p className="text-xs muted">Activation, completion, and settlement are disabled.</p></article>
			<article className="rounded-xl border border-white/10 p-3"><h3 className="font-semibold">Identity / compliance</h3><p className="mt-1 text-sm">Status: <b>{data.identity.status}</b></p><p className="text-sm">Provider: {data.identity.provider||'Admin review only'}</p><p className="text-xs muted">Admin review available: {data.identity.adminReviewAvailable?'Yes':'No'}</p></article>
		</div>}
	</section>;
}
