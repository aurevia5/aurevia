import type {ReactNode} from 'react';
import './globals.css';
import './experience.css';
import StartupShell from '@/components/StartupShell';
import Providers from '@/components/Providers';

export const metadata={title:'Aurevia Invest',description:'Aurevia Invest — digital trading and investment platform'};

export default function RootLayout({children}:{children:ReactNode}){
  return <html lang="en"><body><Providers><StartupShell>{children}</StartupShell></Providers></body></html>;
}
