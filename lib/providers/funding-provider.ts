import type {FundingProvider} from './contracts';

let fundingProvider:FundingProvider|null=null;

export function getFundingProvider(){return fundingProvider;}

export function registerFundingProvider(provider:FundingProvider){
	if(fundingProvider)throw new Error('FUNDING_PROVIDER_ALREADY_REGISTERED');
	fundingProvider=provider;
}
