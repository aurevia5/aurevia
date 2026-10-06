'use client';

import {FormEvent,useEffect,useState} from 'react';
import {FileCheck2,Info,ShieldCheck} from 'lucide-react';
import Nav from '@/components/Nav';

type VerificationStatus='PENDING'|'APPROVED'|'REJECTED'|'NEEDS_CHANGES';
type VerificationForm={legalName:string;dob:string;address:string;idType:string;idNumber:string};
const emptyForm:VerificationForm={legalName:'',dob:'',address:'',idType:'PASSPORT',idNumber:''};

const statusCopy:Record<VerificationStatus,{label:string;description:string}>={
  PENDING:{label:'Pending review',description:'Your submitted information is waiting for an administrator review.'},
  APPROVED:{label:'Approved',description:'The account verification status is approved.'},
  REJECTED:{label:'Needs attention',description:'The submitted verification was rejected. Review your details and resubmit.'},
  NEEDS_CHANGES:{label:'Changes requested',description:'Review the information and submit the requested corrections.'},
};

export default function Kyc(){
  const [form,setForm]=useState<VerificationForm>(emptyForm);
  const [status,setStatus]=useState<VerificationStatus>('PENDING');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);

  useEffect(()=>{
    let active=true;
    Promise.all([fetch('/api/kyc'),fetch('/api/profile')]).then(async([kycResponse,profileResponse])=>{
      if(!kycResponse.ok||!profileResponse.ok)throw new Error('Unable to load verification details.');
      const [kyc,profile]=await Promise.all([kycResponse.json(),profileResponse.json()]);
      if(!active)return;
      if(kyc)setForm({legalName:kyc.legalName||'',dob:kyc.dob?String(kyc.dob).slice(0,10):'',address:kyc.address||'',idType:kyc.idType||'PASSPORT',idNumber:kyc.idNumber||''});
      if(['PENDING','APPROVED','REJECTED','NEEDS_CHANGES'].includes(profile.kycStatus))setStatus(profile.kycStatus);
    }).catch(exception=>{if(active)setError(exception instanceof Error?exception.message:'Unable to load verification details.')}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[]);

  const completed=[form.legalName,form.dob,form.address,form.idType,form.idNumber].filter(Boolean).length;
  const completion=Math.round(completed/5*100);
  const state=statusCopy[status];

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(submitting)return;
    setSubmitting(true);setMessage('');setError('');
    try{
      const response=await fetch('/api/kyc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(form)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Unable to submit verification details.');
      setStatus('PENDING');setMessage('Your details were submitted. The status will update after review.');
    }catch(exception){setError(exception instanceof Error?exception.message:'Unable to submit verification details.')}
    finally{setSubmitting(false)}
  }

  return <><Nav/><main className="account-page">
    <header className="account-heading"><div><span className="account-kicker">Account verification</span><h1>Identity details</h1><p>Submit the information requested by the current verification workflow and follow its review status.</p></div><span className="status-pill">{loading?'Loading status':state.label}</span></header>
    <section className="account-panel card p-5">
      <div className="account-panel-title"><div><h2>Verification progress</h2><p className="account-panel-subtitle">{state.description}</p></div><ShieldCheck size={20} className="gold" aria-hidden="true"/></div>
      <div className="progress-track" role="progressbar" aria-label="Verification details completed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}><span style={{width:`${completion}%`}}/></div>
      <p className="mt-2 text-right text-xs muted">{completion}% of the current form completed</p>
      <div className="verification-steps mt-5">
        <div className={`verification-step ${form.legalName&&form.dob?'is-current':''}`}><i>1</i><span>Personal details</span></div>
        <div className={`verification-step ${form.address?'is-current':''}`}><i>2</i><span>Address</span></div>
        <div className="verification-step"><i>3</i><span>Employment &amp; finance</span></div>
        <div className={`verification-step ${form.idNumber?'is-current':''}`}><i>4</i><span>Identity details</span></div>
        <div className={`verification-step ${status==='PENDING'?'is-current':''}`}><i>5</i><span>Review &amp; result</span></div>
      </div>
    </section>
    <div className="account-content-grid">
      <section className="account-panel card p-5"><div className="account-panel-title"><div><h2>Personal information</h2><p className="account-panel-subtitle">Use information that matches your identity document.</p></div><FileCheck2 size={18} className="gold" aria-hidden="true"/></div>
        <form onSubmit={submit} className="account-form-grid">
          <label className="account-label">Legal name<input className="input" autoComplete="name" required minLength={2} maxLength={160} value={form.legalName} onChange={event=>setForm({...form,legalName:event.target.value})}/></label>
          <label className="account-label">Date of birth<input className="input" type="date" required value={form.dob} onChange={event=>setForm({...form,dob:event.target.value})}/></label>
          <label className="account-label md:col-span-2">Residential address<input className="input" autoComplete="street-address" required minLength={5} maxLength={500} value={form.address} onChange={event=>setForm({...form,address:event.target.value})}/></label>
          <label className="account-label">Identity document type<select className="input" value={form.idType} onChange={event=>setForm({...form,idType:event.target.value})}><option value="PASSPORT">Passport</option><option value="NATIONAL_ID">National ID</option><option value="DRIVERS_LICENSE">Driver&apos;s license</option></select></label>
          <label className="account-label">Document number<input className="input" required minLength={3} maxLength={100} autoComplete="off" value={form.idNumber} onChange={event=>setForm({...form,idNumber:event.target.value})}/></label>
          <div className="account-callout md:col-span-2"><Info size={16}/><span>The current workflow collects these text details only. Employment and financial details, document uploads, and third-party identity checks are not enabled. Do not submit real identity documents to this demo.</span></div>
          <div className="md:col-span-2"><button className="btn bg-gold text-black" type="submit" disabled={submitting||loading}>{submitting?'Submitting…':'Submit for review'}</button>{message&&<p className="mt-3 text-sm text-profit" role="status">{message}</p>}{error&&<p className="mt-3 text-sm text-loss" role="alert">{error}</p>}</div>
        </form>
      </section>
      <aside className="account-panel card p-5"><div className="account-panel-title"><div><h2>Review status</h2><p className="account-panel-subtitle">Current account status from your profile.</p></div></div><span className="status-pill">{loading?'Loading':state.label}</span><p className="mt-4 text-sm leading-6 muted">{state.description}</p><div className="mt-5 border-t border-white/10 pt-4"><h3 className="text-sm font-semibold">Information not requested</h3><p className="mt-2 text-xs leading-5 muted">Employment, financial profile, file upload, and resubmission document storage are not part of this implementation.</p></div></aside>
    </div>
  </main></>;
}