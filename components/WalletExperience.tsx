'use client';

import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useSession} from 'next-auth/react';
import {ArrowDownLeft,ArrowUpRight,Check,Copy,RefreshCw,WalletCards} from 'lucide-react';
import Nav from '@/components/Nav';

type PaymentMethod={id:string;name:string;currencies:string[];destination:string|null;instructions:string|null;minimumAmount:string|number;maximumAmount:string|number|null;depositEnabled:boolean;withdrawalEnabled:boolean;requiresNetwork:boolean;demoOnly:boolean};
type FundingRecord={id:string;type:'DEPOSIT'|'WITHDRAWAL';method:string;amount:number|string;currency:string;status:string;accountMode:'DEMO'|'REAL';createdAt:string;transactionReference?:string|null;adminNote?:string|null;hasReceipt?:boolean};
type WalletData={accountMode:'DEMO'|'REAL';balance:number|string;balances:Array<{currency:string;balance:number|string}>;transactions:FundingRecord[]};
type KycData={kycStatus:string};

const money=(amount:number,currency='USD')=>`${amount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:8})} ${currency}`;
const statuses:Record<string,string>={PENDING:'Pending',PENDING_REVIEW:'Pending review',PROCESSING:'Processing',APPROVED:'Approved',COMPLETED:'Completed',REJECTED:'Rejected',CANCELLED:'Cancelled'};
const reserves=['PENDING','PENDING_REVIEW','PROCESSING'];

export default function WalletExperience(){
	const {data:session,status:sessionStatus}=useSession();
	const activeMode=session?.user?.accountMode;
	const [data,setData]=useState<WalletData>({accountMode:'DEMO',balance:0,balances:[],transactions:[]});
	const [methods,setMethods]=useState<PaymentMethod[]>([]);
	const [profile,setProfile]=useState<KycData|null>(null);
	const [type,setType]=useState<'DEPOSIT'|'WITHDRAWAL'>('DEPOSIT');
	const [methodId,setMethodId]=useState('');
	const [currency,setCurrency]=useState('USD');
	const [amount,setAmount]=useState('');
	const [transactionReference,setTransactionReference]=useState('');
	const [referenceInfo,setReferenceInfo]=useState('');
	const [senderInfo,setSenderInfo]=useState('');
	const [destinationInfo,setDestinationInfo]=useState('');
	const [beneficiaryInfo,setBeneficiaryInfo]=useState('');
	const [network,setNetwork]=useState('');
	const [note,setNote]=useState('');
	const [confirming,setConfirming]=useState(false);
	const [message,setMessage]=useState('');
	const [error,setError]=useState('');
	const [loading,setLoading]=useState(true);
	const [submitting,setSubmitting]=useState(false);
	const [copied,setCopied]=useState(false);
	const [idempotencyKey,setIdempotencyKey]=useState('');
	const [keyFingerprint,setKeyFingerprint]=useState('');
	const [receiptFiles,setReceiptFiles]=useState<Record<string,File|undefined>>({});
	const [receiptBusy,setReceiptBusy]=useState('');

	const availableMethods=useMemo(()=>methods.filter(method=>type==='DEPOSIT'?method.depositEnabled:method.withdrawalEnabled),[methods,type]);
	const selectedMethod=availableMethods.find(method=>method.id===methodId);
	const supportedCurrencies=useMemo(()=>selectedMethod?.currencies||[],[selectedMethod]);
	const currentBalance=Number(data.balances.find(item=>item.currency===currency)?.balance||0);
	const pendingWithdrawal=useMemo(()=>data.transactions.filter(item=>item.type==='WITHDRAWAL'&&item.currency===currency&&reserves.includes(item.status)).reduce((sum,item)=>sum+Number(item.amount),0),[data.transactions,currency]);
	const availableBalance=currentBalance-pendingWithdrawal;
	const realKycApproved=profile?.kycStatus==='APPROVED';

	const load=useCallback(async(showLoading=false)=>{
		if(showLoading)setLoading(true);
		try{
			const [walletResponse,methodResponse,profileResponse]=await Promise.all([fetch('/api/wallet'),fetch('/api/payment-methods'),fetch('/api/profile')]);
			const [walletResult,methodResult,profileResult]=await Promise.all([walletResponse.json(),methodResponse.json(),profileResponse.json()]);
			if(!walletResponse.ok||!methodResponse.ok||!profileResponse.ok)throw new Error(walletResult.error||methodResult.error||profileResult.error||'Unable to load wallet data.');
			setData(walletResult);setMethods(methodResult);setProfile(profileResult);setError('');
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to load wallet data.');}
		finally{if(showLoading)setLoading(false);}
	},[]);

	useEffect(()=>{
		if(sessionStatus!=='authenticated')return;
		setData({accountMode:activeMode||'DEMO',balance:0,balances:[],transactions:[]});
		setMethods([]);setMethodId('');
		void load(true);
	},[sessionStatus,activeMode,load]);
	useEffect(()=>{
		if(!availableMethods.some(method=>method.id===methodId))setMethodId(availableMethods[0]?.id||'');
	},[availableMethods,methodId]);
	useEffect(()=>{if(supportedCurrencies.length&&!supportedCurrencies.includes(currency))setCurrency(supportedCurrencies[0])},[supportedCurrencies,currency]);

	async function submit(event:FormEvent<HTMLFormElement>){
		event.preventDefault();	setConfirming(true);setMessage('');setError('');
	}

	async function confirmSubmit(){
		if(!selectedMethod||submitting)return;
		setSubmitting(true);setError('');
		const payload={type,paymentMethodId:selectedMethod.id,amount:Number(amount),currency,transactionReference:transactionReference||undefined,referenceInfo:referenceInfo||undefined,senderInfo:senderInfo||undefined,destinationInfo:destinationInfo||undefined,beneficiaryInfo:beneficiaryInfo||undefined,network:network||undefined,note:note||undefined};
		const fingerprint=JSON.stringify(payload);
		const key=idempotencyKey&&keyFingerprint===fingerprint?idempotencyKey:window.crypto.randomUUID();setIdempotencyKey(key);setKeyFingerprint(fingerprint);
		try{
			const response=await fetch('/api/wallet',{method:'POST',headers:{'content-type':'application/json','Idempotency-Key':key},body:JSON.stringify(payload)});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to submit this request.');
			setMessage(response.status===200?`Request ${result.id} already exists with status ${String(result.status).replaceAll('_',' ')}. No new request was created.`:`Request ${result.id} submitted for administrator review. The ledger has not been posted.`);
			setAmount('');setTransactionReference('');setReferenceInfo('');setSenderInfo('');setDestinationInfo('');setBeneficiaryInfo('');setNetwork('');setNote('');setIdempotencyKey('');setKeyFingerprint('');setConfirming(false);
			await load();
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to submit this request.');}
		finally{setSubmitting(false);}
	}

	async function copyDestination(){
		if(!selectedMethod?.destination||selectedMethod.demoOnly)return;
		try{await navigator.clipboard.writeText(selectedMethod.destination);setCopied(true);window.setTimeout(()=>setCopied(false),1500)}catch{setError('Clipboard access is unavailable in this browser.')}
	}

	async function uploadReceipt(request:FundingRecord){
		const file=receiptFiles[request.id];if(!file||receiptBusy)return;
		setReceiptBusy(request.id);setError('');setMessage('');
		try{
			const body=new FormData();body.append('file',file);
			const response=await fetch(`/api/wallet/${encodeURIComponent(request.id)}/receipt`,{method:'POST',body});
			const result=await response.json();if(!response.ok)throw new Error(result.error||'Receipt upload failed.');
			const delivery=result.emailDelivery==='sent'?'Support email sent.':result.emailDelivery==='failed'?'Support email failed; admin notification is recorded.':'Email is not configured; admin notification is recorded.';
			setMessage(`Receipt stored privately. Funds were not credited. ${delivery}`);setReceiptFiles(current=>({...current,[request.id]:undefined}));await load();
		}catch(exception){setError(exception instanceof Error?exception.message:'Receipt upload failed.')}
		finally{setReceiptBusy('')}
	}

	async function openReceipt(requestId:string){
		try{
			const response=await fetch(`/api/wallet/${encodeURIComponent(requestId)}/receipt`,{cache:'no-store'});
			const result=await response.json();if(!response.ok)throw new Error(result.error||'Receipt unavailable.');
			window.open(result.url,'_blank','noopener,noreferrer');
		}catch(exception){setError(exception instanceof Error?exception.message:'Receipt unavailable.')}
	}

	return <><Nav/><main className="account-page">
		<header className="account-heading"><div><span className="account-kicker">{data.accountMode} ACCOUNT · Wallet &amp; funding</span><h1>Account funds</h1><p>{data.accountMode==='DEMO'?'Demo balances and funding activity are isolated from real accounts.':'Real-account funding stays pending until administrator review.'}</p></div><span className={`status-pill ${data.accountMode==='DEMO'?'mode-demo':'mode-real'}`}>{data.accountMode} ACCOUNT</span></header>
		{data.accountMode==='REAL'&&!realKycApproved&&<div className="account-callout account-mode-notice"><span>Identity verification must be approved before real-account funding requests can be submitted.</span><Link className="text-link" href="/kyc">Open verification</Link></div>}
		<section className="wallet-balance-panel"><div className="account-kicker">Available {data.accountMode.toLowerCase()} balances</div><div className="wallet-balance-value">{loading?'Loading…':money(Number(data.balance||0))}</div><p className="wallet-demo-note">Only approved ledger entries are included. Pending withdrawals are reserved below.</p><div className="wallet-currency-list">{data.balances.map(item=><span key={item.currency}>{money(Number(item.balance),item.currency)}</span>)}</div></section>
		{error&&<p className="mt-3 text-sm text-loss" role="alert">{error}</p>}
		{message&&<p className="mt-3 text-sm text-profit" role="status">{message}</p>}
		<div className="account-metrics mt-3"><div className="account-metric"><span>Requests pending review</span><b>{data.transactions.filter(item=>reserves.includes(item.status)).length}</b><small>No ledger posting until approved</small></div><div className="account-metric"><span>Withdrawal reservations</span><b>{money(pendingWithdrawal,currency)}</b><small>{currency} requests awaiting review</small></div><div className="account-metric"><span>Enabled payment methods</span><b>{methods.length}</b><small>Configured by an administrator</small></div><div className="account-metric"><span>Recent requests</span><b>{data.transactions.length}</b><small>Latest 100 for this account mode</small></div></div>
		<div className="account-content-grid">
			<section className="account-panel card p-5"><div className="account-panel-title"><div><h2>Funding request</h2><p className="account-panel-subtitle">Requests are not payment confirmations or payout instructions.</p></div><WalletCards size={18} className="gold" aria-hidden="true"/></div>
				<div className="wallet-type-switch" role="group" aria-label="Funding request type"><button type="button" aria-pressed={type==='DEPOSIT'} onClick={()=>{setType('DEPOSIT');setConfirming(false)}}><ArrowDownLeft size={15}/> Deposit</button><button type="button" aria-pressed={type==='WITHDRAWAL'} onClick={()=>{setType('WITHDRAWAL');setConfirming(false)}}><ArrowUpRight size={15}/> Withdraw</button></div>
				<form onSubmit={submit} className="mt-4 space-y-4">
					<label className="account-label">Payment method<select className="input" required value={methodId} onChange={event=>setMethodId(event.target.value)}><option value="">Select an enabled method</option>{availableMethods.map(method=><option key={method.id} value={method.id}>{method.name}</option>)}</select></label>
					{selectedMethod&&<>
						<label className="account-label">Currency<select className="input" required value={currency} onChange={event=>setCurrency(event.target.value)}>{supportedCurrencies.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
						<label className="account-label">Amount ({currency})<input className="input" type="number" min={selectedMethod.minimumAmount||'0.00000001'} max={selectedMethod.maximumAmount||undefined} step="any" inputMode="decimal" required value={amount} onChange={event=>setAmount(event.target.value)} placeholder="0.00"/></label>
						{type==='DEPOSIT'?<>
							{(selectedMethod.destination||selectedMethod.instructions)&&<div className="account-callout deposit-instructions"><div><strong>Administrator-configured payment instructions</strong>{selectedMethod.destination&&<p className="mt-2 break-all font-mono text-xs">{selectedMethod.destination}</p>}{selectedMethod.instructions&&<p className="mt-2 text-sm">{selectedMethod.instructions}</p>}</div>{selectedMethod.destination&&<button type="button" className="icon-action" aria-label="Copy payment destination" onClick={()=>void copyDestination()}>{copied?<Check size={15}/>:<Copy size={15}/>}</button>}</div>}
							<label className="account-label">External transaction/reference ID (optional)<input className="input" maxLength={180} value={transactionReference} onChange={event=>setTransactionReference(event.target.value)} placeholder="Only enter a reference issued by your payment provider"/></label>
							<label className="account-label">Sender or payment reference (optional)<input className="input" maxLength={500} value={referenceInfo} onChange={event=>setReferenceInfo(event.target.value)} placeholder="Your provider reference"/></label>
							<label className="account-label">Sender information (optional)<input className="input" maxLength={300} value={senderInfo} onChange={event=>setSenderInfo(event.target.value)} placeholder="Name or account details"/></label>
							<div className="account-callout"><span>Payment proof upload is not enabled. Your request remains pending until an administrator verifies it; approval is not a blockchain confirmation.</span></div>
						</>:<>
							{selectedMethod.demoOnly?<div className="account-callout"><span>DEMO withdrawal only. No bank transfer or cryptocurrency payout will be sent, and no real destination is collected.</span></div>:<label className="account-label">Destination address or account<input className="input" required maxLength={500} value={destinationInfo} onChange={event=>setDestinationInfo(event.target.value)} placeholder="Enter the payout destination"/></label>}
							{selectedMethod.requiresNetwork&&!selectedMethod.demoOnly&&<label className="account-label">Network<input className="input" required maxLength={80} value={network} onChange={event=>setNetwork(event.target.value)} placeholder="Select or enter the destination network"/></label>}
							<label className="account-label">Beneficiary information (optional)<input className="input" maxLength={300} value={beneficiaryInfo} onChange={event=>setBeneficiaryInfo(event.target.value)} placeholder="Name or account holder"/></label>
							<div className="account-callout"><span>Available {currency} balance: {money(availableBalance,currency)}. Funds are reserved while review is pending and posted only after administrator approval. No external payout is sent by this application.</span></div>
						</>}
						<label className="account-label">Note (optional)<textarea className="input min-h-20" maxLength={500} value={note} onChange={event=>setNote(event.target.value)}/></label>
					</>}
					{!availableMethods.length&&<div className="account-empty">No {type.toLowerCase()} methods are currently enabled. Contact an administrator through support.</div>}
					{confirming&&selectedMethod&&<div className="account-confirm-panel" role="alert"><h3>Confirm {type.toLowerCase()} request</h3><p>{money(Number(amount||0),currency)} via {selectedMethod.name} in the {data.accountMode} account. This records a request only; it does not send or confirm payment.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn bg-gold text-black" disabled={submitting} onClick={()=>void confirmSubmit()}>{submitting?'Submitting…':'Confirm request'}</button><button type="button" className="btn bg-white/5" onClick={()=>setConfirming(false)}>Cancel</button></div></div>}
					{!confirming&&<button className="btn w-full bg-gold text-black" type="submit" disabled={loading||!selectedMethod||(data.accountMode==='REAL'&&!realKycApproved)}>{type==='DEPOSIT'?'Review deposit request':'Review withdrawal request'}</button>}
				</form>
			</section>
			<section className="account-panel card p-5"><div className="account-panel-title"><div><h2>Transaction history</h2><p className="account-panel-subtitle">Mode-specific funding requests and review records.</p></div><div className="flex items-center gap-2"><Link className="text-link" href="/wallet/transactions">Full history</Link><button type="button" className="icon-action" aria-label="Refresh wallet history" onClick={()=>{setLoading(true);void load()}}><RefreshCw size={15}/></button></div></div>
				{loading?<div className="account-empty" role="status">Loading transaction history…</div>:data.transactions.length?<div className="account-table-wrap"><table className="account-table"><thead><tr><th>Request</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead><tbody>{data.transactions.map(transaction=><tr key={transaction.id}><td><Link className="transaction-kind" href={`/wallet/transactions/${encodeURIComponent(transaction.id)}`}>{transaction.type==='DEPOSIT'?<ArrowDownLeft size={13}/>:<ArrowUpRight size={13}/>} {transaction.type}<small className="transaction-method">{transaction.method}</small><small className="transaction-method">{transaction.id}</small></Link></td><td>{money(Number(transaction.amount),transaction.currency)}</td><td><span className="status-pill">{statuses[transaction.status]||transaction.status}</span></td><td>{transaction.type==='DEPOSIT'&&reserves.includes(transaction.status)?<div className="grid min-w-40 gap-1"><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label={`Choose receipt for ${transaction.id}`} onChange={event=>setReceiptFiles(current=>({...current,[transaction.id]:event.target.files?.[0]}))}/><button type="button" className="btn min-h-11 bg-white/5" disabled={!receiptFiles[transaction.id]||receiptBusy===transaction.id} onClick={()=>void uploadReceipt(transaction)}>{receiptBusy===transaction.id?'Uploading…':'Upload receipt'}</button>{transaction.hasReceipt&&<button type="button" className="text-link" onClick={()=>void openReceipt(transaction.id)}>View private receipt</button>}</div>:transaction.hasReceipt?<button type="button" className="text-link" onClick={()=>void openReceipt(transaction.id)}>View private receipt</button>:<span className="muted">—</span>}</td></tr>)}</tbody></table></div>:<div className="account-empty"><div><WalletCards size={22} className="mx-auto mb-3 gold"/><p>No funding requests yet.</p></div></div>}
			</section>
		</div>
	</main></>;
}