'use client';

import {FormEvent,useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,CheckCheck,MessageSquareText,RefreshCw,Send} from 'lucide-react';
import Nav from '@/components/Nav';

type Conversation={id:string;user:{id:string;email:string;name:string|null};accountMode:'DEMO'|'REAL';subject:string;status:string;category:string;isComplaint:boolean;hasAttachment:boolean;createdAt:string;updatedAt:string;lastMessageAt:string;transaction:{id:string;type:string;accountMode:'DEMO'|'REAL';status:string;amount:string;currency:string}|null;messages:Array<{id:string;authorType:string;body:string;createdAt:string}>};

export default function AdminSupport(){
	const [items,setItems]=useState<Conversation[]>([]);
	const [selectedId,setSelectedId]=useState('');
	const [message,setMessage]=useState('');
	const [notice,setNotice]=useState('');
	const [error,setError]=useState('');
	const [busy,setBusy]=useState(false);
	const [loading,setLoading]=useState(true);
	const selected=items.find(item=>item.id===selectedId);

	const load=useCallback(async()=>{
		setLoading(true);
		try{const response=await fetch('/api/admin/support');const result=await response.json();if(!response.ok)throw new Error('Administrator authorization required.');setItems(result);setError('');setSelectedId(current=>current||result[0]?.id||'')}
		catch(exception){setError(exception instanceof Error?exception.message:'Unable to load support inbox.')}
		finally{setLoading(false)}
	},[]);
	useEffect(()=>{void load()},[load]);

	async function update(action:'reply'|'resolve',event?:FormEvent<HTMLFormElement>){
		event?.preventDefault();if(!selected||busy)return;setBusy(true);setError('');setNotice('');
		try{
			const response=await fetch('/api/admin/support',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action,conversationId:selected.id,...(action==='reply'?{message}: {})})});
			const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to update ticket.');
			setMessage('');setNotice(action==='reply'?'Response sent to the user.':'Conversation marked resolved.');await load();
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to update ticket.')}
		finally{setBusy(false)}
	}

	async function openAttachment(conversationId:string){
		try{const response=await fetch(`/api/admin/support/${encodeURIComponent(conversationId)}/attachment`,{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Attachment unavailable.');window.open(result.url,'_blank','noopener,noreferrer')}
		catch(exception){setError(exception instanceof Error?exception.message:'Attachment unavailable.')}
	}

	return <><Nav/><main className="account-page">
		<header className="account-heading"><div><span className="account-kicker">ADMINISTRATION · CUSTOMER SUPPORT</span><h1>Support inbox</h1><p>Review private Nova escalations and respond using the recorded account context.</p></div><div className="flex gap-2"><Link className="button-secondary" href="/admin"><ArrowLeft size={14}/> Admin home</Link><button className="icon-action" type="button" aria-label="Refresh support inbox" onClick={()=>void load()}><RefreshCw size={15}/></button></div></header>
		{notice&&<p className="mb-3 text-sm text-profit" role="status">{notice}</p>}{error&&<p className="mb-3 text-sm text-loss" role="alert">{error}</p>}
		<div className="admin-support-layout">
			<aside className="account-panel card p-4"><div className="account-panel-title"><div><h2>Conversations</h2><p className="account-panel-subtitle">{items.length} tickets</p></div><MessageSquareText size={18} className="gold"/></div>{loading?<p className="account-empty">Loading inbox…</p>:items.length?<div className="support-ticket-list">{items.map(item=><button type="button" key={item.id} className={`support-inbox-item ${selectedId===item.id?'is-selected':''}`} onClick={()=>setSelectedId(item.id)}><b>{item.subject}</b><span>{item.user.name||item.user.email}</span><small>{item.isComplaint?`Complaint · ${item.category}`:'Support'} · {item.accountMode} · {item.status.replaceAll('_',' ')}</small><small>{item.messages[0]?.body||'No messages yet'}</small><small>{new Date(item.lastMessageAt).toLocaleString()}</small></button>)}</div>:<p className="account-empty">No support tickets.</p>}</aside>
			<section className="account-panel card p-5">{!selected?<div className="account-empty">Choose a ticket to review.</div>:<>
				<div className="account-panel-title"><div><span className={`status-pill ${selected.accountMode==='DEMO'?'mode-demo':'mode-real'}`}>{selected.accountMode} ACCOUNT</span><h2 className="mt-3">{selected.subject}</h2><p className="account-panel-subtitle">Ticket {selected.id} · {selected.status.replaceAll('_',' ')} · {selected.category}</p></div><span className="muted text-xs">{new Date(selected.createdAt).toLocaleString()}</span></div>
				<dl className="support-context"><div><dt>User</dt><dd>{selected.user.name||'Name not provided'} · {selected.user.email}</dd></div><div><dt>User ID</dt><dd className="font-mono">{selected.user.id}</dd></div>{selected.transaction&&<div><dt>Related transaction</dt><dd><span className="font-mono">{selected.transaction.id}</span><span className="muted"> · {selected.transaction.type} · {selected.transaction.accountMode} · {selected.transaction.status}</span></dd></div>}</dl>
				{selected.hasAttachment&&<button type="button" className="text-link" onClick={()=>void openAttachment(selected.id)}>View private attachment</button>}
				<div className="support-admin-messages">{selected.messages.slice().reverse().map(item=><article key={item.id}><div><b>{item.authorType}</b><time>{new Date(item.createdAt).toLocaleString()}</time></div><p>{item.body}</p></article>)}</div>
				{selected.status!=='RESOLVED'&&<form className="support-admin-reply" onSubmit={event=>void update('reply',event)}><label className="account-label">Admin response<textarea className="input min-h-24" required minLength={1} maxLength={4000} value={message} onChange={event=>setMessage(event.target.value)}/></label><div className="flex flex-wrap gap-2"><button className="btn bg-gold text-black" disabled={busy||!message.trim()}><Send size={14} className="mr-1 inline"/>{busy?'Sending…':'Send response'}</button><button type="button" className="btn bg-white/5" disabled={busy} onClick={()=>void update('resolve')}><CheckCheck size={14} className="mr-1 inline"/>Resolve</button></div></form>}
			</>}</section>
		</div>
	</main></>;
}