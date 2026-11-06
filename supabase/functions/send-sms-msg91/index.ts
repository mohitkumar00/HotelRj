// Supabase Auth "Send SMS" hook -> MSG91 OTP delivery.
// Deploy:  supabase functions deploy send-sms-msg91 --no-verify-jwt
// Secrets: supabase secrets set MSG91_AUTH_KEY=... MSG91_TEMPLATE_ID=... SEND_SMS_HOOK_SECRET=v1,whsec_...
// Then in Dashboard > Authentication > Hooks, enable "Send SMS" and point it at this function.
// MSG91 needs a DLT-approved OTP template for India; the template must contain the ##OTP## variable.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const AUTH_KEY = Deno.env.get('MSG91_AUTH_KEY');
const TEMPLATE_ID = Deno.env.get('MSG91_TEMPLATE_ID');
const HOOK_SECRET = (Deno.env.get('SEND_SMS_HOOK_SECRET') || '').replace('v1,whsec_', '');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!AUTH_KEY || !TEMPLATE_ID || !HOOK_SECRET) {
    return json({ error: { http_code: 500, message: 'MSG91 secrets are not configured' } }, 500);
  }

  const payload = await req.text();
  let data: { user: { phone: string }; sms: { otp: string } };
  try {
    data = new Webhook(HOOK_SECRET).verify(payload, Object.fromEntries(req.headers)) as typeof data;
  } catch {
    return json({ error: { http_code: 401, message: 'Invalid hook signature' } }, 401);
  }

  // MSG91 expects the mobile number with country code and no "+".
  const mobile = data.user.phone.replace(/^\+/, '');
  const res = await fetch('https://control.msg91.com/api/v5/otp?' + new URLSearchParams({
    template_id: TEMPLATE_ID,
    mobile,
    otp: data.sms.otp,
  }), {
    method: 'POST',
    headers: { authkey: AUTH_KEY, 'Content-Type': 'application/json' },
    body: '{}',
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok || out?.type === 'error') {
    console.error('MSG91 error', res.status, JSON.stringify(out));
    return json({ error: { http_code: 500, message: 'Could not send SMS' } }, 500);
  }
  return json({}, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
