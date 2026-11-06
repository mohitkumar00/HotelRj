# Security setup: device pairing, owner pairing code and database lockdown

Staff never log in. The owner enters a pairing code once per device ("Pair this device"); the device then keeps
its own long-lived session. Manager actions (Owner Insights, Operations, bill voids) ask for a
manager PIN that is set during the first pairing.

Until you run migration **b**, the app behaves exactly like before (open database).

## 1. Supabase auth: pairing code (no email needed, about 5 minutes)

All devices pair with one shared **pairing code**, which is the password of one Supabase user. Nothing is emailed.

1. Dashboard > Authentication > Sign In / Providers > **Email**: enable (default). You can leave "Confirm email" on.
2. Same page: **disable "Allow new users to sign up"** (critical).
3. Authentication > Users > **Add user > Create new user**:
   - Email: any address, e.g. `pairing@hotelrj.co.in` (it never receives mail),
   - Password: a long pairing code (12+ characters, letters and digits),
   - tick **Auto Confirm User**.
4. In the app: Owner Insights PIN screen > "Owner: pair this device / set PIN" > enter that email and the code.

### Changing the pairing code later
Dashboard > SQL Editor:
```sql
update auth.users
set encrypted_password = extensions.crypt('NEW-LONG-CODE', extensions.gen_salt('bf'))
where email = 'pairing@hotelrj.co.in';
```
Already-paired devices keep working. To cut off a device, use Revoke in Owner Insights. To cut off everyone, run
`update paired_devices set revoked = true;` and re-pair the devices you still want.

### Emailed OTP (optional, later)
The pairing screen has a "Use emailed OTP instead" link. It needs custom SMTP in Supabase (Authentication > Emails > SMTP Settings)
and the Magic link template edited to show `{{ .Token }}`. Not required.

## 2. SMS via MSG91 (optional, later)

Not required. `supabase/functions/send-sms-msg91` is kept in case you later want phone OTP; it needs DLT approval in India.
The app currently pairs with email only.

## 3. Rollout order (nothing breaks if you follow it)

1. Run `supabase/migrations/20261106a_device_pairing_tables.sql` (additive, safe).
2. Build and distribute the new app (Windows installer, Android APK, website).
3. On the **Counter PC**: Owner Insights PIN screen > "Owner: pair this device / set PIN" > enter the pairing code > set manager PIN.
4. Pair each waiter phone and the owner's own phone/browser the same way. Review them in Owner Insights > Cloud > Paired devices.
5. Waiter phones: enter the **Waiter Pairing Code** shown on the Counter POS (Sync screen) once in Sync Counter.
6. Verify billing, void, menu toggle and Owner Insights on a paired phone.
7. Run `supabase/migrations/20261106b_lockdown_rls.sql`. The public site can now only read `menu_items`.

Rollback for step 7 is at the bottom of that file.

## 4. Lost phone

Owner Insights > Cloud > Paired devices > **Revoke**. The device loses cloud access immediately. Also change the manager PIN if staff knew it.

## 5. Local Wi-Fi sync code

The Counter PC generates an 8-character pairing code (stored in its app data folder). Every request from phones must send it
(`X-Sync-Token`); requests from the Counter PC itself are exempt. After 10 wrong codes an IP is blocked for 5 minutes.
