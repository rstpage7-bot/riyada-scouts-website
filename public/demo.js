// Disposable examples only. Nothing is sent to a backend or saved between pages.
const examplePhoto='11111111-1111-4111-8111-111111111111';
const stamp='2026-10-19T00:00:00.000Z';
let requests=[
  {id:'22222222-2222-4222-8222-222222222222',name:'طالب تجريبي ١',email:'student1@example.test',phone:'',faculty:'كلية نموذجية',year:'الأولى',motivation:'طلب توضيحي لتجربة المراجعة والرد، وليس بيانات طالب حقيقي.',status:'pending',reply:'',archived:false,createdAt:stamp,updatedAt:stamp},
  {id:'33333333-3333-4333-8333-333333333333',name:'طالب تجريبي ٢',email:'student2@example.test',phone:'',faculty:'كلية نموذجية',year:'الثانية',motivation:'مثال لعضو مقبول في العرض التجريبي.',status:'accepted',reply:'رد نموذجي للمعاينة فقط.',archived:false,createdAt:stamp,updatedAt:stamp},
];
let photos=[{id:examplePhoto,title:'رسم توضيحي للمعرض',alt:'رسم تعبيري لمعسكر كشفي، ضمن النسخة التجريبية',mime:'image/svg+xml',published:true,archived:false,createdAt:stamp}];
let news=[{id:'44444444-4444-4444-8444-444444444444',title:'نموذج خبر: مساحة لحكايات الفريق',text:'هذا مثال توضيحي لطريقة عرض الأخبار. بعد تفعيل الخدمة يستطيع مسؤول المشروع إضافة أخبار الأنشطة ومراجعتها ونشر الصور المرتبطة بها.',imageId:examplePhoto,source:'',published:true,archived:false,createdAt:stamp,updatedAt:stamp}];
const pictures=new Map();
const copy=value=>structuredClone(value);
export function demoMediaURL(id){return pictures.get(id)||new URL('camp.svg',import.meta.url).href;}
export async function demoRequest(path,{method='GET',body={}}={}){
  const respond=value=>Response.json(copy(value),{headers:{'Cache-Control':'no-store'}});
  if(path==='/health')return respond({ok:true,demo:true,storage:'not-connected'});
  if(path==='/content')return respond({news:news.filter(n=>n.published&&!n.archived),photos:photos.filter(p=>p.published&&!p.archived)});
  if(path==='/join'||path==='/track')throw new Error('التسجيل والمتابعة الفعليان غير متاحين في نسخة العرض. سيبدآن بعد تفعيل الخدمة.');
  if(path==='/admin/state')return respond({initialized:true,loggedIn:true,demo:true});
  if(path==='/admin/requests'&&method==='GET')return respond({requests});
  if(path==='/admin/content')return respond({news,photos});
  if(path.startsWith('/media/'))return fetch(demoMediaURL(path.split('/').at(-1)));
  if(path.startsWith('/admin/requests/')&&method==='PATCH'){
    const row=requests.find(r=>r.id===path.split('/').at(-1));
    if(!row)throw new Error('الطلب النموذجي غير موجود.');
    Object.assign(row,{status:body.status,reply:body.reply||'',archived:!!body.archived,updatedAt:new Date().toISOString()});return respond(row);
  }
  if(path==='/admin/news'&&method==='POST'){
    const old=news.find(n=>n.id===body.id);const row={...body,id:old?.id||crypto.randomUUID(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    if(old)news=news.map(n=>n.id===old.id?row:n);else news.push(row);return respond(row);
  }
  if(path==='/admin/photos'&&method==='POST'){
    const id=crypto.randomUUID();pictures.set(id,'data:image/webp;base64,'+body.data);
    const row={id,title:body.title,alt:body.alt,mime:'image/webp',published:!!body.published,archived:false,createdAt:new Date().toISOString()};photos.push(row);return respond(row);
  }
  if(path.startsWith('/admin/photos/')&&method==='PATCH'){
    const row=photos.find(p=>p.id===path.split('/').at(-1));if(!row)throw new Error('الصورة غير موجودة.');
    Object.assign(row,{published:!!body.published,archived:!!body.archived});return respond(row);
  }
  throw new Error('هذه العملية غير متاحة في المعاينة.');
}
