import {NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/auth';
import {getExecutionProviderStatus} from '@/lib/providers/registry';
import {getIdentityComplianceProvider} from '@/lib/providers/identity-provider';
import {getMarketDataProvider} from '@/lib/providers/market-data-provider';
import {getFundingProvider} from '@/lib/providers/funding-provider';

export const dynamic='force-dynamic';

function safeProviderLabel(value:string|null|undefined){
	if(!value)return null;
	return /^[A-Za-z0-9][A-Za-z0-9._ -]{0,63}$/.test(value)?value:'Configured provider (name hidden)';
}

export async function GET(){
	try{
		await requireAdmin();
		const execution=await getExecutionProviderStatus();
		const marketProvider=getMarketDataProvider();
		const identityProvider=getIdentityComplianceProvider();
		const fundingProvider=getFundingProvider();
		return NextResponse.json({
			checkedAt:new Date().toISOString(),
			realExecution:{
				status:execution.state,
				enabled:execution.enabled,
				provider:safeProviderLabel(execution.providerName),
				providerMode:execution.providerMode,
				adapterRegistered:execution.adapterRegistered,
				configuredVariables:execution.configuredVariables,
				missingConfiguration:execution.missingConfiguration,
				executionPathEnabled:execution.state==='CONNECTED',
				cryptoCapabilities:{
					orderSubmission:execution.state==='CONNECTED',
					positionAndBalanceReconciliation:false,
					webhookPersistence:false,
				},
			},
			marketData:{
				status:marketProvider?'CONFIGURED':'NOT_CONFIGURED',
				provider:safeProviderLabel(marketProvider?.name)||'Yahoo Finance chart endpoint (unofficial; request health is reported by quote routes)',
				usedForOrderExecution:false,
			},
			funding:{
				status:fundingProvider?'CONFIGURED':'NOT_CONFIGURED',
				provider:safeProviderLabel(fundingProvider?.name),
				realDepositsCreditOnlyOnProviderConfirmation:true,
			},
			investments:{
				status:'NOT_CONFIGURED',
				provider:null,
				realLifecycleActionsEnabled:false,
			},
			identity:{
				status:identityProvider?'CONFIGURED':'NOT_CONFIGURED',
				provider:safeProviderLabel(identityProvider?.name),
				adminReviewAvailable:true,
			},
			webhooks:{
				brokerAdapterRegistered:execution.adapterRegistered,
				signatureVerificationAvailable:execution.adapterRegistered,
			},
		},{headers:{'Cache-Control':'private, no-store'}});
	}catch(error){
		const status=error instanceof Error&&error.message==='UNAUTHORIZED'?401:403;
		return NextResponse.json({error:status===401?'Unauthorized':'Forbidden'},{status});
	}
}
