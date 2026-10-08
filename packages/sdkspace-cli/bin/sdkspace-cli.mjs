#!/usr/bin/env node
const command=process.argv[2]||'health';
const routes={health:['GET','/v1/health'],me:['GET','/v1/me'],chat:['POST','/v1/chat'],image:['POST','/v1/image']};
if(!routes[command]){console.error('Usage: node sdkspace-cli.mjs health|me|chat <message>|image <prompt>');process.exit(1);}
const [method,path]=routes[command];
const headers={'accept':'application/json'};
if(command!=='health'){if(!process.env.SDKSPACE_API_KEY){console.error('Set SDKSPACE_API_KEY in your environment');process.exit(1);}headers.authorization='Bearer '+process.env.SDKSPACE_API_KEY;}
let body;
if(method==='POST'){const value=process.argv.slice(3).join(' ');if(!value){console.error('Provide a message or prompt');process.exit(1);}headers['content-type']='application/json';body=JSON.stringify(command==='chat'?{message:value,stream:false}:{prompt:value});}
try{const res=await fetch('https://agents-sdk.space'+path,{method,headers,body,signal:AbortSignal.timeout(120000)});console.log(await res.text());if(!res.ok)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}
