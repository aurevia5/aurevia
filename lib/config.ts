import {getServerConfiguration} from './config/env';

export function getSupportContact(){
	const config=getServerConfiguration().smtp;
	return {
		email:config.supportEmail,
		complaintsEmail:config.complaintsEmail,
		phone:config.supportPhone,
	};
}

export const verificationConfig={
	expiresInMinutes:10,
	resendCooldownSeconds:60,
	maxAttempts:5,
} as const;