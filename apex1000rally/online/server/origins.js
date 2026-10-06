export function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = new Set([new URL(request.url).origin, ...(env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean)]);
  if (!allowed.has(origin)) { const e = Error('Origen no permitido.'); e.status = 403; throw e; }
  return origin;
}
export function cors(response, request, env) {
  const origin = allowedOrigin(request, env);
  const out = new Response(response.body, response);
  if (origin) {
    out.headers.set('Access-Control-Allow-Origin', origin);
    out.headers.set('Vary', 'Origin');
    out.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    out.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
    out.headers.set('Access-Control-Max-Age', '86400');
  }
  return out;
}
export function browserSession(request, token) {
  return request.headers.get('Origin') && request.headers.get('Origin') !== new URL(request.url).origin ? { token } : {};
}
