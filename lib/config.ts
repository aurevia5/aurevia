export function getSupportContact(){
	return {
		email:process.env.SUPPORT_EMAIL?.trim()||'',
		complaintsEmail:process.env.COMPLAINTS_EMAIL?.trim()||'',
		phone:process.env.SUPPORT_PHONE?.trim()||'',
	};
}

export const verificationConfig={
	expiresInMinutes:10,
	resendCooldownSeconds:60,
	maxAttempts:5,
} as const;