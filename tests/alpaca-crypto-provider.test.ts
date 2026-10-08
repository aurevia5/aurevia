import {describe,expect,it,vi} from 'vitest';
import {AlpacaCryptoProvider,buildAlpacaCryptoClient} from '../lib/providers/alpaca-crypto-provider';

describe('Alpaca crypto provider safety',()=>{
	it('accepts only sandbox broker endpoints for non-authorized execution',()=>{
		expect(()=>new AlpacaCryptoProvider({
			baseUrl:'https://broker-api.sandbox.alpaca.markets',
			clientId:'test-id',
			clientSecret:'test-secret',
			accountId:'00000000-0000-0000-0000-000000000001',
			webhookSecret:'test-webhook-secret',
		})).not.toThrow();
		expect(()=>new AlpacaCryptoProvider({
			baseUrl:'https://broker-api.alpaca.markets',
			clientId:'test-id',
			clientSecret:'test-secret',
			accountId:'00000000-0000-0000-0000-000000000001',
			webhookSecret:'test-webhook-secret',
		})).toThrow('SANDBOX_ONLY');
	});

	it('normalizes broker responses and preserves idempotency metadata',async()=>{
		const fetcher=vi.fn().mockResolvedValue({
			ok:true,
			status:200,
			json:async()=>({
				id:'11111111-1111-1111-1111-111111111111',
				client_order_id:'client-order',
				asset_id:'22222222-2222-2222-2222-222222222222',
				symbol:'BTCUSD',
				status:'accepted',
				filled_qty:'0',
				filled_at:null,
				created_at:'2026-01-01T00:00:00Z',
				updated_at:'2026-01-01T00:00:00Z',
				qty:'0.25',
			}),
		});
		const client=buildAlpacaCryptoClient({
			baseUrl:'https://broker-api.sandbox.alpaca.markets',
			clientId:'test-id',
			clientSecret:'test-secret',
			accountId:'00000000-0000-0000-0000-000000000001',
			fetcher,
		});
		const result=await client.submitOrder({
			clientOrderId:'client-order',
			assetId:'22222222-2222-2222-2222-222222222222',
			symbol:'BTCUSD',
			side:'buy',
			type:'market',
			timeInForce:'gtc',
			qty:'0.25',
		});
		expect(result.id).toBe('11111111-1111-1111-1111-111111111111');
		expect(result.clientOrderId).toBe('client-order');
		expect(result.status).toBe('accepted');
		expect(fetcher).toHaveBeenCalledOnce();
	});
});
