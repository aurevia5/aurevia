import Image from 'next/image';
import Link from 'next/link';
import {Activity,ArrowRight,ArrowUpRight,BookOpen,Check,ChevronDown,CircleHelp,Globe2,Landmark,LockKeyhole,ShieldCheck,WalletCards} from 'lucide-react';
import Nav from '@/components/Nav';
import HomeAccountActions from '@/components/HomeAccountActions';
import HomeMarketPreview from '@/components/HomeMarketPreview';
import HomeMarketTicker from '@/components/HomeMarketTicker';

const principles=[
	{icon:LockKeyhole,title:'Account access',copy:'Credential-based sign-in and protected account areas keep personal views behind your session.'},
	{icon:WalletCards,title:'Portfolio visibility',copy:'Review your ledger balance, positions, orders, and funding requests in one place.'},
	{icon:Activity,title:'Market information',copy:'Explore the instruments currently available in the clearly labeled demo environment.'},
	{icon:ShieldCheck,title:'Account controls',copy:'Manage verification details and review the status of submitted information.'},
	{icon:Landmark,title:'Clear account records',copy:'Funding requests and account activity are presented with visible review states.'},
	{icon:Globe2,title:'Built for every screen',copy:'A responsive interface keeps essential account actions usable on mobile and desktop.'},
];

const steps=[
	['01','Create your account','Set up your profile and sign in.'],
	['02','Complete verification','Submit the details requested for review.'],
	['03','Request funding','Send a funding request for review. Demo methods are simulations.'],
	['04','Explore markets','Review instruments available in the demo environment.'],
	['05','Monitor your portfolio','Track ledger balance, positions, and orders.'],
	['06','Manage positions','Review or close supported demo positions.'],
];

const assetClasses=[
	{name:'Forex',status:'Available in demo',copy:'EUR/USD instrument in the simulated market feed.',icon:Globe2,available:true},
	{name:'Crypto',status:'Available in demo',copy:'BTC/USD and ETH/USD simulated instruments.',icon:Activity,available:true},
	{name:'Stocks',status:'Coming soon',copy:'Equity instruments are not enabled in this demo.',icon:Landmark},
	{name:'ETFs',status:'Coming soon',copy:'ETF instruments are not enabled in this demo.',icon:WalletCards},
	{name:'Indices',status:'Coming soon',copy:'Index instruments are not enabled in this demo.',icon:ArrowUpRight},
	{name:'Commodities',status:'Coming soon',copy:'Commodity instruments are not enabled in this demo.',icon:CircleHelp},
];

const questions=[
	['What can I do with an Aurevia account?','You can review demo market information, submit simulated funding requests, manage verification details, and use the trading interface for supported demo instruments.'],
	['How does verification work?','Submit your personal and identity details from Verification. The account status remains pending until an administrator reviews it.'],
	['Are funding methods connected to a bank or wallet?','No. The available funding methods are simulations and do not connect to a bank, card network, crypto wallet, or custody provider.'],
	['Is the market feed live?','The Markets page requests informational quotes from Yahoo Finance, an unofficial provider that may be delayed or unavailable. Trading uses a separate simulated market feed; neither feed connects to a broker or executes real trades.'],
	['Are trading fees shown?','The trading interface uses the fee settings configured for the demo instruments. Review the order estimate before submitting an order.'],
	['Is this financial advice?','No. Platform information is general and educational, not individualized investment advice. Trading involves risk, including the possible loss of capital.'],
];

export default function Home(){
	return <>
		<Nav/>
		<main className="home-root">
			<section className="home-hero">
				<div className="home-hero-grid" aria-hidden="true"/>
				<div className="home-hero-copy">
					<div className="home-kicker"><span/> Investment tools, in clear view</div>
					<div className="home-brand-lockup"><Image src="/aurevia-logo.png" alt="Aurevia Invest" width={46} height={46} priority/><span>AUREVIA <b>INVEST</b></span></div>
					<h1>Invest with clarity.<br/><em>Trade with confidence.</em></h1>
					<p className="home-hero-lede">Explore market information, review your portfolio, and manage supported demo positions from one considered workspace.</p>
					<div className="home-hero-actions"><HomeAccountActions variant="hero"/></div>
					<div className="home-hero-note"><span className="note-mark"><Check size={14}/></span><span>Demo environment <i/> Market prices and funding are simulated</span></div>
				</div>
				<div className="home-hero-visual"><HomeMarketPreview/><div className="hero-caption"><span>01 / MARKET VIEW</span><span>SIMULATED ENVIRONMENT</span></div></div>
				<a className="home-scroll-cue" href="#platform"><span>SCROLL TO EXPLORE</span><ChevronDown size={15}/></a>
			</section>

			<section className="market-ribbon" aria-label="Market data notice"><div className="ribbon-label"><span className="source-dot"/>Demo market watch</div><HomeMarketTicker/><span className="ribbon-disclaimer">SIMULATED DATA · NOT LIVE EXCHANGE PRICES</span></section>

			<section className="home-section platform-section" id="platform">
				<div className="section-heading"><div><p className="eyebrow">THE AUREVIA EXPERIENCE</p><h2>Useful tools.<br/><em>Clear information.</em></h2></div><p className="section-intro">A focused environment for exploring markets and understanding your account, without promises or noise.</p></div>
				<div className="principle-grid">{principles.map((item,index)=>{const Icon=item.icon;return <article className="principle-item" key={item.title}><span className="principle-index">0{index+1}</span><Icon size={21} strokeWidth={1.5}/><h3>{item.title}</h3><p>{item.copy}</p></article>})}</div>
			</section>

			<section className="experience-section" id="how-it-works">
				<div className="home-section experience-inner"><div className="section-heading"><div><p className="eyebrow">A SIMPLE ROUTE THROUGH THE PLATFORM</p><h2>Your investment<br/><em>experience.</em></h2></div><p className="section-intro">Move at your own pace. Each step makes the next account action easier to understand.</p></div>
					<ol className="experience-steps">{steps.map(([number,title,copy])=><li key={number}><span className="step-number">{number}</span><span className="step-rule"/><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol>
				</div>
			</section>

			<section className="home-section markets-section" id="markets">
				<div className="section-heading"><div><p className="eyebrow">MARKETS</p><h2>Explore what’s<br/><em>available.</em></h2></div><p className="section-intro">Availability reflects instruments configured in this application. The current feed is simulated, not connected to external venues.</p></div>
				<div className="asset-grid">{assetClasses.map(item=>{const Icon=item.icon;return <article className={`asset-item ${item.available?'asset-available':'asset-coming'}`} key={item.name}><div className="asset-top"><span className="asset-icon"><Icon size={20} strokeWidth={1.6}/></span><span className="asset-state">{item.status}</span></div><h3>{item.name}</h3><p>{item.copy}</p>{item.available?<HomeAccountActions variant="market"/>:<span className="asset-link asset-link-muted">Coming soon</span>}</article>})}</div>
			</section>

			<section className="preview-section" id="portfolio">
				<div className="home-section preview-inner"><div className="section-heading"><div><p className="eyebrow">PORTFOLIO WORKSPACE</p><h2>Everything in view.<br/><em>Nothing assumed.</em></h2></div><p className="section-intro">The signed-in workspace brings balances, positions, and market context together. Your account values come from your account, not a marketing preview.</p></div>
					<div className="dashboard-preview"><div className="preview-window"><div className="preview-window-bar"><span className="window-brand"><Image src="/aurevia-logo.png" alt="" width={25} height={25}/> Aurevia <b>Invest</b></span><span className="preview-example">EXAMPLE LAYOUT</span><span className="preview-window-dots"><i/><i/><i/></span></div><div className="preview-body"><aside className="preview-rail"><span className="rail-logo">A</span><span className="rail-active"><Activity size={16}/></span><span><WalletCards size={16}/></span><span><ShieldCheck size={16}/></span></aside><div className="preview-main"><div className="preview-greeting"><div><small>PORTFOLIO OVERVIEW</small><h3>Account snapshot</h3></div><span>Example</span></div><div className="preview-metrics"><div><small>Portfolio value</small><b>Example</b><span>Actual account data appears after sign in</span></div><div><small>Available balance</small><b>—</b><span>From your account ledger</span></div><div><small>Open positions</small><b>—</b><span>Updated from your positions</span></div></div><div className="preview-chart"><div className="preview-chart-head"><span>Portfolio activity</span><span>EXAMPLE VIEW</span></div><div className="preview-chart-lines"><span/><span/><span/><div className="preview-chart-path" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div className="preview-chart-axis"><span>Activity</span><span>Account values are not shown in this preview</span></div></div></div></div></div><div className="preview-side-note"><span className="note-mark"><Check size={14}/></span><div><b>Account-specific by design</b><p>Balances and performance are only shown inside your authenticated workspace.</p></div></div></div>
				</div>
			</section>

			<section className="home-section trading-section" id="trading">
				<div className="trading-copy"><p className="eyebrow">TRADING WORKSPACE</p><h2>Plan the order.<br/><em>Understand the details.</em></h2><p>Review instrument pricing, order type, estimated fees, and available ledger balance before submitting supported demo trades.</p><HomeAccountActions variant="trade"/></div>
				<div className="trade-steps"><div><span>01</span><b>Choose an instrument</b><small>Review the simulated market price.</small></div><div><span>02</span><b>Set order details</b><small>Select a supported side and order type.</small></div><div><span>03</span><b>Review before submit</b><small>Check estimated fees and available balance.</small></div></div>
			</section>

			<section className="home-section trust-section" id="security"><div className="trust-emblem"><ShieldCheck size={34} strokeWidth={1.2}/><span>ACCOUNT<br/>CONTROLS</span></div><div><p className="eyebrow">ACCOUNT & SECURITY</p><h2>Designed for<br/><em>account clarity.</em></h2><p className="section-intro">Aurevia uses authenticated account areas, role checks for administration, and auditable records for account activity. Review the account status and verification state shown in your workspace.</p><div className="trust-points"><span><Check size={15}/> Protected account routes</span><span><Check size={15}/> Server-validated actions</span><span><Check size={15}/> Clear verification states</span></div></div><div className="risk-note" id="risk"><span className="eyebrow">RISK NOTE</span><p>Investing and trading involve risk. Simulated prices do not represent live markets or predict future outcomes. You may lose some or all of your invested capital.</p></div></section>

			<section className="education-section" id="education"><div className="home-section"><div className="section-heading"><div><p className="eyebrow">LEARN AT YOUR PACE</p><h2>Market knowledge,<br/><em>without the noise.</em></h2></div><p className="section-intro">Explore general educational topics. Content is informational and is not personal investment advice.</p></div><div className="education-grid">{[['Investing basics','Build familiarity with common investment terms.'],['Market fundamentals','Understand what market prices and instruments represent.'],['Risk management','Learn about exposure, volatility, and position sizing.'],['Trading concepts','Review order types and execution basics.'],['Portfolio management','Explore diversification and portfolio monitoring.']].map(([title,copy],index)=><article key={title}><BookOpen size={18}/><span>0{index+1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>

			<section className="home-section news-section" id="news"><div className="news-mark"><Activity size={22}/></div><div><p className="eyebrow">MARKET INFORMATION</p><h2>Market news integration</h2><p>External news is not configured yet. No headlines are shown until a verified provider is connected.</p></div><span className="integration-state">PROVIDER NOT CONNECTED</span></section>

			<section className="home-section faq-section" id="faq"><div className="section-heading"><div><p className="eyebrow">GOOD TO KNOW</p><h2>Questions,<br/><em>answered clearly.</em></h2></div><p className="section-intro">A quick guide to the current Aurevia demo environment.</p></div><div className="faq-list">{questions.map(([question,answer])=><details key={question}><summary>{question}<ChevronDown size={18}/></summary><p>{answer}</p></details>)}</div></section>

			<section className="home-cta" id="support"><div><p className="eyebrow">AUREVIA INVEST</p><h2>Explore the platform<br/><em>at your own pace.</em></h2><p>Choose your account type and access clearly labeled account tools.</p></div><div className="home-cta-actions"><HomeAccountActions variant="cta"/></div></section>
		</main>
		<Footer/>
	</>;
}

function Footer(){
	return <footer className="home-footer"><div className="footer-main"><div className="footer-brand"><Link href="/" className="footer-logo"><Image src="/aurevia-logo.png" alt="Aurevia Invest" width={42} height={42}/><span>AUREVIA <b>INVEST</b></span></Link><p>A considered workspace for exploring markets and understanding your account.</p><span className="footer-demo-label">DEMO DATA · NO EXTERNAL EXECUTION</span></div><div className="footer-column"><b>Platform</b><Link href="/dashboard">Dashboard</Link><Link href="/trade">Trading</Link><Link href="/wallet">Wallet</Link><Link href="/kyc">Verification</Link></div><div className="footer-column"><b>Explore</b><a href="#markets">Markets</a><Link href="/client-stories">Client stories</Link><a href="#education">Education</a><a href="#news">Market information</a><a href="#faq">FAQs</a></div><div className="footer-column"><b>Information</b><Link href="/risk-disclosure">Risk disclosure</Link><a href="#security">Security</a><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Aurevia Invest</span><span>Demo environment · No external market or funding provider connected</span></div></footer>;
}
