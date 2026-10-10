const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');

process.env.DATABASE_URL = 'postgres://test/test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough-123456';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = 'test';

const { app, pool, encryptJson, decryptJson } = require('../src');

const users = [];
const assets = [];
const auditLogs = [];

function cloneAsset(asset) {
  return { ...asset, tags: [...asset.tags] };
}

pool.query = async (query, params = []) => {
  if (query.includes('INSERT INTO audit_logs')) {
    auditLogs.push({ actor_user_id: params[0], action: params[1], asset_id: params[2], metadata: JSON.parse(params[4]), created_at: new Date() });
    return { rowCount: 1, rows: [] };
  }
  if (query.includes('SELECT id, email, name, avatar_url FROM users WHERE id')) {
    const user = users.find((item) => item.id === params[0]);
    return { rowCount: user ? 1 : 0, rows: user ? [{ ...user }] : [] };
  }
  if (query.includes('SELECT id, email, name, avatar_url, password_hash FROM users WHERE email')) {
    const user = users.find((item) => item.email === params[0]);
    return { rowCount: user ? 1 : 0, rows: user ? [{ ...user }] : [] };
  }
  if (query.includes('INSERT INTO users')) {
    if (users.some((item) => item.email === params[0])) {
      const error = new Error('duplicate email');
      error.code = '23505';
      throw error;
    }
    const user = { id: crypto.randomUUID(), email: params[0], name: params[1], password_hash: params[2], avatar_url: null };
    users.push(user);
    return { rowCount: 1, rows: [{ ...user }] };
  }
  if (query.includes('INSERT INTO assets')) {
    const asset = {
      id: crypto.randomUUID(), user_id: params[0], title: params[1], type_key: params[2],
      description: params[3], tags: JSON.parse(params[4]), shared_content: params[5],
      private_bindings: params[6], favorite: params[7], use_count: 0, used_at: null,
      url: params[8] || '', folder: params[9] || '',
      created_at: new Date(), updated_at: new Date(),
    };
    assets.push(asset);
    return { rowCount: 1, rows: [cloneAsset(asset)] };
  }
  if (query.includes('SELECT id, title, type_key, description, tags, shared_content, private_bindings, favorite, used_at, use_count, created_at, updated_at, url, folder FROM assets')) {
    const userId = params[0];
    const recentOnly = query.includes('use_count > 0');
    const folderFilter = query.includes('folder = $2') ? params[1] : '';
    const listed = assets.filter((asset) => asset.user_id === userId && (!recentOnly || asset.use_count > 0) && (!folderFilter || asset.folder === folderFilter));
    return { rowCount: listed.length, rows: listed.map(cloneAsset) };
  }
  if (query.includes('SELECT id, private_bindings FROM assets')) {
    const asset = assets.find((item) => item.id === params[0] && item.user_id === params[1]);
    return { rowCount: asset ? 1 : 0, rows: asset ? [{ id: asset.id, private_bindings: asset.private_bindings }] : [] };
  }
  if (query.includes('SELECT * FROM assets WHERE id = $1 AND user_id = $2')) {
    const asset = assets.find((item) => item.id === params[0] && item.user_id === params[1]);
    return { rowCount: asset ? 1 : 0, rows: asset ? [cloneAsset(asset)] : [] };
  }
  if (query.includes('UPDATE assets SET used_at=now()')) {
    const asset = assets.find((item) => item.id === params[0] && item.user_id === params[1]);
    if (!asset) return { rowCount: 0, rows: [] };
    asset.use_count = (asset.use_count || 0) + 1;
    asset.used_at = new Date();
    return { rowCount: 1, rows: [cloneAsset(asset)] };
  }
  if (query.includes('SELECT count(*)::int AS copies FROM audit_logs')) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const copies = auditLogs.filter((entry) => entry.actor_user_id === params[0] && entry.action === 'asset.use' && new Date(entry.created_at) >= monthStart).length;
    return { rowCount: 1, rows: [{ copies }] };
  }
  if (query.includes('UPDATE assets SET title=')) {
    const asset = assets.find((item) => item.id === params[9] && item.user_id === params[10]);
    if (!asset) return { rowCount: 0, rows: [] };
    Object.assign(asset, {
      title: params[0], type_key: params[1], description: params[2], tags: JSON.parse(params[3]),
      shared_content: params[4], private_bindings: params[5], favorite: params[6],
      url: params[7] || '', folder: params[8] || '', updated_at: new Date(),
    });
    return { rowCount: 1, rows: [cloneAsset(asset)] };
  }
  throw new Error(`Unexpected query in test double: ${query}`);
};

let server;
let baseUrl;
test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.origin ? { Origin: options.origin } : {}),
      ...(options.headers || {}),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    response,
    body: text ? JSON.parse(text) : null,
    cookie: response.headers.get('set-cookie')?.split(';', 1)[0],
  };
}

test('private bindings are authenticated ciphertext', () => {
  const value = { OPENROUTER_API_KEY: 'secret-value', APP_URL: 'http://localhost:3000' };
  const encrypted = encryptJson(value);
  assert.notEqual(encrypted, JSON.stringify(value));
  assert.deepEqual(decryptJson(encrypted), value);
});

test('authentication, asset ownership, and private response boundaries', async () => {
  const missing = await request('/api/v1/assets');
  assert.equal(missing.response.status, 401);

  const blockedOrigin = await request('/api/v1/auth/register', {
    method: 'POST', origin: 'https://attacker.example',
    body: { email: 'blocked@example.com', name: 'Blocked', password: 'correct horse battery staple' },
  });
  assert.equal(blockedOrigin.response.status, 403);

  const registered = await request('/api/v1/auth/register', {
    method: 'POST', body: { email: 'owner@example.com', name: 'Owner', password: 'correct horse battery staple' },
  });
  assert.equal(registered.response.status, 201);
  const ownerCookie = registered.cookie;

  const created = await request('/api/v1/assets', {
    method: 'POST', cookie: ownerCookie,
    body: {
      title: 'OpenRouter', typeKey: 'credentials', sharedContent: 'KEY={{OPENROUTER_API_KEY}}',
      privateBindings: { OPENROUTER_API_KEY: 'sk-test-secret' },
    },
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.asset.privateBindings, undefined);
  assert.equal(created.body.asset.privateBindingMeta.OPENROUTER_API_KEY.length, 14);
  assert.match(JSON.stringify(created.body), /OPENROUTER_API_KEY/);
  assert.doesNotMatch(JSON.stringify(created.body), /sk-test-secret/);
  assert.ok(auditLogs.some((entry) => entry.action === 'auth.register'));
  assert.ok(auditLogs.some((entry) => entry.action === 'asset.create' && entry.asset_id === created.body.asset.id));

  const assetId = created.body.asset.id;
  const recentBeforeUse = await request('/api/v1/assets?recent=true', { cookie: ownerCookie });
  assert.equal(recentBeforeUse.response.status, 200);
  assert.equal(recentBeforeUse.body.assets.length, 0);
  const invalidBindings = await request('/api/v1/assets', {
    method: 'POST', cookie: ownerCookie,
    body: { title: 'Invalid', typeKey: 'snippet', sharedContent: 'x', privateBindings: { lowercase_key: 'not accepted' } },
  });
  assert.equal(invalidBindings.response.status, 400);

  const privateValues = await request(`/api/v1/assets/${assetId}/private`, { cookie: ownerCookie });
  assert.equal(privateValues.response.status, 200);
  assert.equal(privateValues.body.privateBindings.OPENROUTER_API_KEY, 'sk-test-secret');
  assert.equal(privateValues.response.headers.get('cache-control'), 'no-store');
  assert.ok(auditLogs.some((entry) => entry.action === 'asset.private.read' && entry.asset_id === assetId));

  const other = await request('/api/v1/auth/register', {
    method: 'POST', body: { email: 'other@example.com', name: 'Other', password: 'correct horse battery staple' },
  });
  const crossUser = await request(`/api/v1/assets/${assetId}/private`, { cookie: other.cookie });
  assert.equal(crossUser.response.status, 404);

  const malformedId = await request('/api/v1/assets/not-an-id', { cookie: ownerCookie });
  assert.equal(malformedId.response.status, 400);
});

test('duplicate registration is rejected', async () => {
  const duplicate = await request('/api/v1/auth/register', {
    method: 'POST', body: { email: 'owner@example.com', name: 'Owner', password: 'correct horse battery staple' },
  });
  assert.equal(duplicate.response.status, 409);
});

test('authentication endpoints are rate limited per source', async () => {
  const headers = { 'X-Forwarded-For': '198.51.100.44' };
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request('/api/v1/auth/login', {
      method: 'POST', headers,
      body: { email: 'missing@example.com', password: 'wrong-password' },
    });
    assert.equal(response.response.status, 401);
  }
  const limited = await request('/api/v1/auth/login', {
    method: 'POST', headers,
    body: { email: 'missing@example.com', password: 'wrong-password' },
  });
  assert.equal(limited.response.status, 429);
  assert.ok(Number(limited.response.headers.get('retry-after')) > 0);
});

test('copy events track per-asset heat and monthly copies', async () => {
  const registered = await request('/api/v1/auth/register', {
    method: 'POST', body: { email: 'heat@example.com', name: 'Heat', password: 'correct horse battery staple' },
  });
  const created = await request('/api/v1/assets', {
    method: 'POST', cookie: registered.cookie,
    body: { title: 'Hot asset', typeKey: 'snippet', sharedContent: 'x' },
  });
  const assetId = created.body.asset.id;
  assert.equal(created.body.asset.useCount, 0);
  assert.equal(created.body.asset.usedAt, null);
  const beforeUseUpdatedAt = assets.find((asset) => asset.id === assetId).updated_at;
  const first = await request(`/api/v1/assets/${assetId}/use`, { method: 'POST', cookie: registered.cookie });
  const second = await request(`/api/v1/assets/${assetId}/use`, { method: 'POST', cookie: registered.cookie });
  assert.equal(first.response.status, 200);
  assert.equal(second.body.asset.useCount, 2);
  assert.ok(second.body.asset.usedAt);
  assert.equal(assets.find((asset) => asset.id === assetId).updated_at, beforeUseUpdatedAt);
  const recentAfterUse = await request('/api/v1/assets?recent=true', { cookie: registered.cookie });
  assert.equal(recentAfterUse.response.status, 200);
  assert.equal(recentAfterUse.body.assets.length, 1);
  const stats = await request('/api/v1/stats/copies', { cookie: registered.cookie });
  assert.equal(stats.response.status, 200);
  assert.ok(stats.body.copies >= 2);
  const other = await request('/api/v1/auth/register', {
    method: 'POST', body: { email: 'cold@example.com', name: 'Cold', password: 'correct horse battery staple' },
  });
  const otherStats = await request('/api/v1/stats/copies', { cookie: other.cookie });
  assert.equal(otherStats.body.copies, 0);
});
