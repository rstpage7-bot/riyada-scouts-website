import { createApp } from './app.mjs';
export function createHandler({ store, origin = 'https://rstpage7-bot.github.io' }) {
  return async request => {
    const requestOrigin = request.headers.get('origin');
    const headers = {
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin',
      ...(requestOrigin === origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    };
    if (requestOrigin && requestOrigin !== origin) return Response.json({ error: 'هذا المصدر غير مسموح.' }, { status: 403, headers });
    if (request.method === 'OPTIONS') {
      const requestedMethod = request.headers.get('access-control-request-method');
      if (requestOrigin !== origin || !['GET','POST','PATCH'].includes(requestedMethod)) return new Response(null, {status:403,headers});
      return new Response(null, {status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, PATCH','Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Max-Age':'600'}});
    }
    try {
      const target = new URL(request.url);
      const path = target.pathname.replace(/^\/functions\/v1\/rovers-api(?=\/|$)/, '').replace(/^\/rovers-api(?=\/|$)/, '');
      target.pathname = '/api' + path;
      const activation = path === '/admin/setup' || path === '/admin/state' ? await store.get('auth/activation') : null;
      const app = createApp({ store, setupHash: activation?.hash || '', origin, authMode: 'bearer' });
      // A global limit is also applied by the app, independent of this IP hint.
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const response = await app(new Request(target, request), {ip});
      const resultHeaders = new Headers(response.headers);
      for (const [key,value] of Object.entries(headers)) resultHeaders.set(key,value);
      return new Response(response.body, { status:response.status, headers:resultHeaders });
    } catch {
      return Response.json({error:'خدمة المشروع غير متاحة مؤقتًا. حاول مجددًا بعد قليل.'},{status:503,headers});
    }
  };
}
