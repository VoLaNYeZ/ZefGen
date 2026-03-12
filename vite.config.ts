import fs from 'node:fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import type { Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const findRepoRoot = (startDir: string) => {
  // Vite may copy this config into `node_modules/.vite-temp/`, so `__dirname` is not stable.
  // Walk upwards until we find the nearest `package.json` (the project root).
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
};

const withOrigin = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const toWebSocketOrigin = (origin: string) => {
  if (origin.startsWith('https://')) return `wss://${origin.slice('https://'.length)}`;
  if (origin.startsWith('http://')) return `ws://${origin.slice('http://'.length)}`;
  return null;
};

const buildConnectSrc = (mode: string, env: Record<string, string>) => {
  const sources = new Set([
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://replicate.delivery',
    'https://*.replicate.delivery',
    'https://*.appshelp.cc',
  ]);

  if (mode === 'development') {
    const supabaseOrigin = withOrigin(env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '');
    if (supabaseOrigin) {
      sources.add(supabaseOrigin);
      const wsOrigin = toWebSocketOrigin(supabaseOrigin);
      if (wsOrigin) sources.add(wsOrigin);
    }
  }

  return Array.from(sources).join(' ');
};

export default defineConfig(({ mode }) => {
  // Ensure Vite always reads `.env*` from this repo (not from whatever cwd `vite` was launched from).
  const envDir = findRepoRoot(__dirname);

  // Load env vars into process.env so local dev server middleware (and other server-side code)
  // can read secrets like OPENAI_API_KEY / REPLICATE_API_TOKEN safely.
  const env = loadEnv(mode, envDir, '');
  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'string') continue;
    // Only fill missing/empty values so shell env can still override intentionally.
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }

  const cspConnectSrc = buildConnectSrc(mode, env as Record<string, string>);

  // Local-only API handler so `npm run dev` (Vite) can serve `/api/*` without running `vercel dev`.
  // In production, Vercel serves `/api/*` from the `api/` directory.
  const localApiPlugin = (): Plugin => ({
    name: 'zefgen:local-api',
    apply: 'serve',
    configureServer(server) {
      const resolveLocalModule = (modulePath: string) => {
        const rel = modulePath.replace(/^\.\//, '');
        const base = path.resolve(envDir, rel);
        const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`];
        const found = candidates.find((p) => fs.existsSync(p));
        if (!found) throw new Error(`Local API module not found: ${modulePath}`);
        return found;
      };

      const wire = (route: string, modulePath: string) => {
        server.middlewares.use(route, async (req, res) => {
          try {
            let rawBody = '';
            await new Promise<void>((resolve) => {
              req.on('data', (chunk) => {
                rawBody += String(chunk);
              });
              req.on('end', () => resolve());
            });

            if (rawBody) {
              try {
                (req as any).body = JSON.parse(rawBody);
              } catch {
                (req as any).body = rawBody;
              }
            } else {
              (req as any).body = {};
            }

            const absPath = resolveLocalModule(modulePath);
            // Use Vite's SSR loader so TS files work and paths don't break when Vite copies config into `.vite-temp/`.
            const mod = await server.ssrLoadModule(absPath);
            const handler = (mod as any).default;
            if (typeof handler !== 'function') {
              throw new Error(`Local API module missing default export: ${absPath}`);
            }
            // Important: await so async handler errors are caught and returned as JSON (instead of a vague 500).
            await handler(req, res);
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: String(err?.message || 'Local API error') }));
          }
        });
      };

      wire('/api/generate-screenshot', './api/generate-screenshot');
      wire('/api/generate-appstore-description', './api/generate-appstore-description');
      wire('/api/generate-icon-prompt', './api/generate-icon-prompt');
      wire('/api/create-github-repo', './api/create-github-repo');
      wire('/api/delete-github-repo', './api/delete-github-repo');
      wire('/api/provider-status', './api/provider-status');
      wire('/api/workspace-sessions', './api/workspace-sessions');
      wire('/api/appstore-review-webhook-status', './api/appstore-review-webhook-status');
    },
  });

  const cspHtmlPlugin = (): Plugin => ({
    name: 'zefgen:csp-html',
    transformIndexHtml(html) {
      return html.replace('__ZEFGEN_CONNECT_SRC__', cspConnectSrc);
    },
  });

  return {
    root: envDir,
    envDir,
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
    plugins: [react(), localApiPlugin(), cspHtmlPlugin()],
    resolve: {
      alias: {
        '@': envDir,
      }
    },
    build: {
      minify: 'terser' as const,
      chunkSizeWarningLimit: 1000,
      terserOptions: {
        format: {
          comments: false,
        },
        compress: {
          drop_console: false,
          drop_debugger: true,
          pure_funcs: ['console.log'],
        }
      },
      rollupOptions: {
        output: {
          banner: ''
        }
      }
    }
  };
});
