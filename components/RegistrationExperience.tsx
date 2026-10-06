'use client';

import {FormEvent,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {ArrowRight,ShieldCheck} from 'lucide-react';
import type {CountryCode} from 'libphonenumber-js';
import Nav from '@/components/Nav';
import CountrySelector from '@/components/CountrySelector';
import {findCountry} from '@/lib/countries';
import {normalizePhoneE164,parseDateOfBirth} from '@/lib/registration-validation';

type AccountMode='DEMO'|'REAL';
type RegistrationDetails={firstName:string;lastName:string;dateOfBirth:string;residenceCountry:string;phoneCountry:string;phoneNumber:string;email:string;password:string;confirmPassword:string;accountMode:AccountMode};

const initialDetails:RegistrationDetails={firstName:'',lastName:'',dateOfBirth:'',residenceCountry:'',phoneCountry:'US',phoneNumber:'',email:'',password:'',confirmPassword:'',accountMode:'DEMO'};

function dateInputMaximum(){return new Date().toISOString().slice(0,10)}

export default function RegistrationExperience(){
	const [details,setDetails]=useState(initialDetails);
	const [termsAccepted,setTermsAccepted]=useState(false);
	const [stage,setStage]=useState<'details'|'verify'>('details');
	const [verificationEmail,setVerificationEmail]=useState('');
	const [verificationChannel,setVerificationChannel]=useState<'email'|'sms'|'unknown'>('unknown');
	const [verificationCode,setVerificationCode]=useState('');
	const [resendSeconds,setResendSeconds]=useState(0);
	const [error,setError]=useState('');
	const [notice,setNotice]=useState('');
	const [countryError,setCountryError]=useState('');
	const [dateError,setDateError]=useState('');
	const [phoneError,setPhoneError]=useState('');
	const [passwordError,setPasswordError]=useState('');
	const [busy,setBusy]=useState(false);
	const router=useRouter();
	const residence=findCountry(details.residenceCountry);

	useEffect(()=>{
		if(resendSeconds<=0)return;
		const timer=window.setInterval(()=>setResendSeconds(value=>Math.max(0,value-1)),1000);
		return()=>window.clearInterval(timer);
	},[resendSeconds]);

	function update<K extends keyof RegistrationDetails>(key:K,value:RegistrationDetails[K]){
		setDetails(current=>({...current,[key]:value}));
	}

	async function submit(event:FormEvent<HTMLFormElement>){
		event.preventDefault();
		if(busy)return;
		setError('');setCountryError('');setDateError('');setPhoneError('');setPasswordError('');setNotice('');
		const date=parseDateOfBirth(details.dateOfBirth);
		const phone=details.phoneNumber.trim()?normalizePhoneE164(details.phoneNumber,details.phoneCountry as CountryCode):'';
		let invalid=false;
		if(!residence){setCountryError('Select your country of residence.');invalid=true;}
		if(!date){setDateError('Enter a valid date of birth that is not in the future.');invalid=true;}
		if(details.phoneNumber.trim()&&!phone){setPhoneError('Enter a valid number for the selected country.');invalid=true;}
		if(details.password!==details.confirmPassword){setPasswordError('Passwords do not match.');invalid=true;}
		if(invalid||!residence)return;
		setBusy(true);
		try{
			const response=await fetch('/api/register',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({name:`${details.firstName.trim()} ${details.lastName.trim()}`.trim(),email:details.email,password:details.password,country:residence.name,phone, dateOfBirth:details.dateOfBirth,accountMode:details.accountMode,termsAccepted})});
			const result=await response.json().catch(()=>({}));
			if(!response.ok){
				if(result.verificationPending){setVerificationEmail(details.email);setVerificationChannel(result.channel==='sms'?'sms':result.channel==='email'?'email':'unknown');setResendSeconds(result.resendAfterSeconds||0);setStage('verify');}
				setError(result.error||'Registration failed.');return;
			}
			if(!result.verificationRequired){router.replace('/login?registered=1');router.refresh();return;}
			setVerificationEmail(details.email);setVerificationChannel(result.channel==='sms'?'sms':result.channel==='email'?'email':'unknown');setResendSeconds(result.resendAfterSeconds||60);setStage('verify');setNotice(result.message||'Verification instructions were sent through the configured provider.');
		}catch{setError('Unable to reach the registration service. Please try again.');}
		finally{setBusy(false);}
	}

	async function verify(event:FormEvent<HTMLFormElement>){
		event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
		try{const response=await fetch('/api/register/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:verificationEmail,code:verificationCode})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to verify this account.');router.replace('/login?verified=1');router.refresh();}
		catch(exception){setError(exception instanceof Error?exception.message:'Unable to verify this account.');}
		finally{setBusy(false);}
	}

	async function resend(){
		if(busy||resendSeconds>0)return;setBusy(true);setError('');setNotice('');
		try{const response=await fetch('/api/register/resend',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:verificationEmail})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to request a new code.');setNotice(result.message);setResendSeconds(60);}
		catch(exception){setError(exception instanceof Error?exception.message:'Unable to request a new code.');}
		finally{setBusy(false);}
	}

	return <><Nav/><main className="auth-scene"><section className="auth-card auth-register-card" aria-labelledby="registration-title">
		<div className="auth-brand"><Image src="/aurevia-logo.png" alt="" width={48} height={48}/><span>AUREVIA <b>INVEST</b></span></div>
		{stage==='details'?<>
			<h1 id="registration-title" className="auth-heading">Open an account</h1>
			<p className="auth-subtitle">A clear setup for your personal and account details.</p>
			<div className="auth-market-line" aria-hidden="true"/>
			<form onSubmit={submit} className="mt-4 space-y-5">
				<fieldset className="register-form-section"><legend className="sr-only">Personal information</legend><h2>Personal information</h2><div className="grid gap-3 sm:grid-cols-2">
					<label className="auth-field-label">First name<input className="auth-input" name="given-name" autoComplete="given-name" value={details.firstName} onChange={event=>update('firstName',event.target.value)} required maxLength={60}/></label>
					<label className="auth-field-label">Last name<input className="auth-input" name="family-name" autoComplete="family-name" value={details.lastName} onChange={event=>update('lastName',event.target.value)} required maxLength={59}/></label>
					<label className="auth-field-label">Date of birth<input className="auth-input auth-date-input" type="date" name="bday" autoComplete="bday" value={details.dateOfBirth} max={dateInputMaximum()} aria-describedby={dateError?'dob-error':undefined} onChange={event=>{update('dateOfBirth',event.target.value);setDateError('')}} required/></label>
					<div><span className="auth-field-label">Country of residence</span><CountrySelector label="country of residence" value={details.residenceCountry} onChange={code=>{update('residenceCountry',code);setCountryError('')}} required invalid={Boolean(countryError)} errorId={countryError?'country-error':undefined}/>{countryError&&<p id="country-error" className="mt-1 text-xs text-loss" role="alert">{countryError}</p>}</div>
				</div>
					{dateError&&<p id="dob-error" className="mt-2 text-xs text-loss" role="alert">{dateError}</p>}
				</fieldset>
				<fieldset className="register-form-section"><legend className="sr-only">Contact information</legend><h2>Contact information</h2><div className="space-y-3">
					<label className="auth-field-label">Email address<input className="auth-input" name="email" type="email" autoComplete="email" value={details.email} onChange={event=>update('email',event.target.value)} required maxLength={254}/></label>
					<div><label className="auth-field-label" htmlFor="registration-phone">Phone number <span className="muted font-normal">(optional unless phone verification is enabled)</span></label><div className="register-phone-row mt-1"><CountrySelector label="phone country and dialing code" value={details.phoneCountry} onChange={code=>update('phoneCountry',code)}/><input id="registration-phone" className="auth-input mt-0 min-w-0" name="tel-national" type="tel" autoComplete="tel-national" inputMode="tel" value={details.phoneNumber} onChange={event=>{update('phoneNumber',event.target.value);setPhoneError('')}} placeholder="Phone number" aria-describedby={phoneError?'phone-error':undefined}/></div>{phoneError&&<p id="phone-error" className="mt-1 text-xs text-loss" role="alert">{phoneError}</p>}</div>
				</div></fieldset>
				<fieldset className="register-form-section"><legend className="sr-only">Security</legend><h2>Security</h2><div className="grid gap-3 sm:grid-cols-2">
					<label className="auth-field-label">Password<input className="auth-input" name="new-password" type="password" autoComplete="new-password" value={details.password} onChange={event=>{update('password',event.target.value);setPasswordError('')}} required minLength={10} maxLength={128} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{10,128}" aria-describedby="password-requirements"/></label>
					<label className="auth-field-label">Confirm password<input className="auth-input" name="confirm-password" type="password" autoComplete="new-password" value={details.confirmPassword} onChange={event=>{update('confirmPassword',event.target.value);setPasswordError('')}} required maxLength={128} aria-describedby={passwordError?'password-error':undefined}/></label>
				</div><p id="password-requirements" className="mt-2 text-xs muted">Use at least 10 characters, including uppercase, lowercase, and a number.</p>{passwordError&&<p id="password-error" className="mt-1 text-xs text-loss" role="alert">{passwordError}</p>}</fieldset>
				<fieldset className="register-form-section"><legend className="sr-only">Account type</legend><h2>Account</h2>
					<div className="grid gap-2 sm:grid-cols-2"><label className={`block cursor-pointer rounded-md border p-3 ${details.accountMode==='DEMO'?'border-gold/40 bg-white/5':'border-white/10'}`}><span className="flex min-h-11 items-center gap-3"><input type="radio" name="accountMode" value="DEMO" checked={details.accountMode==='DEMO'} onChange={()=>update('accountMode','DEMO')}/><b>DEMO ACCOUNT</b></span><span className="block pl-7 text-xs leading-5 muted">Explore simulated markets and demo activity.</span></label><label className={`block cursor-pointer rounded-md border p-3 ${details.accountMode==='REAL'?'border-gold/40 bg-white/5':'border-white/10'}`}><span className="flex min-h-11 items-center gap-3"><input type="radio" name="accountMode" value="REAL" checked={details.accountMode==='REAL'} onChange={()=>update('accountMode','REAL')}/><b>REAL ACCOUNT</b></span><span className="block pl-7 text-xs leading-5 muted">Funding requests require identity verification and administrator review.</span></label></div>
					<label className="mt-4 flex min-h-11 items-start gap-2 text-xs leading-5 muted"><input className="mt-1" type="checkbox" checked={termsAccepted} onChange={event=>setTermsAccepted(event.target.checked)} required/><span>I agree to the <Link className="auth-link" href="/terms">Terms</Link>, <Link className="auth-link" href="/privacy">Privacy Policy</Link>, and risk disclosures.</span></label>
				</fieldset>
				{error&&<p className="auth-error" role="alert">{error}</p>}
				<button type="submit" disabled={busy} className="auth-submit flex w-full items-center justify-center gap-2">{busy?'Creating account…':'Create account'}<ArrowRight size={16} aria-hidden="true"/></button>
			</form>
			<p className="auth-footer">Already registered? <Link href="/login" className="auth-link">Sign in</Link></p>
		</>:<>
			<h1 id="registration-title" className="auth-heading">Verify your account</h1><p className="auth-subtitle">Enter the one-time code sent through the configured verification provider.</p>
			<form onSubmit={verify} className="mt-5 space-y-4">
				<label className="auth-field-label">Account email<input className="auth-input" type="email" value={verificationEmail} readOnly/></label>
				<p className="text-sm muted">{verificationChannel==='unknown'?'If this account is eligible, a one-time code will be sent to its registered email or phone.':`A one-time code was sent by ${verificationChannel==='sms'?'SMS':'email'} if the contact is eligible.`} Codes expire after 10 minutes.</p>
				<label className="auth-field-label">Verification code<input className="auth-input verification-code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={verificationCode} onChange={event=>setVerificationCode(event.target.value.replace(/\D/g,'').slice(0,6))}/></label>
				{error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p className="text-sm muted" role="status">{notice}</p>}
				<button type="submit" disabled={busy||verificationCode.length!==6} className="auth-submit w-full">{busy?'Verifying…':'Verify account'}</button>
				<button type="button" className="btn w-full bg-white/5" disabled={busy||resendSeconds>0} onClick={()=>void resend()}>{resendSeconds>0?`Resend code in ${resendSeconds}s`:'Resend code'}</button>
				<p className="text-xs muted">Already verified or did not receive a code? <Link href="/login" className="auth-link">Sign in</Link> or <Link href="/support" className="auth-link">contact support</Link>.</p>
			</form>
		</>}
		<div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs muted"><ShieldCheck size={15} className="gold" aria-hidden="true"/>Account details remain private to your account.</div>
	</section></main></>;
}