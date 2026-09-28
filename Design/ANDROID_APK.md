# TraderOtto Android and Google TV

TraderOtto ships its UI inside the APK. It does not load a website and does
not require Vercel. Supabase remains the online database, authentication
provider, and protected API runtime.

## 1. Deploy Supabase Edge Functions

Install and sign in to the Supabase CLI, link this repository to the existing
project, then deploy:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy quotes --no-verify-jwt
npx supabase functions deploy ticker --no-verify-jwt
npx supabase functions deploy option-spreads --no-verify-jwt
npx supabase functions deploy books-search --no-verify-jwt
npx supabase functions deploy books-identify --no-verify-jwt
npx supabase functions deploy books-discover --no-verify-jwt
npx supabase functions deploy notifications-deliver --no-verify-jwt
npx supabase functions deploy notifications-telegram --no-verify-jwt
```

JWT verification is performed inside each function because some market/status
operations are intentionally public while saved data and AI history require a
signed-in user.

Set secrets in the Supabase Dashboard or CLI:

```powershell
npx supabase secrets set ALPACA_API_KEY_ID=... ALPACA_API_SECRET_KEY=...
npx supabase secrets set ALPACA_DATA_URL=https://data.alpaca.markets
npx supabase secrets set ALPACA_TRADING_URL=https://paper-api.alpaca.markets
npx supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=gpt-4o-mini
npx supabase secrets set FINNHUB_API_KEY=...
npx supabase secrets set SENDGRID_API_KEY=... NOTIFICATION_FROM_EMAIL="Trader Otto <verified@example.com>"
npx supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_BOT_USERNAME=...
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided to Edge Functions by
Supabase. Keep the client values in `.env` as
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the anon key is
safe to bundle because all tables remain protected by RLS.

## 2. Authentication redirects

Add this URL to **Authentication > URL Configuration > Redirect URLs**:

```text
com.traderotto.app://auth/callback
```

Email/password and OTP are easiest on a TV. Google and Apple sign-in open the
system browser and return through this deep link.

## 3. Build the APK

Android Studio (or an Android SDK with Java 21) must be installed.

```powershell
npm install
npm run build:android
```

The installable debug APK is:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 4. Install

Phone:

```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Google TV:

1. Enable Developer options and USB/network debugging.
2. Connect with `adb connect TV_IP_ADDRESS`.
3. Run the same `adb install -r` command.

The same APK advertises both phone launcher and Android TV Leanback launcher
support. A private release keystore should be created outside Git before
publishing a release build.
