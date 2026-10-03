import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('GET /health', () => {
  it('answers 200 with ok: true', async () => {
    const res = await createApp().request('/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
