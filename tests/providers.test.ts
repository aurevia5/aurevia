import {createHmac} from 'node:crypto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {getExecutionProviderOrThrow,getExecutionProviderStatus,verifyHmacSha256} from '../lib/providers/registry';

afterEach(()=>vi.unstubAllEnvs());

describe('REAL execution provider readiness',()=>{
	it('remains disabled when the safety gate is not explicitly enabled',async()=>{
		vi.stubEnv('REAL_EXECUTION_ENABLED','false');
		const status=await getExecutionProviderStatus();
		expect(status.state).toBe('DISABLED');
		expect(status.adapterRegistered).toBe(false);
	});

	it('fails closed when the gate is enabled but broker configuration is incomplete',async()=>{
		vi.stubEnv('REAL_EXECUTION_ENABLED','true');
		for(const name of ['BROKER_PROVIDER','BROKER_API_URL','BROKER_API_KEY','BROKER_ACCOUNT_ID','BROKER_WEBHOOK_SECRET'])vi.stubEnv(name,'');
		const status=await getExecutionProviderStatus();
		expect(status.state).toBe('NOT_CONFIGURED');
		expect(status.missingConfiguration).toEqual(['BROKER_PROVIDER','BROKER_API_URL','BROKER_API_KEY','BROKER_ACCOUNT_ID','BROKER_WEBHOOK_SECRET']);
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
});
