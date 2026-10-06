'use client';

import {FormEvent,useEffect,useState} from 'react';
import {signIn,useSession} from 'next-auth/react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {Eye,EyeOff,LoaderCircle,ShieldCheck} from 'lucide-react';
import Nav from '@/components/Nav';

export default function Login(){
	const [identifier,setIdentifier]=useState('');
	const [password,setPassword]=useState('');
	const [passwordVisible,setPasswordVisible]=useState(false);
	const [error,setError]=useState('');
	const [verified,setVerified]=useState(false);
	const [registered,setRegistered]=useState(false);
	const [replaceSession,setReplaceSession]=useState(false);
	const [busy,setBusy]=useState(false);
	const router=useRouter();
	const {update}=useSession();

	useEffect(()=>{
		const query=new URLSearchParams(window.location.search);
		setVerified(query.get('verified')==='1');setRegistered(query.get('registered')==='1');
	},[]);

	async function submit(event:FormEvent<HTMLFormElement>){
		event.preventDefault();if(busy)return;setBusy(true);setError('');
		try{
			const result=await signIn('credentials',{username:identifier,email:identifier,password,replaceSession:String(replaceSession),redirect:false});
			if(result?.ok){await update();router.replace('/dashboard');router.refresh();}
			else setError('Sign-in failed. Check your credentials and account status. If you are moving to another device, explicitly select session replacement.');
		}catch{setError('Unable to reach the authentication service. Please try again.');}
		finally{setBusy(false);}
	}

	return <><Nav/><main className="auth-scene"><section className="auth-card" aria-labelledby="signin-title">
		<div className="auth-brand"><Image src="/aurevia-logo.png" alt="" width={52} height={52} priority/><span>AUREVIA <b>INVEST</b></span></div>
		<p className="account-kicker">SECURE ACCOUNT ACCESS</p>
		<h1 id="signin-title" className="auth-heading">Welcome back</h1>
		<p className="auth-subtitle">Sign in to your Aurevia Invest workspace.</p>
		<div className="auth-market-line" aria-hidden="true"/>
		{verified&&<p className="mt-4 text-sm text-profit" role="status">Your account is verified. Sign in to continue.</p>}
		{registered&&<p className="mt-4 text-sm text-profit" role="status">If your account was created, you can sign in now. Phone verification is not required.</p>}
		<form onSubmit={submit} className="mt-5 space-y-4">
			<label className="auth-field-label">Email or administrator username<input className="auth-input" name="username" type="text" autoComplete="username" value={identifier} onChange={event=>{setIdentifier(event.target.value);setError('')}} required/></label>
			<div><label className="auth-field-label" htmlFor="login-password">Password</label><div className="auth-password-wrap"><input id="login-password" className="auth-input" name="password" type={passwordVisible?'text':'password'} autoComplete="current-password" value={password} onChange={event=>{setPassword(event.target.value);setError('')}} required/><button type="button" className="auth-password-toggle" aria-label={passwordVisible?'Hide password':'Show password'} aria-pressed={passwordVisible} onClick={()=>setPasswordVisible(value=>!value)}>{passwordVisible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
			<div className="auth-inline-links"><span>Protected sign-in</span><Link className="auth-link" href="/forgot-password">Forgot password?</Link></div>
			<label className="auth-session-option"><input type="checkbox" checked={replaceSession} onChange={event=>setReplaceSession(event.target.checked)}/><span>Replace the active Aurevia session on another device. That session will be signed out.</span></label>
			{error&&<p className="auth-error" role="alert">{error}</p>}
			<button type="submit" disabled={busy} className="auth-submit flex w-full items-center justify-center gap-2" aria-busy={busy}>{busy?<><LoaderCircle size={16} className="animate-spin" aria-hidden="true"/>Signing in…</>:'Sign in'}</button>
		</form>
		<p className="auth-footer">New to Aurevia? <Link className="auth-link" href="/register">Create an account</Link></p>
		<div className="mt-5 flex items-center justify-center gap-2 border-t border-white/10 pt-4 text-xs muted"><ShieldCheck size={15} className="gold" aria-hidden="true"/>Your account remains protected by your sign-in session.</div>
	</section></main></>;
}