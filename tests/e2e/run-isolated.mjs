import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:net';

const image='postgres:17-alpine';
const databaseName='aurevia_e2e';
const databaseUser='postgres';
const password=randomBytes(32).toString('hex');
const containerName=`aurevia-e2e-${randomUUID()}`;
const temporaryDirectory=await mkdtemp(join(tmpdir(),'aurevia-e2e-'));
const envFile=join(temporaryDirectory,'postgres.env');
const bootstrapFile=join(temporaryDirectory,'bootstrap.sql');
let containerStarted=false;

function run(command,args,options={}){
	const result=spawnSync(command,args,{stdio:'inherit',...options});
	if(result.error)throw result.error;
	return result.status??1;
}

function runCaptured(command,args,options={}){
	const result=spawnSync(command,args,{encoding:'utf8',...options});
	if(result.error)throw result.error;
	if(result.status!==0){
		const diagnostic=`${result.stdout||''}${result.stderr||''}`
			.replaceAll(password,'[redacted]')
			.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/g,'[connection string redacted]');
		if(diagnostic.trim())console.error(diagnostic);
		throw new Error(`${command} failed (${result.status??'unknown status'}).`);
	}
	return result.stdout.trim();
}

async function availableLocalPort(){
	const server=createServer();
	await new Promise((resolve,reject)=>{
		server.once('error',reject);
		server.listen(0,'127.0.0.1',resolve);
	});
	const address=server.address();
	if(!address||typeof address==='string')throw new Error('Could not reserve a local PostgreSQL port.');
	await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
	return address.port;
}

function localUrl(port){
	return `postgresql://${databaseUser}:${password}@127.0.0.1:${port}/${databaseName}?schema=public`;
}

let port;
let databaseUrl;
let directUrl;
let exitCode=1;

try{
	runCaptured('docker',['info','--format','{{.ServerVersion}}']);
	port=await availableLocalPort();
	await writeFile(envFile,[
		`POSTGRES_DB=${databaseName}`,
		`POSTGRES_USER=${databaseUser}`,
		`POSTGRES_PASSWORD=${password}`,
	].join('\n')+'\n',{mode:0o600});
	await writeFile(bootstrapFile,`
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
    id TEXT PRIMARY KEY,
    public BOOLEAN NOT NULL,
    file_size_limit BIGINT
);
CREATE TABLE storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT NOT NULL
);
INSERT INTO storage.buckets (id, public, file_size_limit) VALUES
    ('kyc-documents', FALSE, 10485760),
    ('profile-avatars', FALSE, 5242880),
    ('wallet-receipts', FALSE, 10485760),
    ('support-attachments', FALSE, 10485760);
`.trimStart(),{mode:0o644});

	const startOutput=runCaptured('docker',[
		'run','--detach','--name',containerName,
		'--publish',`127.0.0.1:${port}:5432`,
		'--env-file',envFile,
		'--mount',`type=bind,source=${bootstrapFile},destination=/docker-entrypoint-initdb.d/001-e2e-supabase-storage.sql,readonly`,
		'--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=512m',
		image,
	]);
	containerStarted=true;
	if(!/^[a-f0-9]{12,64}$/i.test(startOutput))throw new Error('Docker did not return a valid isolated PostgreSQL container ID.');

	let ready=false;
	for(let attempt=0;attempt<90;attempt++){
		const result=spawnSync('docker',['exec',containerName,'pg_isready','-U',databaseUser,'-d',databaseName],{stdio:'ignore'});
		if(result.status===0){ready=true;break}
		await new Promise(resolve=>setTimeout(resolve,1000));
	}
	if(!ready){
		const logs=spawnSync('docker',['logs',containerName],{encoding:'utf8'});
		const output=`${logs.stdout||''}${logs.stderr||''}`.replaceAll(password,'[redacted]');
		if(output.trim())console.error(output);
		throw new Error('Isolated PostgreSQL 17 did not become ready within 90 seconds.');
	}

	databaseUrl=localUrl(port);
	directUrl=localUrl(port);
	const environment={
		...process.env,
		DATABASE_URL:databaseUrl,
		DIRECT_URL:directUrl,
	};
	const identity=runCaptured('docker',[
		'exec',containerName,'psql','-U',databaseUser,'-d',databaseName,'-Atqc',
		"SELECT current_database() || '|' || (current_setting('server_version_num')::int / 10000)::text;",
	]);
	if(identity!==`${databaseName}|17`)throw new Error('Connected database identity did not match the isolated PostgreSQL 17 test database.');
	console.log('Verified disposable PostgreSQL 17 test database.');

	console.log('Applying Prisma migrations to the disposable local database only.');
	const migrationStatus=run('npx',['prisma','migrate','deploy'],{env:environment});
	if(migrationStatus!==0){exitCode=migrationStatus;throw new Error('Prisma migrations failed on the isolated database.')}

	console.log('Running the complete Playwright suite against the disposable local database.');
	exitCode=run('npm',['run','test:e2e','--',...process.argv.slice(2)],{env:environment});
}catch(error){
	console.error(error instanceof Error?error.message:'Isolated Playwright setup failed.');
	if(exitCode===1)exitCode=1;
}finally{
	if(containerStarted){
		const stopped=spawnSync('docker',['rm','--force',containerName],{stdio:'ignore'});
		if(stopped.status!==0)console.error('Warning: failed to remove the disposable PostgreSQL container.');
	}
	await rm(temporaryDirectory,{recursive:true,force:true});
}

process.exitCode=exitCode;
