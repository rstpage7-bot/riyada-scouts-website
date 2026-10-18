import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const directory=new URL('../private/',import.meta.url);
await mkdir(directory,{recursive:true});
const code=randomBytes(32).toString('base64url');
const hash=createHash('sha256').update(code).digest('hex');
await writeFile(new URL('activation.sql',directory),`insert into public.rst_records(key,value) values ('auth/activation',jsonb_build_object('hash','${hash}')) on conflict(key) do update set value=excluded.value,revision=gen_random_uuid();\n`,{flag:'wx'});
await writeFile(new URL('activation.txt',directory),`رمز التفعيل الخاص بإدارة جوالة الريادة\n${code}\n\nبعد نشر الخدمة، افتح:\nhttps://rstpage7-bot.github.io/riyada-scouts-website/admin.html\nأدخل الرمز واختر كلمة مرور خاصة من 12 حرفًا على الأقل، ثم احفظ كود الاسترداد الذي يظهر مرة واحدة.\nبريد الدخول بعد التفعيل: rstpage7@gmail.com\nلا تنشر هذا الملف في GitHub أو تشاركه مع غير صاحب المشروع.\n`,{flag:'wx'});
console.log('Private activation files created under private/. No credentials were printed.');
