'use client';

import {useEffect,useId,useRef,useState,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {ChevronDown,Globe} from 'lucide-react';
import {localeMeta,locales} from '@/lib/i18n';
import {useLocale} from '@/lib/i18n-context';

export default function LanguageSelector(){
  const {locale,setLocale,transitioning}=useLocale();
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  const menuId=useId();
  const triggerRef=useRef<HTMLButtonElement>(null);

  useEffect(()=>{
    const close=(event:MouseEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false)};
    const key=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown',close);
    document.addEventListener('keydown',key);
    return ()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',key)};
  },[]);

  function closeAndRestoreFocus(){setOpen(false);triggerRef.current?.focus();}
  function choose(next:typeof locale){setLocale(next);setOpen(false);triggerRef.current?.focus();}
  function handleMenuKeyDown(event:ReactKeyboardEvent<HTMLDivElement>){
    if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
    event.preventDefault();
    const options=Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')||[]);
    const current=options.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex=current<0?event.key==='ArrowDown'?0:options.length-1:(current+ (event.key==='ArrowDown'?1:-1)+options.length)%options.length;
    options[nextIndex]?.focus();
  }

  return <div className="language-selector" ref={ref}>
    <button ref={triggerRef} type="button" className="language-selector-trigger" aria-label={`Select language. Current language: ${localeMeta[locale].nativeName}`} aria-expanded={open} aria-haspopup="menu" aria-controls={menuId} onClick={()=>setOpen(value=>!value)} disabled={transitioning}>
      <Globe size={16} aria-hidden="true"/><span aria-hidden="true">{localeMeta[locale].flag}</span><span className="language-current">{localeMeta[locale].nativeName}</span><ChevronDown size={13} aria-hidden="true"/>
    </button>
    {open&&<div id={menuId} className="language-menu" role="menu" aria-label="Languages" onKeyDown={handleMenuKeyDown}>
      <p>{localeMeta[locale].name}</p>
      {locales.map(item=><button key={item} type="button" role="menuitem" className={item===locale?'is-active':''} aria-current={item===locale?'true':undefined} onClick={()=>choose(item)}><span aria-hidden="true">{localeMeta[item].flag}</span><span><b>{localeMeta[item].nativeName}</b><small>{localeMeta[item].name}</small></span>{item===locale&&<span aria-hidden="true">✓</span>}</button>)}
    </div>}
  </div>;
}
