import {startRegistration,startAuthentication} from '@simplewebauthn/browser';
export async function registerPasskey(api,data) {
  const offer=await api.request('/api/passkey/register/options',{method:'POST',body:JSON.stringify(data)});
  const response=await startRegistration({optionsJSON:offer.options});
  return api.request('/api/passkey/register/verify',{method:'POST',body:JSON.stringify({challengeId:offer.challengeId,response})});
}
export async function loginPasskey(api) {
  const offer=await api.request('/api/passkey/login/options',{method:'POST',body:'{}'});
  const response=await startAuthentication({optionsJSON:offer.options});
  return api.request('/api/passkey/login/verify',{method:'POST',body:JSON.stringify({challengeId:offer.challengeId,response})});
}
