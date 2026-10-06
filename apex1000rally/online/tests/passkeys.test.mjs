import test from 'node:test';
import assert from 'node:assert/strict';
import {isoCBOR} from '@simplewebauthn/server/helpers';
import worker from '../server/worker.js';
import {database} from './d1.mjs';
import {viewWorld} from '../server/view.js';
import {createWorld,addDirector,events,command,advanceWorld} from '../server/world.js';
const now=Date.parse('2026-10-06T12:00:00Z');
const env=()=>({DB:database(),RP_ID:'apex.test',AUTH_ORIGINS:'https://apex.test',ALLOWED_ORIGINS:'https://apex.test',SEASON_EPOCH:'2026-10-07T03:00:00Z',MAX_PLAYERS:'20',ASSETS:{fetch:()=>new Response('assets')}});
const enc=new TextEncoder(),b64=x=>Buffer.from(x).toString('base64url'),un64=x=>new Uint8Array(Buffer.from(x,'base64url'));
async function req(e,path,b,headers={}) {const original=Date.now;Date.now=()=>now;try{return await worker.fetch(new Request('https://api.test'+path,{method:b?'POST':'GET',headers:{Origin:'https://apex.test','Content-Type':'application/json',...headers},...(b?{body:JSON.stringify(b)}:{})}),e,{waitUntil(){}});}finally{Date.now=original;}}
async function fakeRegistration(options,origin='https://apex.test') {
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey),id=crypto.getRandomValues(new Uint8Array(32));
  const cose=isoCBOR.encode(new Map([[1,2],[3,-7],[-1,1],[-2,un64(jwk.x)],[-3,un64(jwk.y)]]));
  const rp=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(options.rp.id)));
  const auth=Uint8Array.from([...rp,0x45,0,0,0,0,...new Uint8Array(16),0,id.length,...id,...cose]);
  const response={id:b64(id),rawId:b64(id),type:'public-key',clientExtensionResults:{},response:{clientDataJSON:b64(enc.encode(JSON.stringify({type:'webauthn.create',challenge:options.challenge,origin,crossOrigin:false}))),attestationObject:b64(isoCBOR.encode(new Map([['fmt','none'],['attStmt',new Map()],['authData',auth]]))),transports:['internal']}};
  return {keys,id,response};
}
function der(raw){const integer=v=>{let x=Buffer.from(v);while(x.length>1&&x[0]===0)x=x.subarray(1);if(x[0]&128)x=Buffer.concat([Buffer.from([0]),x]);return Buffer.concat([Buffer.from([2,x.length]),x]);};const a=integer(raw.slice(0,32)),b=integer(raw.slice(32));return Buffer.concat([Buffer.from([0x30,a.length+b.length]),a,b]);}
async function fakeLogin(options,cred,userId) {
  const client=enc.encode(JSON.stringify({type:'webauthn.get',challenge:options.challenge,origin:'https://apex.test',crossOrigin:false}));
  const rp=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(options.rpId))),auth=Uint8Array.from([...rp,5,0,0,0,1]);
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',client));
  const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},cred.keys.privateKey,Uint8Array.from([...auth,...hash])));
  return {id:b64(cred.id),rawId:b64(cred.id),type:'public-key',clientExtensionResults:{},response:{clientDataJSON:b64(client),authenticatorData:b64(auth),signature:b64(der(signature)),userHandle:b64(enc.encode(userId))}};
}
test('passkeys: registro, firma ES256, sesión CORS, consumo de desafío y logout',async()=>{
  const e=env(),options=await (await req(e,'/api/passkey/register/options',{username:'passkey_qa',email:'passkey@example.test',teamName:'Equipo passkey',shieldId:1})).json();
  const cred=await fakeRegistration(options.options);
  const r=await req(e,'/api/passkey/register/verify',{challengeId:options.challengeId,response:cred.response});
  assert.equal(r.status,201,await r.clone().text());assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://apex.test');
  const account=await r.json();assert.match(account.token,/^[a-f0-9]{64}$/);
  assert.equal(e.DB.sql.prepare('SELECT password_hash FROM users').get().password_hash,'passkey-only');
  const bootstrap=await req(e,'/api/bootstrap',null,{Authorization:'Bearer '+account.token});assert.equal(bootstrap.status,200,await bootstrap.clone().text());assert.equal((await bootstrap.json()).view.mode,'online');
  assert.equal((await req(e,'/api/passkey/register/verify',{challengeId:options.challengeId,response:cred.response})).status,400);
  const login=await(await req(e,'/api/passkey/login/options',{})).json(), assertion=await fakeLogin(login.options,cred,account.user.id);
  const session=await req(e,'/api/passkey/login/verify',{challengeId:login.challengeId,response:assertion});assert.equal(session.status,200,await session.clone().text());
  const key=(await session.json()).token;
  assert.equal((await req(e,'/api/logout',{}, {Authorization:'Bearer '+key})).status,200);
  assert.equal((await req(e,'/api/bootstrap',null,{Authorization:'Bearer '+key})).status,401);
  assert.equal((await req(e,'/api/login',{login:'passkey_qa',password:'not-supported'})).status,410);
});
test('passkeys: rechaza origen falso, desafío vencido y falta de verificación de usuario',async()=>{
  for(const mode of ['origin','expired','verification']){
    const e=env(),offer=await(await req(e,'/api/passkey/register/options',{username:'invalid_qa',email:'qa@example.test',teamName:'QA',shieldId:1})).json();
    const cred=await fakeRegistration(offer.options,mode==='origin'?'https://evil.test':'https://apex.test');
    if(mode==='expired')e.DB.sql.prepare('UPDATE passkey_challenges SET expires_at=?').run(now-1);
    if(mode==='verification') {const obj=isoCBOR.decodeFirst(un64(cred.response.response.attestationObject));obj.get('authData')[32]=0x41;cred.response.response.attestationObject=b64(isoCBOR.encode(obj));}
    const r=await req(e,'/api/passkey/register/verify',{challengeId:offer.challengeId,response:cred.response});assert.equal(r.status,400,mode);assert.equal(e.DB.sql.prepare('SELECT COUNT(*) n FROM users').get().n,0);
  }
});
test('proyección del visor conserva planes y excluye datos privados del rival',()=>{
  const w=createWorld(now,'2026-10-06T12:01:00Z'),a=addDirector(w,'a','driver_a','A',1),b=addDirector(w,'b','driver_b','B',2);
  const event=events(w).find(e=>e.id==='andes');for(const t of [a,b])command(w,t.id,{type:'enroll',eventId:event.eventId,driverId:t.activeDriver});
  advanceWorld(w,now+120000);
  const view=viewWorld(w,'a',event.eventId),other=view.teams.find(t=>t.id==='b');assert.equal(view.teams[0].id,'player');assert.equal(other.budget,undefined);assert.equal(other.rng,undefined);assert.equal(other.drivers[0].salary,undefined);assert.equal(view.teams.length,7);assert.equal(a.id,'a');
});
