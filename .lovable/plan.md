# إشعارات WhatsApp لأولياء الأمور

## الهدف
إرسال رسائل WhatsApp تلقائية إلى أولياء الأمور (على رقم `guardian_phone` في جدول `students`) لأربعة أحداث رئيسية، مع سجل قابل للتدقيق وإمكانية إعادة الإرسال يدوياً.

## الأحداث المُشغِّلة
1. **تسجيل غياب** — عند إدخال حضور `absent` لطالب في `attendance` → رسالة فورية.
2. **دفعة جديدة** — عند إضافة صف في `student_payments` → إيصال مختصر (المبلغ + المتبقي).
3. **تذكير قسط مستحق** — Cron يومي 08:00 يفحص `student_payment_plans` غير المدفوعة والمستحقة خلال 3 أيام.
4. **ملاحظة سلوكية** — عند إضافة `daily_marks.notes` (بدون درجة، أو مع علامة منخفضة) → إشعار ولي الأمر.

## الربط والبنية التحتية
- تفعيل موصّل **Twilio** عبر `standard_connectors--connect` (المستخدم يزوّد Account SID + API Key + رقم WhatsApp Sender المعتمد من Twilio).
- إضافة إعداد رقم المرسِل كسر (`TWILIO_WHATSAPP_FROM`, مثال: `whatsapp:+14155238886`) عبر `add_secret`.
- **قاعدة البيانات**: جدول جديد `whatsapp_messages` (recipient, student_id, event_type, template, body, status, twilio_sid, error, sent_at) + جدول `whatsapp_settings` (event_type PK, enabled bool, template text) مع RLS يقصر التحكّم على admin.

## الخادم (Server Functions + Server Route)
- `src/lib/whatsapp.server.ts` — helper يستدعي gateway Twilio (`/Messages.json` مع `To=whatsapp:+..., From=$TWILIO_WHATSAPP_FROM, Body=...`) ويكتب النتيجة في `whatsapp_messages`.
- `src/lib/whatsapp.functions.ts` — server fns محمية بـ `requireSupabaseAuth`:
  - `sendWhatsappForEvent({ event, studentId, payload })` — يُستدعى من واجهة الحضور/الدفعات/العلامات بعد الحفظ.
  - `resendWhatsapp({ messageId })` لإعادة الإرسال.
  - `listWhatsappMessages({ studentId?, limit })` للسجل.
- `src/routes/api/public/cron/payment-reminders.ts` — يفحص الأقساط المستحقة ويرسل، محمي بمقارنة `apikey` مع Supabase anon key.
- جدولة عبر `pg_cron` + `pg_net` يومياً 08:00 لاستدعاء المسار أعلاه.

## الواجهة (RTL عربي)
- **إعدادات → تبويب "إشعارات WhatsApp"**: تفعيل/تعطيل لكل نوع حدث، تعديل قوالب الرسائل (placeholders: `{student}`, `{date}`, `{amount}`, `{remaining}`, `{subject}`, `{note}`).
- **بطاقة الطالب**: تبويب "سجل الرسائل" يعرض الرسائل المُرسَلة + زر "إعادة إرسال".
- إشعار toast بعد كل إجراء يوضّح نجاح/فشل الإرسال دون تعطيل الحفظ الأصلي.

## نقاط تقنية
- كل نداءات Twilio تمرّ عبر `https://connector-gateway.lovable.dev/twilio/Messages.json` بترويسات `Authorization: Bearer $LOVABLE_API_KEY` و `X-Connection-Api-Key: $TWILIO_API_KEY`.
- تطبيع رقم ولي الأمر إلى E.164 قبل الإرسال (اقتطاع الأصفار وإضافة رمز الدولة الافتراضي — سأطلب من المستخدم لاحقاً الدولة الافتراضية عند التنفيذ إذا لم تكن مضبوطة).
- الإرسال يتم داخل `Promise` مستقل — فشل WhatsApp لا يوقف حفظ الغياب/الدفعة.
- ملاحظة WhatsApp Business: يتطلب Twilio قوالب معتمدة مسبقاً للرسائل الصادرة خارج نافذة 24 ساعة؛ سيتم توثيق ذلك للمستخدم داخل شاشة الإعدادات.

هل نمضي بهذا؟
