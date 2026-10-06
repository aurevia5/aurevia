'use client';
import Link from 'next/link';
import Image from 'next/image';
import {useSession,signOut} from 'next-auth/react';
import {usePathname,useRouter} from 'next/navigation';
import {LogOut,LayoutDashboard,LineChart,Wallet,ShieldCheck,Settings,Menu,X,UserRound,ArrowUpRight} from 'lucide-react';
import {useEffect,useState} from 'react';
import NotificationBell from '@/components/NotificationBell';

export default function Nav(){
 const {data,status,update}=useSession(); const pathname=usePathname(); const router=useRouter(); const [open,setOpen]=useState(false); const [modeError,setModeError]=useState('');
 const close=()=>setOpen(false);
 const active=(href:string)=>pathname===href||pathname.startsWith(`${href}/`);
 async function changeMode(accountMode:'DEMO'|'REAL'){
  setModeError('');
  try{
   const response=await fetch('/api/account/mode',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({accountMode})});
   if(!response.ok){setModeError('Mode update failed');return;}
   await update();router.refresh();close();
  }catch{setModeError('Mode update failed');}
 }
 useEffect(()=>{setOpen(false)},[pathname]);
 return <header className={`site-nav ${status==='authenticated'&&data?.user?.role==='ADMIN'?'site-nav-admin':''}`}><div className="nav-inner">
   <Link href="/" className="brand" onClick={close}><Image src="/aurevia-logo.png" alt="Aurevia Invest" width={38} height={38}/><span>AUREVIA <b>INVEST</b></span></Link>
  <nav id="primary-navigation" aria-label="Primary navigation" className={`nav-links ${status==='authenticated'&&data?.user?.role==='ADMIN'?'is-admin':''} ${open?'nav-open':''}`} onKeyDown={event=>{if(event.key==='Escape')close()}}>
  {status==='authenticated'&&data?.user ? <>
     <Link href="/" onClick={close} aria-current={pathname==='/'?'page':undefined}>Home</Link>
     <Link href="/dashboard" onClick={close} aria-current={active('/dashboard')?'page':undefined}><LayoutDashboard size={15} aria-hidden="true"/>Dashboard</Link>
    <Link href="/markets" onClick={close} aria-current={active('/markets')?'page':undefined}><LineChart size={15} aria-hidden="true"/>Markets</Link>
     <Link href="/trade" onClick={close} aria-current={active('/trade')?'page':undefined}><ActivityIcon/>Trade</Link>
    <Link href="/portfolio" onClick={close} aria-current={active('/portfolio')?'page':undefined}>Portfolio</Link>
    <Link href="/orders" onClick={close} aria-current={active('/orders')?'page':undefined}>Orders</Link>
    <Link href="/investments" onClick={close} aria-current={active('/investments')?'page':undefined}>Investments</Link>
     <Link href="/wallet" onClick={close} aria-current={active('/wallet')?'page':undefined}><Wallet size={15} aria-hidden="true"/>Wallet</Link>
     <Link href="/kyc" onClick={close} aria-current={active('/kyc')?'page':undefined}><ShieldCheck size={15} aria-hidden="true"/>Verification</Link>
     <Link href="/settings" onClick={close} aria-current={active('/settings')?'page':undefined}><Settings size={15} aria-hidden="true"/>Settings</Link>
    <Link href="/support" onClick={close} aria-current={active('/support')?'page':undefined}>Support</Link>
    {data.user.role==='ADMIN'&&<><Link href="/admin" onClick={close} aria-current={pathname==='/admin'?'page':undefined}>Admin</Link><Link href="/admin/investments" onClick={close} aria-current={active('/admin/investments')?'page':undefined}>Investment ops</Link><Link href="/admin/payments" onClick={close} aria-current={active('/admin/payments')?'page':undefined}>Payments</Link><Link href="/admin/support" onClick={close} aria-current={active('/admin/support')?'page':undefined}>Support inbox</Link></>}
      <label className="mode-switch-wrap"><span className="sr-only">Account mode</span><select className="mode-switch" aria-label="Account mode" value={data.user.accountMode} onChange={event=>void changeMode(event.target.value as 'DEMO'|'REAL')}><option value="DEMO">DEMO</option><option value="REAL">REAL</option></select></label>
     <button type="button" className="nav-logout" onClick={()=>{close();void signOut({callbackUrl:'/login'});}}><LogOut size={15} aria-hidden="true"/>Logout</button>
    </> : status==='unauthenticated' ? <><Link href="/" onClick={close} aria-current={pathname==='/'?'page':undefined}>Home</Link><Link href="/markets" onClick={close} aria-current={active('/markets')?'page':undefined}><LineChart size={15} aria-hidden="true"/>Markets</Link><Link href="/#platform" onClick={close}>Platform</Link><Link href="/education" onClick={close} aria-current={active('/education')?'page':undefined}>Education</Link><Link href="/about" onClick={close} aria-current={active('/about')?'page':undefined}>About</Link><Link href="/support" onClick={close} aria-current={active('/support')?'page':undefined}>Support</Link><Link href="/login" onClick={close}><UserRound size={15} aria-hidden="true"/>Login</Link><Link href="/register" className="nav-cta" onClick={close}>Open account <ArrowUpRight size={14} aria-hidden="true"/></Link></> : <span className="muted text-sm" aria-live="polite">{modeError||'Restoring session…'}</span>}
   </nav>
   <div className="nav-actions"><NotificationBell/><button className="menu-button" type="button" aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} aria-controls="primary-navigation" onClick={()=>setOpen(!open)}>{open?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}</button></div>
 </div></header>
}

function ActivityIcon(){return <LineChart size={15} aria-hidden="true"/>}
