import nextEnv from '@next/env';
import {spawn} from 'node:child_process';

const {loadEnvConfig}=nextEnv;
const port=4310;
const projectRoot=process.cwd();
for(const name of ['DATABASE_URL','DIRECT_URL'])delete process.env[name];
loadEnvConfig(projectRoot,false,undefined,true);

function databaseTarget(name){
	const value=process.env[name];
	if(!value)throw new Error(`${name} is not set.`);
	const parsed=new URL(value);
	if(!parsed.hostname.endsWith('.supabase.com'))throw new Error(`${name} must target the configured Supabase project.`);
	return `${parsed.hostname}${parsed.pathname}`;
}
if(databaseTarget('DATABASE_URL')!==databaseTarget('DIRECT_URL'))throw new Error('DATABASE_URL and DIRECT_URL must target the same Supabase project.');

function run(command,args,options={}){
	return new Promise((resolve,reject)=>{
		const child=spawn(command,args,{cwd:projectRoot,stdio:'inherit',...options});
		child.on('error',reject);
		child.on('exit',code=>resolve(code));
	});
}

const environment={...process.env,PORT:String(port),NODE_ENV:'production'};
console.log('Verified project environment files and Supabase database target.');
console.log('Running the complete existing Playwright suite.');
const exitCode=await run('npm',['run','test:e2e','--',...process.argv.slice(2)],{env:environment});
process.exitCode=exitCode??1;
