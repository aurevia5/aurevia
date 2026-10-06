type StorageConfiguration={baseUrl:string;serviceKey:string;bucket:string};

export class PrivateStorageError extends Error {
	constructor(message:string,readonly status=502){super(message);this.name='PrivateStorageError';}
}

const privateBucketCache=new Map<string,{expiresAt:number;promise:Promise<void>}>();

function configuration():StorageConfiguration{
	const baseUrl=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim().replace(/\/$/,'');
	const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
	const bucket=(process.env.SUPABASE_PRIVATE_BUCKET||'aurevia-private').trim();
	if(!baseUrl||!serviceKey||!bucket)throw new PrivateStorageError('Private file storage is not configured.',503);
	try{new URL(baseUrl)}catch{throw new PrivateStorageError('Private file storage is not configured.',503)}
	return {baseUrl,serviceKey,bucket};
}

function objectUrl(config:StorageConfiguration,key:string){
	const path=key.split('/').map(segment=>encodeURIComponent(segment)).join('/');
	return `${config.baseUrl}/storage/v1/object/${encodeURIComponent(config.bucket)}/${path}`;
}

function storageHeaders(config:StorageConfiguration,contentType?:string){
	return {Authorization:`Bearer ${config.serviceKey}`,apikey:config.serviceKey,...(contentType?{'Content-Type':contentType}:{})};
}

function verifyPrivateBucket(config:StorageConfiguration){
	const cacheKey=`${config.baseUrl}:${config.bucket}`;
	const cached=privateBucketCache.get(cacheKey);
	if(cached&&cached.expiresAt>Date.now())return cached.promise;
	const promise=(async()=>{
		let response:Response;
		try{response=await fetch(`${config.baseUrl}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`,{headers:storageHeaders(config),cache:'no-store'})}
		catch{throw new PrivateStorageError('Private file storage is unavailable.',503)}
		if(!response.ok)throw new PrivateStorageError('Private storage bucket is unavailable.',503);
		const bucket=await response.json() as {public?:boolean};
		if(bucket.public!==false)throw new PrivateStorageError('Configured file storage bucket must be private.',503);
	})().catch(error=>{privateBucketCache.delete(cacheKey);throw error});
	privateBucketCache.set(cacheKey,{expiresAt:Date.now()+60_000,promise});
	return promise;
}

export async function uploadPrivateObject(key:string,bytes:Buffer,contentType:string){
	const config=configuration();
	await verifyPrivateBucket(config);
	let response:Response;
	try{response=await fetch(objectUrl(config,key),{method:'POST',headers:{...storageHeaders(config,contentType),'x-upsert':'false'},body:new Uint8Array(bytes)})}
	catch{throw new PrivateStorageError('Private file storage is unavailable.',503)}
	if(!response.ok)throw new PrivateStorageError(response.status===413?'Uploaded file is too large.':'Private file upload failed.',response.status===413?413:502);
}

export async function deletePrivateObject(key:string){
	try{const config=configuration();await verifyPrivateBucket(config);await fetch(objectUrl(config,key),{method:'DELETE',headers:storageHeaders(config)})}catch{}
}

export async function createPrivateSignedUrl(key:string,expiresIn=120){
	const config=configuration();
	await verifyPrivateBucket(config);
	const path=key.split('/').map(segment=>encodeURIComponent(segment)).join('/');
	let response:Response;
	try{response=await fetch(`${config.baseUrl}/storage/v1/object/sign/${encodeURIComponent(config.bucket)}/${path}`,{method:'POST',headers:{...storageHeaders(config,'application/json'),'Cache-Control':'no-store'},body:JSON.stringify({expiresIn})})}
	catch{throw new PrivateStorageError('Private file storage is unavailable.',503)}
	if(!response.ok)throw new PrivateStorageError('Private file is unavailable.',502);
	const result=await response.json() as {signedURL?:string;signedUrl?:string};
	const signedPath=result.signedURL||result.signedUrl;
	if(!signedPath)throw new PrivateStorageError('Private file is unavailable.',502);
	if(/^https?:\/\//i.test(signedPath))return signedPath;
	return new URL(signedPath,`${config.baseUrl}/storage/v1/`).toString();
}

export function isPrivateStorageConfigured(){
	return !!(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL)&&!!process.env.SUPABASE_SERVICE_ROLE_KEY;
}