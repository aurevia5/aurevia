import type {ReactNode} from 'react';
import Script from 'next/script';
import './globals.css';
import './experience.css';
import StartupShell from '@/components/StartupShell';
import Providers from '@/components/Providers';

export const metadata={title:'Aurevia Invest',description:'Aurevia Invest — digital trading and investment platform'};

export default function RootLayout({children}:{children:ReactNode}){
  return <html lang="en"><body><Script id="aurevia-startup-state" strategy="beforeInteractive">{`try{if(sessionStorage.getItem('aurevia-startup-complete')==='1')document.documentElement.dataset.aureviaStartupComplete='true'}catch{}`}</Script><Providers><StartupShell>{children}</StartupShell></Providers></body></html>;
}
