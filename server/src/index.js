require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const port = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET;
const encryptionKey = process.env.ENCRYPTION_KEY;
const cookieName = 'ofa_session';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
if (!/^[0-9a-f]{64}$/i.test(encryptionKey || '')) throw new Error('ENCRYPTION_KEY must be 64 hex characters');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error', error));
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,https://tools.chatcanvas.online').split(',').map((value) => value.trim()).filter(Boolean);
  if (origin && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'ORIGIN_FORBIDDEN', message: '请求来源不被允许' });
  }
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      // Ignore malformed cookies and let authentication return a normal 401.
    }
  }
  return cookies;
}

function setSessionCookie(res, token) {
  const attributes = [`${cookieName}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=604800'];
  if (isProduction) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(res) {
  const attributes = [`${cookieName}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isProduction) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret, { expiresIn: '7d', issuer: 'one-for-all' });
}

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name, avatarUrl: row.avatar_url || null };
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptJson(value) {
  if (!value) return {};
  const [ivPart, tagPart, encryptedPart] = String(value).split('.');
  if (!ivPart || !tagPart || !encryptedPart) throw new Error('Invalid encrypted private bindings');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const parsed = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encryptedPart, 'base64url')), decipher.final()]).toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid private bindings payload');
  return parsed;
}

function parseBindings(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 100 || entries.some(([key, item]) => !/^[A-Z][A-Z0-9_]{0,127}$/.test(key) || typeof item !== 'string' || item.length > 8192)) return null;
  if (entries.reduce((total, [, item]) => total + item.length, 0) > 65536) return null;
  return Object.fromEntries(entries);
}

function assetResponse(row) {
  let bindingMeta = {};
  try {
    const bindings = decryptJson(row.private_bindings);
    bindingMeta = Object.fromEntries(Object.entries(bindings).map(([key, value]) => [key, { length: value.length }]));
  } catch (error) {
    console.error('Unable to decrypt asset bindings', row.id, error.message);
  }
  return {
    id: row.id, title: row.title, typeKey: row.type_key, description: row.description,
    tags: Array.isArray(row.tags) ? row.tags : [], sharedContent: row.shared_content,
    privateBindingMeta: bindingMeta, favorite: row.favorite, usedAt: row.used_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function readPrivateBindings(row) {
  return decryptJson(row.private_bindings);
}

async function authenticate(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  const token = bearer || cookies[cookieName];
  if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED', message: '登录后才能访问此资源' });
  try {
    const payload = jwt.verify(token, jwtSecret, { issuer: 'one-for-all' });
    const result = await pool.query('SELECT id, email, name, avatar_url FROM users WHERE id = $1', [payload.sub]);
    if (!result.rowCount) return res.status(401).json({ error: 'AUTH_INVALID', message: '登录状态已失效' });
    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: 'AUTH_INVALID', message: '登录状态已失效' });
  }
}

function validateEmail(email) { return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254; }
function validatePassword(password) { return typeof password === 'string' && password.length >= 10 && password.length <= 128; }
function validateType(typeKey) { return ['credentials', 'infra', 'prompt', 'snippet', 'database', 'component'].includes(typeKey); }
function validateUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function badRequest(res, message) { return res.status(400).json({ error: 'BAD_REQUEST', message }); }

function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > 10000) {
      for (const [entryKey, entry] of buckets) if (entry.resetAt <= now) buckets.delete(entryKey);
    }
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - bucket.count));
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ error: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' });
    }
    next();
  };
}

async function recordAudit({ req, userId = null, action, assetId = null, metadata = {} }) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (actor_user_id, action, asset_id, ip_address, metadata) VALUES ($1,$2,$3,$4,$5::jsonb)',
      [userId, action, assetId, req.ip || null, JSON.stringify(metadata)],
    );
  } catch (error) {
    // Audit failures must not make a successful user operation fail.
    console.error('Unable to write audit log', action, error.message);
  }
}

const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

app.get(['/health', '/api/health'], async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', timestamp: new Date().toISOString() }); }
  catch (error) { res.status(503).json({ status: 'error', message: '数据库不可用' }); }
});
app.get('/api/v1', (req, res) => res.json({ name: 'one-for-all-api', version: 'v1' }));
app.param('id', (req, res, next, id) => validateUuid(id)
  ? next()
  : res.status(400).json({ error: 'BAD_REQUEST', message: '资产 ID 无效' }));

app.post('/api/v1/auth/register', authRateLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase(); const name = String(req.body?.name || email.split('@')[0]).trim(); const password = req.body?.password;
    if (!validateEmail(email) || !validatePassword(password) || !name || name.length > 80) return badRequest(res, '请输入有效邮箱、姓名和至少 10 位密码');
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query('INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, avatar_url', [email, name, passwordHash]);
    const user = result.rows[0]; setSessionCookie(res, issueToken(user));
    await recordAudit({ req, userId: user.id, action: 'auth.register' });
    res.status(201).json({ user: publicUser(user) });
  } catch (error) { if (error.code === '23505') return res.status(409).json({ error: 'EMAIL_EXISTS', message: '该邮箱已经注册' }); next(error); }
});

app.post('/api/v1/auth/login', authRateLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase(); const password = req.body?.password;
    if (!validateEmail(email) || typeof password !== 'string') return badRequest(res, '请输入邮箱和密码');
    const result = await pool.query('SELECT id, email, name, avatar_url, password_hash FROM users WHERE email = $1', [email]);
    const user = result.rows[0]; if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'LOGIN_FAILED', message: '邮箱或密码不正确' });
    setSessionCookie(res, issueToken(user));
    await recordAudit({ req, userId: user.id, action: 'auth.login' });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});
app.post('/api/v1/auth/logout', async (req, res) => { clearSessionCookie(res); await recordAudit({ req, action: 'auth.logout' }); res.status(204).end(); });
app.get('/api/v1/auth/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

app.get('/api/v1/assets', authenticate, async (req, res, next) => {
  try {
    const values = [req.user.id]; const where = ['user_id = $1'];
    if (req.query.type) { if (!validateType(req.query.type)) return badRequest(res, '无效的资产类型'); values.push(req.query.type); where.push(`type_key = $${values.length}`); }
    if (req.query.favorite === 'true') where.push('favorite = true');
    if (req.query.recent === 'true') where.push(`used_at >= now() - interval '30 days'`);
    if (req.query.q) { values.push(`%${String(req.query.q).slice(0, 200)}%`); const index = values.length; where.push(`(title ILIKE $${index} OR description ILIKE $${index} OR shared_content ILIKE $${index} OR tags::text ILIKE $${index})`); }
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100); const offset = Math.max(Number(req.query.offset) || 0, 0); values.push(limit, offset);
    const result = await pool.query(`SELECT id, title, type_key, description, tags, shared_content, private_bindings, favorite, used_at, created_at, updated_at FROM assets WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    await recordAudit({ req, userId: req.user.id, action: 'asset.list', metadata: { count: result.rowCount } });
    res.json({ assets: result.rows.map(assetResponse), pagination: { limit, offset, count: result.rowCount } });
  } catch (error) { next(error); }
});

app.post('/api/v1/assets', authenticate, async (req, res, next) => {
  try {
    const body = req.body || {}; const title = String(body.title || '').trim(); const typeKey = body.typeKey; const sharedContent = String(body.sharedContent || '');
    if (!title || title.length > 200 || !validateType(typeKey) || sharedContent.length > 200000) return badRequest(res, '资产名称、类型或共享模板无效');
    const tags = Array.isArray(body.tags) ? body.tags.filter((tag) => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, 30) : [];
    const privateBindings = parseBindings(body.privateBindings);
    if (privateBindings === null) return badRequest(res, '私密配置格式无效或超过大小限制');
    const result = await pool.query('INSERT INTO assets (user_id, title, type_key, description, tags, shared_content, private_bindings, favorite) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) RETURNING *', [req.user.id, title, typeKey, String(body.description || '').slice(0, 1000), JSON.stringify(tags), sharedContent, encryptJson(privateBindings), Boolean(body.favorite)]);
    await recordAudit({ req, userId: req.user.id, action: 'asset.create', assetId: result.rows[0].id, metadata: { typeKey } });
    res.status(201).json({ asset: assetResponse(result.rows[0]) });
  } catch (error) { next(error); }
});

app.get('/api/v1/assets/:id', authenticate, async (req, res, next) => {
  try { const result = await pool.query('SELECT * FROM assets WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]); if (!result.rowCount) return res.status(404).json({ error: 'NOT_FOUND', message: '资产不存在' }); res.json({ asset: assetResponse(result.rows[0]) }); }
  catch (error) { next(error); }
});

// Private values have a dedicated owner-only endpoint and are never included in normal asset responses.
app.get('/api/v1/assets/:id/private', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, private_bindings FROM assets WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'NOT_FOUND', message: '资产不存在' });
    await recordAudit({ req, userId: req.user.id, action: 'asset.private.read', assetId: req.params.id });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ privateBindings: readPrivateBindings(result.rows[0]) });
  } catch (error) { next(error); }
});

app.put('/api/v1/assets/:id/private', authenticate, async (req, res, next) => {
  try {
    const privateBindings = parseBindings(req.body?.privateBindings);
    if (privateBindings === null) return badRequest(res, '私密配置格式无效或超过大小限制');
    const result = await pool.query('UPDATE assets SET private_bindings=$1, updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING *', [encryptJson(privateBindings), req.params.id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'NOT_FOUND', message: '资产不存在' });
    await recordAudit({ req, userId: req.user.id, action: 'asset.private.update', assetId: req.params.id, metadata: { bindingCount: Object.keys(privateBindings).length } });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ asset: assetResponse(result.rows[0]) });
  } catch (error) { next(error); }
});

app.put('/api/v1/assets/:id', authenticate, async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM assets WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]); if (!current.rowCount) return res.status(404).json({ error: 'NOT_FOUND', message: '资产不存在' });
    const existing = current.rows[0]; const body = req.body || {}; const title = body.title === undefined ? existing.title : String(body.title).trim(); const typeKey = body.typeKey === undefined ? existing.type_key : body.typeKey; const sharedContent = body.sharedContent === undefined ? existing.shared_content : String(body.sharedContent);
    if (!title || title.length > 200 || !validateType(typeKey) || sharedContent.length > 200000) return badRequest(res, '资产名称、类型或共享模板无效');
    const tags = body.tags === undefined ? existing.tags : (Array.isArray(body.tags) ? body.tags.filter((tag) => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, 30) : []);
    const parsedBindings = body.privateBindings === undefined ? undefined : parseBindings(body.privateBindings);
    if (parsedBindings === null) return badRequest(res, '私密配置格式无效或超过大小限制');
    const privateBindings = parsedBindings === undefined ? existing.private_bindings : encryptJson(parsedBindings);
    const result = await pool.query('UPDATE assets SET title=$1,type_key=$2,description=$3,tags=$4::jsonb,shared_content=$5,private_bindings=$6,favorite=$7,updated_at=now() WHERE id=$8 AND user_id=$9 RETURNING *', [title, typeKey, body.description === undefined ? existing.description : String(body.description).slice(0, 1000), JSON.stringify(tags), sharedContent, privateBindings, body.favorite === undefined ? existing.favorite : Boolean(body.favorite), req.params.id, req.user.id]);
    await recordAudit({ req, userId: req.user.id, action: 'asset.update', assetId: req.params.id, metadata: { typeKey } });
    res.json({ asset: assetResponse(result.rows[0]) });
  } catch (error) { next(error); }
});

app.post('/api/v1/assets/:id/use', authenticate, async (req, res, next) => {
  try { const result = await pool.query('UPDATE assets SET used_at=now(), updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *', [req.params.id, req.user.id]); if (!result.rowCount) return res.status(404).json({ error: 'NOT_FOUND', message: '资产不存在' }); await recordAudit({ req, userId: req.user.id, action: 'asset.use', assetId: req.params.id }); res.json({ asset: assetResponse(result.rows[0]) }); }
  catch (error) { next(error); }
});

app.delete('/api/v1/assets/:id', authenticate, async (req, res, next) => {
  try { const result = await pool.query('DELETE FROM assets WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]); if (!result.rowCount) return res.status(404).json({ error: 'NOT_FOUND', message: '资产不存在' }); await recordAudit({ req, userId: req.user.id, action: 'asset.delete', assetId: req.params.id }); res.status(204).end(); }
  catch (error) { next(error); }
});

app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND', message: '接口不存在' }));
app.use((error, req, res, next) => { console.error(error); if (res.headersSent) return next(error); if (error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed') return res.status(400).json({ error: 'BAD_JSON', message: '请求 JSON 格式无效' }); res.status(500).json({ error: 'INTERNAL_ERROR', message: '服务器内部错误' }); });

let server;
async function shutdown(signal) {
  console.log(`${signal}: shutting down`);
  if (!server) return pool.end();
  server.close(async () => { await pool.end(); process.exit(0); });
}

if (require.main === module) {
  server = app.listen(port, () => console.log(`One for All API listening on ${port}`));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { app, pool, encryptJson, decryptJson, parseBindings, parseCookies };
