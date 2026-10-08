import {randomUUID} from 'node:crypto';
import {test,expect,loginAs,logout,waitForStartup,expectNoHorizontalOverflow} from './fixtures';

const viewports=[
	{width:320,height:800},
	{width:360,height:800},
	{width:375,height:812},
	{width:390,height:844},
	{width:393,height:852},
	{width:430,height:932},
	{width:414,height:896},
	{width:768,height:1024},
	{width:1024,height:900},
	{width:1280,height:900},
	{width:1440,height:900},
	{width:1920,height:1080},
];

const publicRoutes=['/','/login','/register','/markets','/client-stories','/about','/education','/support','/terms','/privacy','/risk-disclosure'];
const authenticatedRoutes=['/dashboard','/trade','/markets','/portfolio','/orders','/investments','/wallet','/wallet/transactions','/kyc','/tier','/settings','/support','/notifications'];
const adminRoutes=['/admin/login','/admin','/admin/investments','/admin/payments','/admin/support'];

function fixture(name:string){
	const value=process.env[`AUREVIA_E2E_${name}`];
	if(!value)throw new Error(`Playwright fixture ${name} is unavailable.`);
	return value;
}

test.describe('public routes and responsive layout',()=>{
	for(const viewport of viewports){
		test(`public routes render without horizontal overflow at ${viewport.width}x${viewport.height}`,async({page})=>{
			await page.setViewportSize(viewport);
			for(const route of publicRoutes){
				const response=await page.goto(route);
				expect(response?.status(),route).toBe(200);
				await expect(page.locator('h1').first(),route).toBeVisible();
				if(route==='/markets')await expect(page.getByRole('heading',{name:'Mercados',exact:true})).toBeVisible();
				if(route==='/support')await expect(page.getByRole('heading',{name:'Nova AI',exact:true})).toBeVisible();
				if(route==='/register'){
					await expect(page.getByRole('radio',{name:/DEMO ACCOUNT/})).toBeVisible();
					await expect(page.getByRole('radio',{name:/REAL ACCOUNT/})).toBeVisible();
				}
				await expectNoHorizontalOverflow(page);
			}
		});
	}
});

test('mobile navigation opens and navigates to Login',async({page})=>{
	await page.setViewportSize({width:320,height:800});
	await page.goto('/');
	await page.getByRole('button',{name:'Open navigation'}).click();
	const nav=page.getByRole('navigation',{name:'Primary navigation'});
	await expect(nav).toBeVisible();
	await nav.getByRole('link',{name:'Login'}).click();
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

test('startup waits for session initialization, then stays dismissed across navigation and refresh',async({page})=>{
	await page.emulateMedia({reducedMotion:'reduce'});
	let releaseSession!:()=>void;
	const sessionGate=new Promise<void>(resolve=>{releaseSession=resolve});
	await page.route('**/api/auth/session',async route=>{
		await sessionGate;
		await route.fulfill({status:200,contentType:'application/json',body:'{}'});
	});
	await page.goto('/login');
	const startup=page.getByRole('status',{name:'Loading Aurevia Invest'});
	await expect(startup).toBeVisible();
	releaseSession();
	await expect(startup).toBeHidden();
	await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
	await page.getByRole('link',{name:'Create an account'}).click();
	await expect(page.getByRole('heading',{name:'Open an account'})).toBeVisible();
	await expect(startup).toBeHidden();
	await page.goBack();
	await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
	await expect(startup).toBeHidden();
});

test('market refresh runs in place without reloading the page',async({page})=>{
	let documentRequests=0;
	let quoteRequests=0;
	let historyRequests=0;
	page.on('request',request=>{if(request.resourceType()==='document')documentRequests++});
	await page.route(/\/api\/live-markets\?symbols=/,route=>{
		quoteRequests++;
		return route.fulfill({status:200,contentType:'application/json',body:'{"quotes":[],"source":"isolated UI test"}'});
	});
	await page.route(/\/api\/live-markets\/[^?]+\?timeframe=/,async route=>{
		const timeframe=new URL(route.request().url()).searchParams.get('timeframe');
		historyRequests++;
		await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({quote:null,candles:[],timeframe,interval:'1m'})});
	});
	await page.goto('/markets');
	await waitForStartup(page);
	const beforeRetry=documentRequests;
	await expect.poll(()=>historyRequests).toBeGreaterThan(0);
	const priorQuotes=quoteRequests;
	const priorHistory=historyRequests;
	await page.getByRole('button',{name:'Actualizar cotizaciones'}).click();
	await expect.poll(()=>quoteRequests).toBeGreaterThan(priorQuotes);
	await expect.poll(()=>historyRequests).toBeGreaterThan(priorHistory);
	expect(documentRequests).toBe(beforeRetry);
});

test('country selector searches Nigeria and United Kingdom and shows their dialing codes',async({page})=>{
	await page.setViewportSize({width:320,height:800});
	await page.goto('/register');
	const picker=page.getByRole('button',{name:/phone country and dialing code/});
	await expect(picker).toHaveAttribute('aria-label',/United States \+1/);
	await picker.click();
	const dialog=page.getByRole('dialog',{name:'Select phone country and dialing code'});
	await expect(dialog).toBeVisible();
	await expectNoHorizontalOverflow(page);
	const search=dialog.getByRole('searchbox');
	await search.fill('Nigeria');
	const nigeria=dialog.getByRole('option',{name:/Nigeria.*NG.*\+234/});
	await expect(nigeria).toBeVisible();
	await search.press('ArrowDown');
	await expect(nigeria).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(picker).toHaveAttribute('aria-label',/Nigeria \+234/);
	await picker.click();
	const ukDialog=page.getByRole('dialog',{name:'Select phone country and dialing code'});
	await ukDialog.getByRole('searchbox').fill('United Kingdom');
	const uk=ukDialog.getByRole('option',{name:/United Kingdom.*GB.*\+44/});
	await expect(uk).toBeVisible();
	await uk.click();
	await expect(picker).toHaveAttribute('aria-label',/United Kingdom \+44/);
	await expectNoHorizontalOverflow(page);
});

test('mobile date entry is calendar-backed and future dates are blocked',async({page})=>{
	await page.setViewportSize({width:320,height:800});
	await page.goto('/register');
	const date=page.getByLabel('Date of birth');
	await expect(date).toHaveAttribute('type','date');
	await expect(date).toHaveAttribute('max',new Date().toISOString().slice(0,10));
	const future=new Date();future.setUTCDate(future.getUTCDate()+1);
	const futureDate=future.toISOString().slice(0,10);
	await date.fill(futureDate);
	await expect(date).toHaveValue(futureDate);
	const rejectsFuture=await date.evaluate((input:HTMLInputElement)=>input.validity.rangeOverflow);
	expect(rejectsFuture).toBe(true);
	await expectNoHorizontalOverflow(page);
});

test('sign-in password visibility, recovery link, and account link are accessible on mobile',async({page})=>{
	await page.setViewportSize({width:320,height:800});
	await page.goto('/login');
	const password=page.getByLabel('Password',{exact:true});
	await password.fill('ExamplePassword123');
	await page.getByRole('button',{name:'Show password'}).click();
	await expect(password).toHaveAttribute('type','text');
	await page.getByRole('button',{name:'Hide password'}).click();
	await expect(password).toHaveAttribute('type','password');
	await expect(page.getByRole('link',{name:'Forgot password?'})).toHaveAttribute('href','/forgot-password');
	await expect(page.getByRole('link',{name:'Create an account'})).toHaveAttribute('href','/register');
	await expectNoHorizontalOverflow(page);
});

test('registration selects account mode, verifies through delivery, then login persists until logout',async({page})=>{
	const email=fixture('REGISTRATION_EMAIL');
	const password=fixture('REGISTRATION_PASSWORD');
	await page.request.post('http://127.0.0.1:4311/reset');
	await page.goto('/register');
	await expect(page.getByRole('heading',{name:'Open an account'})).toBeVisible();
	await expect(page.getByRole('radio',{name:/DEMO ACCOUNT/})).toBeVisible();
	const realMode=page.getByRole('radio',{name:/REAL ACCOUNT/});
	await realMode.check();
	await expect(realMode).toBeChecked();
	const demoMode=page.getByRole('radio',{name:/DEMO ACCOUNT/});
	await demoMode.check();
	await expect(demoMode).toBeChecked();
	await page.getByLabel('First name').fill('Temporary');
	await page.getByLabel('Last name').fill('Browser Test');
	await page.getByLabel('Date of birth').fill('2000-02-29');
	const residencePicker=page.getByRole('button',{name:/country of residence/});
	await residencePicker.click();
	const residenceDialog=page.getByRole('dialog',{name:'Select country of residence'});
	await residenceDialog.getByRole('searchbox').fill('United States');
	await residenceDialog.getByRole('option',{name:/United States.*US.*\+1/}).click();
	const phonePicker=page.getByRole('button',{name:/phone country and dialing code/});
	await phonePicker.click();
	const phoneDialog=page.getByRole('dialog',{name:'Select phone country and dialing code'});
	await phoneDialog.getByRole('searchbox').fill('United Kingdom');
	await phoneDialog.getByRole('option',{name:/United Kingdom.*GB.*\+44/}).click();
	await page.getByLabel('Email address').fill(email);
	await page.getByLabel(/Phone number/).fill('07400 123456');
	await page.getByLabel('Password', {exact:true}).fill(password);
	await page.getByLabel('Confirm password').fill(password);
	await page.getByRole('checkbox').check();
	const registrationRequest=page.waitForRequest(request=>request.url().endsWith('/api/register')&&request.method()==='POST');
	await page.getByRole('button',{name:'Create account'}).click();
	const registrationPayload=(await registrationRequest).postDataJSON();
	expect(registrationPayload).toMatchObject({name:'Temporary Browser Test',country:'United States',phone:'+447400123456',dateOfBirth:'2000-02-29'});
	await expect(page.getByRole('heading',{name:'Verify your account'})).toBeVisible();
	const providerStats=await page.request.get('http://127.0.0.1:4311/stats');
	expect(await providerStats.json()).toMatchObject({email:1,sms:0});
	const unverifiedLogin=await page.context().newPage();
	await unverifiedLogin.goto('/login');
	await unverifiedLogin.getByLabel('Email or administrator username').fill(email);
	await unverifiedLogin.getByLabel('Password',{exact:true}).fill(password);
	await unverifiedLogin.getByRole('button',{name:'Sign in'}).click();
	await expect(unverifiedLogin.getByText(/Sign-in failed/)).toBeVisible();
	await unverifiedLogin.close();
	const codeResponse=await page.request.get(`http://127.0.0.1:4311/test-code?email=${encodeURIComponent(email)}`);
	expect(codeResponse.ok()).toBeTruthy();
	const code=(await codeResponse.json()).code as string;
	const invalidCode=code==='000000'?'000001':'000000';
	await page.getByLabel('Verification code').fill(invalidCode);
	await page.getByRole('button',{name:'Verify account'}).click();
	await expect(page.getByText('The code is incorrect.',{exact:true})).toBeVisible();
	await page.getByLabel('Verification code').fill(code);
	await page.getByRole('button',{name:'Verify account'}).click();
	await expect(page).toHaveURL(/\/login\?verified=1/);
	await expect(page.getByText('Your account is verified. Sign in to continue.',{exact:true})).toBeVisible();
	await page.getByLabel('Email or administrator username').fill(email);
	await page.getByLabel('Password',{exact:true}).fill(password);
	await page.getByRole('button',{name:'Sign in'}).click();
	await page.waitForURL(/dashboard/);
	const profileResponse=await page.request.get('/api/profile');
	expect(profileResponse.ok()).toBeTruthy();
	const profile=await profileResponse.json();
	expect(profile.phoneVerified).toBe(false);
	expect(profile).not.toHaveProperty('dob');
	expect(profile).not.toHaveProperty('dateOfBirth');
	const kycResponse=await page.request.get('/api/kyc');
	expect((await kycResponse.json()).dob).toBe('2000-02-29T00:00:00.000Z');
	const demoWallet=await page.request.get('/api/wallet');
	expect(Number((await demoWallet.json()).balance)).toBe(5000);
	await page.getByLabel('Account mode').selectOption('REAL');
	await expect.poll(async()=>Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(0);
	await page.getByLabel('Account mode').selectOption('DEMO');
	await expect.poll(async()=>Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(5000);
	await page.goto('/');
	await expect(page.getByRole('link',{name:/Dashboard/}).first()).toBeVisible();
	await expect(page.getByRole('button',{name:/Notifications/})).toBeVisible();
	await expect(page.getByRole('link',{name:'Login'})).toHaveCount(0);
	await page.reload();
	await expect(page.getByRole('button',{name:/Notifications/})).toBeVisible();
	await logout(page);
	await expect(page).toHaveURL(/\/login/);
	await page.goto('/');
	await expect(page.getByRole('link',{name:'Login'})).toBeVisible();
	await expect(page.getByRole('link',{name:'Open an account'}).first()).toBeVisible();
});

test('legacy account without registration verification metadata can still sign in',async({page})=>{
	await loginAs(page,fixture('LEGACY_USER_EMAIL'),fixture('LEGACY_USER_PASSWORD'));
	await expect(page.getByRole('heading',{name:'Hello, Legacy'})).toBeVisible();
	await expect(page.getByRole('button',{name:/Notifications/})).toBeVisible();
});

test('session replacement is explicit and refresh-safe',async({page,browser})=>{
	const email=fixture('USER_EMAIL');
	const password=fixture('USER_PASSWORD');
	await page.goto('/login');
	await page.getByLabel('Email or administrator username').fill(email);
	await page.getByLabel('Password',{exact:true}).fill(password);
	await page.getByRole('button',{name:'Sign in'}).click();
	await page.waitForURL(/dashboard/);
	await page.reload();
	await expect(page.getByRole('heading',{name:'Hello, Temporary'})).toBeVisible();
	const otherContext=await browser.newContext();
	try{
		const otherDevice=await otherContext.newPage();
		await otherDevice.goto('/login');
		await otherDevice.getByLabel('Email or administrator username').fill(email);
		await otherDevice.getByLabel('Password',{exact:true}).fill(password);
		await otherDevice.getByRole('checkbox',{name:/Replace the active Aurevia session/}).check();
		await otherDevice.getByRole('button',{name:'Sign in'}).click();
		await otherDevice.waitForURL(/dashboard/);
		const response=await page.request.get('/api/dashboard');
		expect(response.status()).toBe(401);
	}finally{await otherContext.close();}
});

for(const viewport of viewports){
	test(`authenticated routes render without horizontal overflow at ${viewport.width}x${viewport.height}`,async({page})=>{
		await page.setViewportSize(viewport);
		await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
		for(const route of authenticatedRoutes){
			const response=await page.goto(route);
			expect(response?.status(),route).toBe(200);
			await expect(page.locator('h1').first(),route).toBeVisible();
			await expectNoHorizontalOverflow(page);
		}
	});
}

test('notifications bell, unread state, mark one/all, and history persist',async({page})=>{
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	await page.goto('/');
	const bell=page.getByRole('button',{name:/Notifications/});
	await expect(bell).toContainText(/\d/);
	await bell.click();
	await expect(page.getByRole('dialog',{name:'Notifications'})).toBeVisible();
	const first=page.locator('.notification-row').filter({hasText:'E2E unread notification one'});
	await expect(first).toBeVisible();
	await first.click();
	await page.getByRole('button',{name:'Mark all notifications as read'}).click();
	await expect(page.locator('.notification-count')).toHaveCount(0);
	await page.goto('/notifications');
	await expect(page.getByRole('heading',{name:'Notifications'})).toBeVisible();
	await expect(page.getByText('All caught up')).toBeVisible();
	await page.reload();
	await expect(page.getByText('All caught up')).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

test('account-mode changes refresh and isolate wallet, trade, history, and support state',async({page})=>{
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	const mode=page.getByLabel('Account mode');
	await page.goto('/wallet');
	await expect(page.getByText('DEMO ACCOUNT',{exact:true}).last()).toBeVisible();
	let releaseModeUpdate!:()=>void;
	const modeUpdateGate=new Promise<void>(resolve=>{releaseModeUpdate=resolve});
	await page.route('**/api/account/mode',async route=>{await modeUpdateGate;await route.continue()});
	await mode.selectOption('REAL');
	await expect(mode).toBeDisabled();
	releaseModeUpdate();
	await page.unroute('**/api/account/mode');
	await expect(mode).toHaveValue('REAL');
	await expect(page.getByText('REAL ACCOUNT',{exact:true}).last()).toBeVisible();
	await expect(page.locator('.wallet-balance-value')).toHaveText('0.00 USD');
	const instrumentsResponse=await page.request.get('/api/market');
	const instruments=await instrumentsResponse.json();
	const realOrderResponse=await page.request.post('/api/orders',{data:{instrumentId:instruments[0].id,side:'BUY',type:'MARKET',quantity:1}});
	expect(realOrderResponse.status()).toBe(400);
	expect((await realOrderResponse.json()).error).toContain('REAL_EXECUTION_UNAVAILABLE');
	await page.goto('/wallet/transactions');
	await expect(page.locator('.account-heading .status-pill')).toContainText('REAL ACCOUNT');
	await expect(page.getByText('No transactions yet')).toBeVisible();
	await mode.selectOption('DEMO');
	await expect(page.locator('.account-heading .status-pill')).toContainText('DEMO ACCOUNT');
	await page.goto('/trade');
	await mode.selectOption('REAL');
	await expect(page.getByText('REAL execution status',{exact:true})).toBeVisible();
	await expect(page.getByRole('button',{name:'Place BUY order'})).toHaveCount(0);
	await mode.selectOption('DEMO');
	await expect(page.getByRole('button',{name:'Place BUY order'})).toBeEnabled();
	await page.goto('/support');
	await page.getByRole('button',{name:'Contact Admin'}).click();
	const subject=`Mode-scoped support ${randomUUID().slice(0,8)}`;
	await page.getByLabel('Subject').fill(subject);
	await page.getByLabel('Message').fill('Temporary DEMO support isolation test.');
	await page.getByRole('button',{name:'Create support ticket'}).click();
	await expect(page.getByRole('button').filter({hasText:subject})).toBeVisible();
	await mode.selectOption('REAL');
	await expect(page.getByRole('button').filter({hasText:subject})).toHaveCount(0);
	await mode.selectOption('DEMO');
	await expect(page.getByRole('button').filter({hasText:subject})).toBeVisible();
});

test('REAL provider status is admin-only and unconfirmed REAL funding cannot post or settle',async({browser,page})=>{
	await loginAs(page,fixture('INVESTOR_EMAIL'),fixture('INVESTOR_PASSWORD'));
	expect((await page.request.get('/api/admin/providers/status')).status()).toBe(403);
	expect((await page.request.post('/api/webhooks/broker/unconfigured',{data:{eventId:'synthetic-test-event'}})).status()).toBe(503);
	await page.getByLabel('Account mode').selectOption('REAL');
	await expect.poll(async()=>Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(0);
	const instruments=await page.request.get('/api/market').then(response=>response.json());
	const blockedOrder=await page.request.post('/api/orders',{headers:{'Idempotency-Key':randomUUID()},data:{instrumentId:instruments[0].id,side:'BUY',type:'MARKET',quantity:1}});
	expect(blockedOrder.status()).toBe(400);
	expect((await blockedOrder.json()).error).toContain('REAL_EXECUTION_UNAVAILABLE');
	const secondBlockedOrder=await page.request.post('/api/orders',{headers:{'Idempotency-Key':randomUUID()},data:{instrumentId:instruments[0].id,side:'BUY',type:'MARKET',quantity:1}});
	expect(secondBlockedOrder.status()).toBe(400);
	expect(await page.request.get('/api/orders').then(response=>response.json())).toHaveLength(0);

	const adminContext=await browser.newContext();
	try{
		const adminPage=await adminContext.newPage();
		await loginAs(adminPage,fixture('ADMIN_EMAIL'),fixture('ADMIN_PASSWORD'));
		const statusResponse=await adminPage.request.get('/api/admin/providers/status');
		expect(statusResponse.ok()).toBe(true);
		const status=await statusResponse.json();
		expect(status.realExecution).toMatchObject({status:'DISABLED',enabled:false,executionPathEnabled:false,adapterRegistered:false});
		expect(status.funding).toMatchObject({status:'NOT_CONFIGURED',realDepositsCreditOnlyOnProviderConfirmation:true});
		expect(status.investments).toMatchObject({status:'NOT_CONFIGURED',realLifecycleActionsEnabled:false});
		expect(status.realExecution.configuredVariables).toHaveProperty('BROKER_API_KEY');
		expect(JSON.stringify(status)).not.toContain('://');

		const depositApproval=await adminPage.request.patch('/api/admin/funding',{data:{id:fixture('REAL_DEPOSIT_ID'),decision:'APPROVED'}});
		expect(depositApproval.status()).toBe(409);
		expect((await depositApproval.json()).error).toBe('REAL_DEPOSIT_PROVIDER_UNAVAILABLE');
		const withdrawalApproval=await adminPage.request.patch('/api/admin/funding',{data:{id:fixture('REAL_WITHDRAWAL_ID'),decision:'APPROVED'}});
		expect(withdrawalApproval.status()).toBe(409);
		expect((await withdrawalApproval.json()).error).toBe('REAL_WITHDRAWAL_PROVIDER_UNAVAILABLE');
		const settlement=await adminPage.request.post('/api/admin/funding/settle',{data:{id:fixture('REAL_WITHDRAWAL_ID'),settlementReference:'TEST-REFERENCE'}});
		expect(settlement.status()).toBe(503);
		expect((await settlement.json()).error).toBe('REAL_WITHDRAWAL_PROVIDER_UNAVAILABLE');
		const fundingHistory=await adminPage.request.get('/api/admin/funding?history=true').then(response=>response.json());
		expect(fundingHistory.find((row:{id:string})=>row.id===fixture('REAL_DEPOSIT_ID')).status).toBe('PENDING_REVIEW');
		expect(fundingHistory.find((row:{id:string})=>row.id===fixture('REAL_WITHDRAWAL_ID'))).toMatchObject({status:'PENDING_REVIEW',settlementReference:null,settledAt:null});
	}finally{await adminContext.close();}

	await page.getByLabel('Account mode').selectOption('DEMO');
	await expect.poll(async()=>Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(5000);
});

test('DEMO trading supports cash-backed buy and owned-unit sell execution',async({browser,page})=>{
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	const symbol=fixture('INSTRUMENT_B');
	await page.goto('/markets');
	await expect(page.getByRole('heading',{name:'Mercados',exact:true})).toBeVisible();
	const marketPageUrl=page.url();
	const tradePage=await page.context().newPage();
	try{
		await tradePage.goto('/trade');
		const instrument=tradePage.getByRole('button',{name:new RegExp(symbol.replace('/','\\/'))});
		await expect(instrument).toBeVisible();
		await instrument.click();
		await expect(tradePage.locator('.recharts-surface').first()).toBeVisible();
		await expect(tradePage.getByText('Internal simulated market')).toBeVisible();
		const orderResponsePromise=tradePage.waitForResponse(response=>response.url().endsWith('/api/orders')&&response.request().method()==='POST');
		await tradePage.getByRole('button',{name:'Place BUY order'}).click();
		await expect(tradePage.getByRole('status')).toContainText('Order accepted');
		const orderResponse=await orderResponsePromise;
		expect(orderResponse.ok()).toBeTruthy();
		const order=await orderResponse.json();
		expect(order.status).toBe('FILLED');
		expect(order.executions).toHaveLength(1);
		await tradePage.getByRole('button',{name:'Sell',exact:true}).click();
		const sellResponsePromise=tradePage.waitForResponse(response=>response.url().endsWith('/api/orders')&&response.request().method()==='POST');
		await tradePage.getByRole('button',{name:'Place SELL order'}).click();
		await expect(tradePage.getByRole('status')).toContainText('Order accepted');
		const sellResponse=await sellResponsePromise;
		expect(sellResponse.ok()).toBeTruthy();
		expect((await sellResponse.json()).status).toBe('FILLED');
		const openPositions=await tradePage.request.get('/api/positions');
		expect(await openPositions.json()).toHaveLength(0);
		const freshMarkets=await tradePage.request.get('/api/market').then(response=>response.json());
		const freshInstrument=freshMarkets.find((item:{symbol:string})=>item.symbol===symbol);
		const oversell=await tradePage.request.post('/api/orders',{headers:{'Idempotency-Key':randomUUID()},data:{instrumentId:freshInstrument.id,side:'SELL',type:'MARKET',quantity:1,expectedPrice:Number(freshInstrument.price),observedAt:freshInstrument.lastUpdatedAt}});
		expect(oversell.status()).toBe(400);
		expect((await oversell.json()).error).toContain('INSUFFICIENT_POSITION');
		const privateActivity=await tradePage.request.get('/api/market/activity').then(response=>response.json());
		expect(privateActivity.source).toBe('simulated execution records');
		expect(privateActivity.activity.filter((event:{instrument:string;accountMode:string})=>event.instrument===symbol&&event.accountMode==='DEMO')).toHaveLength(2);
		const unrelatedContext=await browser.newContext();
		try{
			const unrelatedPage=await unrelatedContext.newPage();
			await loginAs(unrelatedPage,fixture('LEGACY_USER_EMAIL'),fixture('LEGACY_USER_PASSWORD'));
			const unrelatedActivity=await unrelatedPage.request.get('/api/market/activity').then(response=>response.json());
			expect(unrelatedActivity.activity).toHaveLength(0);
		}finally{await unrelatedContext.close();}
		expect(page.url()).toBe(marketPageUrl);
		await page.getByLabel('Account mode').selectOption('REAL');
		await expect.poll(async()=>{
			const response=await tradePage.request.get('/api/market/activity');
			return (await response.json()).activity;
		}).toHaveLength(0);
		await page.getByLabel('Account mode').selectOption('DEMO');
		await expectNoHorizontalOverflow(page);
	}finally{if(!tradePage.isClosed())await tradePage.close();}
});

test('closing a DEMO position records a sell execution, reconciles portfolio, and notifies',async({page})=>{
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	const initialWallet=await page.request.get('/api/wallet').then(response=>response.json());
	expect(Number(initialWallet.balance)).toBeGreaterThan(0);
	const instruments=await page.request.get('/api/market').then(response=>response.json());
	const instrument=instruments.find((item:{symbol:string})=>item.symbol===fixture('INSTRUMENT_A'));
	expect(instrument).toBeTruthy();
	const buy=await page.request.post('/api/orders',{headers:{'Idempotency-Key':randomUUID()},data:{instrumentId:instrument.id,side:'BUY',type:'MARKET',quantity:1,expectedPrice:Number(instrument.price),observedAt:instrument.lastUpdatedAt}});
	expect(buy.ok()).toBeTruthy();
	expect((await buy.json()).status).toBe('FILLED');
	const afterBuyWallet=await page.request.get('/api/wallet').then(response=>response.json());
	expect(Number(afterBuyWallet.balance)).toBeLessThan(5000);
	const positions=await page.request.get('/api/positions').then(response=>response.json());
	expect(positions).toHaveLength(1);
	const openPortfolio=await page.request.get('/api/portfolio').then(response=>response.json());
	expect(Number(openPortfolio.totalValue)).toBeCloseTo(Number(openPortfolio.cashBalance)+Number(openPortfolio.positionValue),2);

	const close=await page.request.post('/api/positions',{data:{positionId:positions[0].id}});
	expect(close.ok()).toBeTruthy();
	expect((await page.request.get('/api/positions').then(response=>response.json()))).toHaveLength(0);
	const orders=await page.request.get('/api/orders').then(response=>response.json());
	const closeOrder=orders.find((order:{side:string;instrumentId:string;status:string})=>order.side==='SELL'&&order.instrumentId===instrument.id&&order.status==='FILLED');
	expect(closeOrder).toBeTruthy();
	expect(closeOrder.executions).toHaveLength(1);
	const closedPortfolio=await page.request.get('/api/portfolio').then(response=>response.json());
	expect(Number(closedPortfolio.positionValue)).toBe(0);
	expect(closedPortfolio.realizedPnl).not.toBeNull();
	const notificationResponse=await page.request.get('/api/notifications?limit=100').then(response=>response.json());
	expect(notificationResponse.notifications.some((item:{title:string;relatedId:string|null})=>item.relatedId===closeOrder.id&&item.title==='Demo position closed')).toBe(true);
});

test('investment requests remain mode-isolated through admin review without fake REAL settlement',async({browser,page})=>{
	const adminContext=await browser.newContext();
	const adminPage=await adminContext.newPage();
	try{
		await loginAs(adminPage,fixture('ADMIN_EMAIL'),fixture('ADMIN_PASSWORD'));
		const opportunityResponse=await adminPage.request.post('/api/admin/investments',{data:{title:'E2E simulated opportunity',category:'Test allocation',description:'Disposable investment terms for isolated Playwright coverage.',assetSymbol:null,minimumAmount:100,maximumAmount:10000,targetReturnPercent:8,durationDays:30,startsAt:null,maturesAt:null,riskLevel:'MODERATE',status:'AVAILABLE',demoEligible:true,realEligible:true,requiresApproval:true,targetPrice:null,stopPrice:null}});
		expect(opportunityResponse.status()).toBe(201);
		const opportunity=await opportunityResponse.json();

		await loginAs(page,fixture('INVESTOR_EMAIL'),fixture('INVESTOR_PASSWORD'));
		const profile=await page.request.get('/api/profile').then(response=>response.json());
		const initialDemoWallet=await page.request.get('/api/wallet').then(response=>response.json());
		expect(Number(initialDemoWallet.balance)).toBe(5000);
		await page.goto('/investments');
		await expect(page.getByRole('heading',{name:'Available opportunities'})).toBeVisible();
		await page.getByLabel('Amount (USD)').fill('1000');
		await page.getByRole('button',{name:'Request investment'}).click();
		await expect(page.getByRole('status')).toContainText('DEMO request recorded');
		let userInvestments=await page.request.get('/api/investments').then(response=>response.json());
		const demoRequest=userInvestments.requests.find((item:{opportunityId:string;accountMode:string})=>item.opportunityId===opportunity.id&&item.accountMode==='DEMO');
		expect(demoRequest.status).toBe('PENDING_APPROVAL');
		expect(Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(4000);

		const unrelatedContext=await browser.newContext();
		try{
			const unrelatedPage=await unrelatedContext.newPage();
			await loginAs(unrelatedPage,fixture('LEGACY_USER_EMAIL'),fixture('LEGACY_USER_PASSWORD'));
			const isolated=await unrelatedPage.request.get('/api/investments').then(response=>response.json());
			expect(isolated.requests).toHaveLength(0);
			expect((await unrelatedPage.request.get('/api/admin/investments')).status()).toBe(403);
		}finally{await unrelatedContext.close();}

		async function review(requestId:string,action:string,extra:Record<string,unknown>={}){
			const response=await adminPage.request.patch('/api/admin/investments',{data:{requestId,action,...extra}});
			const result=await response.json();
			expect(response.ok(),`${action}: ${result.error||response.status()}`).toBeTruthy();
			return result;
		}
		await review(demoRequest.id,'approve');
		await review(demoRequest.id,'activate');
		await review(demoRequest.id,'complete');
		expect(Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(4000);
		await review(demoRequest.id,'settle',{simulatedPayout:1100});
		userInvestments=await page.request.get('/api/investments').then(response=>response.json());
		expect(userInvestments.requests.find((item:{id:string})=>item.id===demoRequest.id).status).toBe('SETTLED');
		expect(Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(5100);

		const kycResponse=await adminPage.request.patch('/api/admin/users',{data:{userId:profile.id,kycStatus:'APPROVED',reviewNote:'Isolated E2E verification fixture.'}});
		expect(kycResponse.ok()).toBeTruthy();
		await page.getByLabel('Account mode').selectOption('REAL');
			await expect.poll(async()=>Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(0);
		await page.goto('/investments');
		await expect(page.getByText(/administrator review of an identity profile, not external KYC\/AML clearance/i)).toBeVisible();
		const realRequestResponse=await page.request.post('/api/investments',{headers:{'Idempotency-Key':randomUUID()},data:{opportunityId:opportunity.id,amount:500}});
		expect(realRequestResponse.status()).toBe(201);
		const realRequest=await realRequestResponse.json();
		expect(realRequest.status).toBe('PENDING_APPROVAL');
		expect(Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(0);
		await review(realRequest.id,'approve');
		const unreferencedActivation=await adminPage.request.patch('/api/admin/investments',{data:{requestId:realRequest.id,action:'activate'}});
		expect(unreferencedActivation.status()).toBe(409);
		const fabricatedActivation=await adminPage.request.patch('/api/admin/investments',{data:{requestId:realRequest.id,action:'activate',executionReference:'UNVERIFIED-REFERENCE'}});
		expect(fabricatedActivation.status()).toBe(409);
		expect((await fabricatedActivation.json()).error).toBe('REAL_INVESTMENT_PROVIDER_UNAVAILABLE');
		const fabricatedSettlement=await adminPage.request.patch('/api/admin/investments',{data:{requestId:realRequest.id,action:'settle',settlementReference:'UNVERIFIED-SETTLEMENT',simulatedPayout:600}});
		expect(fabricatedSettlement.status()).toBe(409);
		expect((await fabricatedSettlement.json()).error).toBe('REAL_INVESTMENT_PROVIDER_UNAVAILABLE');
		await review(realRequest.id,'cancel');
		expect(Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(0);

		await page.getByLabel('Account mode').selectOption('DEMO');
			await expect.poll(async()=>Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(5100);
			await logout(page);
		await loginAs(page,fixture('INVESTOR_EMAIL'),fixture('INVESTOR_PASSWORD'));
		const persistedDemoWallet=await page.request.get('/api/wallet').then(response=>response.json());
		expect(Number(persistedDemoWallet.balance)).toBe(5100);
		await page.goto('/portfolio');
		await page.getByRole('button',{name:'Reset DEMO'}).click();
		await page.getByLabel('Type RESET DEMO ACCOUNT to confirm').fill('RESET DEMO ACCOUNT');
		await page.getByRole('button',{name:'Confirm DEMO reset'}).click();
		await expect(page.getByRole('status')).toContainText('DEMO portfolio reset to $5,000.00');
		expect(Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(5000);
		await page.getByLabel('Account mode').selectOption('REAL');
			await expect.poll(async()=>Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(0);
		await expectNoHorizontalOverflow(page);
	}finally{await adminContext.close();}
});

test('Nova escalation reaches admin and admin response appears with notification',async({page})=>{
	const subject=`E2E support ${randomUUID().slice(0,8)}`;
	const reply='Temporary Playwright admin response.';
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	await page.goto('/support');
	await expect(page.getByRole('heading',{name:'Nova AI',exact:true})).toBeVisible();
	const supportContact=await page.request.get('/api/support/contact').then(response=>response.json());
	if(supportContact.email)await expect(page.getByRole('link',{name:new RegExp(supportContact.email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))})).toBeVisible();
	else await expect(page.getByText('Direct email is not configured. Authenticated support tickets remain available.')).toBeVisible();
	await page.getByRole('button',{name:'Contact Admin'}).click();
	await page.getByLabel('Subject').fill(subject);
	await page.getByLabel('Message').fill('Please review this disposable browser test ticket.');
	await page.getByRole('button',{name:'Create support ticket'}).click();
	await expect(page.getByRole('status')).toContainText(/created\./i);
	await logout(page);
	await expect(page).toHaveURL(/\/login/);
	await loginAs(page,fixture('ADMIN_EMAIL'),fixture('ADMIN_PASSWORD'));
	await page.goto('/admin/support');
	await page.getByRole('button',{name:new RegExp(subject)}).click();
	await page.getByLabel('Admin response').fill(reply);
	await page.getByRole('button',{name:'Send response'}).click();
	await expect(page.getByRole('status')).toContainText('Response sent to the user');
	await logout(page);
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	await page.goto('/notifications');
	await expect(page.getByText('Admin replied to your support ticket')).toBeVisible();
	await page.goto('/support');
	const ticket=page.getByRole('button').filter({hasText:subject});
	await ticket.click();
	await expect(page.getByText(reply)).toBeVisible();
});

test('administrator email sign-in persists through refresh and logout removes admin access',async({page})=>{
	await page.goto('/admin/login');
	await page.getByLabel('Admin username').fill(fixture('ADMIN_EMAIL'));
	await page.getByLabel('Password',{exact:true}).fill(fixture('ADMIN_PASSWORD'));
	await page.getByRole('checkbox',{name:/Replace another active Aurevia session/}).check();
	await page.getByRole('button',{name:'Enter control center'}).click();
	await page.waitForURL(/\/admin$/);
	await expect(page.getByRole('heading',{name:'Aurevia administration'})).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading',{name:'Aurevia administration'})).toBeVisible();
	await logout(page);
	await expect(page).toHaveURL(/\/login/);
	await page.goto('/admin');
	await expect(page).toHaveURL(/\/login/);
});

test('a normal customer cannot access the administrator dashboard',async({page})=>{
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	await page.goto('/admin');
	await expect(page).toHaveURL(/\/login/);
});

test('admin pages render for authenticated administrator at requested viewports',async({page})=>{
	await loginAs(page,fixture('ADMIN_EMAIL'),fixture('ADMIN_PASSWORD'));
	for(const viewport of viewports){
		await page.setViewportSize(viewport);
		for(const route of adminRoutes){
			const response=await page.goto(route);
			expect(response?.status(),route).toBe(200);
			await expect(page.locator('h1').first(),route).toBeVisible();
			await expectNoHorizontalOverflow(page);
		}
	}
});

test('DEMO order idempotency prevents duplicate fills and user history stays isolated',async({browser,page})=>{
	await loginAs(page,fixture('LEGACY_USER_EMAIL'),fixture('LEGACY_USER_PASSWORD'));
	const startingBalance=Number((await page.request.get('/api/wallet').then(response=>response.json())).balance);
	expect(startingBalance).toBe(5000);
	const symbol=fixture('INSTRUMENT_A');
	const instruments=await page.request.get('/api/market').then(response=>response.json());
	const instrument=instruments.find((item:{symbol:string})=>item.symbol===symbol);
	expect(instrument).toBeTruthy();
	const key=randomUUID();
	const payload={instrumentId:instrument.id,side:'BUY',type:'MARKET',quantity:1,expectedPrice:Number(instrument.price),observedAt:instrument.lastUpdatedAt};
	const first=await page.request.post('/api/orders',{headers:{'Idempotency-Key':key},data:payload});
	const replay=await page.request.post('/api/orders',{headers:{'Idempotency-Key':key},data:payload});
	expect(first.status()).toBe(201);
	expect(replay.status()).toBe(201);
	const firstOrder=await first.json();
	const replayOrder=await replay.json();
	expect(replayOrder.id).toBe(firstOrder.id);
	expect(replayOrder.executions).toHaveLength(1);
	const afterBalance=Number((await page.request.get('/api/wallet').then(response=>response.json())).balance);
	expect(afterBalance).toBeLessThan(startingBalance);
	expect(Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(afterBalance);
	expect(await page.request.get('/api/orders').then(response=>response.json()).then((orders:Array<{id:string}>)=>orders.filter(order=>order.id===firstOrder.id))).toHaveLength(1);
	let position=(await page.request.get('/api/positions').then(response=>response.json()))[0];
	expect(Number(position.quantity)).toBe(1);

	const updatedMarket=await page.request.get('/api/market').then(response=>response.json());
	const updatedInstrument=updatedMarket.find((item:{symbol:string})=>item.symbol===symbol);
	const secondBuy=await page.request.post('/api/orders',{headers:{'Idempotency-Key':randomUUID()},data:{instrumentId:updatedInstrument.id,side:'BUY',type:'MARKET',quantity:1,expectedPrice:Number(updatedInstrument.price),observedAt:updatedInstrument.lastUpdatedAt}});
	expect(secondBuy.status()).toBe(201);
	position=(await page.request.get('/api/positions').then(response=>response.json()))[0];
	expect(Number(position.quantity)).toBe(2);
	const openPortfolio=await page.request.get('/api/portfolio').then(response=>response.json());
	expect(Number(openPortfolio.totalValue)).toBeCloseTo(Number(openPortfolio.cashBalance)+Number(openPortfolio.positionValue),2);
	expect(Number(openPortfolio.unrealizedPnl)).toBeCloseTo(Number(position.unrealizedPnl),2);

	const sellMarket=await page.request.get('/api/market').then(response=>response.json());
	const sellInstrument=sellMarket.find((item:{symbol:string})=>item.symbol===symbol);
	const partialSell=await page.request.post('/api/orders',{headers:{'Idempotency-Key':randomUUID()},data:{instrumentId:sellInstrument.id,side:'SELL',type:'MARKET',quantity:0.5,expectedPrice:Number(sellInstrument.price),observedAt:sellInstrument.lastUpdatedAt}});
	expect(partialSell.status()).toBe(201);
	position=(await page.request.get('/api/positions').then(response=>response.json()))[0];
	expect(Number(position.quantity)).toBe(1.5);
	expect(Number(position.realizedPnl)).not.toBe(0);
	const close=await page.request.post('/api/positions',{data:{positionId:position.id}});
	expect(close.ok()).toBeTruthy();
	expect(await page.request.get('/api/positions').then(response=>response.json())).toHaveLength(0);
	const closedPortfolio=await page.request.get('/api/portfolio').then(response=>response.json());
	expect(Number(closedPortfolio.positionValue)).toBe(0);
	expect(Number(closedPortfolio.realizedPnl)).not.toBe(0);

	const otherContext=await browser.newContext();
	try{
		const otherPage=await otherContext.newPage();
		await loginAs(otherPage,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
		const otherOrders=await otherPage.request.get('/api/orders').then(response=>response.json());
		expect(otherOrders.some((order:{id:string})=>order.id===firstOrder.id)).toBe(false);
	}finally{await otherContext.close();}
});

test('wallet deposit and withdrawal requests remain pending and idempotent without posting money',async({browser,page})=>{
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	await page.getByLabel('Account mode').selectOption('DEMO');
	const startingBalance=Number((await page.request.get('/api/wallet').then(response=>response.json())).balance);
	const methods=await page.request.get('/api/payment-methods').then(response=>response.json());
	expect(methods.length).toBeGreaterThan(0);
	const method=methods[0];

	const depositKey=randomUUID();
	const depositPayload={type:'DEPOSIT',paymentMethodId:method.id,amount:100,currency:'USD'};
	const deposit=await page.request.post('/api/wallet',{headers:{'Idempotency-Key':depositKey},data:depositPayload});
	expect(deposit.status()).toBe(201);
	const depositRequest=await deposit.json();
	expect(depositRequest.status).toBe('PENDING_REVIEW');
	expect(depositRequest.accountMode).toBe('DEMO');
	const replay=await page.request.post('/api/wallet',{headers:{'Idempotency-Key':depositKey},data:depositPayload});
	expect(replay.status()).toBe(200);
	expect((await replay.json()).id).toBe(depositRequest.id);
	expect(Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(startingBalance);

	const withdrawal=await page.request.post('/api/wallet',{headers:{'Idempotency-Key':randomUUID()},data:{type:'WITHDRAWAL',paymentMethodId:method.id,amount:10,currency:'USD'}});
	expect(withdrawal.status()).toBe(201);
	expect((await withdrawal.json()).status).toBe('PENDING_REVIEW');
	expect(Number((await page.request.get('/api/wallet').then(response=>response.json())).balance)).toBe(startingBalance);

	const otherContext=await browser.newContext();
	try{
		const otherPage=await otherContext.newPage();
		await loginAs(otherPage,fixture('LEGACY_USER_EMAIL'),fixture('LEGACY_USER_PASSWORD'));
		const otherWallet=await otherPage.request.get('/api/wallet').then(response=>response.json());
		expect(otherWallet.transactions).toHaveLength(0);
	}finally{await otherContext.close();}
});

test('KYC document access is owner-scoped and private Storage fails closed without credentials',async({browser,page})=>{
	const documentId=fixture('KYC_DOCUMENT_ID');
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	expect((await page.request.get(`/api/kyc/documents/${documentId}`)).status()).toBe(404);
	expect((await page.request.get(`/api/admin/kyc/documents/${documentId}`)).status()).toBe(403);

	const unauthenticatedContext=await browser.newContext();
	try{
		const unauthenticatedPage=await unauthenticatedContext.newPage();
		expect((await unauthenticatedPage.request.get(`/api/kyc/documents/${documentId}`)).status()).toBe(401);
	}finally{await unauthenticatedContext.close();}

	const investorContext=await browser.newContext();
	try{
		const investorPage=await investorContext.newPage();
		await loginAs(investorPage,fixture('INVESTOR_EMAIL'),fixture('INVESTOR_PASSWORD'));
		const documents=await investorPage.request.get('/api/kyc/documents').then(response=>response.json());
		expect(documents.map((document:{id:string})=>document.id)).toContain(documentId);
		const ownerAccess=await investorPage.request.get(`/api/kyc/documents/${documentId}`);
		expect(ownerAccess.status()).toBe(503);
		expect((await ownerAccess.json()).error).toContain('Private file storage is not configured');

		const upload=await investorPage.request.post('/api/kyc/documents',{multipart:{
			kind:'IDENTITY_DOCUMENT',
			file:{name:'temporary-e2e.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\\nDisposable E2E document\\n%%EOF\\n')},
		}});
		expect(upload.status()).toBe(503);
		expect((await investorPage.request.get('/api/kyc/documents').then(response=>response.json()))).toHaveLength(documents.length);
	}finally{await investorContext.close();}

	const adminContext=await browser.newContext();
	try{
		const adminPage=await adminContext.newPage();
		await loginAs(adminPage,fixture('ADMIN_EMAIL'),fixture('ADMIN_PASSWORD'));
		const adminAccess=await adminPage.request.get(`/api/admin/kyc/documents/${documentId}`);
		expect(adminAccess.status()).toBe(503);
		expect((await adminAccess.json()).error).toContain('Private file storage is not configured');
	}finally{await adminContext.close();}
});

test('profile settings persist for the owner and remain inaccessible to signed-out clients',async({browser,page})=>{
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	const updated=await page.request.patch('/api/profile',{data:{name:'Temporary Settings Update',country:'Test Country',address:'Isolated test address',twoFactorEnabled:false}});
	expect(updated.ok()).toBeTruthy();
	expect((await page.request.get('/api/profile').then(response=>response.json())).name).toBe('Temporary Settings Update');
	const signedOutContext=await browser.newContext();
	try{
		const signedOutPage=await signedOutContext.newPage();
		expect((await signedOutPage.request.get('/api/profile')).status()).toBe(401);
	}finally{await signedOutContext.close();}
});
