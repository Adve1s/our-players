import { serve } from '@hono/node-server';
import { app } from './app';
import { loadConfig } from './config';

const { port } = loadConfig(process.env);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
