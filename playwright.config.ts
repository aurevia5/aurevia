import {randomBytes,randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defineConfig,devices} from '@playwright/test';
import {loadEnvConfig} from '@next/env';

loadEnvConfig(process.cwd());
function localDatabaseTarget(name:string){
	const value=process.env[name];
	let parsed:URL;
	try{parsed=new URL(value||'')}catch{throw new Error(`Refusing to start Playwright: ${name} must point to an isolated local test database.`)}
	if(!['localhost','127.0.0.1','::1'].includes(parsed.hostname)||!parsed.pathname||parsed.pathname==='/'){
		throw new Error(`Refusing to start Playwright: ${name} must point to an isolated local test database.`);
	}
	return `${parsed.hostname}:${parsed.port||'5432'}${parsed.pathname}`;
}
if(localDatabaseTarget('DATABASE_URL')!==localDatabaseTarget('DIRECT_URL')){
	throw new Error('Refusing to start Playwright: DATABASE_URL and DIRECT_URL must target the same isolated local database.');
}
const baseURL='http://127.0.0.1:4310';
const providerURL='http://127.0.0.1:4311';
const testSecret=randomBytes(32).toString('hex');
process.env.AUREVIA_E2E_STATE_FILE=join(tmpdir(),`aurevia-e2e-${randomUUID()}.json`);

export default defineConfig({
	testDir:'./tests/e2e',
	testMatch:'**/*.spec.ts',
	outputDir:join(tmpdir(),'aurevia-playwright-results'),
	fullyParallel:false,
	workers:1,
	retries:0,
	reporter:'list',
	timeout:90000,
	expect:{timeout:10000},
	globalSetup:'./tests/e2e/global-setup.ts',
	globalTeardown:'./tests/e2e/global-teardown.ts',
	use:{
		baseURL,
		...devices['Desktop Chrome'],
		viewport:{width:1440,height:900},
		headless:true,
		trace:'off',
		screenshot:'only-on-failure',
		actionTimeout:15000,
		navigationTimeout:45000,
	},
	projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
	webServer:[
		{
			command:'node tests/e2e/mock-provider.cjs',
			url:`${providerURL}/health`,
			reuseExistingServer:false,
			timeout:15000,
		},
		{
			command:'npm run build && npm start',
			url:`${baseURL}/api/health`,
			reuseExistingServer:false,
			timeout:240000,
			env:{
				...process.env,
				PORT:'4310',
				NODE_ENV:'production',
				NEXTAUTH_URL:baseURL,
				NEXT_PUBLIC_APP_URL:baseURL,
				NEXTAUTH_SECRET:testSecret,
				VERIFICATION_CODE_SECRET:testSecret,
				PHONE_VERIFICATION_REQUIRED:'false',
				VERIFICATION_EMAIL_API_URL:`${providerURL}/email`,
				VERIFICATION_EMAIL_API_KEY:'playwright-only-provider-key',
				VERIFICATION_SMS_API_URL:`${providerURL}/sms`,
				VERIFICATION_SMS_API_KEY:'playwright-only-provider-key',
				AUREVIA_E2E_ALLOW_HTTP_PROVIDER:'1',
				MARKET_TICK_MS:'1000',
				SUPABASE_URL:'',
				SUPABASE_SERVICE_ROLE_KEY:'',
				NEXT_PUBLIC_SUPABASE_URL:'',
				NEXT_PUBLIC_SUPABASE_ANON_KEY:'',
				REAL_EXECUTION_ENABLED:'false',
				BROKER_PROVIDER:'',
				BROKER_API_URL:'',
				BROKER_API_KEY:'',
				BROKER_ACCOUNT_ID:'',
				BROKER_WEBHOOK_SECRET:'',
				PAYMENT_PROVIDER:'',
				PAYMENT_API_URL:'',
				PAYMENT_API_KEY:'',
				PAYMENT_WEBHOOK_SECRET:'',
			},
		},
	],
});
