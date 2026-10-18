import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createStore } from '../supabase/functions/_shared/store.mjs';
import { createHandler } from '../supabase/functions/_shared/handler.mjs';

test('Supabase SQL, server adapter, CORS and private sessions work together', async t => {
  const db=new PGlite();
  t.after(()=>db.close());
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  await db.exec(await readFile(new URL('../supabase/migrations/202610190001_rovers_private_store.sql',import.meta.url),'utf8'));
  await t.test('database denies both anonymous and signed-in clients direct access',async()=>{
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);
      for(const sql of ["select * from public.rst_records", "select * from public.rst_get('auth/admin')", "select public.rst_put('auth/admin','{}'::jsonb)","select * from public.rst_list('request/')","select public.rst_delete('auth/admin')"]){
        await assert.rejects(db.query(sql),/permission denied/);
      }
      await db.exec('reset role');
    }
    assert.equal((await db.query("select relrowsecurity from pg_class where relname='rst_records'")).rows[0].relrowsecurity,true);
  });
  await db.exec('set role service_role');
  const queries={rst_get:['p_key'],rst_put:['p_key','p_value','p_new','p_revision'],rst_list:['p_prefix','p_omit_data','p_after','p_limit'],rst_delete:['p_key']};
  const store=createStore({url:'https://test.supabase.co',serviceKey:'server-test-key',fetchImpl:async(url,options)=>{
    assert.equal(options.headers.apikey,'server-test-key');
    const name=new URL(url).pathname.split('/').at(-1),args=JSON.parse(options.body),params=queries[name];
    assert.ok(params,'unknown RPC');
    const sql=`select * from public.${name}(${params.map((_,i)=>'$'+(i+1)).join(',')})`;
    const result=await db.query(sql,params.map(p=>args[p]));
    return Response.json(name==='rst_put'?result.rows[0].rst_put:name==='rst_delete'?null:result.rows);
  }});
  const origin='https://rstpage7-bot.github.io',code='test-activation-for-supabase',password='test-admin-password-2026';
  await store.setJSON('auth/activation',{hash:createHash('sha256').update(code).digest('hex')});
  let handler=createHandler({store}),credential;
  const call=async(path,{method='GET',body,token,headers={}}={})=>{
    const response=await handler(new Request('https://test.supabase.co/functions/v1/rovers-api'+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined}));
    return {status:response.status,headers:response.headers,body:response.headers.get('content-type')?.includes('json')?await response.json():await response.arrayBuffer()};
  };
  await t.test('preflight allows only the site origin and returns no credentialed cookies',async()=>{
    const response=await call('/join',{method:'OPTIONS',headers:{'Access-Control-Request-Method':'POST'}});
    assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),origin);
    assert.equal(response.headers.get('access-control-allow-credentials'),null);
    assert.equal((await call('/join',{method:'OPTIONS',headers:{Origin:'https://other.example','Access-Control-Request-Method':'POST'}})).status,403);
    assert.equal((await call('/health')).body.storage,'connected');
    assert.equal((await call('/admin/requests')).status,401);
  });
  await t.test('activation returns an in-memory bearer token, rejects cookies and concurrent owners',async()=>{
    const result=await call('/admin/setup',{method:'POST',body:{code,password}});
    assert.equal(result.status,201);credential=result.body;
    assert.match(credential.sessionToken,/^[A-Za-z0-9_-]{43}$/);
    assert.equal(result.headers.get('set-cookie'),null);
    assert.equal((await call('/admin/setup',{method:'POST',body:{code,password}})).status,409);
    assert.equal((await call('/admin/requests',{headers:{Cookie:'__Host-rst_session='+credential.sessionToken}})).status,401);
    assert.equal((await call('/admin/requests',{token:'x'.repeat(43)})).status,401);
    assert.equal((await call('/admin/requests',{token:credential.sessionToken})).status,200);
    const stored=await store.get('auth/admin');assert.notEqual(stored.hash,password);
    const sessions=await store.values('session/');assert.ok(!JSON.stringify(sessions).includes(credential.sessionToken));
  });
  await t.test('requests persist across handlers; only the private code can read the result',async()=>{
    const applicant={name:'طالب اختبار قاعدة البيانات',email:'student@example.test',faculty:'الهندسة',year:'الأولى',consent:true};
    const joined=await call('/join',{method:'POST',body:applicant});assert.equal(joined.status,201);
    const {id,trackingCode}=joined.body;
    assert.equal((await call('/track',{method:'POST',body:{id,code:'wrong'}})).status,404);
    assert.equal((await call('/admin/requests/'+id,{method:'PATCH',body:{status:'accepted',reply:'تم القبول'},token:credential.sessionToken})).status,200);
    handler=createHandler({store});
    const tracked=await call('/track',{method:'POST',body:{id,code:trackingCode}});
    assert.equal(tracked.body.status,'accepted');assert.equal(tracked.body.reply,'تم القبول');assert.equal(tracked.body.email,undefined);
    const list=await call('/admin/requests',{token:credential.sessionToken});assert.equal(list.body.requests[0].trackingHash,undefined);
    assert.equal(JSON.stringify((await call('/content')).body).includes(applicant.email),false);
  });
  await t.test('private image previews require a bearer token; publishing and archiving change public access',async()=>{
    const image={title:'صورة اختبار',alt:'صورة اختبار خاصة',published:false,data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR2kAAAAASUVORK5CYII='};
    const photo=await call('/admin/photos',{method:'POST',body:image,token:credential.sessionToken});assert.equal(photo.status,201);
    const id=photo.body.id;
    assert.equal((await call('/media/'+id)).status,401);assert.equal((await call('/media/'+id,{token:credential.sessionToken})).status,200);
    await call('/admin/photos/'+id,{method:'PATCH',body:{published:true,archived:false},token:credential.sessionToken});
    assert.equal((await call('/media/'+id)).headers.get('content-type'),'image/png');
    const news=await call('/admin/news',{method:'POST',body:{title:'خبر تجريبي',text:'هذا النص يستخدم في اختبار النشر فقط',imageId:id,published:true},token:credential.sessionToken});assert.equal(news.status,201);
    const content=(await call('/content')).body;assert.equal(content.photos.length,1);assert.equal(content.photos[0].data,undefined);assert.equal(content.news.length,1);
    await call('/admin/photos/'+id,{method:'PATCH',body:{published:false,archived:true},token:credential.sessionToken});
    assert.equal((await call('/media/'+id)).status,401);assert.equal((await call('/content')).body.photos.length,0);
  });
  await t.test('recovery revokes old sessions and logout deletes the new session',async()=>{
    const recovery=await call('/admin/recover',{method:'POST',body:{code:credential.recoveryCode,password:'new-test-password-2026'}});assert.equal(recovery.status,200);
    assert.equal((await call('/admin/requests',{token:credential.sessionToken})).status,401);
    assert.equal((await call('/admin/requests',{token:recovery.body.sessionToken})).status,200);
    await call('/admin/logout',{method:'POST',body:{},token:recovery.body.sessionToken});
    assert.equal((await call('/admin/requests',{token:recovery.body.sessionToken})).status,401);
  });
  await t.test('CAS updates reject stale versions and the photo list paginates without image payloads',async()=>{
    assert.equal((await store.setJSON('test/cas',{count:1},{onlyIfNew:true})).modified,true);
    assert.equal((await store.setJSON('test/cas',{count:2},{onlyIfNew:true})).modified,false);
    const record=await store.getWithMetadata('test/cas');
    assert.equal((await store.setJSON('test/cas',{count:3},{onlyIfMatch:record.etag})).modified,true);
    assert.equal((await store.setJSON('test/cas',{count:4},{onlyIfMatch:record.etag})).modified,false);
    await db.exec("insert into public.rst_records(key,value) select 'pagination/'||lpad(i::text,4,'0'),jsonb_build_object('id',i,'data','binary') from generate_series(1,251) i");
    const photos=await store.values('pagination/',{omitData:true});assert.equal(photos.length,251);assert.equal(photos[0].data,undefined);
    assert.equal((await store.get('pagination/0001')).data,'binary');
  });
  await t.test('expired records are pruned and the global limit applies even with another IP',async()=>{
    await store.setJSON('session/expired',{expires:Date.now()-1});assert.equal(await store.get('session/expired'),null);
    const key=`limit/${Math.floor(Date.now()/900000)}/join/${createHash('sha256').update('global').digest('hex')}`;
    await store.setJSON(key,{count:120});
    assert.equal((await call('/join',{method:'POST',body:{name:'test'},headers:{'X-Forwarded-For':'203.0.113.5'}})).status,429);
  });
});
