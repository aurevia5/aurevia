'use client';

import Link from 'next/link';
import {useSession} from 'next-auth/react';
import {ArrowRight,ArrowUpRight,LayoutDashboard,Wallet} from 'lucide-react';

type Variant='hero'|'cta'|'trade'|'market';

export default function HomeAccountActions({variant}:{variant:Variant}){
	const {data,status}=useSession();
	if(status==='loading')return <div className="home-auth-actions" aria-busy="true" aria-label="Restoring account session"/>;
	if(status==='authenticated'&&data?.user){
		if(variant==='trade'&&data.user.accountMode==='DEMO')return <Link href="/trade" className="text-link">Open demo trading <ArrowRight size={16}/></Link>;
		if(variant==='trade')return <Link href="/wallet" className="text-link">Review real account activity <ArrowRight size={16}/></Link>;
		if(variant==='market')return <Link href="/trade" className="asset-link">Open trading workspace <ArrowUpRight size={15}/></Link>;
		return <div className="home-auth-actions"><Link href="/dashboard" className="button-primary"><LayoutDashboard size={16}/> Dashboard</Link><Link href="/wallet" className="button-secondary"><Wallet size={16}/> {data.user.accountMode} account</Link></div>;
	}
	if(variant==='trade')return <Link href="/login?callbackUrl=%2Ftrade" className="text-link">View the trading workspace <ArrowRight size={16}/></Link>;
	if(variant==='market')return <Link href="/login?callbackUrl=%2Ftrade" className="asset-link">Explore in demo <ArrowUpRight size={15}/></Link>;
	return <div className="home-auth-actions"><Link href="/register" className="button-primary">Open an account <ArrowUpRight size={17}/></Link><Link href="/login" className="button-secondary">Sign in <ArrowRight size={16}/></Link></div>;
}