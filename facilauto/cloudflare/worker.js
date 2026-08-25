/**
 * FACIL AUTO — Worker Login + Créditos + Admin v1.5.7
 * Cloudflare Workers Free + D1 Free + Google OAuth
 *
 * Cambio v1.1.2:
 * /auth/google YA NO usa D1 antes de redirigir a Google.
 * El estado OAuth + PKCE se guarda temporalmente en una cookie HttpOnly
 * del dominio workers.dev.
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const ADMIN_EMAILS = new Set(['emanuel.astudillo@gmail.com']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (request.method === 'OPTIONS') return corsPreflight(request, env);

      if (url.pathname === '/health' && request.method === 'GET') {
        return safeJson({
          ok: true,
          service: 'facilauto-auth',
          version: '1.5.7'
        }, 200, request, env);
      }

      if (url.pathname === '/health/auth' && request.method === 'GET') {
        return authDiagnostic(request, env);
      }

      if (url.pathname === '/auth/google' && request.method === 'GET') {
        return startGoogle(request, env);
      }

      if (url.pathname === '/auth/google/callback' && request.method === 'GET') {
        return finishGoogle(request, env);
      }

      if (url.pathname === '/auth/exchange' && request.method === 'POST') {
        return exchangeTicket(request, env);
      }

      if (url.pathname === '/api/me' && request.method === 'GET') {
        return me(request, env);
      }

      if (url.pathname === '/api/consultations/use' && request.method === 'POST') {
        return useConsultation(request, env);
      }

      if (url.pathname === '/api/admin/users' && request.method === 'GET') {
        return adminUsers(request, env);
      }

      if (url.pathname === '/auth/logout' && request.method === 'POST') {
        return logout(request, env);
      }

      return safeJson({error:'not_found'}, 404, request, env);
    } catch (err) {
      console.error('FACIL AUTO worker error:', err);
      return safeJson({
        error: 'server_error',
        message: String(err?.message || err || 'Error interno'),
        route: url.pathname
      }, 500, request, env);
    }
  }
};

async function authDiagnostic(request, env) {
  const result = {
    ok: true,
    version: '1.5.7',
    app_url: false,
    google_client_id: Boolean(env.GOOGLE_CLIENT_ID),
    google_client_secret: Boolean(env.GOOGLE_CLIENT_SECRET),
    db_binding: Boolean(env.DB),
    db_query: false,
    tables: {
      users: false,
      sessions: false,
      login_tickets: false,
      user_plans: false,
      consultation_usage: false,
      credit_purchases: false
    }
  };

  try {
    new URL(env.APP_URL);
    result.app_url = true;
  } catch {}

  if (env.DB) {
    try {
      await env.DB.prepare('SELECT 1 AS ok').first();
      result.db_query = true;

      const rows = await env.DB.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table'
        AND name IN ('users','sessions','login_tickets','user_plans','consultation_usage','credit_purchases')
      `).all();

      const names = new Set((rows.results || []).map(r => r.name));
      result.tables.users = names.has('users');
      result.tables.sessions = names.has('sessions');
      result.tables.login_tickets = names.has('login_tickets');
      result.tables.user_plans = names.has('user_plans');
      result.tables.consultation_usage = names.has('consultation_usage');
      result.tables.credit_purchases = names.has('credit_purchases');
    } catch (err) {
      result.db_error = String(err?.message || err);
    }
  }

  result.ok =
    result.app_url &&
    result.google_client_id &&
    result.google_client_secret &&
    result.db_binding &&
    result.db_query &&
    result.tables.users &&
    result.tables.sessions &&
    result.tables.login_tickets &&
    result.tables.user_plans &&
    result.tables.consultation_usage &&
    result.tables.credit_purchases;

  return safeJson(result, result.ok ? 200 : 500, request, env);
}

async function startGoogle(request, env) {
  if (!env.GOOGLE_CLIENT_ID) {
    return safeJson({
      error: 'missing_google_client_id',
      message: 'Falta GOOGLE_CLIENT_ID en Cloudflare.'
    }, 500, request, env);
  }

  const requestUrl = new URL(request.url);
  const requestedReturn = requestUrl.searchParams.get('return_to') || env.APP_URL;
  const returnTo = safeReturnTo(requestedReturn, env.APP_URL);

  if (!returnTo) {
    return safeJson({
      error: 'invalid_app_url',
      message: 'APP_URL no está configurada correctamente.'
    }, 500, request, env);
  }

  const state = randomToken(32);
  const verifier = randomToken(48);
  const nonce = randomToken(24);
  const challenge = await sha256Base64Url(verifier);
  const redirectUri = `${requestUrl.origin}/auth/google/callback`;

  const temporaryState = encodeJson({
    state,
    verifier,
    nonce,
    returnTo,
    expiresAt: unix() + 600
  });

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account'
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${GOOGLE_AUTH_URL}?${params.toString()}`,
      'Set-Cookie': oauthCookie(temporaryState)
    }
  });
}

async function finishGoogle(request, env) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const oauthError = requestUrl.searchParams.get('error');

  const encoded = readCookie(request, 'fa_oauth');
  const temporary = encoded ? decodeJson(encoded) : null;

  if (
    oauthError ||
    !code ||
    !state ||
    !temporary ||
    temporary.state !== state ||
    Number(temporary.expiresAt) < unix()
  ) {
    return redirectError(env);
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return safeJson({
      error: 'missing_google_credentials',
      message: 'Faltan credenciales Google en Cloudflare.'
    }, 500, request, env);
  }

  if (!env.DB) {
    return safeJson({
      error: 'missing_db_binding',
      message: 'Falta el binding D1 llamado DB.'
    }, 500, request, env);
  }

  const redirectUri = `${requestUrl.origin}/auth/google/callback`;

  const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: temporary.verifier
    })
  });

  if (!tokenResp.ok) {
    const body = await tokenResp.text();
    console.error('Google token error:', body);
    return safeJson({
      error: 'google_token_error',
      status: tokenResp.status,
      message: 'Google rechazó el intercambio del código OAuth.'
    }, 502, request, env);
  }

  const tokens = await tokenResp.json();
  if (!tokens.access_token) {
    return safeJson({error:'missing_access_token'}, 502, request, env);
  }

  const profileResp = await fetch(GOOGLE_USERINFO_URL, {
    headers: {Authorization:`Bearer ${tokens.access_token}`}
  });

  if (!profileResp.ok) {
    return safeJson({
      error: 'google_profile_error',
      status: profileResp.status
    }, 502, request, env);
  }

  const profile = await profileResp.json();

  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    return safeJson({
      error: 'invalid_google_profile',
      message: 'Google no devolvió un perfil verificado.'
    }, 403, request, env);
  }

  const now = unix();

  await env.DB.prepare(`
    INSERT INTO users (google_sub, email, name, picture, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(google_sub) DO UPDATE SET
      email=excluded.email,
      name=excluded.name,
      picture=excluded.picture,
      last_login_at=excluded.last_login_at
  `).bind(
    profile.sub,
    String(profile.email).toLowerCase(),
    profile.name || '',
    profile.picture || '',
    now,
    now
  ).run();

  const user = await env.DB.prepare(`
    SELECT id FROM users WHERE google_sub = ?
  `).bind(profile.sub).first();

  if (!user) {
    return safeJson({error:'user_not_created'}, 500, request, env);
  }

  const rawTicket = randomToken(40);
  const ticketHash = await sha256Hex(rawTicket);

  await env.DB.prepare(`
    INSERT INTO login_tickets (ticket_hash, user_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(ticketHash, user.id, now + 120).run();

  await cleanup(env);

  const destination = new URL(
    safeReturnTo(temporary.returnTo, env.APP_URL) || env.APP_URL
  );
  destination.searchParams.set('login_ticket', rawTicket);

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.toString(),
      'Set-Cookie': clearOauthCookie()
    }
  });
}

async function exchangeTicket(request, env) {
  if (!env.DB) {
    return safeJson({error:'missing_db_binding'}, 500, request, env);
  }

  const body = await request.json().catch(() => ({}));

  if (!body.ticket || typeof body.ticket !== 'string') {
    return safeJson({error:'invalid_ticket'}, 400, request, env);
  }

  const ticketHash = await sha256Hex(body.ticket);
  const now = unix();

  const ticket = await env.DB.prepare(`
    SELECT ticket_hash, user_id, expires_at
    FROM login_tickets
    WHERE ticket_hash = ?
  `).bind(ticketHash).first();

  if (!ticket || Number(ticket.expires_at) < now) {
    if (ticket) {
      await env.DB.prepare(`
        DELETE FROM login_tickets WHERE ticket_hash = ?
      `).bind(ticketHash).run();
    }
    return safeJson({error:'invalid_ticket'}, 401, request, env);
  }

  await env.DB.prepare(`
    DELETE FROM login_tickets WHERE ticket_hash = ?
  `).bind(ticketHash).run();

  const rawToken = randomToken(48);
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = now + (60 * 60 * 24 * 30);

  await env.DB.prepare(`
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(tokenHash, ticket.user_id, now, expiresAt).run();

  const user = await env.DB.prepare(`
    SELECT id, email, name, picture
    FROM users
    WHERE id = ?
  `).bind(ticket.user_id).first();

  return safeJson({
    ok: true,
    token: rawToken,
    expires_at: expiresAt,
    user
  }, 200, request, env);
}

async function me(request, env) {
  const user = await authenticatedUser(request, env);

  if (!user) {
    return safeJson({authenticated:false}, 401, request, env);
  }

  const account = await accountStatus(env, user.id);

  return safeJson({
    authenticated:true,
    user:{
      id:user.id,
      email:user.email,
      name:user.name,
      picture:user.picture
    },
    account,
    is_admin:isAdminUser(user)
  }, 200, request, env);
}

async function useConsultation(request, env) {
  const user = await authenticatedUser(request, env);

  if (!user) {
    return safeJson({
      error:'authentication_required',
      message:'Tenés que iniciar sesión para hacer una consulta.'
    }, 401, request, env);
  }

  await ensureCreditAccount(env, user.id);

  const now = unix();
  const month = monthKeyArgentina();

  // Primero consume el cupo mensual. Es un UPDATE condicional y atómico:
  // dos clicks simultáneos no pueden gastar el mismo crédito.
  const monthly = await env.DB.prepare(`
    UPDATE consultation_usage
    SET used = used + 1, updated_at = ?
    WHERE user_id = ?
      AND month_key = ?
      AND used < (
        SELECT monthly_limit
        FROM user_plans
        WHERE user_id = ?
      )
  `).bind(now, user.id, month, user.id).run();

  let consumed = Number(monthly?.meta?.changes || 0) > 0;
  let source = consumed ? 'monthly' : null;

  // Preparado para futuros paquetes/créditos adicionales.
  if (!consumed) {
    const bonus = await env.DB.prepare(`
      UPDATE user_plans
      SET bonus_credits = bonus_credits - 1, updated_at = ?
      WHERE user_id = ?
        AND bonus_credits > 0
    `).bind(now, user.id).run();

    consumed = Number(bonus?.meta?.changes || 0) > 0;
    if (consumed) source = 'bonus';
  }

  const account = await accountStatus(env, user.id);

  if (!consumed) {
    return safeJson({
      error:'no_consultations_left',
      message:'No te quedan consultas disponibles.',
      account
    }, 402, request, env);
  }

  return safeJson({
    ok:true,
    consumed:true,
    source,
    account
  }, 200, request, env);
}

async function ensureCreditAccount(env, userId) {
  if (!env.DB) throw new Error('Falta el binding D1 DB.');

  const now = unix();
  const month = monthKeyArgentina();

  await env.DB.prepare(`
    INSERT INTO user_plans (
      user_id, plan, monthly_limit, bonus_credits, updated_at
    )
    VALUES (?, 'free', 10, 0, ?)
    ON CONFLICT(user_id) DO NOTHING
  `).bind(userId, now).run();

  await env.DB.prepare(`
    INSERT INTO consultation_usage (
      user_id, month_key, used, updated_at
    )
    VALUES (?, ?, 0, ?)
    ON CONFLICT(user_id, month_key) DO NOTHING
  `).bind(userId, month, now).run();
}

async function accountStatus(env, userId) {
  await ensureCreditAccount(env, userId);

  const month = monthKeyArgentina();

  const row = await env.DB.prepare(`
    SELECT
      p.plan,
      p.monthly_limit,
      p.bonus_credits,
      COALESCE(u.used, 0) AS used
    FROM user_plans p
    LEFT JOIN consultation_usage u
      ON u.user_id = p.user_id
     AND u.month_key = ?
    WHERE p.user_id = ?
    LIMIT 1
  `).bind(month, userId).first();

  if (!row) throw new Error('No se pudo cargar el estado de consultas.');

  const monthlyLimit = Math.max(0, Number(row.monthly_limit) || 0);
  const used = Math.max(0, Number(row.used) || 0);
  const bonus = Math.max(0, Number(row.bonus_credits) || 0);
  const monthlyAvailable = Math.max(0, monthlyLimit - used);

  return {
    plan: String(row.plan || 'free'),
    monthly_limit: monthlyLimit,
    used,
    bonus_credits: bonus,
    available: monthlyAvailable + bonus,
    month_key: month
  };
}

function monthKeyArgentina() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(new Date());

  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;

  return `${year}-${month}`;
}


function isAdminUser(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  return ADMIN_EMAILS.has(email);
}

async function adminUsers(request, env) {
  const admin = await authenticatedUser(request, env);

  if (!admin) {
    return safeJson({
      error:'authentication_required'
    }, 401, request, env);
  }

  if (!isAdminUser(admin)) {
    return safeJson({
      error:'forbidden'
    }, 403, request, env);
  }

  const month = monthKeyArgentina();

  const rows = await env.DB.prepare(`
    SELECT
      u.id,
      u.email,
      u.name,
      u.picture,
      u.created_at,
      u.last_login_at,
      COALESCE(p.plan, 'free') AS plan,
      COALESCE(p.monthly_limit, 10) AS monthly_limit,
      COALESCE(p.bonus_credits, 0) AS bonus_credits,
      COALESCE(cu.used, 0) AS used_this_month,
      COALESCE(cp.purchased_total, 0) AS purchased_total
    FROM users u
    LEFT JOIN user_plans p
      ON p.user_id = u.id
    LEFT JOIN consultation_usage cu
      ON cu.user_id = u.id
     AND cu.month_key = ?
    LEFT JOIN (
      SELECT user_id, SUM(credits) AS purchased_total
      FROM credit_purchases
      GROUP BY user_id
    ) cp
      ON cp.user_id = u.id
    ORDER BY u.last_login_at DESC, u.id DESC
    LIMIT 1000
  `).bind(month).all();

  const users = (rows.results || []).map(row => {
    const monthlyLimit = Math.max(0, Number(row.monthly_limit) || 0);
    const used = Math.max(0, Number(row.used_this_month) || 0);
    const bonus = Math.max(0, Number(row.bonus_credits) || 0);
    const monthlyAvailable = Math.max(0, monthlyLimit - used);

    return {
      id:Number(row.id),
      email:String(row.email || ''),
      name:String(row.name || ''),
      picture:String(row.picture || ''),
      plan:String(row.plan || 'free'),
      available:monthlyAvailable + bonus,
      used_this_month:used,
      monthly_limit:monthlyLimit,
      bonus_credits:bonus,
      purchased_total:Math.max(0, Number(row.purchased_total) || 0),
      created_at:Number(row.created_at) || 0,
      last_login_at:Number(row.last_login_at) || 0
    };
  });

  return safeJson({
    ok:true,
    month_key:month,
    users
  }, 200, request, env);
}

async function logout(request, env) {
  const raw = bearerToken(request);

  if (raw && env.DB) {
    const hash = await sha256Hex(raw);
    await env.DB.prepare(`
      DELETE FROM sessions WHERE token_hash = ?
    `).bind(hash).run();
  }

  return safeJson({ok:true}, 200, request, env);
}

async function authenticatedUser(request, env) {
  if (!env.DB) return null;

  const raw = bearerToken(request);
  if (!raw) return null;

  const hash = await sha256Hex(raw);

  return env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.picture
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
    LIMIT 1
  `).bind(hash, unix()).first();
}

async function cleanup(env) {
  if (!env.DB) return;
  const now = unix();
  await env.DB.prepare(`DELETE FROM login_tickets WHERE expires_at < ?`).bind(now).run();
  await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?`).bind(now).run();
}

function bearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function safeReturnTo(candidate, fallback) {
  try {
    const allowed = new URL(fallback);
    const target = new URL(candidate || fallback);

    if (target.origin !== allowed.origin) return allowed.toString();
    if (!target.pathname.startsWith(allowed.pathname)) return allowed.toString();

    return target.toString();
  } catch {
    try {
      return new URL(fallback).toString();
    } catch {
      return null;
    }
  }
}

function redirectError(env) {
  const target = safeReturnTo(env.APP_URL, env.APP_URL);
  if (!target) {
    return new Response('OAuth error', {status:400});
  }

  const destination = new URL(target);
  destination.searchParams.set('login','error');

  return new Response(null, {
    status:302,
    headers:{
      Location:destination.toString(),
      'Set-Cookie':clearOauthCookie()
    }
  });
}

function oauthCookie(value) {
  return [
    `fa_oauth=${value}`,
    'Path=/auth/google/callback',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=600'
  ].join('; ');
}

function clearOauthCookie() {
  return [
    'fa_oauth=',
    'Path=/auth/google/callback',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0'
  ].join('; ');
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }

  return '';
}

function encodeJson(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return base64Url(bytes);
}

function decodeJson(value) {
  try {
    const base64 = value.replace(/-/g,'+').replace(/_/g,'/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function corsHeaders(request, env) {
  let appOrigin = '*';

  try {
    appOrigin = new URL(env.APP_URL).origin;
  } catch {}

  const origin = request.headers.get('Origin');
  const allowedOrigin = origin === appOrigin ? origin : appOrigin;

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type, Accept, Authorization',
    'Vary':'Origin',
    'Cache-Control':'no-store'
  };
}

function corsPreflight(request, env) {
  let appOrigin = '';

  try {
    appOrigin = new URL(env.APP_URL).origin;
  } catch {}

  const origin = request.headers.get('Origin');

  if (!appOrigin || origin !== appOrigin) {
    return new Response(null,{status:403});
  }

  return new Response(null,{
    status:204,
    headers:corsHeaders(request,env)
  });
}

function safeJson(data, status, request, env) {
  let headers = {
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store'
  };

  try {
    headers = {...headers, ...corsHeaders(request, env)};
  } catch {}

  return new Response(JSON.stringify(data),{status,headers});
}

function unix() {
  return Math.floor(Date.now()/1000);
}

function randomToken(bytes=32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64Url(arr);
}

async function sha256Hex(value) {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  );
  return [...digest]
    .map(b=>b.toString(16).padStart(2,'0'))
    .join('');
}

async function sha256Base64Url(value) {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  );
  return base64Url(digest);
}

function base64Url(bytes) {
  let binary='';
  for (const b of bytes) binary += String.fromCharCode(b);

  return btoa(binary)
    .replace(/\+/g,'-')
    .replace(/\//g,'_')
    .replace(/=+$/,'');
}
