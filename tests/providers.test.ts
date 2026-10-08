import {createHmac} from 'node:crypto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {getExecutionProviderOrThrow,getExecutionProviderStatus,registerExecutionProvider,verifyHmacSha256} from '../lib/providers/registry';
import {AlpacaCryptoProvider} from '../lib/providers/alpaca-crypto-provider';

afterEach(()=>vi.unstubAllEnvs());

describe('REAL execution provider readiness',()=>{
	it('remains disabled when the safety gate is not explicitly enabled',async()=>{
		vi.stubEnv('REAL_EXECUTION_ENABLED','false');
		const status=await getExecutionProviderStatus();
		expect(status.state).toBe('DISABLED');
		expect(status.adapterRegistered).toBe(false);
	});

	it('fails closed when the gate is enabled but provider configuration is incomplete',async()=>{
		vi.stubEnv('REAL_EXECUTION_ENABLED','true');
		for(const name of ['ALPACA_TRADING_BASE_URL','ALPACA_API_KEY','ALPACA_API_SECRET','ALPACA_ACCOUNT_ID','ALPACA_WEBHOOK_SECRET','ALPACA_BROKER_BASE_URL','ALPACA_BROKER_CLIENT_ID','ALPACA_BROKER_CLIENT_SECRET','BROKER_PROVIDER','BROKER_API_URL','BROKER_API_KEY','BROKER_ACCOUNT_ID','BROKER_WEBHOOK_SECRET'])vi.stubEnv(name,'');
		const status=await getExecutionProviderStatus();
		expect(status.state).toBe('NOT_CONFIGURED');
		expect(status.missingConfiguration).toEqual(expect.arrayContaining([
			'ALPACA_TRADING_BASE_URL','ALPACA_API_KEY','ALPACA_API_SECRET','ALPACA_ACCOUNT_ID','ALPACA_WEBHOOK_SECRET',
			'BROKER_PROVIDER','BROKER_API_URL','BROKER_API_KEY','BROKER_ACCOUNT_ID','BROKER_WEBHOOK_SECRET',
		]));
		await expect(getExecutionProviderOrThrow()).rejects.toThrow('REAL_EXECUTION_UNAVAILABLE');
	});

	it('verifies webhook HMACs and rejects malformed or incorrect signatures',()=>{
		const body='{"event":"order.updated"}';
		const secret='test-only-provider-webhook-secret';
		const signature=createHmac('sha256',secret).update(body).digest('hex');
		expect(verifyHmacSha256(body,`sha256=${signature}`,secret)).toBe(true);
		expect(verifyHmacSha256(body,signature,'different-test-secret')).toBe(false);
		expect(verifyHmacSha256(body,'not-a-signature',secret)).toBe(false);
	});

	it('never reports a healthy Alpaca sandbox adapter as REAL-ready',async()=>{
		for(const [name,value] of Object.entries({
			REAL_EXECUTION_ENABLED:'true',
			BROKER_PROVIDER:'alpaca',
			BROKER_API_URL:'https://broker-api.sandbox.alpaca.markets',
			BROKER_API_KEY:'test-key',
			BROKER_ACCOUNT_ID:'test-account',
			BROKER_WEBHOOK_SECRET:'test-webhook-secret',
			ALPACA_BROKER_BASE_URL:'https://broker-api.sandbox.alpaca.markets',
			ALPACA_BROKER_CLIENT_ID:'test-client-id',
			ALPACA_BROKER_CLIENT_SECRET:'test-client-secret',
		}))vi.stubEnv(name,value);
		registerExecutionProvider(new AlpacaCryptoProvider({
			baseUrl:'https://broker-api.sandbox.alpaca.markets',
			clientId:'test-client-id',
			clientSecret:'test-client-secret',
			accountId:'test-account',
			webhookSecret:'test-webhook-secret',
			fetcher:vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({orders:[]})}),
		}));

		const status=await getExecutionProviderStatus();
		expect(status.providerMode).toBe('PAPER');
		expect(status.state).toBe('DISABLED');
		expect(status.enabled).toBe(false);
		await expect(getExecutionProviderOrThrow()).rejects.toThrow('REAL_EXECUTION_UNAVAILABLE');
	});
});
