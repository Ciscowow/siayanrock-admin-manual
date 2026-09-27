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
2. Link the Supabase CLI to this project, then configure the function secrets:

   ```sh
   supabase secrets set RESEND_API_KEY=re_... RESEND_FROM_EMAIL="SiayanRock <invoices@your-verified-domain.com>"
   ```

3. Deploy the function:

   ```sh
   supabase functions deploy send-booking-invoice
   ```

The dashboard currently has no staff sign-in, so the function is configured for public dashboard invocation. It accepts one or more booking IDs (up to 20) and always uses the email stored in Supabase. Multiple bookings are included in one combined email only when they all have the same saved guest email; callers cannot supply a recipient or invoice totals. Anyone with access to the public dashboard can still trigger invoice emails, so add staff authentication and server-side authorization before making the dashboard broadly public.
