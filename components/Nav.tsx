'use client';
import Link from 'next/link';
import Image from 'next/image';
import {useSession,signOut} from 'next-auth/react';
import {usePathname,useRouter} from 'next/navigation';
import {LogOut,LayoutDashboard,LineChart,Wallet,ShieldCheck,Settings,Menu,X,UserRound,ArrowUpRight} from 'lucide-react';
import {useEffect,useState} from 'react';
import NotificationBell from '@/components/NotificationBell';
import LanguageSelector from '@/components/LanguageSelector';
import {useLocale} from '@/lib/i18n-context';

export default function Nav(){
 const {data,status,update}=useSession(); const pathname=usePathname(); const router=useRouter(); const {translate}=useLocale(); const [open,setOpen]=useState(false); const [modeError,setModeError]=useState(''); const [modeBusy,setModeBusy]=useState(false); const [loggingOut,setLoggingOut]=useState(false);
 const close=()=>setOpen(false);
 const active=(href:string)=>pathname===href||pathname.startsWith(`${href}/`);
 async function changeMode(accountMode:'DEMO'|'REAL'){
  if(modeBusy)return;
  setModeBusy(true);setModeError('');
  try{
   const response=await fetch('/api/account/mode',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({accountMode})});
   if(!response.ok){setModeError('Mode update failed');return;}
   await update();router.refresh();close();
  }catch{setModeError('Mode update failed');}
  finally{setModeBusy(false)}
 }
 async function logout(){
  close();setLoggingOut(true);
  try{await signOut({callbackUrl:'/login'})}
  catch{setLoggingOut(false);setModeError('Unable to sign out. Please try again.')}
 }
 useEffect(()=>{setOpen(false)},[pathname]);
 return <header className={`site-nav ${status==='authenticated'&&data?.user?.role==='ADMIN'?'site-nav-admin':''}`}><div className="nav-inner">
   <Link href="/" className="brand" onClick={close}><Image src="/aurevia-logo.png" alt="Aurevia Invest" width={38} height={38}/><span>AUREVIA <b>INVEST</b></span></Link>
  <nav id="primary-navigation" aria-label="Primary navigation" className={`nav-links ${status==='authenticated'&&data?.user?.role==='ADMIN'?'is-admin':''} ${open?'nav-open':''}`} onKeyDown={event=>{if(event.key==='Escape')close()}}>
  {status==='authenticated'&&data?.user ? <>
     <Link href="/" onClick={close} aria-current={pathname==='/'?'page':undefined}>{translate('home')}</Link>
     <Link href="/dashboard" onClick={close} aria-current={active('/dashboard')?'page':undefined}><LayoutDashboard size={15} aria-hidden="true"/>{translate('dashboard')}</Link>
    <Link href="/markets" onClick={close} aria-current={active('/markets')?'page':undefined}><LineChart size={15} aria-hidden="true"/>{translate('markets')}</Link>
     <Link href="/trade" onClick={close} aria-current={active('/trade')?'page':undefined}><ActivityIcon/>{translate('trade')}</Link>
    <Link href="/portfolio" onClick={close} aria-current={active('/portfolio')?'page':undefined}>{translate('portfolio')}</Link>
    <Link href="/orders" onClick={close} aria-current={active('/orders')?'page':undefined}>{translate('orders')}</Link>
    <Link href="/investments" onClick={close} aria-current={active('/investments')?'page':undefined}>{translate('investments')}</Link>
     <Link href="/wallet" onClick={close} aria-current={active('/wallet')?'page':undefined}><Wallet size={15} aria-hidden="true"/>{translate('wallet')}</Link>
     <Link href="/kyc" onClick={close} aria-current={active('/kyc')?'page':undefined}><ShieldCheck size={15} aria-hidden="true"/>{translate('verification')}</Link>
     <Link href="/settings" onClick={close} aria-current={active('/settings')?'page':undefined}><Settings size={15} aria-hidden="true"/>{translate('settings')}</Link>
    <Link href="/support" onClick={close} aria-current={active('/support')?'page':undefined}>{translate('support')}</Link>
    <Link href="/waitlist" onClick={close} aria-current={pathname==='/waitlist'?'page':undefined}>{translate('joinWaitlist')}</Link>
    {data.user.role==='ADMIN'&&<><Link href="/admin" onClick={close} aria-current={pathname==='/admin'?'page':undefined}>{translate('admin')}</Link><Link href="/admin/investments" onClick={close} aria-current={active('/admin/investments')?'page':undefined}>{translate('investmentOps')}</Link><Link href="/admin/payments" onClick={close} aria-current={active('/admin/payments')?'page':undefined}>{translate('payments')}</Link><Link href="/admin/support" onClick={close} aria-current={active('/admin/support')?'page':undefined}>{translate('supportInbox')}</Link></>}
      <label className="mode-switch-wrap"><span className="sr-only">{translate('accountMode')}</span><select className="mode-switch" aria-label={translate('accountMode')} value={data.user.accountMode} disabled={modeBusy||loggingOut} aria-busy={modeBusy} onChange={event=>void changeMode(event.target.value as 'DEMO'|'REAL')}><option value="DEMO">{translate('demo')}</option><option value="REAL">{translate('real')}</option></select></label>
     {modeError&&<span className="text-xs text-loss" role="alert">{modeError}</span>}
     <button type="button" className="nav-logout" disabled={loggingOut} aria-busy={loggingOut} onClick={()=>void logout()}><LogOut size={15} aria-hidden="true"/>{loggingOut?translate('signingOut'):translate('logout')}</button>
    </> : status==='unauthenticated' ? <><Link href="/" onClick={close} aria-current={pathname==='/'?'page':undefined}>{translate('home')}</Link><Link href="/markets" onClick={close} aria-current={active('/markets')?'page':undefined}><LineChart size={15} aria-hidden="true"/>{translate('markets')}</Link><Link href="/#platform" onClick={close}>{translate('platform')}</Link><Link href="/education" onClick={close} aria-current={active('/education')?'page':undefined}>{translate('education')}</Link><Link href="/about" onClick={close} aria-current={active('/about')?'page':undefined}>{translate('about')}</Link><Link href="/support" onClick={close} aria-current={active('/support')?'page':undefined}>{translate('support')}</Link><Link href="/waitlist" onClick={close}>{translate('joinWaitlist')}</Link><Link href="/login" onClick={close}><UserRound size={15} aria-hidden="true"/>{translate('login')}</Link><Link href="/register" className="nav-cta" onClick={close}>{translate('openAccount')} <ArrowUpRight size={14} aria-hidden="true"/></Link></> : <span className="muted text-sm" aria-live="polite">{modeError||translate('restoringSession')}</span>}
   </nav>
   <div className="nav-actions"><NotificationBell/><LanguageSelector/><button className="menu-button" type="button" aria-label={open?translate('closeMenu'):translate('openMenu')} aria-expanded={open} aria-controls="primary-navigation" onClick={()=>setOpen(!open)}>{open?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}</button></div>
 </div></header>
}

function ActivityIcon(){return <LineChart size={15} aria-hidden="true"/>}
