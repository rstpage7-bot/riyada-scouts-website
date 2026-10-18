import { api } from './api-client.js';
document.querySelector('#test').onclick = async event => {
  const button=event.currentTarget, result=document.querySelector('#result');
  button.disabled=true; result.textContent='جارٍ اختبار الاتصال بالخدمة وقاعدة البيانات…';
  try {
    const state=await api('/health');
    if(!state.ok||state.storage!=='connected') throw new Error('لم يكتمل اختبار قاعدة البيانات.');
    result.textContent='نجح الاتصال بخدمة التسجيل وقاعدة البيانات من اتصالك الحالي. يمكنك الآن تجربة طلب انضمام.';
  } catch(error) { result.textContent='لم ينجح الاتصال: '+error.message; }
  finally {button.disabled=false;}
};
