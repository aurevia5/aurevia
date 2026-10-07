'use client';

import {useCallback,useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {useSession} from 'next-auth/react';
import AureviaStartup from '@/components/AureviaStartup';

const startupKey='aurevia-startup-complete';
const exitDurationMs=180;

export default function StartupShell({children}:{children:ReactNode}){
	const {status}=useSession();
	const [ready,setReady]=useState(false);
	const [showStartup,setShowStartup]=useState(true);
	const [isExiting,setIsExiting]=useState(false);

	const markStartupComplete=useCallback(()=>{
		try{sessionStorage.setItem(startupKey,'1')}catch{}
		document.documentElement.dataset.aureviaStartupComplete='true';
		setShowStartup(false);
	},[]);

	useEffect(()=>{
		try{
			if(sessionStorage.getItem(startupKey)==='1'){
				document.documentElement.dataset.aureviaStartupComplete='true';
				setShowStartup(false);
			}
		}catch{}
		setReady(true);
	},[]);

	useEffect(()=>{
		if(!ready||!showStartup||status==='loading')return;
		if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
			markStartupComplete();
			return;
		}
		setIsExiting(true);
		const timer=window.setTimeout(markStartupComplete,exitDurationMs);
		return()=>window.clearTimeout(timer);
	},[markStartupComplete,ready,showStartup,status]);

	return <div className="app-shell">
		<div className="scene-depth" aria-hidden="true"><div className="scene-orb scene-orb-one"/><div className="scene-orb scene-orb-two"/><div className="scene-orb scene-orb-three"/></div>
		<div className="scene-content"><div aria-hidden={showStartup} inert={showStartup}>{children}</div>{showStartup&&<AureviaStartup isExiting={isExiting}/>}</div>
	</div>;
}
