import {afterEach,describe,expect,it,vi} from 'vitest';
import {
  getPublicConfiguration,
  getServerConfiguration,
  validateServerConfiguration,
} from '../lib/config/env';

afterEach(()=>vi.unstubAllEnvs());

describe('canonical environment configuration',()=>{
  const source: Record<string,string|undefined> = {
    DATABASE_URL:'postgresql://user:test@example.invalid/db',
    DIRECT_URL:'postgresql://user:test@example.invalid/db',
    NEXTAUTH_SECRET:'test-secret-that-is-long-enough-for-auth',
    NEXTAUTH_URL:'https://app.example.invalid',
    NEXT_PUBLIC_APP_URL:'https://app.example.invalid',
    NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-anon-key',
    SUPABASE_SERVICE_ROLE_KEY:'private-service-key',
  };

  it('validates required server configuration without exposing secret values',()=>{
    const config=getServerConfiguration(source);
    const validation=validateServerConfiguration(config);

    expect(config.database.url).toContain('example.invalid');
    expect(config.auth.secret).toBe('test-secret-that-is-long-enough-for-auth');
    expect(config.database.directUrl).toContain('example.invalid');
    expect(validation).toEqual([]);
    expect(JSON.stringify(getPublicConfiguration(source))).not.toContain('private-service-key');
  });

  it('reports missing required values and malformed URLs with variable names only',()=>{
    const issues=validateServerConfiguration(getServerConfiguration({
      DATABASE_URL:'',
      DIRECT_URL:'not-a-url',
      NEXTAUTH_SECRET:'',
      NEXTAUTH_URL:'relative-url',
    }));

    expect(issues).toEqual(expect.arrayContaining([
      'DATABASE_URL is missing',
      'DIRECT_URL must be a valid PostgreSQL URL',
      'NEXTAUTH_SECRET is missing',
      'NEXTAUTH_URL must be a valid absolute HTTPS URL',
    ]));
  });

  it('keeps public configuration limited to browser-safe values',()=>{
    vi.stubEnv('NEXT_PUBLIC_APP_URL','https://app.example.invalid');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','public-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','private-service-key');

    const publicConfig=getPublicConfiguration();

    expect(publicConfig.appUrl).toBe('https://app.example.invalid');
    expect(publicConfig.supabaseUrl).toBe('https://project.supabase.co');
    expect(publicConfig.supabaseAnonKey).toBe('public-anon-key');
    expect(JSON.stringify(publicConfig)).not.toContain('private-service-key');
  });

  it('detects optional integrations without requiring credentials',()=>{
    const config=getServerConfiguration({
      REAL_EXECUTION_ENABLED:'false',
      BROKER_PROVIDER:'',
      ALPACA_BROKER_BASE_URL:'https://broker-api.sandbox.alpaca.markets',
      ALPACA_BROKER_CLIENT_ID:'',
      ALPACA_BROKER_CLIENT_SECRET:'',
    });

    expect(config.execution.realEnabled).toBe(false);
    expect(config.execution.alpacaConfigured).toBe(false);
    expect(config.execution.provider).toBeNull();
    expect(config.smtp.configured).toBe(false);
    expect(config.marketData.configured).toBe(false);
  });
});
