import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Runs the /api routes inside the Vite dev server, so `npm run dev` works locally
 * exactly like Vercel does in production. Not used in the production build.
 */
function localApi(env) {
  return {
    name: 'brewdesk-local-api',
    apply: 'serve',
    configureServer(server) {
      if (env.VITE_USE_EMULATORS === 'true') {
        process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
        process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
        process.env.FIREBASE_PROJECT_ID ??= env.VITE_FIREBASE_PROJECT_ID || 'demo-brewdesk';
      } else {
        // Testing locally against a real project: read the service account from .env.local.
        for (const key of ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']) {
          if (env[key]) process.env[key] ??= env[key];
        }
      }

      server.middlewares.use('/api', async (req, res, next) => {
        const name = (req.url || '').split('?')[0].replace(/^\/+|\/+$/g, '');
        if (!/^[a-z0-9-]+$/.test(name)) return next();

        let mod;
        try {
          mod = await server.ssrLoadModule(`/api/${name}.js`);
        } catch (err) {
          if (/Failed to load url|does not exist|ENOENT/i.test(String(err?.message))) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: `No API route named "${name}".` }));
          }
          console.error(err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'The API route failed to load. Check the terminal.' }));
        }
        await mod.default(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), localApi(env)],
  };
});
