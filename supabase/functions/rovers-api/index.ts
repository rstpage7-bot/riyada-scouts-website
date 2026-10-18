import { createStore } from '../_shared/store.mjs';
import { createHandler } from '../_shared/handler.mjs';
const store = createStore({
  url: Deno.env.get('SUPABASE_URL'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
});
Deno.serve(createHandler({store}));
