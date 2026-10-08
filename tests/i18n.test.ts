import {describe,expect,it} from 'vitest';
import {isLocale,locales,normalizeLocale,translations,t} from '@/lib/i18n';

describe('locale system',()=>{
  it('accepts every configured locale',()=>{for(const locale of locales)expect(isLocale(locale)).toBe(true)});
  it('keeps every locale key set aligned',()=>{const keys=Object.keys(translations.en);for(const locale of locales){const localeKeys=Object.keys({...translations.en,...translations[locale]});expect(localeKeys).toEqual(expect.arrayContaining(keys));expect(localeKeys).toHaveLength(keys.length)}});
  it('falls back to English for missing keys',()=>{expect(t('en','missingKey' as never)).toBe('missingKey')});
  it('normalizes unsupported locales',()=>{expect(normalizeLocale('xx','ar')).toBe('ar')});
});
