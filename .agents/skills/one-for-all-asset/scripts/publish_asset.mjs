#!/usr/bin/env node

import fs from 'node:fs/promises'
import process from 'node:process'

const VALID_TYPES = new Set(['credentials', 'infra', 'prompt', 'snippet', 'database', 'component'])
const TYPE_LABELS = {
  credentials: '凭证',
  infra: '基础设施',
  prompt: '提示词',
  snippet: '代码片段',
  database: '数据库',
  component: '组件',
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (!item.startsWith('--')) continue
    const key = item.slice(2)
    if (key === 'dry-run') args.dryRun = true
    else args[key] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : ''
  }
  return args
}

function parseEnvFile(text) {
  const values = {}
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    values[match[1]] = value
  }
  return values
}

async function loadLocalEnv() {
  const path = process.env.OFA_ENV_FILE || `${process.cwd()}/.env.local`
  try {
    const values = parseEnvFile(await fs.readFile(path, 'utf8'))
    for (const [key, value] of Object.entries(values)) if (process.env[key] === undefined) process.env[key] = value
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`无法读取本地环境文件: ${path}`)
  }
}

function looksLikeSecret(value) {
  const normalized = String(value || '').trim()
  return normalized.length >= 12 && !/^\$\{[^}]+\}$|^\{\{[^}]+\}\}$|^<[^>]+>$|^your[-_]|^placeholder|^example|^sk-[….-]+$/i.test(normalized)
}

function looksLikeStandaloneSecret(value) {
  const normalized = String(value || '').trim()
  if (!looksLikeSecret(normalized) || /\s|[\u3400-\u9fff]/.test(normalized)) return false
  return /^(sk-|rk-|pk-|gh[pousr]_|xox[baprs]-|AIza|AKIA|eyJ)/i.test(normalized) || /^[A-Za-z0-9._-]{20,}$/.test(normalized)
}

function envName(preferred, context) {
  const imageContext = /gpt[-_ ]?image/i.test(context)
  let name = String(preferred || (imageContext ? 'GPT_IMAGE_API_KEY' : 'API_KEY')).replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_')
  if (!name || !/^[A-Z]/.test(name)) name = imageContext ? 'GPT_IMAGE_API_KEY' : 'API_KEY'
  return name
}

function splitSensitiveContent(input, title = '') {
  const context = `${title}\n${input}`
  const bindings = {}
  const usedNames = new Set()
  const addBinding = (preferred, rawValue) => {
    const value = String(rawValue || '').trim().replace(/[),;]+$/, '')
    if (!looksLikeSecret(value)) return null
    const base = envName(preferred, context)
    let name = base
    let suffix = 2
    while (usedNames.has(name) && bindings[name] !== value) name = `${base}_${suffix++}`
    if (!usedNames.has(name)) {
      bindings[name] = value
      usedNames.add(name)
    }
    return name
  }

  let sharedContent = String(input || '')
  sharedContent = sharedContent.replace(/(Authorization\s*:\s*Bearer\s+)([^\s"'\\]+)/gi, (match, prefix, value) => {
    const name = addBinding(/gpt[-_ ]?image/i.test(context) ? 'GPT_IMAGE_API_KEY' : 'API_BEARER_TOKEN', value)
    return name ? `${prefix}\${${name}}` : match
  })
  sharedContent = sharedContent.replace(/\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*=\s*(["']?)([^\s'"\\]+)\2/g, (match, key, quote, value) => {
    const name = addBinding(key, value)
    return name ? `${key}=${quote}\${${name}}${quote}` : match
  })
  sharedContent = sharedContent.replace(/(["'])(apiKey|api_key|accessToken|access_token|secretKey|secret_key|password)\1\s*:\s*(["'])([^"']+)(["'])/gi, (match, keyQuote, key, valueQuote, value, endQuote) => {
    const name = addBinding(key, value)
    return name ? `${keyQuote}${key}${keyQuote}: ${valueQuote}\${${name}}${endQuote}` : match
  })

  const raw = String(input || '').trim()
  if (!Object.keys(bindings).length && raw && !raw.includes('\n') && looksLikeStandaloneSecret(raw)) {
    const name = addBinding(/gpt[-_ ]?image/i.test(context) ? 'GPT_IMAGE_API_KEY' : 'API_KEY', raw)
    if (name) sharedContent = `# ${title || '开发资产'}\n\n请从本地 .env.local 读取 ${name}。\n${name}=\${${name}}`
  }
  return { sharedContent, privateBindings: bindings }
}

function inferType(title, content) {
  const text = `${title}\n${content}`.toLowerCase()
  if (looksLikeStandaloneSecret(String(content).trim())) return 'credentials'
  if (/prompt|提示词|system message|你是一个/.test(text)) return 'prompt'
  if (/[\u3400-\u9fff]/.test(text) && !/```|curl\s+-x|authorization\s*:|\b(from|import|const|function)\b/.test(text) && text.length > 20) return 'prompt'
  if (/postgres|mysql|database|数据库|prisma|sql|redis|mongodb/.test(text)) return 'database'
  if (/react|vue|组件|component|useState|hook/.test(text) && !/curl|authorization|api[_ -]?key/.test(text)) return 'component'
  if (/cos|oss|docker|kubernetes|nginx|上传|部署|terraform|s3/.test(text)) return 'infra'
  if (/api[_ -]?key|access[_ -]?token|authorization\s*:\s*bearer|secret|密码|密钥|秘钥|凭证|curl\s+-x/.test(text)) return 'credentials'
  return 'snippet'
}

function inferTitle(content, requested) {
  if (requested?.trim()) return requested.trim().slice(0, 200)
  const heading = String(content).match(/^\s*#\s+(.+)$/m)?.[1]?.trim()
  if (heading) return heading.slice(0, 200)
  if (/gpt[-_ ]?image/i.test(content)) return 'GPT Image API 调用'
  if (/openrouter/i.test(content)) return 'OpenRouter API 接入'
  if (/腾讯云|\bcos\b/i.test(content)) return '腾讯云 COS 接入'
  return '未命名开发资产'
}

function inferTags(title, content, requested) {
  const tags = String(requested || '').split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
  const candidates = [
    [/openrouter/i, 'OpenRouter'], [/gpt[-_ ]?image/i, 'GPT Image'], [/curl/i, 'curl'], [/api|接口/i, 'API'],
    [/node|npm|javascript|typescript/i, 'Node.js'], [/react/i, 'React'], [/vue/i, 'Vue'], [/cos|腾讯云/i, '腾讯云 COS'],
    [/docker/i, 'Docker'], [/postgres|mysql|sql|prisma/i, '数据库'], [/prompt|提示词/i, 'Prompt'],
    [/token|secret|key|密钥/i, '环境变量'],
  ]
  for (const [pattern, tag] of candidates) if (pattern.test(`${title}\n${content}`) && !tags.includes(tag)) tags.push(tag)
  if (!tags.length) tags.push(TYPE_LABELS[inferType(title, content)])
  return [...new Set(tags)].slice(0, 30)
}

function inferDescription(title, content, requested, type) {
  if (requested?.trim()) return requested.trim().slice(0, 1000)
  const firstMeaningful = String(content).split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith('#') && !line.startsWith('```'))
  return (firstMeaningful ? `${TYPE_LABELS[type]}：${firstMeaningful.replace(/\s+/g, ' ').slice(0, 180)}` : `${title || TYPE_LABELS[type]} 的可复用开发资产`).slice(0, 1000)
}

async function readStdin() {
  if (process.stdin.isTTY) return ''
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function request(path, options = {}) {
  const base = (process.env.OFA_API_URL || 'https://tools.chatcanvas.online/api/v1').replace(/\/$/, '')
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message || `One for All 请求失败 (${response.status})`)
  return { body, response }
}

async function authenticate() {
  const token = process.env.OFA_SESSION_TOKEN || process.env.ONE_FOR_ALL_TOKEN
  if (token) return { Authorization: `Bearer ${token}` }
  if (process.env.OFA_SESSION_COOKIE) return { Cookie: process.env.OFA_SESSION_COOKIE }
  if (!process.env.OFA_EMAIL || !process.env.OFA_PASSWORD) throw new Error('请在当前项目 .env.local 设置 OFA_SESSION_TOKEN，或设置 OFA_EMAIL 与 OFA_PASSWORD')
  const { response, body } = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: process.env.OFA_EMAIL, password: process.env.OFA_PASSWORD }) })
  if (!body?.user) throw new Error('One for All 登录失败')
  const setCookie = response.headers.get('set-cookie') || ''
  const cookie = setCookie.split(';')[0]
  if (!cookie) throw new Error('登录成功但未取得会话 Cookie')
  return { Cookie: cookie }
}

function safeSummary(asset, bindings) {
  return JSON.stringify({
    saved: true,
    id: asset.id,
    title: asset.title,
    typeKey: asset.typeKey,
    tags: asset.tags,
    privateBindingCount: Object.keys(bindings).length,
    privateBindingNames: Object.keys(bindings),
  }, null, 2)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await loadLocalEnv()
  const raw = await readStdin()
  if (!raw.trim()) throw new Error('请通过 stdin 提供资产内容')
  const title = inferTitle(raw, args.title)
  const typeKey = VALID_TYPES.has(args.type) ? args.type : inferType(title, raw)
  const split = splitSensitiveContent(raw, title)
  const description = inferDescription(title, split.sharedContent, args.description, typeKey)
  const tags = inferTags(title, split.sharedContent, args.tags)
  if (!split.sharedContent.trim()) split.sharedContent = `# ${title}`
  if (args.dryRun) {
    process.stdout.write(JSON.stringify({ dryRun: true, title, typeKey, description, tags, privateBindingCount: Object.keys(split.privateBindings).length, privateBindingNames: Object.keys(split.privateBindings) }, null, 2) + '\n')
    return
  }
  const headers = await authenticate()
  const { body } = await request('/assets', { method: 'POST', headers, body: JSON.stringify({ title, typeKey, description, tags, sharedContent: split.sharedContent, privateBindings: split.privateBindings, favorite: false }) })
  if (!body?.asset) throw new Error('One for All 未返回已保存资产')
  process.stdout.write(safeSummary(body.asset, split.privateBindings) + '\n')
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
