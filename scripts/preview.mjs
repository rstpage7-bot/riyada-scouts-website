// Disposable local preview only. No real student data or production credentials.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createHandler } from '../supabase/functions/_shared/handler.mjs';
const origin='http://127.0.0.1:4175',apiOrigin='http://127.0.0.1:4176';
const rows=new Map();let sequence=0;
const store={
  async get(key){return structuredClone(rows.get(key)?.data??null);},
  async getWithMetadata(key){return structuredClone(rows.get(key)??null);},
  async setJSON(key,data,options={}){const old=rows.get(key);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return{modified:false};rows.set(key,{data:structuredClone(data),etag:String(++sequence)});return{modified:true};},
  async list({prefix}){return{blobs:[...rows.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};},
  async delete(key){rows.delete(key);},
};
await store.setJSON('auth/activation',{hash:createHash('sha256').update('preview-only-activation').digest('hex')});
const handler=createHandler({store,origin});
await handler(new Request(apiOrigin+'/rovers-api/admin/setup',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code:'preview-only-activation',password:'Preview-only-password-2026'})}));
http.createServer(async(req,res)=>{
  try{
    const chunks=[];for await(const part of req)chunks.push(part);
    const response=await handler(new Request(apiOrigin+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}));
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Preview error');}
}).listen(4176,'127.0.0.1');
const files=new Set(['index.html','membership.html','admin.html','connection.html','style.css','portal.css','camp.svg','app.js','portal.js','api-client.js','connection.js','config.js']);
http.createServer(async(req,res)=>{
  const path=new URL(req.url,origin).pathname.replace(/^\/riyada-scouts-website\//,'');
  const file=path||'index.html';if(!files.has(file)){res.writeHead(404);res.end();return;}
  try{
    const content=file==='config.js'?`export const API_BASE='${apiOrigin}/rovers-api';`:await readFile(new URL('../public/'+file,import.meta.url));
    res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'image/svg+xml','Cache-Control':'no-store'});res.end(content);
  }catch{res.writeHead(404);res.end();}
}).listen(4175,'127.0.0.1',()=>console.log('Disposable preview: '+origin+'/riyada-scouts-website/'));
