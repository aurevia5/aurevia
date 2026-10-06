'use client';
import type {ReactNode} from 'react';

export default function StartupShell({children}:{children:ReactNode}){
  return <div className="app-shell"><div className="scene-depth"><div className="scene-orb scene-orb-one"/><div className="scene-orb scene-orb-two"/><div className="scene-orb scene-orb-three"/></div><div className="scene-content">{children}</div></div>;
}
