'use client';

import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Activity,Bell,Check,CheckCheck,CircleDollarSign,Info,LifeBuoy,RefreshCw,ShieldCheck,UserRound,WalletCards} from 'lucide-react';
import Nav from '@/components/Nav';
import {relativeTime} from '@/components/NotificationBell';

type NotificationItem={id:string;type:string;title:string;message:string;isRead:boolean;createdAt:string;relatedEntity:string|null;relatedId:string|null;actionUrl:string|null};
type NotificationResponse={notifications:NotificationItem[];unreadCount:number};
const iconByType:Record<string,typeof Bell>={ACCOUNT:UserRound,SECURITY:ShieldCheck,KYC:ShieldCheck,DEPOSIT:CircleDollarSign,WITHDRAWAL:WalletCards,TRADE:Activity,MARKET:Activity,SUPPORT:LifeBuoy,SYSTEM:Info};

export default function NotificationsExperience(){
	const router=useRouter();
	const [data,setData]=useState<NotificationResponse>({notifications:[],unreadCount:0});
	const [loading,setLoading]=useState(true);
	const [error,setError]=useState('');
	const [busy,setBusy]=useState(false);

	async function load(){
		setLoading(true);setError('');
		try{const response=await fetch('/api/notifications?limit=100',{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to load notifications.');setData(result)}
		catch(exception){setError(exception instanceof Error?exception.message:'Unable to load notifications.')}
		finally{setLoading(false)}
	}
	useEffect(()=>{void load()},[]);

	async function mark(action:{action:'read';id:string}|{action:'read-all'}){
		if(busy)return;setBusy(true);setError('');
		try{const response=await fetch('/api/notifications',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(action)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to update notifications.');setData(current=>({unreadCount:result.unreadCount,notifications:current.notifications.map(item=>action.action==='read-all'||item.id===action.id?{...item,isRead:true}:item)}));window.dispatchEvent(new Event('aurevia:notifications'))}
		catch(exception){setError(exception instanceof Error?exception.message:'Unable to update notifications.')}
		finally{setBusy(false)}
	}

	async function open(item:NotificationItem){if(!item.isRead)await mark({action:'read',id:item.id});if(item.actionUrl)router.push(item.actionUrl)}

	return <><Nav/><main className="account-page notifications-page">
		<header className="account-heading"><div><span className="account-kicker">ACCOUNT CENTER</span><h1>Notifications</h1><p>Your account, verification, funding, trading, and support activity.</p></div><button type="button" className="icon-action" aria-label="Refresh notifications" onClick={()=>void load()}><RefreshCw size={15}/></button></header>
		{error&&<p className="mb-3 text-sm text-loss" role="alert">{error}</p>}
		<section className="account-panel card p-5"><div className="account-panel-title"><div><h2><Bell size={17} className="gold"/> Notification history</h2><p className="account-panel-subtitle">{data.unreadCount?`${data.unreadCount} unread notification${data.unreadCount===1?'':'s'}`:'All caught up'}</p></div><button type="button" className="text-link notification-mark-all" disabled={busy||!data.unreadCount} onClick={()=>void mark({action:'read-all'})}><CheckCheck size={15}/> Mark all read</button></div>
			{loading?<div className="account-empty" role="status">Loading notifications…</div>:data.notifications.length?<div className="notification-history-list">{data.notifications.map(item=>{const Icon=iconByType[item.type]||Info;return <article className={`notification-history-item ${item.isRead?'is-read':'is-unread'}`} key={item.id}><span className={`notification-icon notification-type-${item.type.toLowerCase()}`}><Icon size={17}/></span><button type="button" className="notification-history-copy" onClick={()=>void open(item)}><span className="notification-history-heading"><b>{item.title}</b>{!item.isRead&&<i>New</i>}</span><span>{item.message}</span><time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>{relativeTime(item.createdAt)} · {new Date(item.createdAt).toLocaleString()}</time></button>{!item.isRead&&<button type="button" className="icon-action notification-read-action" aria-label={`Mark ${item.title} as read`} disabled={busy} onClick={()=>void mark({action:'read',id:item.id})}><Check size={15}/></button>}</article>})}</div>:<div className="notification-empty-state"><Bell size={25} aria-hidden="true"/><h3>No notifications yet</h3><p>Updates about your account will appear here.</p></div>}
		</section>
	</main></>;
}