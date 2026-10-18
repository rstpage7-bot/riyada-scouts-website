// Credentials come from the Edge Function environment, never from the browser.
export function createStore({ url, serviceKey, fetchImpl = fetch }) {
  if (!url || !serviceKey) throw new Error('Missing backend configuration');
  async function rpc(name, args) {
    const response = await fetchImpl(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Database operation failed (${response.status})`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  const store = {
    async get(key) { return (await store.getWithMetadata(key))?.data ?? null; },
    async getWithMetadata(key) {
      const rows = await rpc('rst_get', { p_key: key });
      return rows[0] ? { data: rows[0].value, etag: rows[0].revision } : null;
    },
    async setJSON(key, data, options = {}) {
      return { modified: await rpc('rst_put', { p_key: key, p_value: data, p_new: !!options.onlyIfNew, p_revision: options.onlyIfMatch || null }) };
    },
    async values(prefix, { omitData = false } = {}) {
      const values = []; let after = '';
      for (;;) {
        const rows = await rpc('rst_list', { p_prefix: prefix, p_omit_data: omitData, p_after: after, p_limit: 250 });
        values.push(...rows.map(row => row.value));
        if (rows.length < 250) return values;
        after = rows.at(-1).key;
      }
    },
    async delete(key) { await rpc('rst_delete', { p_key: key }); },
  };
  return store;
}
