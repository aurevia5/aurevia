'use client';
import {FormEvent,useState} from 'react';
import {signIn,useSession} from 'next-auth/react';
import {useRouter} from 'next/navigation';
import Image from 'next/image';

export default function AdminLogin(){
 const [username,setUsername]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 const [replaceSession,setReplaceSession]=useState(false);
 const [busy,setBusy]=useState(false);
 const router=useRouter();
 const {update}=useSession();
 async function submit(e:FormEvent){
   e.preventDefault();
   if(busy)return;
   setBusy(true); setError('');
   try{
    const result=await signIn('credentials',{username,password,replaceSession:String(replaceSession),redirect:false,callbackUrl:'/admin'});
    if(result?.ok){await update();router.replace('/admin');router.refresh();}
    else setError('Sign-in failed. Check your credentials and account status. Select session replacement only when you intend to end the current administrator session.');
   }catch{setError('Unable to reach the authentication service. Please try again.')}
   finally{setBusy(false)}
 }
 return <main className="admin-login-scene min-h-screen px-4 py-10 sm:py-16">
   <div className="admin-orb admin-orb-a"/><div className="admin-orb admin-orb-b"/>
   <div className="admin-login-card card mx-auto max-w-md p-7 sm:p-9">
    <div className="flex justify-center"><Image src="/aurevia-logo.png" alt="Aurevia Invest" width={92} height={92} className="admin-login-logo" priority/></div>
    <div className="mt-4 text-center"><div className="gold text-xs font-bold tracking-[0.28em]">AUREVIA INVEST</div><h1 className="mt-2 text-3xl font-black">Administrator sign in</h1><p className="mt-2 muted">Restricted control-center access.</p></div>
     <form onSubmit={submit} className="mt-7 space-y-4">
       <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider muted">Admin username</span><input className="input" type="text" autoComplete="username" required placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)}/></label>
       <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider muted">Password</span><input className="input" type="password" autoComplete="current-password" required placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <label className="flex min-h-11 items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={replaceSession} onChange={event=>setReplaceSession(event.target.checked)}/><span>Replace another active Aurevia session and sign it out.</span></label>
       {error&&<p className="text-loss text-sm" role="alert">{error}</p>}
       <button className="btn admin-login-button w-full bg-gold text-black" type="submit" disabled={busy}>{busy?'Authenticating…':'Enter control center'}</button>
     </form>
   </div>
 </main>
}
