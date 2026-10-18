document.getElementById('share').addEventListener('click',async()=>{const status=document.getElementById('share-status');try{await navigator.clipboard.writeText(location.origin+'/');status.textContent='تم نسخ الرابط';}catch{status.textContent='يمكنك نسخ الرابط من شريط العنوان';}setTimeout(()=>status.textContent='',5000);});
const make=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
async function loadContent(){
 try{
  const response=await fetch('/api/content');if(!response.ok)throw new Error('unavailable');const data=await response.json(),photoIds=new Set(data.photos.map(p=>p.id));
  const gallery=document.getElementById('gallery-grid');
  for(const p of data.photos){const card=make('figure'),link=make('a'),img=make('img');link.href='/api/media/'+p.id;link.target='_blank';link.rel='noopener';img.src=link.href;img.alt=p.alt;img.loading='lazy';link.append(img);card.append(link,make('figcaption',p.title));gallery.append(card);}
  document.getElementById('gallery').hidden=!data.photos.length;
  for(const n of data.news){const card=make('article');card.className='content-card';if(n.imageId&&photoIds.has(n.imageId)){const img=make('img');img.src='/api/media/'+n.imageId;img.alt=data.photos.find(p=>p.id===n.imageId).alt;img.loading='lazy';card.append(img);}const time=make('time',new Date(n.createdAt).toLocaleDateString('ar-EG'));time.dateTime=n.createdAt;card.append(time,make('h3',n.title),make('p',n.text));if(n.source?.startsWith('https://')){const link=make('a','مصدر الخبر ↗');link.href=n.source;link.target='_blank';link.rel='noopener';card.append(link);}document.getElementById('news-cards').append(card);}
  document.getElementById('live-content-status').textContent='';
 }catch{document.getElementById('live-content-status').textContent='تعذر تحميل آخر إضافات الفريق الآن. يمكنك المحاولة لاحقًا.';}
}
loadContent();
