'use client';

import {useEffect,useState} from 'react';
import {Eye,EyeOff,LoaderCircle,ShieldCheck} from 'lucide-react';

type KycProfile={legalName:string|null;dob:string|null;address:string|null;idType:string|null;idNumber:string|null;submittedAt:string|null;reviewedAt:string|null;reviewNote:string|null};
type ReviewUser={id:string;email:string;name:string|null;country:string|null;phone:string|null;kycStatus:string;kyc:KycProfile|null};

export default function AdminKycReviewPanel(){
	const [users,setUsers]=useState<ReviewUser[]>([]);
	const [notes,setNotes]=useState<Record<string,string>>({});
	const [revealed,setRevealed]=useState<string[]>([]);
	const [loading,setLoading]=useState(true);
	const [busyUser,setBusyUser]=useState('');
	const [message,setMessage]=useState('');
	const [error,setError]=useState('');

	async function load(){
		setLoading(true);
		try{
			const response=await fetch('/api/admin/users',{cache:'no-store'});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to load verification profiles.');
			const reviewable=(result as ReviewUser[]).filter(user=>user.kyc||user.kycStatus!=='PENDING');
			setUsers(reviewable);
			setNotes(current=>Object.fromEntries(reviewable.map(user=>[user.id,current[user.id]??user.kyc?.reviewNote??''])));
			setError('');
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to load verification profiles.');}
		finally{setLoading(false);}
	}

	useEffect(()=>{void load()},[]);

	async function review(user:ReviewUser,kycStatus:'APPROVED'|'REJECTED'|'NEEDS_CHANGES'){
		setBusyUser(user.id);setMessage('');setError('');
		try{
			const response=await fetch('/api/admin/users',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({userId:user.id,kycStatus,reviewNote:notes[user.id]||''})});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to review this profile.');
			setMessage(`Verification status updated for ${user.email}.`);
			await load();
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to review this profile.');}
		finally{setBusyUser('');}
	}

	return <section id="kyc-verification" className="card p-4 sm:p-5">
		<header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">KYC / profile verification</h2><p className="mt-1 text-sm muted">Submitted profile details are visible to administrators only. No identity documents are stored here.</p></div><button className="btn min-h-11 bg-white/5" type="button" onClick={()=>void load()} disabled={loading}>{loading?<LoaderCircle size={16} className="animate-spin"/>:'Refresh'}</button></header>
		{message&&<p className="mt-3 text-sm text-profit" role="status">{message}</p>}{error&&<p className="mt-3 text-sm text-loss" role="alert">{error}</p>}
		{loading&&!users.length?<p className="mt-4 muted">Loading verification profiles…</p>:users.length?<div className="mt-3 divide-y divide-white/10">{users.map(user=>{
			const profile=user.kyc;
			const isRevealed=revealed.includes(user.id);
			return <article className="py-4" key={user.id}>
				<div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{profile?.legalName||user.name||user.email}</h3><p className="muted text-xs">{user.email} · {user.kycStatus.replaceAll('_',' ')}</p></div><span className="status-pill">{profile?.submittedAt?`Submitted ${new Date(profile.submittedAt).toLocaleDateString()}`:'No profile submitted'}</span></div>
				{profile&&<dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="muted text-xs">Date of birth</dt><dd>{profile.dob?profile.dob.slice(0,10):'Not provided'}</dd></div><div><dt className="muted text-xs">Identity document</dt><dd>{profile.idType||'Not provided'} · {profile.idNumber?(isRevealed?profile.idNumber:`••••${profile.idNumber.slice(-4)}`):'Not provided'}{profile.idNumber&&<button type="button" className="ml-2 min-h-11 px-2 gold" aria-label={isRevealed?'Hide document number':'Reveal document number'} onClick={()=>setRevealed(current=>isRevealed?current.filter(id=>id!==user.id):[...current,user.id])}>{isRevealed?<EyeOff size={15}/>:<Eye size={15}/>}</button>}</dd></div><div className="sm:col-span-2"><dt className="muted text-xs">Submitted address</dt><dd className="break-words">{profile.address||'Not provided'}</dd></div><div><dt className="muted text-xs">Country / phone</dt><dd>{[user.country,user.phone].filter(Boolean).join(' · ')||'Not provided'}</dd></div><div><dt className="muted text-xs">Last review</dt><dd>{profile.reviewedAt?new Date(profile.reviewedAt).toLocaleString():'Not reviewed'}</dd></div></dl>}
				<label className="mt-3 block text-xs muted">Review note for the user<textarea className="input mt-1 min-h-20 resize-y" maxLength={500} value={notes[user.id]||''} onChange={event=>setNotes(current=>({...current,[user.id]:event.target.value}))}/></label>
				<div className="mt-3 flex flex-wrap gap-2"><button className="btn min-h-11 bg-profit px-4 text-black disabled:opacity-50" type="button" disabled={!profile||busyUser===user.id||user.kycStatus==='APPROVED'} onClick={()=>void review(user,'APPROVED')}><ShieldCheck size={15}/>Approve</button><button className="btn min-h-11 bg-loss px-4 disabled:opacity-50" type="button" disabled={!profile||busyUser===user.id||user.kycStatus==='REJECTED'} onClick={()=>void review(user,'REJECTED')}>Reject</button><button className="btn min-h-11 bg-white/10 px-4 disabled:opacity-50" type="button" disabled={!profile||busyUser===user.id||user.kycStatus==='NEEDS_CHANGES'} onClick={()=>void review(user,'NEEDS_CHANGES')}>Request information</button></div>
			</article>;
		})}</div>:<p className="mt-4 muted">No submitted profiles are awaiting review.</p>}
	</section>;
}