import { randomBytes, randomUUID, createHash, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCb);
const ADMIN_EMAIL = 'rstpage7@gmail.com';
const sha = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const publicRequest = r => ({ id:r.id, name:r.name, email:r.email, phone:r.phone, faculty:r.faculty, year:r.year, motivation:r.motivation, createdAt:r.createdAt, updatedAt:r.updatedAt, status:r.status, reply:r.reply, archived:!!r.archived });
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const need = (condition, status, message) => { if (!condition) throw new HttpError(status, message); };
const passwordCheck = password => need(typeof password === 'string' && password.length >= 12 && password.length <= 128, 400, 'استخدم كلمة مرور من 12 إلى 128 حرفًا.');
async function hashPassword(password) { const salt = randomBytes(16).toString('hex'); return { salt, hash: (await scrypt(password, salt, 64)).toString('hex') }; }
async function verifyPassword(password, record) { if (typeof password !== 'string' || password.length > 128) return false; return equal((await scrypt(password, record.salt, 64)).toString('hex'), record.hash); }

export function createApp({ store, setupHash = '', origin = 'https://rst-rovers.netlify.app', now = () => Date.now(), secure = true }) {
  const get = key => store.get(key, { type:'json' });
  const entries = async prefix => {
    const { blobs } = await store.list({ prefix });
    const rows = [];
    for (let i=0;i<blobs.length;i+=30) rows.push(...await Promise.all(blobs.slice(i,i+30).map(b=>get(b.key))));
    return rows.filter(Boolean);
  };
  const json = (data, status=200, headers={}) => Response.json(data, {status, headers:{ 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers }});
  const cookie = value => `${secure?'__Host-':''}rst_session=${value}; Path=/; HttpOnly; SameSite=Strict${secure?'; Secure':''}; Max-Age=${value?28800:0}`;
  const sessionKey = req => {
    const name = secure?'__Host-rst_session':'rst_session';
    const value=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
    return value && /^[A-Za-z0-9_-]{43}$/.test(value)?'session/'+sha(value):null;
  };
  const admin = async req => {
    const key = sessionKey(req), session = key?await get(key):null, account = await get('auth/admin');
    need(session && session.expires > now() && account && session.version === account.version, 401, 'سجّل دخول الإدارة للمتابعة.');
    return account;
  };
  const session = async account => {
    const value=token(); await store.setJSON('session/'+sha(value),{version:account.version,expires:now()+28800000});
    return cookie(value);
  };
  async function limit(ip, area, max) {
    const bucket=Math.floor(now()/900000), key=`limit/${bucket}/${area}/${sha(ip)}`;
    for(let attempt=0;attempt<8;attempt++) {
      const old=await store.getWithMetadata(key,{type:'json'});
      need((old?.data.count||0)<max,429,'محاولات كثيرة. حاول بعد 15 دقيقة.');
      const result=await store.setJSON(key,{count:(old?.data.count||0)+1},{...(old?{onlyIfMatch:old.etag}:{onlyIfNew:true})});
      if(result.modified)return;
    }
    throw new HttpError(429,'حاول مرة أخرى بعد قليل.');
  }
  async function body(req, max=20000) {
    need(req.headers.get('content-type')?.split(';')[0]==='application/json',415,'صيغة الطلب غير مدعومة.');
    need(Number(req.headers.get('content-length')||0)<=max,413,'الملف أو البيانات أكبر من الحد المسموح.');
    // Bound streamed bodies too; Content-Length is not trusted.
    const reader=req.body?.getReader(); let size=0; const parts=[];
    if(reader) for(;;) {const {done,value}=await reader.read(); if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new HttpError(413,'البيانات أكبر من الحد المسموح.');}parts.push(value);}
    try { const result=JSON.parse(Buffer.concat(parts).toString('utf8'));need(result&&typeof result==='object'&&!Array.isArray(result),400,'تعذر قراءة البيانات.');return result; } catch { throw new HttpError(400,'تعذر قراءة البيانات.'); }
  }
  async function update(key, change) {
    const record=await store.getWithMetadata(key,{type:'json'});need(record,404,'العنصر غير موجود.');
    const updated=change(record.data);const result=await store.setJSON(key,updated,{onlyIfMatch:record.etag});
    need(result.modified,409,'تم تعديل العنصر من نافذة أخرى. حدّث الصفحة وحاول مجددًا.');return updated;
  }
  return async (req, context={}) => {
    try {
      const url=new URL(req.url), path=url.pathname.replace(/^\/\.netlify\/functions\/api/, '/api'), method=req.method;
      const ip=context.ip||'unknown';
      if(!['GET','HEAD'].includes(method)) need(req.headers.get('origin')===origin,403,'الطلب غير مسموح من هذا المصدر.');
      if(path==='/api/content' && method==='GET') {
        const [news,photos]=await Promise.all([entries('news/'),entries('photo/')]);
        return json({news:news.filter(n=>n.published&&!n.archived).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),photos:photos.filter(p=>p.published&&!p.archived).map(({data,...p})=>p).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
      }
      const media=path.match(/^\/api\/media\/([0-9a-f-]{36})$/);
      if(media && method==='GET') {
        const p=await get('photo/'+media[1]);need(p,404,'الصورة غير موجودة.');
        if(!p.published||p.archived) await admin(req);
        return new Response(Buffer.from(p.data,'base64'),{headers:{'Content-Type':p.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
      }
      if(path==='/api/join' && method==='POST') {
        await limit(ip,'join',8); const b=await body(req);need(!b.website,400,'تعذر تسجيل الطلب.');
        const name=clean(b.name,120),email=clean(b.email,254).toLowerCase(),faculty=clean(b.faculty,100),year=clean(b.year,40),phone=clean(b.phone,30),motivation=clean(b.motivation,1500);
        need(name.length>=3&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&faculty&&year&&b.consent===true,400,'أكمل الاسم والبريد والكلية والسنة الدراسية والموافقة.');
        need(!phone||/^[+\d\s()\-]{7,25}$/.test(phone),400,'راجع رقم الهاتف.');
        const id=randomUUID(), trackingCode=token(),createdAt=new Date(now()).toISOString();
        await store.setJSON('request/'+id,{id,name,email,faculty,year,phone,motivation,trackingHash:sha(trackingCode),status:'pending',reply:'',createdAt,updatedAt:createdAt,archived:false},{onlyIfNew:true});
        return json({id,trackingCode,status:'pending'},201);
      }
      if(path==='/api/track' && method==='POST') {
        await limit(ip,'track',40); const b=await body(req); const id=clean(b.id,36),code=clean(b.code,100);
        need(/^[0-9a-f-]{36}$/.test(id),400,'راجع رقم الطلب وكود المتابعة.');
        const r=await get('request/'+id);need(r&&equal(sha(code),r.trackingHash),404,'لم نعثر على طلب يطابق الرقم والكود.');
        return json({id:r.id,name:r.name,status:r.status,reply:r.reply,createdAt:r.createdAt,updatedAt:r.updatedAt});
      }
      if(path==='/api/admin/state' && method==='GET') {
        const account=await get('auth/admin');let loggedIn=false;try{await admin(req);loggedIn=true;}catch{}
        return json({initialized:!!account,setupEnabled:!!setupHash,loggedIn,...(loggedIn?{email:ADMIN_EMAIL}:{})});
      }
      if(path==='/api/admin/setup' && method==='POST') {
        await limit(ip,'auth',10);const b=await body(req);
        need(setupHash && typeof b.code==='string' && equal(sha(b.code),setupHash),403,'رمز التفعيل غير صحيح.');
        need(!(await get('auth/admin')),409,'تم تفعيل الإدارة مسبقًا.');passwordCheck(b.password);
        const recoveryCode=token(), account={email:ADMIN_EMAIL,...await hashPassword(b.password),recoveryHash:sha(recoveryCode),version:randomUUID()};
        const result=await store.setJSON('auth/admin',account,{onlyIfNew:true});need(result.modified,409,'تم تفعيل الإدارة مسبقًا.');
        return json({ok:true,recoveryCode},201,{'Set-Cookie':await session(account)});
      }
      if(path==='/api/admin/login' && method==='POST') {
        await limit(ip,'auth',10); const b=await body(req),account=await get('auth/admin');
        need(account && clean(b.email,254).toLowerCase()===ADMIN_EMAIL && await verifyPassword(b.password,account),401,'البريد أو كلمة المرور غير صحيحة.');
        return json({ok:true},200,{'Set-Cookie':await session(account)});
      }
      if(path==='/api/admin/recover' && method==='POST') {
        await limit(ip,'auth',10); const b=await body(req);passwordCheck(b.password);const account=await get('auth/admin');
        need(account&&typeof b.code==='string'&&equal(sha(b.code),account.recoveryHash),403,'كود الاسترداد غير صحيح.');
        const recoveryCode=token(),hashed=await hashPassword(b.password),version=randomUUID();
        const updated=await update('auth/admin',a=>{need(a.version===account.version,409,'حاول مجددًا.');return {...a,...hashed,version,recoveryHash:sha(recoveryCode)};});
        return json({ok:true,recoveryCode},200,{'Set-Cookie':await session(updated)});
      }
      if(path==='/api/admin/logout'&&method==='POST') {const key=sessionKey(req);if(key)await store.delete(key);return json({ok:true},200,{'Set-Cookie':cookie('')});}
      if(path.startsWith('/api/admin/')) {
        await admin(req);
        if(path==='/api/admin/requests'&&method==='GET') return json({requests:(await entries('request/')).map(publicRequest).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
        const request=path.match(/^\/api\/admin\/requests\/([0-9a-f-]{36})$/);
        if(request&&method==='PATCH') {const b=await body(req);need(['pending','accepted','declined'].includes(b.status),400,'حالة الطلب غير صحيحة.');const r=await update('request/'+request[1],r=>({...r,status:b.status,reply:clean(b.reply,1500),archived:!!b.archived,updatedAt:new Date(now()).toISOString()}));return json(publicRequest(r));}
        if(path==='/api/admin/content'&&method==='GET') {const [news,photos]=await Promise.all([entries('news/'),entries('photo/')]);return json({news,photos:photos.map(({data,...p})=>p)});}
        if(path==='/api/admin/news'&&method==='POST') {
          const b=await body(req,52000),title=clean(b.title,180),text=clean(b.text,12000),imageId=clean(b.imageId,36),source=clean(b.source,1000);
          need(title.length>=3&&text.length>=10,400,'أدخل عنوانًا ونصًا للخبر.');if(source)need(/^https:\/\//.test(source),400,'رابط المصدر يجب أن يبدأ بـ https://');
          if(imageId){const p=await get('photo/'+imageId);need(p&&!p.archived&&p.published,400,'اختر صورة منشورة من المعرض.');}
          const id=b.id?clean(b.id,36):randomUUID();need(/^[0-9a-f-]{36}$/.test(id),400,'معرّف الخبر غير صحيح.');
          const values={title,text,imageId,source,published:!!b.published,archived:!!b.archived,updatedAt:new Date(now()).toISOString()};
          const row=b.id?await update('news/'+id,n=>({...n,...values})):{id,...values,createdAt:values.updatedAt};
          if(!b.id)await store.setJSON('news/'+id,row,{onlyIfNew:true});return json(row,b.id?200:201);
        }
        if(path==='/api/admin/photos'&&method==='POST') {
          const b=await body(req,4300000),title=clean(b.title,150),alt=clean(b.alt,250);need(title&&alt,400,'أدخل عنوان الصورة ووصفها.');
          need(typeof b.data==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(b.data),400,'بيانات الصورة غير صحيحة.');
          const bytes=Buffer.from(b.data,'base64');need(bytes.length>16&&bytes.length<=3000000,413,'الحد الأقصى للصورة 3 ميجابايت.');
          let mime='';if(bytes.subarray(0,3).equals(Buffer.from([255,216,255])))mime='image/jpeg';else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')mime='image/webp';
          need(mime,415,'اختر صورة JPG أو PNG أو WebP.');const id=randomUUID(),createdAt=new Date(now()).toISOString();
          const row={id,title,alt,mime,data:bytes.toString('base64'),published:!!b.published,archived:false,createdAt};await store.setJSON('photo/'+id,row,{onlyIfNew:true});const {data,...result}=row;return json(result,201);
        }
        const photo=path.match(/^\/api\/admin\/photos\/([0-9a-f-]{36})$/);
        if(photo&&method==='PATCH') {const b=await body(req);const row=await update('photo/'+photo[1],p=>({...p,published:!!b.published,archived:!!b.archived}));const {data,...result}=row;return json(result);}
      }
      throw new HttpError(404,'الصفحة المطلوبة غير موجودة.');
    } catch (e) {if(!(e instanceof HttpError))console.error('Request failed',e.name);return json({error:e instanceof HttpError?e.message:'تعذر إتمام العملية الآن. حاول مرة أخرى.'},e.status||500);}
  };
}
