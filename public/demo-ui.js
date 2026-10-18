import { DEMO_MODE } from './config.js';
if(DEMO_MODE){
  const banner=document.createElement('aside');banner.className='demo-banner';banner.setAttribute('role','note');
  const title=document.createElement('strong');title.textContent='نسخة تجريبية للعرض';
  const text=document.createElement('span');text.textContent=document.body.dataset.page==='admin'?'هذه معاينة عامة للإدارة ببيانات نموذجية. الإضافات والتعديلات مؤقتة وتختفي عند تحديث الصفحة؛ استخدم بيانات وصورًا تجريبية فقط.':'يمكنك استكشاف الموقع ومعاينة لوحة الإدارة. استقبال طلبات الانضمام والحفظ الفعلي سيبدآن بعد تفعيل الخدمة.';
  banner.append(title,text);document.body.prepend(banner);
  for(const link of document.querySelectorAll('a[href="admin.html"]'))link.textContent='معاينة لوحة الإدارة';
  for(const link of document.querySelectorAll('a[href="membership.html"]'))link.textContent='معاينة نموذج الانضمام ↗';
  const joinText=document.querySelector('#join > div > p:not(.eyebrow)');if(joinText)joinText.textContent='تعرّف على نموذج الانضمام ولوحة إدارة الفريق. التسجيل الفعلي سيُفتح بعد تفعيل الخدمة.';
  const footerText=document.querySelector('footer > p');if(footerText)footerText.textContent='مشروع جامعي طلابي · نسخة للعرض وليست موقعًا رسميًا للجامعة.';
  const guide=document.querySelector('#tab-guide > p');if(guide)guide.textContent='في هذه المعاينة، يمكنك تجربة إدارة الطلبات النموذجية والصور والأخبار. التعديلات تخص الصفحة المفتوحة فقط وتختفي عند تحديثها، ولا تُنشر لباقي الزوار. بعد تفعيل الخدمة سيحفظ المسؤول المحتوى فعليًا.';
  if(document.body.dataset.page==='membership'){
    document.querySelector('.intro').textContent='تعرّف على شكل طلب الانضمام وخطوات متابعته. سيُتاح تقديم الطلبات بعد تفعيل الخدمة، والقبول في هذا المشروع الطلابي لا يُعد اعتمادًا رسميًا من الجامعة.';
    for(const control of document.querySelectorAll('#join-form input,#join-form select,#join-form textarea,#join-form button,#track-form input,#track-form button'))control.disabled=true;
    const note=document.querySelector('#notice');note.textContent='هذا عرض لشكل نموذج التسجيل. لا نستقبل بيانات أو طلبات حقيقية حاليًا. يمكنك معاينة لوحة الإدارة ببيانات نموذجية من الرابط أسفل الصفحة.';note.hidden=false;
    document.querySelector('#join-form button').textContent='التسجيل قريبًا بعد التفعيل';
    document.querySelector('#track-form button').textContent='المتابعة متاحة بعد التفعيل';
    document.querySelector('#join-form .help').textContent='النموذج معروض للتعريف بالخطوات فقط. الحفظ الفعلي لطلبات الانضمام غير مفعّل.';
    document.querySelector('.track-panel > .help').textContent='بعد التفعيل، ستتمكن من متابعة طلبك برقم وكود خاصين دون إنشاء حساب.';
  }
}
