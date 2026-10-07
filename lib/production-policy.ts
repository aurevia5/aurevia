import {AccountMode,Prisma,KycStatus} from '@prisma/client';

export type AccountTier='TIER 1'|'TIER 2'|'TIER 3';
export type TierContext={accountMode:AccountMode;kycStatus:KycStatus;verificationDocuments:number;verificationSubmitted?:boolean;accountStatus?:string};
export type WithdrawalValidation={balance:string|number;pending:string|number;amount:string|number;withdrawalEnabled:boolean;accountRestricted?:boolean;kycStatus:KycStatus};

const decimal=(value:string|number)=>new Prisma.Decimal(value.toString());

export function getAccountTier(context:TierContext):{label:AccountTier;progress:number;eligibleForRealTrading:boolean;verified:boolean}{
	const verified=context.accountMode===AccountMode.REAL&&context.verificationSubmitted===true&&context.kycStatus===KycStatus.APPROVED&&context.verificationDocuments>0;
	if(context.accountMode===AccountMode.REAL&&verified)return {label:'TIER 3',progress:100,eligibleForRealTrading:false,verified:true};
	if(context.accountMode===AccountMode.DEMO)return {label:'TIER 1',progress:60,eligibleForRealTrading:false,verified:false};
	if(context.verificationSubmitted||context.kycStatus===KycStatus.APPROVED)return {label:'TIER 2',progress:75,eligibleForRealTrading:false,verified:false};
	return {label:'TIER 1',progress:25,eligibleForRealTrading:false,verified:false};
}

export function verifyKycState(status:KycStatus){return status===KycStatus.APPROVED;}

export function validateWithdrawal(input:WithdrawalValidation){
	const balance=decimal(input.balance);const pending=decimal(input.pending);const amount=decimal(input.amount);
	if(!input.withdrawalEnabled)throw new Error('WITHDRAWAL_DISABLED');
	if(input.accountRestricted)throw new Error('ACCOUNT_RESTRICTED');
	if(amount.lte(0))throw new Error('INVALID_AMOUNT');
	if(balance.lt(amount.plus(pending)))throw new Error('INSUFFICIENT_BALANCE');
	if(input.kycStatus!==KycStatus.APPROVED)throw new Error('REAL_KYC_REQUIRED');
	return {balance:balance.toString(),pending:pending.toString(),amount:amount.toString()};
}
