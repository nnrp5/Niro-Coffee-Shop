import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

const rawSupabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
const assignmentMatch = rawSupabaseKey.match(
  /^(?:VITE_SUPABASE_PUBLISHABLE_KEY|SUPABASE_PUBLISHABLE_KEY)\s*=\s*([\s\S]+)$/i,
);
const assignedValue = (assignmentMatch?.[1] ?? rawSupabaseKey).trim();
const wrappedValue = assignedValue.match(/^(['"])([\s\S]*)\1$/);
const supabaseKey = (wrappedValue?.[2] ?? assignedValue).trim();
let isPublicKey = false;
let isPrivilegedKey = supabaseKey.startsWith('sb_secret_');
if (supabaseKey) {
  isPublicKey = supabaseKey.startsWith('sb_publishable_');
  if (!isPublicKey && supabaseKey.split('.').length === 3) {
    try {
      const legacyRole = JSON.parse(Buffer.from(supabaseKey.split('.')[1], 'base64url').toString()).role;
      isPublicKey = legacyRole === 'anon';
      isPrivilegedKey = legacyRole === 'service_role';
    } catch {
      isPublicKey = false;
    }
  }
}
let supabaseUrlIsValid = false;
try {
  supabaseUrlIsValid = new URL(process.env.VITE_SUPABASE_URL?.trim() ?? '').protocol === 'https:';
} catch {
  supabaseUrlIsValid = false;
}
const supabaseAuthConfigStatus = !supabaseKey
  ? 'key_missing'
  : isPrivilegedKey
    ? 'privileged_key_rejected'
    : !isPublicKey
      ? 'key_unrecognized'
      : !supabaseUrlIsValid
        ? 'url_missing_or_invalid'
        : 'ready';
if (supabaseAuthConfigStatus !== 'ready') {
  console.warn(`Supabase authentication configuration status: ${supabaseAuthConfigStatus}. No rejected key is exposed to the browser.`);
}
// Scrub rejected values before Vite exposes any VITE_ environment variables.
const publicSupabaseKey = isPublicKey ? supabaseKey! : '';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = publicSupabaseKey;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  base: basePath,
  define: {
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(publicSupabaseKey),
    'import.meta.env.VITE_SUPABASE_CONFIG_STATUS': JSON.stringify(supabaseAuthConfigStatus),
  },
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
