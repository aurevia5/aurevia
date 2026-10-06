import {expect,test as base,Page} from '@playwright/test';

type RuntimeCapture={consoleErrors:string[];pageErrors:string[];failedRequests:string[];failedResponses:Array<{url:string;status:number}>};
const appOrigin='http://127.0.0.1:4310';

export const test=base;
export {expect};

export async function loginAs(page:Page,email:string,password:string){
	await page.goto('/login');
	await page.getByLabel('Email or administrator username').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('checkbox',{name:/Replace the active Aurevia session/}).check();
	await page.getByRole('button',{name:'Sign in'}).click();
	await page.waitForURL(/dashboard/);
}

export async function expectNoHorizontalOverflow(page:Page){
	const dimensions=await page.evaluate(()=>({viewport:window.innerWidth,document:document.documentElement.scrollWidth}));
	expect(dimensions.document,`horizontal overflow at ${dimensions.viewport}px`).toBeLessThanOrEqual(dimensions.viewport+1);
}

test.beforeEach(async({page},testInfo)=>{
	const capture:RuntimeCapture={consoleErrors:[],pageErrors:[],failedRequests:[],failedResponses:[]};
	(page as Page & {__runtimeCapture?:RuntimeCapture}).__runtimeCapture=capture;
	page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('status of 400 (Bad Request)')&&!message.text().includes('status of 401 (Unauthorized)'))capture.consoleErrors.push(message.text())});
	page.on('pageerror',error=>capture.pageErrors.push(error.message));
	page.on('requestfailed',request=>{
		const failure=request.failure()?.errorText||'request failed';
		if(failure==='net::ERR_ABORTED'||failure.includes('ERR_ABORTED'))return;
		if(request.url().startsWith(appOrigin))capture.failedRequests.push(`${request.method()} ${request.url()} · ${failure}`);
	});
	page.on('response',response=>{
		if(response.status()<400||!response.url().startsWith(appOrigin))return;
		capture.failedResponses.push({url:response.url(),status:response.status()});
	});
});

test.afterEach(async({page},testInfo)=>{
	const capture=(page as Page & {__runtimeCapture?:RuntimeCapture}).__runtimeCapture;
	if(!capture)return;
	await testInfo.attach('browser-runtime.json',{body:Buffer.from(JSON.stringify(capture,null,2)),contentType:'application/json'});
	const expectedClientErrors=capture.failedResponses.filter(response=>(response.url.endsWith('/api/register/verify')&&response.status===400)||(response.url.endsWith('/api/auth/callback/credentials')&&response.status===401));
	const unexpectedResponses=capture.failedResponses.filter(response=>!expectedClientErrors.includes(response));
	expect(capture.consoleErrors,'browser console errors').toEqual([]);
	expect(capture.pageErrors,'uncaught browser exceptions').toEqual([]);
	expect(capture.failedRequests,'failed application requests').toEqual([]);
	expect(unexpectedResponses,'unexpected failed application responses').toEqual([]);
});
