import { copyFile, writeFile } from 'node:fs/promises';
import { API_BASE, DEMO_MODE } from '../public/config.js';
const demo=process.argv.includes('--demo');
if(demo!==DEMO_MODE)throw new Error('Demo flag and public configuration must match.');
if (!demo && !/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/rovers-api$/.test(API_BASE)) throw new Error('Configure the real Supabase endpoint in public/config.js first.');
for (const path of demo?[]:['/health','/admin/state']) {
  const response=await fetch(API_BASE+path,{headers:{Origin:'https://rstpage7-bot.github.io'},signal:AbortSignal.timeout(45000)});
  if(!response.ok||response.headers.get('access-control-allow-origin')!=='https://rstpage7-bot.github.io')throw new Error('Backend/CORS check failed. Live files were not changed.');
  const result=await response.json();
  if(path==='/health'&&(!result.ok||result.storage!=='connected'))throw new Error('Database check failed.');
  if(path==='/admin/state'&&!result.initialized&&!result.setupEnabled)throw new Error('Private administrator activation must be provisioned first.');
}
for(const file of ['index.html','style.css','camp.svg','app.js','membership.html','admin.html','portal.js','portal.css','config.js','api-client.js','connection.html','connection.js','demo.js','demo-ui.js']){
  await copyFile(new URL('../public/'+file,import.meta.url),new URL('../'+file,import.meta.url));
}
await writeFile(new URL('../.nojekyll',import.meta.url),'');
console.log(demo?'Demo pages prepared. Registration is disabled and admin data is temporary.':'GitHub Pages files prepared. Commit and push to deploy, then test connection.html from Egypt.');
