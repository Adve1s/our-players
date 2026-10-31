import { z } from 'zod';

// Without this, zod probes `new Function("")` when the first object schema is built; the web CSP
// (`public/_headers`, no 'unsafe-eval') refuses it and logs a violation on every page load (S16).
z.config({ jitless: true });
