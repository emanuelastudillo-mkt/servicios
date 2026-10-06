import { generateRegistrationOptions, generateAuthenticationOptions, verifyRegistrationResponse, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { directorName } from '../../src/identity.js';
import { randomToken, limitAuth } from './auth.js';

export const toBase64 = bytes => btoa(String.fromCharCode(...bytes));
export const fromBase64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
function config(env) {
  if (!env.RP_ID || !env.AUTH_ORIGINS) throw Error('Acceso con passkey pendiente de configurar.');
  return {rpID:env.RP_ID,origin:env.AUTH_ORIGINS.split(',').map(s=>s.trim())};
}
export async function passkeyOptions(request,env,now,kind,b) {
  await limitAuth(request,env.DB,now,60);
  const {rpID}=config(env); let payload={}, options;
  if(kind==='register') {
    const username=directorName(b.username),email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Email inválido.');
    if(typeof b.teamName!=='string'||!b.teamName.trim()||b.teamName.length>40)throw Error('Nombre de escudería inválido.');
    if(await env.DB.prepare('SELECT id FROM users WHERE username_key=? OR email=?').bind(username.normalize('NFKC').toLowerCase(),email).first())throw Error('Ese usuario o email ya está registrado.');
    const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM users').first();
    if(count.total>=Number(env.MAX_PLAYERS||20))throw Error('La sala está completa.');
    payload={id:crypto.randomUUID(),username,email,teamName:b.teamName.trim(),shieldId:b.shieldId,vehicleId:b.vehicleId||'niva'};
    options=await generateRegistrationOptions({rpName:'Apex1000 Rally',rpID,userName:username,userID:new TextEncoder().encode(payload.id),attestationType:'none',supportedAlgorithmIDs:[-7],authenticatorSelection:{residentKey:'required',userVerification:'required'}});
  } else {
    // Discoverable credentials avoid leaking which usernames or emails have an account.
    options=await generateAuthenticationOptions({rpID,userVerification:'required'});
  }
  const challengeId=randomToken();
  await env.DB.prepare('INSERT INTO passkey_challenges(id,kind,challenge,payload_json,expires_at) VALUES(?,?,?,?,?)').bind(challengeId,kind,options.challenge,JSON.stringify(payload),now+300000).run();
  return {challengeId,options};
}
export async function verifyPasskey(env,now,kind,b) {
  const {rpID,origin}=config(env);
  if(typeof b.challengeId!=='string'||! /^[a-f0-9]{64}$/.test(b.challengeId)||!b.response)throw Error('Respuesta de acceso inválida.');
  // Consume once, even if signature verification fails. A recorded assertion cannot create another session.
  const challenge=await env.DB.prepare('DELETE FROM passkey_challenges WHERE id=? AND kind=? AND expires_at>? RETURNING challenge,payload_json').bind(b.challengeId,kind,now).first();
  if(!challenge)throw Error('El acceso venció o ya fue utilizado. Volvé a intentarlo.');
  const expected={expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true};
  if(kind==='register') {
    const v=await verifyRegistrationResponse({...expected,response:b.response,supportedAlgorithmIDs:[-7]});
    if(!v.verified||!v.registrationInfo)throw Error('No se pudo verificar la passkey.');
    return {registration:JSON.parse(challenge.payload_json),credential:v.registrationInfo.credential};
  }
  const key=await env.DB.prepare('SELECT p.*,u.username FROM passkeys p JOIN users u ON u.id=p.user_id WHERE p.credential_id=?').bind(b.response.id||'').first();
  if(!key)throw Error('La passkey no pertenece a una cuenta de Apex1000.');
  if(b.response.response?.userHandle) {
    const handle=new TextDecoder().decode(fromBase64(b.response.response.userHandle.replace(/-/g,'+').replace(/_/g,'/')));
    if(handle!==key.user_id)throw Error('La passkey no coincide con el director.');
  }
  const v=await verifyAuthenticationResponse({...expected,response:b.response,credential:{id:key.credential_id,publicKey:fromBase64(key.public_key),counter:key.counter,transports:JSON.parse(key.transports_json)}});
  if(!v.verified)throw Error('No se pudo verificar el acceso.');
  return {user:{id:key.user_id,username:key.username},credentialId:key.credential_id,oldCounter:key.counter,newCounter:v.authenticationInfo.newCounter};
}
