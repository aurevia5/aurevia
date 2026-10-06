import {redirect} from 'next/navigation';
import {getServerSession} from 'next-auth';
import Link from 'next/link';
import {ArrowUpRight,ChartNoAxesCombined,ShieldCheck,WalletCards} from 'lucide-react';
import {authOptions} from '@/lib/auth-options';
import {db} from '@/lib/db';
import {balance} from '@/lib/ledger';
import Nav from '@/components/Nav';
import MarketTicker from '@/components/MarketTicker';
import EquityChart from '@/components/EquityChart';

const usd=(value:number)=>`$${value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default async function Dashboard(){
	const session=await getServerSession(authOptions);
	if(!session?.user?.id)redirect('/login?callbackUrl=%2Fdashboard');

	const mode=session.user.accountMode;
	const account=await db.ledgerAccount.findUnique({where:{code:`USER:${session.user.id}:${mode}:USD`}});
	const [entries,positions,orders,market,user]=await Promise.all([
		account?db.ledgerEntry.findMany({where:{accountId:account.id},orderBy:{createdAt:'asc'},take:200}):Promise.resolve([]),
		db.position.findMany({where:{userId:session.user.id,accountMode:mode,status:'OPEN'},include:{instrument:true},orderBy:{openedAt:'desc'}}),
		db.order.findMany({where:{userId:session.user.id,accountMode:mode,status:'OPEN'},include:{instrument:true},orderBy:{createdAt:'desc'},take:8}),
		db.instrument.findMany({where:{enabled:true},orderBy:{symbol:'asc'}}),
		db.user.findUnique({where:{id:session.user.id},select:{email:true,kycStatus:true,accountMode:true}}),
	]);
	let running=0;
	const ledgerSeries=entries.map((entry,index)=>{
		running+=entry.type==='CREDIT'?Number(entry.amount):-Number(entry.amount);
		return {t:String(index+1),v:running};
	});
	const available=Number(account?await balance(db,account.id):0);
	const unrealized=positions.reduce((sum,position)=>{
		const price=Number(position.instrument.price),entry=Number(position.entryPrice),quantity=Number(position.quantity);
		return sum+(position.side==='BUY'?(price-entry)*quantity:(entry-price)*quantity);
	},0);
	const usedMargin=positions.reduce((sum,position)=>sum+Number(position.margin),0);
	const portfolioValue=mode==='DEMO'?available+usedMargin+unrealized:available;
	const watchlist=market.map(instrument=>({symbol:instrument.symbol,price:Number(instrument.price)}));
	const recentActivity=entries.slice(-6).reverse();

	return <><Nav/><main className="account-page">
		<header className="account-heading"><div><span className="account-kicker">{mode} ACCOUNT · Portfolio workspace</span><h1>Good to see you.</h1><p>{mode==='DEMO'?'Track your clearly separated demo account and explore simulated market activity.':'Review your real-account ledger and transaction requests. Trading execution is not connected.'}</p></div>{mode==='DEMO'&&<Link className="button-secondary" href="/trade">Open trading <ArrowUpRight size={15}/></Link>}</header>
		<div className="account-metrics">
			<div className="account-metric"><span>{mode==='DEMO'?'Demo portfolio value':'Real USD ledger balance'}</span><b>{usd(portfolioValue)}</b><small>{mode==='DEMO'?'Demo ledger + margin + simulated unrealized P&amp;L':'Posted USD ledger entries only'}</small></div>
			<div className="account-metric"><span>Available balance</span><b>{usd(available)}</b><small>From your USD ledger</small></div>
			<div className="account-metric"><span>{mode==='DEMO'?'Demo unrealized P&L':'Real trading'}</span><b className={mode==='DEMO'?(unrealized>=0?'text-profit':'text-loss'):''}>{mode==='DEMO'?`${unrealized>=0?'+':''}${usd(unrealized)}`:'Unavailable'}</b><small>{mode==='DEMO'?'Uses simulated prices and positions':'No external execution provider is connected'}</small></div>
			<div className="account-metric"><span>{mode==='DEMO'?'Demo used margin':'Pending real requests'}</span><b>{mode==='DEMO'?usd(usedMargin):'Review only'}</b><small>{mode==='DEMO'?`${positions.length} open ${positions.length===1?'position':'positions'}`:'See Wallet for pending status'}</small></div>
		</div>
		<div className="account-content-grid">
			<section className="account-panel card p-5"><div className="account-panel-title"><div><h2>Account activity</h2><p className="account-panel-subtitle">Ledger movements over time · USD</p></div><ChartNoAxesCombined size={18} className="gold" aria-hidden="true"/></div><EquityChart data={ledgerSeries.length?ledgerSeries:[{t:'0',v:0}]}/></section>
			<section className="account-panel card p-5"><div className="account-panel-title"><div><h2>Account status</h2><p className="account-panel-subtitle">{user?.email||session.user.email}</p></div><ShieldCheck size={18} className="gold" aria-hidden="true"/></div><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-3"><span className="muted text-sm">Verification</span><span className="status-pill">{user?.kycStatus==='APPROVED'?'Approved':user?.kycStatus==='REJECTED'?'Needs attention':'Pending'}</span></div><div className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="muted text-sm">Account</span><span className="text-sm">Active</span></div><Link href="/kyc" className="text-link mt-3">Review verification <ArrowUpRight size={14}/></Link></section>
		</div>
		<section className="account-panel card mt-4 p-5"><div className="account-panel-title"><div><h2>Open positions</h2><p className="account-panel-subtitle">Unrealized values use the current simulated instrument prices.</p></div><Link href="/trade" className="text-link">Manage positions <ArrowUpRight size={14}/></Link></div>{positions.length? <div className="account-table-wrap"><table className="account-table"><thead><tr><th>Instrument</th><th>Side</th><th>Quantity</th><th>Entry</th><th>Market</th><th>Unrealized P&amp;L</th></tr></thead><tbody>{positions.map(position=>{const price=Number(position.instrument.price),entry=Number(position.entryPrice),quantity=Number(position.quantity),pnl=position.side==='BUY'?(price-entry)*quantity:(entry-price)*quantity;return <tr key={position.id}><td>{position.instrument.symbol}</td><td>{position.side}</td><td>{quantity.toLocaleString()}</td><td>{priceText(entry)}</td><td>{priceText(price)}</td><td className={pnl>=0?'text-profit':'text-loss'}>{pnl>=0?'+':''}{usd(pnl)}</td></tr>})}</tbody></table></div>:<div className="account-empty"><div><WalletCards size={22} className="mx-auto mb-3 gold"/><p>No open positions</p><Link href="/trade" className="text-link">Explore demo markets <ArrowUpRight size={14}/></Link></div></div>}</section>
		<section className="account-panel card mt-4 p-5"><div className="account-panel-title"><div><h2>Market watch</h2><p className="account-panel-subtitle">Configured instruments · simulated prices, separate from all real-account records</p></div><span className="status-pill mode-demo">Demo feed only</span></div><MarketTicker initial={watchlist}/></section>
		<div className="account-content-grid dashboard-activity-grid">
			<section className="account-panel card p-5"><div className="account-panel-title"><div><h2>Recent account activity</h2><p className="account-panel-subtitle">Latest ledger entries for this account.</p></div><Link href="/wallet" className="text-link">Wallet <ArrowUpRight size={13}/></Link></div>{recentActivity.length?<div className="activity-list">{recentActivity.map(entry=><div className="activity-row" key={entry.id}><span className={`activity-type ${entry.type==='CREDIT'?'is-credit':'is-debit'}`}>{entry.type}</span><span className="activity-reference">{entry.createdAt.toISOString().slice(0,16).replace('T',' ')}</span><b className={entry.type==='CREDIT'?'text-profit':'text-loss'}>{entry.type==='CREDIT'?'+':'−'}{usd(Number(entry.amount))}</b></div>)}</div>:<div className="account-empty">No ledger activity recorded yet.</div>}</section>
			<section className="account-panel card p-5"><div className="account-panel-title"><div><h2>Open orders</h2><p className="account-panel-subtitle">Orders currently waiting for their trigger.</p></div><Link href="/trade" className="text-link">Trade <ArrowUpRight size={13}/></Link></div>{orders.length?<div className="activity-list">{orders.map(order=><div className="activity-row order-activity-row" key={order.id}><span className="activity-type">{order.side}</span><span className="activity-reference">{order.instrument.symbol} · {order.type}</span><b>{Number(order.quantity).toLocaleString()}</b></div>)}</div>:<div className="account-empty">No open orders.</div>}</section>
		</div>
		<section className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-5"><span className="muted text-xs">{mode==='DEMO'?'Demo values reflect this mode’s ledger and simulated positions.':'Real values reflect posted ledger entries only; no real execution is connected.'}</span><Link href="/wallet" className="text-link">Open wallet <ArrowUpRight size={14}/></Link></section>
	</main></>;
}

function priceText(value:number){return value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4});}
