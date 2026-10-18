import { API_BASE } from './config.js';
// The admin session stays in this tab's memory and is never put in a URL or disk storage.
let sessionToken = '';
export const clearSession = () => { sessionToken = ''; };
export function mediaURL(id) { return `${API_BASE}/media/${encodeURIComponent(id)}`; }
export async function request(path, options = {}) {
  if (!API_BASE) throw new Error('يجري تجهيز خدمة التسجيل والإدارة. حاول لاحقًا.');
  const response = await fetch(API_BASE + path, {
    ...options,
    credentials: 'omit', cache: 'no-store',
    signal: AbortSignal.timeout(45000),
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || 'تعذر الاتصال بخدمة المشروع. حاول مرة أخرى.');
    error.status = response.status;
    if (response.status === 401) clearSession();
    throw error;
  }
  return response;
}
export async function api(path, options) {
  try {
    const response = await request(path, options);
    const data = await response.json();
    if (data.sessionToken) sessionToken = data.sessionToken;
    return data;
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'TypeError') throw new Error('تعذر الوصول للخدمة. تحقق من اتصال الإنترنت ثم حاول مجددًا.');
    throw error;
  }
}
