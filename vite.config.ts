import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import type { Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Ensure Vite always reads `.env*` from this repo (not from whatever cwd `vite` was launched from).
  const envDir = __dirname;

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

  // Local-only API handler so `npm run dev` (Vite) can serve `/api/*` without running `vercel dev`.
  // In production, Vercel serves `/api/*` from the `api/` directory.
  const localApiPlugin = (): Plugin => ({
    name: 'zefgen:local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/generate-screenshot', async (req, res) => {
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

          const mod = await import('./api/generate-screenshot');
          const handler = (mod as any).default;
          return handler(req, res);
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: String(err?.message || 'Local API error') }));
        }
      });
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
    plugins: [react(), localApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
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
