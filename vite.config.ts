import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig, loadEnv } from 'vite';
import hostingConfig from './.openai/hosting.json';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

export default defineConfig(async ({ command, mode }) => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  const localEnvironment =
    command === 'serve' ? loadEnv(mode, process.cwd(), '') : {};
  const openAiApiKey =
    localEnvironment.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const evaModel = localEnvironment.EVA_MODEL || process.env.EVA_MODEL;
  const serverVariables = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GMAIL_SESSION_SECRET'] as const;
  const googleVariables = Object.fromEntries(serverVariables.flatMap((key) => {
    const value = localEnvironment[key] || process.env[key];
    return value ? [[key, value]] : [];
  }));
  const localBindingConfig = {
    main: 'vinext/server/fetch-handler',
    compatibility_flags: ['nodejs_compat'],
    // Development-only Worker bindings. Production secrets are configured in
    // Sites and are never copied into build output or client-side Vite values.
    vars:
      command === 'serve'
        ? {
            ...(openAiApiKey ? { OPENAI_API_KEY: openAiApiKey } : {}),
            ...(evaModel ? { EVA_MODEL: evaModel } : {}),
            ...googleVariables,
          }
        : {},
    d1_databases: d1
      ? [
          {
            binding: d1,
            database_name: 'site-creator-d1',
            database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
          },
        ]
      : [],
    r2_buckets: r2
      ? [
          {
            binding: r2,
            bucket_name: 'site-creator-r2',
          },
        ]
      : [],
  };

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  };
});
