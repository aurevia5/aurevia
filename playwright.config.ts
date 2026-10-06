import {randomBytes,randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defineConfig,devices} from '@playwright/test';

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
			command:'npm run build && npm run start',
			url:`${baseURL}/api/health`,
			reuseExistingServer:false,
			timeout:240000,
			env:{
				...process.env,
				PORT:'4310',
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
			},
		},
	],
});
