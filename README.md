# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## Sending booking invoices

The Payments page can email a booking statement to the guest's saved email address. The statement includes stay details, recorded payments, refunds actually returned, the net amount received, and the current balance or overpayment.

Email is sent by the `send-booking-invoice` Supabase Edge Function. The Resend API key must only be configured as a Supabase function secret; never add it to a `VITE_*` variable or browser code.

1. Verify a sender domain in Resend.
2. Run `supabase/migrations/20261003000000_track_booking_invoice_sends.sql` in the Supabase SQL Editor. This adds the timestamp used by the dashboard to identify bookings whose invoices were emailed.
3. Configure the function secrets in Supabase:

   ```sh
   supabase secrets set RESEND_API_KEY=re_... RESEND_FROM_EMAIL="SiayanRock <invoices@your-verified-domain.com>"
   ```

4. Deploy the function after updating its code:

   ```sh
   supabase functions deploy send-booking-invoice
   ```

The dashboard currently has no staff sign-in, so the function is configured for public dashboard invocation. It accepts one or more booking IDs (up to 20) and always uses the email stored in Supabase. Multiple bookings are included in one combined email only when they all have the same saved guest email; callers cannot supply a recipient or invoice totals. Anyone with access to the public dashboard can still trigger invoice emails, so add staff authentication and server-side authorization before making the dashboard broadly public.

Invoices use the booking's saved total and show the stay nights with its average nightly amount. Additional guests above the room's base occupancy are itemized as included at no additional charge because the current schema has no extra-guest fee. The Overview's Guests invoiced tile and Payments list use `bookings.invoice_sent_at`, which is set only after Resend accepts the email.

   ## Dashboard notifications

   The top-bar notification bell shows new bookings, booking-status changes, and payment transactions, and displays live toast alerts while the dashboard is open. Supabase Realtime must publish changes from `public.bookings` and `public.payments`. If those tables are not already enabled, run `supabase/migrations/20261002230000_enable_dashboard_notifications_realtime.sql` in the Supabase SQL Editor. Notifications are kept in the current browser session and are not a replacement for a persistent audit log.
