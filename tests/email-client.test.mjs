import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceUrl, requestRecovery } from '../js/email-client.mjs';
test('ID tokens are sent only to the configured Cloudflare Worker', async () => {
  assert.equal(serviceUrl({ serviceUrl: 'https://evil.example/' }), null);
  assert.equal(serviceUrl({ serviceUrl: 'https://fake.workers.dev@evil.example/' }), null);
  assert.equal(serviceUrl({ serviceUrl: 'http://epav.example.workers.dev/' }), null);
  let request;
  await requestRecovery({ config: { serviceUrl: 'https://epav.example.workers.dev/' }, email: 'person@example.com', token: 'verified-token', fetcher: async (url, options) => { request = { url, options }; return Response.json({ sucesso: true }, { status: 202 }); } });
  assert.equal(request.url, 'https://epav.example.workers.dev/admin/password-reset');
  assert.equal(request.options.headers.Authorization, 'Bearer verified-token');
  assert.deepEqual(JSON.parse(request.options.body), { email: 'person@example.com' });
});
test('public recovery sends a challenge and no authentication token', async () => {
  let request;
  await requestRecovery({ config: { serviceUrl: 'https://epav.example.workers.dev/' }, email: 'person@example.com', challenge: 'challenge', fetcher: async (url, options) => { request = { url, options }; return Response.json({ sucesso: true }, { status: 202 }); } });
  assert.equal(request.url, 'https://epav.example.workers.dev/auth/forgot-password');
  assert.equal(request.options.headers.Authorization, undefined);
  assert.equal(JSON.parse(request.options.body).turnstileToken, 'challenge');
});
