'use client';

import {FormEvent,useEffect,useState} from 'react';
import {useSession} from 'next-auth/react';
import Image from 'next/image';
import {Bell,Check,KeyRound,ShieldCheck,UserRound} from 'lucide-react';
import Nav from '@/components/Nav';

type Profile={id:string;email:string;name:string|null;phone:string|null;phoneVerified:boolean;country:string|null;address:string|null;hasAvatar:boolean;twoFactorEnabled:boolean;role:'USER'|'ADMIN';status:string;kycStatus:string};

export default function Settings(){
	const [profile,setProfile]=useState<Profile|null>(null);
	const [section,setSection]=useState<'profile'|'security'|'preferences'>('profile');
	const [message,setMessage]=useState('');
	const [error,setError]=useState('');
	const [loading,setLoading]=useState(true);
	const [saving,setSaving]=useState(false);
	const [avatarFile,setAvatarFile]=useState<File|null>(null);
	const [avatarUrl,setAvatarUrl]=useState('');
	const [avatarSaving,setAvatarSaving]=useState(false);
	const [retryCount,setRetryCount]=useState(0);
	const {data:session}=useSession();

	useEffect(()=>{
		let active=true;
		fetch('/api/profile').then(async response=>{
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to load your profile.');
			if(active){
				setProfile(result);
				if(result.hasAvatar){const avatar=await fetch('/api/profile/avatar',{cache:'no-store'});if(avatar.ok){const signed=await avatar.json();if(active)setAvatarUrl(signed.url)}}
			}
		}).catch(exception=>{if(active)setError(exception instanceof Error?exception.message:'Unable to load your profile.')}).finally(()=>{if(active)setLoading(false)});
		return()=>{active=false};
	},[retryCount]);

	async function save(event:FormEvent<HTMLFormElement>){
		event.preventDefault();
		if(!profile||saving)return;
		setSaving(true);setMessage('');setError('');
		try{
			const response=await fetch('/api/profile',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:profile.name,phone:profile.phone,country:profile.country,address:profile.address||'',twoFactorEnabled:profile.twoFactorEnabled})});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to save profile.');
			setProfile(current=>current?{...current,...result,address:profile.address}:result);setMessage('Profile saved.');
		}catch(exception){setError(exception instanceof Error?exception.message:'Unable to save profile.')}
		finally{setSaving(false)}
	}

	async function uploadAvatar(){
		if(!avatarFile||avatarSaving)return;
		setAvatarSaving(true);setError('');setMessage('');
		try{
			const body=new FormData();body.append('file',avatarFile);
			const response=await fetch('/api/profile/avatar',{method:'POST',body});
			const result=await response.json();if(!response.ok)throw new Error(result.error||'Profile photo upload failed.');
			const view=await fetch('/api/profile/avatar',{cache:'no-store'});if(!view.ok)throw new Error('Profile photo saved but could not be loaded.');
			const signed=await view.json();setAvatarUrl(signed.url);setAvatarFile(null);setProfile(current=>current?{...current,hasAvatar:true}:current);setMessage('Profile photo updated.');
		}catch(exception){setError(exception instanceof Error?exception.message:'Profile photo upload failed.')}
		finally{setAvatarSaving(false)}
	}

	const verification=profile?.kycStatus==='APPROVED'?'Approved':profile?.kycStatus==='REJECTED'?'Needs attention':'Pending';

	return <><Nav/><main className="account-page">
		<header className="account-heading"><div><span className="account-kicker">Account center</span><h1>Settings</h1><p>Manage your profile and review the security state supported by this account.</p></div><span className="status-pill">{loading?'Loading':profile?.status||'Unavailable'}</span></header>
		{error&&<div className="account-callout mb-4" role="alert"><span>{error}</span><button type="button" className="text-link" disabled={loading} onClick={()=>{setError('');setLoading(true);setRetryCount(value=>value+1)}}>Retry</button></div>}
		<div className="settings-layout">
			<nav className="settings-tabs" aria-label="Settings sections" role="tablist">
				<button type="button" role="tab" aria-selected={section==='profile'} className={section==='profile'?'is-active':''} onClick={()=>setSection('profile')}><UserRound size={16}/>Profile</button>
				<button type="button" role="tab" aria-selected={section==='security'} className={section==='security'?'is-active':''} onClick={()=>setSection('security')}><KeyRound size={16}/>Security</button>
				<button type="button" role="tab" aria-selected={section==='preferences'} className={section==='preferences'?'is-active':''} onClick={()=>setSection('preferences')}><Bell size={16}/>Preferences</button>
			</nav>
			<div className="settings-content">
				{section==='profile'&&<section className="account-panel card p-5" role="tabpanel"><div className="account-panel-title"><div><h2>Personal profile</h2><p className="account-panel-subtitle">Update the information associated with your account.</p></div><UserRound size={18} className="gold" aria-hidden="true"/></div>
					{profile&&<form onSubmit={save} className="account-form-grid">
						<div className="account-label md:col-span-2"><span>Profile photo</span><div className="mt-2 flex flex-wrap items-center gap-3">{avatarUrl&&<Image src={avatarUrl} unoptimized alt="Your private profile photo" width={64} height={64} className="h-16 w-16 rounded-full object-cover"/>}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose profile photo" onChange={event=>setAvatarFile(event.target.files?.[0]||null)}/><button className="btn min-h-11 bg-white/5" type="button" disabled={!avatarFile||avatarSaving} onClick={()=>void uploadAvatar()}>{avatarSaving?'Uploading…':'Upload photo'}</button></div><small className="mt-1 block muted">Private image · PNG, JPEG, or WebP · 2 MB maximum</small></div>
						<label className="account-label md:col-span-2">Email address<input className="input" type="email" autoComplete="email" value={profile.email} disabled/></label>
						<label className="account-label">Name<input className="input" autoComplete="name" required minLength={2} maxLength={120} value={profile.name||''} onChange={event=>setProfile({...profile,name:event.target.value})}/></label>
						<label className="account-label">Phone<input className="input" type="tel" autoComplete="tel" maxLength={40} value={profile.phone||''} onChange={event=>setProfile({...profile,phone:event.target.value})}/></label>
						<p className="muted text-xs">Phone verification: {profile.phoneVerified?'Verified through SMS':'Not verified'}</p>
						<label className="account-label">Country<input className="input" autoComplete="country-name" required minLength={2} maxLength={80} value={profile.country||''} onChange={event=>setProfile({...profile,country:event.target.value})}/></label>
						<label className="account-label md:col-span-2">Address (optional)<input className="input" autoComplete="street-address" maxLength={500} value={profile.address||''} onChange={event=>setProfile({...profile,address:event.target.value})}/></label>
						<div className="account-callout md:col-span-2"><ShieldCheck size={16}/><span>Verification status: <b>{verification}</b>. Review your details on the <a className="gold" href="/kyc">Verification page</a>.</span></div>
						<div className="md:col-span-2"><button type="submit" className="btn bg-gold text-black" disabled={saving||loading} aria-busy={saving}>{saving?'Saving…':'Save profile'}</button>{message&&<p className="mt-3 text-sm text-profit" role="status">{message}</p>}</div>
					</form>}
					{loading&&!profile&&<div className="account-empty" role="status">Loading profile…</div>}
				</section>}
				{section==='security'&&<section className="account-panel card p-5" role="tabpanel"><div className="account-panel-title"><div><h2>Security overview</h2><p className="account-panel-subtitle">Review current account flags and session capabilities.</p></div><ShieldCheck size={18} className="gold" aria-hidden="true"/></div>
					<div className="security-row"><span className="security-icon"><Check size={16}/></span><div><b>Password sign-in</b><p>Credential authentication is enabled for this account.</p></div><span className="status-pill">Enabled</span></div>
					<div className="security-row"><span className="security-icon"><KeyRound size={16}/></span><div><b>Two-factor flag</b><p>This account field is a simulation only; no TOTP, WebAuthn, recovery codes, or second challenge is configured.</p></div><span className="status-pill">{profile?.twoFactorEnabled?'Flag on':'Not enabled'}</span></div>
					<div className="security-row"><span className="security-icon"><UserRound size={16}/></span><div><b>Current server session</b><p>Session ID: {session?.user.sessionId||'Loading'} · use Logout or explicitly replace this session during sign-in elsewhere.</p></div><span className="status-pill">One active session</span></div>
					<div className="account-callout mt-4"><Bell size={16}/><span>Use the notification bell for recent alerts and the Notifications page for full history.</span></div>
				</section>}
				{section==='preferences'&&<section className="account-panel card p-5" role="tabpanel"><div className="account-panel-title"><div><h2>Preferences</h2><p className="account-panel-subtitle">More account controls will appear here when they are connected.</p></div><Bell size={18} className="gold" aria-hidden="true"/></div><div className="account-empty">Notification delivery and display preferences are not configured.</div></section>}
			</div>
		</div>
	</main></>;
}
