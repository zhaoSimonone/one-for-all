import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ArrowUpRight, AlignLeft, Bookmark, Box, Braces, Check, ChevronDown, ChevronUp, Cloud, Code2, Copy, Database, Download, FileCode2, FileDiff, FilePenLine, KeyRound, Layers3, ListFilter, LogOut, Menu, Maximize2, Minimize2, MoreHorizontal, Plus, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Star, Tag, Terminal, Trash2, Upload, UserRound, WandSparkles, Wrench, X, Zap, AlertCircle } from 'lucide-react'
import './styles.css'
import './privacy.css'
import { EditorState } from '@codemirror/state'
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { foldAll, foldGutter, foldedRanges, unfoldEffect, syntaxHighlighting, unfoldAll, HighlightStyle } from '@codemirror/language'
import { SearchQuery, search, setSearchQuery } from '@codemirror/search'
import { collectSearchMatches, nextSearchIndex, jsonSearchHighlights } from './tools/json-search'
import { json } from '@codemirror/lang-json'
import { tags } from '@lezer/highlight'
import { parseJsonWithRecovery } from './tools/loose-json'

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'
const palette = { credentials: ['凭证', KeyRound, 'coral'], infra: ['基础设施', Cloud, 'blue'], prompt: ['提示词', Sparkles, 'violet'], snippet: ['代码片段', Terminal, 'ink'], database: ['数据库', Database, 'green'], component: ['组件', Box, 'amber'] }
const meta = (key) => palette[key] || ['资产', FileCode2, 'ink']
const colors = { credentials: 'coral', infra: 'blue', prompt: 'violet', snippet: 'ink', database: 'green', component: 'amber' }
const seedAssets = [
  { id: 'openrouter', title: 'OpenRouter API 接入', typeKey: 'credentials', favorite: true, description: '统一调用 Claude、GPT、Gemini 等模型的 API 配置与初始化代码。', tags: ['AI / API', 'Node.js', '环境变量'], updated: '今天 10:42', used: '刚刚使用', sharedContent: '# OpenRouter API 接入\n\n## 环境变量（共享模板）\nOPENROUTER_API_KEY={{OPENROUTER_API_KEY}}\nAPP_URL={{APP_URL}}\n\n## 初始化\nimport OpenAI from \'openai\';\n\nconst client = new OpenAI({\n  baseURL: \'https://openrouter.ai/api/v1\',\n  apiKey: process.env.OPENROUTER_API_KEY,\n  defaultHeaders: { \'HTTP-Referer\': process.env.APP_URL, \'X-Title\': \'Your App Name\' },\n});', privateBindings: { OPENROUTER_API_KEY: 'sk-or-v1-your-private-key', APP_URL: 'https://your-app.example' } },
  { id: 'tencent-cos', title: '腾讯云 COS 上传', typeKey: 'infra', favorite: true, description: '前端直传腾讯云对象存储，包含签名服务、上传进度和 CDN 地址拼接。', tags: ['腾讯云', 'COS', '文件上传'], updated: '昨天 16:18', used: '昨天使用', sharedContent: '# 腾讯云 COS 上传\n\nCOS_SECRET_ID={{COS_SECRET_ID}}\nCOS_SECRET_KEY={{COS_SECRET_KEY}}\nCOS_BUCKET={{COS_BUCKET}}\nCOS_REGION={{COS_REGION}}\n\nimport COS from \'cos-nodejs-sdk-v5\';\nconst cos = new COS({ SecretId: process.env.COS_SECRET_ID, SecretKey: process.env.COS_SECRET_KEY });', privateBindings: { COS_SECRET_ID: 'your-private-secret-id', COS_SECRET_KEY: 'your-private-secret-key', COS_BUCKET: 'your-bucket-1250000000', COS_REGION: 'ap-shanghai' } },
  { id: 'prompt-review', title: '代码审查 Prompt', typeKey: 'prompt', favorite: false, description: '让编程助手聚焦风险、回归和测试缺口，输出带行号的审查结果。', tags: ['Codex', 'Code Review', '工作流'], updated: '8月 29日', used: '3 天前使用', sharedContent: '# 代码审查 Prompt\n\n请以资深工程师的标准审查以下变更。\n\n重点关注：\n1. 真实的 bug、行为回归和安全风险\n2. 边界条件、错误处理和并发问题\n3. 缺失或脆弱的测试\n\n输出要求：\n- 先按严重程度列出 findings，并给出文件和行号。\n- 没有问题时明确说明，并列出剩余测试缺口。', privateBindings: {} },
  { id: 'docker-node', title: 'Node 服务 Dockerfile', typeKey: 'snippet', favorite: false, description: '适用于生产环境的多阶段构建，默认使用非 root 用户运行。', tags: ['Docker', 'Node.js', '生产部署'], updated: '8月 27日', used: '上周使用', sharedContent: '# Node 服务 Dockerfile\n\nFROM node:22-alpine AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:22-alpine\nWORKDIR /app\nENV NODE_ENV=production\nCOPY --from=build /app/package*.json ./\nRUN npm ci --omit=dev\nUSER app\nEXPOSE 3000\nCMD ["node", "dist/server.js"]', privateBindings: {} },
  { id: 'postgres-prisma', title: 'Prisma + PostgreSQL', typeKey: 'database', favorite: false, description: '本地开发和线上部署通用的 Prisma 数据库连接配置。', tags: ['Prisma', 'PostgreSQL', 'Schema'], updated: '8月 24日', used: '上周使用', sharedContent: '# Prisma + PostgreSQL\n\nDATABASE_URL={{DATABASE_URL}}\n\n// prisma/schema.prisma\ndatasource db { provider = "postgresql"; url = env("DATABASE_URL") }', privateBindings: { DATABASE_URL: 'postgresql://app:private-password@localhost:5432/app_db' } },
  { id: 'react-table', title: 'React 数据表格状态', typeKey: 'component', favorite: false, description: '列表页常用的筛选、分页、排序状态管理骨架。', tags: ['React', '状态管理', '列表页'], updated: '8月 21日', used: '2 周前使用', sharedContent: '# React 数据表格状态\n\nconst [query, setQuery] = useState({ page: 1, pageSize: 20, keyword: \'\', sort: \'createdAt:desc\' });\nconst updateQuery = (patch) => setQuery((current) => ({ ...current, ...patch }));', privateBindings: {} },
]

const localKey = 'ofa-assets'
const migrationKey = 'ofa-migrated-assets'
const mdPrefKey = 'ofa-md-view'
const seedAssetIds = new Set(seedAssets.map((asset) => asset.id))
const normalizeLocal = (asset) => ({ ...asset, sharedContent: asset.sharedContent || asset.content || '', privateBindings: asset.privateBindings || {}, privateBindingMeta: Object.fromEntries(Object.keys(asset.privateBindings || {}).map((key) => [key, { length: asset.privateBindings[key].length }])), sensitive: Object.keys(asset.privateBindings || {}).length > 0 || asset.sensitive === true, content: undefined })
const readMigrationMap = () => { try { const value = JSON.parse(localStorage.getItem(migrationKey)); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} } }
const readStoredLocal = () => { try { const raw = JSON.parse(localStorage.getItem(localKey)); const migrated = readMigrationMap(); return Array.isArray(raw) && raw.length ? raw.filter((asset) => !seedAssetIds.has(asset.id) && !migrated[asset.id]).map(normalizeLocal) : [] } catch { return [] } }
const readLocal = () => { try { const raw = JSON.parse(localStorage.getItem(localKey)); return (Array.isArray(raw) && raw.length ? raw : seedAssets).map(normalizeLocal) } catch { return seedAssets.map(normalizeLocal) } }
const fromApi = (asset) => ({ ...asset, updated: formatDate(asset.updatedAt), used: formatUsed(asset.usedAt), privateBindings: {}, privateBindingMeta: asset.privateBindingMeta || {}, sensitive: Object.keys(asset.privateBindingMeta || {}).length > 0 })
const bindingCount = (asset) => Object.keys(asset.privateBindings || asset.privateBindingMeta || {}).length
const envText = (bindings) => Object.entries(bindings || {}).map(([key, value]) => `${key}=${value}`).join('\n')
const parseEnvText = (text) => { const raw = String(text || '').trim(); const parsed = Object.fromEntries(raw.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()] })); if (Object.keys(parsed).length || !raw || raw.includes('\n') || !looksLikeSecret(raw)) return parsed; return { [raw.startsWith('sk-') ? 'GPT_IMAGE_API_KEY' : 'API_KEY']: raw } }
const formatDate = (date) => date ? new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(date)) : '刚刚'
const formatUsed = (date) => { if (!date) return '尚未使用'; const minutes = (Date.now() - new Date(date).getTime()) / 60000; return minutes < 10 ? '刚刚使用' : minutes < 1440 ? '今天使用' : '最近使用' }
const looksLikeSecret = (value) => { const normalized = String(value || '').trim(); return normalized.length >= 12 && !/^\$\{[^}]+\}$|^\{\{[^}]+\}\}$|^<[^>]+>$|^your[-_]|^placeholder|^example|^sk-[….-]+$/i.test(normalized) }
const splitSensitiveContent = (text) => { const bindings = {}; const usedNames = new Set(); const detected = []; const imageContext = /gpt[-_ ]?image/i.test(text); const addBinding = (preferred, value) => { const cleanValue = String(value || '').trim(); if (!looksLikeSecret(cleanValue)) return null; let name = preferred.toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_'); if (!name || !/^[A-Z]/.test(name)) name = 'API_SECRET'; let index = 2; const base = name; while (usedNames.has(name) && bindings[name] !== cleanValue) name = `${base}_${index++}`; if (!usedNames.has(name)) { bindings[name] = cleanValue; usedNames.add(name); detected.push(name) } return name }; let sharedContent = String(text || ''); sharedContent = sharedContent.replace(/(Authorization\s*:\s*Bearer\s+)([^\s"'\\]+)/gi, (match, prefix, value) => { const name = addBinding(imageContext ? 'GPT_IMAGE_API_KEY' : 'API_BEARER_TOKEN', value); return name ? `${prefix}$\{${name}\}` : match }); sharedContent = sharedContent.replace(/\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*=\s*(['"]?)([^\s'"\\]+)\2/g, (match, key, quote, value) => { const name = addBinding(key, value); return name ? `${key}=${quote}$\{${name}\}${quote}` : match }); sharedContent = sharedContent.replace(/(["'])(apiKey|api_key|accessToken|access_token|secretKey|secret_key|password)\1\s*:\s*(["'])([^"']+)(["'])/gi, (match, keyQuote, key, valueQuote, value, endQuote) => { const envName = addBinding(key.replace(/([a-z])([A-Z])/g, '$1_$2'), value); return envName ? `${keyQuote}${key}${keyQuote}: ${valueQuote}$\{${envName}\}${endQuote}` : match }); return { sharedContent, privateBindings: bindings, detected } }
const parsePrivateDraft = (text, asset) => { const parsed = parseEnvText(text); const raw = String(text || '').trim(); if (Object.keys(parsed).length || !raw || raw.includes('\n')) return parsed; if (!looksLikeSecret(raw)) return parsed; const context = `${asset?.title || ''} ${asset?.sharedContent || ''}`; const key = /gpt[-_ ]?image/i.test(context) ? 'GPT_IMAGE_API_KEY' : 'API_KEY'; return { [key]: raw } }

async function apiRequest(path, options = {}) { const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options }); const body = response.status === 204 ? null : await response.json().catch(() => null); if (!response.ok) throw new Error(body?.message || '请求失败'); return body }

const ROUTES = [['', { tools: false, view: 'all', type: 'all' }], ['credentials', { tools: false, view: 'all', type: 'credentials' }], ['infra', { tools: false, view: 'all', type: 'infra' }], ['prompt', { tools: false, view: 'all', type: 'prompt' }], ['snippet', { tools: false, view: 'all', type: 'snippet' }], ['database', { tools: false, view: 'all', type: 'database' }], ['component', { tools: false, view: 'all', type: 'component' }], ['favorites', { tools: false, view: 'favorites', type: 'all' }], ['recent', { tools: false, view: 'recent', type: 'all' }], ['tools', { tools: 'library', view: 'all', type: 'all' }], ['tools/json-format', { tools: 'json-format', view: 'all', type: 'all' }], ['tools/json-diff', { tools: 'json-diff', view: 'all', type: 'all' }], ['tools/markdown', { tools: 'markdown', view: 'all', type: 'all' }]]
const routeSlug = (tools, view, type) => tools ? (tools === 'library' ? 'tools' : `tools/${tools}`) : view !== 'all' ? view : type === 'all' ? '' : type
const viewFromPath = (pathname) => { const slug = pathname.replace(/^\/+|\/+$/g, ''); return (ROUTES.find(([candidate]) => candidate === slug) || ROUTES[0])[1] }
const pathForRoute = (tools, view, type) => `/${routeSlug(tools, view, type)}`

const TOOL_SAMPLE = `{
  "name": "one-for-all",
  "version": 1,
  "features": ["assets", "tools"],
  "settings": { "theme": "light", "autosave": true }
}`

const MD_SAMPLE = `# Markdown 编辑器

支持 **实时预览** 与常用语法，数据只在本机处理。

## 常用语法

- **加粗**、*斜体*、~~删除线~~、\`行内代码\`
- 链接：[One for All](https://tools.chatcanvas.online)
- 引用与任务列表

> 轻量、快速、不依赖网络。

## 任务清单

- [x] 完成编辑区
- [ ] 支持表格

## 代码块

\`\`\`js
const greet = (name) => \`Hello, \${name}\`;
\`\`\`

## 表格

| 语法 | 效果 |
| --- | --- |
| **加粗** | 强调 |
| \`代码\` | 行内代码 |
`

const writeClipboardText = async (text) => { let done = false; try { if (navigator.clipboard?.writeText) { await Promise.race([navigator.clipboard.writeText(text).then(() => { done = true }), new Promise((_, reject) => setTimeout(() => reject(new Error('clipboard-timeout')), 1200))]) } else done = true } catch {} if (done) return; const area = document.createElement('textarea'); area.value = text; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;top:-999px;left:0;opacity:0'; document.body.appendChild(area); area.select(); let copied = false; try { copied = document.execCommand('copy') } catch {} area.remove(); if (!copied) throw new Error('clipboard-blocked') }

const parseNestedJson = (value) => {
  if (Array.isArray(value)) return value.map(parseNestedJson)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, parseNestedJson(item)]))
  if (typeof value === 'string') {
    const candidate = value.trim()
    if ((candidate.startsWith('{') && candidate.endsWith('}')) || (candidate.startsWith('[') && candidate.endsWith(']'))) {
      try { return parseNestedJson(JSON.parse(candidate)) } catch {}
    }
  }
  return value
}

const prettyJson = (text, space = 2, sortKeys = false, nestedParse = true) => {
  const { value: parsed, recovered } = parseJsonWithRecovery(text)
  const value = nestedParse ? parseNestedJson(parsed) : parsed
  const sortDeep = (item) => {
    if (Array.isArray(item)) return item.map(sortDeep)
    if (item && typeof item === 'object') return Object.keys(item).sort().reduce((out, key) => ({ ...out, [key]: sortDeep(item[key]) }), {})
    return item
  }
  return { output: JSON.stringify(sortKeys ? sortDeep(value) : value, null, space), recovered }
}

const displayValue = (value) => value === undefined ? '—' : typeof value === 'string' ? `"${value}"` : JSON.stringify(value)
const isObjectLike = (value) => value && typeof value === 'object'
const childPath = (path, key, array) => array ? `${path}[${key}]` : `${path}.${key}`
const makeDiffRows = (left, right, path = '$') => {
  if (JSON.stringify(left) === JSON.stringify(right)) return [{ path, left, right, status: 'same' }]
  if (isObjectLike(left) && isObjectLike(right) && Array.isArray(left) === Array.isArray(right)) {
    const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)]))
    return keys.flatMap((key) => makeDiffRows(left[key], right[key], childPath(path, key, Array.isArray(left))))
  }
  if (left === undefined) return [{ path, right, status: 'added' }]
  if (right === undefined) return [{ path, left, status: 'removed' }]
  return [{ path, left, right, status: 'changed' }]
}

const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inlineMd = (text) => { let html = escapeHtml(text); html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>'); html = html.replace(/~~([^~\n]+)~~/g, '<del>$1</del>'); html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>'); html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>'); html = html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'); return html }
const codeLineSignals = [/\\\s*$/, /^\s{2,}\S/, /^[A-Za-z_][A-Za-z0-9_]*=.+/, /^(curl|wget|npm|npx|yarn|pnpm|pip\d?|python\d*|node|git|docker|kubectl|ssh|scp|brew|sudo)\s+[A-Za-z0-9_'"$./\\-]/, /^(FROM|RUN|CMD|COPY|ADD|WORKDIR|ENV|ARG|USER|EXPOSE|VOLUME|ENTRYPOINT|LABEL)\b/, /^(const|let|var|import|export|async|function|return)\s/, /^\/\//, /^[{\[}\]]/, /^["']/, /[{([][;,]\s*$/, /;;\s*$|=>\s*$/]
const isCodeParagraph = (lines) => { const marked = lines.filter((line) => codeLineSignals.some((re) => re.test(line))).length; return lines.length === 1 ? marked === 1 : marked >= Math.ceil(lines.length / 2) || (marked >= 2 && /[{}]/.test(lines.join('\n'))) }
const withTask = (html) => { const match = html.match(/^\[([ xX])\]\s*/); return match ? `<input type="checkbox" disabled${/[xX]/.test(match[1]) ? ' checked' : ''} /> ${html.slice(match[0].length)}` : html }
const markdownToHtml = (source) => { const lines = String(source ?? '').split('\n'); const blocks = []; let list = null; let para = []; let quote = []; let codeLines = null; const flushPara = () => { if (para.length) { blocks.push(isCodeParagraph(para) ? `<pre><code>${escapeHtml(para.join('\n'))}</code></pre>` : `<p>${inlineMd(para.join('<br />'))}</p>`); para = [] } }; const flushQuote = () => { if (quote.length) { blocks.push(`<blockquote>${inlineMd(quote.join('<br />'))}</blockquote>`); quote = [] } }; const flushList = () => { if (list) { blocks.push(`<${list.ordered ? 'ol' : 'ul'}>${list.items.map((item) => `<li>${item}</li>`).join('')}</${list.ordered ? 'ol' : 'ul'}>`); list = null } }; const flushAll = () => { flushPara(); flushQuote(); flushList() }; const isTableRow = (line) => /^\|.*\|\s*$/.test(String(line).trim()); const isTableDivider = (line) => { const value = String(line).trim(); return /^\|[\s:|-]+\|\s*$/.test(value) && value.includes('-') }; const parseRow = (line) => String(line).trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()); for (let index = 0; index < lines.length; index++) { const raw = lines[index].replace(/\r$/, ''); const trimmed = String(raw).trim(); if (/^```/.test(trimmed)) { flushAll(); if (codeLines) { blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`); codeLines = null } else codeLines = []; continue } if (codeLines) { codeLines.push(raw); continue } if (!trimmed) { flushAll(); continue } if (isTableRow(trimmed) && isTableDivider(String(lines[index + 1] || '').trim())) { flushAll(); const header = parseRow(trimmed); const body = []; index += 1; while (index + 1 < lines.length && isTableRow(String(lines[index + 1]).trim())) { index += 1; body.push(parseRow(String(lines[index]).trim())) } blocks.push(`<table><thead><tr>${header.map((cell) => `<th>${inlineMd(cell)}</th>`).join('')}</tr></thead>${body.length ? `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMd(cell)}</td>`).join('')}</tr>`).join('')}</tbody>` : ''}</table>`); continue } const heading = trimmed.match(/^(#{1,6})\s+(.*)$/); if (heading) { flushAll(); blocks.push(`<h${heading[1].length}>${inlineMd(heading[2])}</h${heading[1].length}>`); continue } if (/^[-*]\s+/.test(trimmed)) { flushPara(); flushQuote(); if (list && list.ordered) flushList(); if (!list) list = { ordered: false, items: [] }; list.items.push(withTask(inlineMd(trimmed.replace(/^[-*]\s+/, '')))); continue } if (/^\d+\.\s+/.test(trimmed)) { flushPara(); flushQuote(); if (list && !list.ordered) flushList(); if (!list) list = { ordered: true, items: [] }; list.items.push(withTask(inlineMd(trimmed.replace(/^\d+\.\s+/, '')))); continue } if (/^>\s?/.test(trimmed)) { flushPara(); flushList(); quote.push(trimmed.replace(/^>\s?/, '')); continue } if (/^(-{3,}|\*{3,})$/.test(trimmed)) { flushAll(); blocks.push('<hr />'); continue } flushQuote(); flushList(); para.push(raw) } if (codeLines) blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`); flushAll(); return blocks.join('') }

function ToolLibrary({ onSelect }) {
  return <div className="tools-page"><div className="tools-hero"><div><p className="eyebrow">UTILITY LIBRARY <span>·</span> BROWSER TOOLS</p><h1>小工具，解决大问题。</h1><p>把日常开发中高频使用的工具集中在这里，数据只在当前浏览器本地处理。</p></div><div className="tools-hero-mark"><Wrench size={28} /><span>LOCAL<br />ONLY</span></div></div><div className="tool-grid"><button className="tool-card featured" onClick={() => onSelect('json-format')}><div className="tool-card-icon blue-bg"><Braces size={22} /></div><div className="tool-card-main"><span className="tool-badge">JSON</span><h2>JSON 格式化</h2><p>校验、格式化、压缩和排序 JSON，快速把一段配置整理成可读格式。</p><div className="tool-card-footer"><span>支持文件导入</span><ArrowUpRight size={15} /></div></div></button><button className="tool-card" onClick={() => onSelect('json-diff')}><div className="tool-card-icon violet-bg"><FileDiff size={22} /></div><div className="tool-card-main"><span className="tool-badge violet">COMPARE</span><h2>JSON Diff</h2><p>并排比较两个 JSON，按字段路径查看新增、删除和修改内容。</p><div className="tool-card-footer"><span>结构化差异</span><ArrowUpRight size={15} /></div></div></button><button className="tool-card" onClick={() => onSelect('markdown')}><div className="tool-card-icon amber-bg"><FilePenLine size={22} /></div><div className="tool-card-main"><span className="tool-badge amber">MARKDOWN</span><h2>Markdown 编辑器</h2><p>分屏编辑与实时预览，支持表格、任务列表等常用语法，导出整洁的 .md 文件。</p><div className="tool-card-footer"><span>实时渲染</span><ArrowUpRight size={15} /></div></div></button></div><div className="tools-coming"><div><span className="coming-dot" /><strong>更多工具正在路上</strong><p>URL 编码、时间戳转换、正则测试等开发工具将陆续加入。</p></div><span className="tool-count">03 tools</span></div></div>
}

function ToolsShell({ onSelect }) { return <><header className="topbar"><div className="breadcrumbs"><span>工作区</span><span>/</span><strong>工具库</strong></div><div className="tool-local-badge"><ShieldCheck size={14} /> 本地处理</div></header><section className="content-wrap tools-content-wrap"><ToolLibrary onSelect={onSelect} /></section></> }

const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: '#b42318' },
  { tag: tags.string, color: '#155eef' },
  { tag: tags.number, color: '#087443' },
  { tag: tags.bool, color: '#7a3e9d' },
  { tag: tags.null, color: '#8a5a00' },
  { tag: [tags.brace, tags.punctuation], color: '#68768a' },
])

const jsonEditorTheme = EditorView.theme({
  '&': { backgroundColor: '#fff', color: '#2f3c51', height: '100%' },
  '.cm-content': { caretColor: '#4263eb', fontFamily: "'DM Mono', monospace", fontSize: '12px', lineHeight: '1.72', padding: '16px 0' },
  '.cm-line': { padding: '0 16px 0 8px' },
  '.cm-gutters': { backgroundColor: '#fbfcfe', color: '#a5afbc', border: '0', borderRight: '1px solid #edf0f4', fontFamily: "'DM Mono', monospace", fontSize: '11px' },
  '.cm-activeLine': { backgroundColor: '#f5f8ff' },
  '.cm-activeLineGutter': { backgroundColor: '#eef2ff', color: '#4263eb' },
  '.cm-foldGutter': { color: '#8b98a8' },
  '.cm-foldPlaceholder': { backgroundColor: '#eef2ff', border: '1px solid #d6def8', color: '#4263eb', padding: '0 5px', borderRadius: '4px' },
  '.cm-selectionBackground, ::selection': { backgroundColor: '#dce7ff !important' },
  '.cm-searchMatch': { backgroundColor: '#fff0bd', outline: '1px solid #e6bd4b' },
  '.cm-searchMatch-selected': { backgroundColor: '#ffe08a' },
  '.cm-panel': { backgroundColor: '#fff', borderTop: '1px solid #e4e8ef', padding: '8px 12px' },
  '.cm-panel input': { border: '1px solid #dce2eb', borderRadius: '5px', padding: '5px 7px', font: "11px 'DM Sans', sans-serif" },
}, { dark: false })

const JsonEditor = forwardRef(function JsonEditor({ value, onChange, readOnly = false, className = '', placeholder = '' }, ref) {
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  valueRef.current = value
  onChangeRef.current = onChange
  useImperativeHandle(ref, () => ({
    foldAll: () => viewRef.current && foldAll(viewRef.current),
    unfoldAll: () => viewRef.current && unfoldAll(viewRef.current),
    setSearch: (query, options = {}) => {
      const view = viewRef.current
      if (view) view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: query, literal: true, ...options })) })
    },
    clearMatch: () => {
      const view = viewRef.current
      if (view) view.dispatch({ selection: { anchor: view.state.selection.main.head } })
    },
    revealMatch: ({ from, to }) => {
      const view = viewRef.current
      if (!view) return
      const effects = [EditorView.scrollIntoView(from, { y: 'center' })]
      foldedRanges(view.state).between(from, to, (start, end) => effects.push(unfoldEffect.of({ from: start, to: end })))
      view.dispatch({ selection: { anchor: from, head: to }, effects })
    },
    get element() { return hostRef.current },
    focus: () => viewRef.current?.focus(),
  }), [])
  useEffect(() => {
    if (!hostRef.current) return undefined
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !readOnly) onChangeRef.current?.(update.state.doc.toString())
    })
    const state = EditorState.create({
      doc: valueRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        foldGutter(),
        json(),
        search(),
        jsonSearchHighlights,
        syntaxHighlighting(jsonHighlightStyle),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        jsonEditorTheme,
        updateListener,
        ...(readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []),
      ],
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
  }, [readOnly])
  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }, [value])
  return <div ref={hostRef} className={`json-cm-editor ${className} ${!value && placeholder ? 'is-empty' : ''}`} data-placeholder={!value ? placeholder : ''} />
})

const MarkdownEditor = forwardRef(function MarkdownEditor({ value, onChange, placeholder = '' }, ref) {
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  valueRef.current = value
  onChangeRef.current = onChange
  useImperativeHandle(ref, () => ({
    get view() { return viewRef.current },
    focus: () => viewRef.current?.focus(),
  }), [])
  useEffect(() => {
    if (!hostRef.current) return undefined
    const updateListener = EditorView.updateListener.of((update) => { if (update.docChanged) onChangeRef.current?.(update.state.doc.toString()) })
    const state = EditorState.create({
      doc: valueRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        EditorView.lineWrapping,
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        jsonEditorTheme,
        updateListener,
      ],
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
  }, [])
  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }, [value])
  return <div ref={hostRef} className={`json-cm-editor md-editor ${!value && placeholder ? 'is-empty' : ''}`} data-placeholder={!value ? placeholder : ''} />
})

function EditorActions({ editorRef, onSearch, compact = false }) {
  return <div className={`editor-actions ${compact ? 'compact' : ''}`}>
    <button className="editor-action" onClick={() => editorRef.current?.foldAll()} title="折叠全部"><ChevronDown size={13} /> 折叠</button>
    <button className="editor-action" onClick={() => editorRef.current?.unfoldAll()} title="展开全部"><ChevronUp size={13} /> 展开</button>
    <button className="editor-action" onClick={onSearch} title="搜索此栏"><Search size={13} /> 搜索</button>
  </div>
}

function JsonSearchBar({ mode, query, setQuery, scope, setScope, matchCase, setMatchCase, useRegex, setUseRegex, wholeWord, setWholeWord, onPrevious, onNext, onClose, inputRef, status, error, hasMatches }) {
  const options = mode === 'format' ? [['both', '全部'], ['input', '输入'], ['result', '结果']] : [['both', '全部'], ['left', '左侧'], ['right', '右侧']]
  return <div className="json-searchbar" role="search" aria-label="JSON 内容搜索" onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
    if (event.key === 'Enter' && event.target === inputRef.current && !event.nativeEvent.isComposing) {
      event.preventDefault(); event.shiftKey ? onPrevious() : onNext()
    }
  }}>
    <div className="json-search-input"><Search size={16} />
      <input ref={inputRef} aria-label="搜索 JSON" aria-invalid={!!error} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索字段或值…" />
      <button className="search-clear" onClick={() => setQuery('')} aria-label="清除搜索" title="清除搜索"><X size={14} /></button>
    </div>
    <div className="search-scope-tabs" aria-label="搜索范围">{options.map(([key, label]) => <button key={key} aria-pressed={scope === key} className={scope === key ? 'active' : ''} onClick={() => setScope(key)}>{label}</button>)}</div>
    <div className="search-options">
      <button aria-label="区分大小写" title="区分大小写" aria-pressed={matchCase} onClick={() => setMatchCase(!matchCase)}>Aa</button>
      <button aria-label="正则表达式" title="正则表达式" aria-pressed={useRegex} onClick={() => setUseRegex(!useRegex)}>.*</button>
      <button aria-label="整词匹配" title="整词匹配" aria-pressed={wholeWord} onClick={() => setWholeWord(!wholeWord)}>整词</button>
    </div>
    <span className={`search-status ${error ? 'invalid' : ''}`} role="status">{error || status}</span>
    <div className="search-nav">
      <button onClick={onPrevious} disabled={!hasMatches} aria-label="上一个" title="上一个（Shift + Enter）"><ChevronUp size={15} /></button>
      <button onClick={onNext} disabled={!hasMatches} aria-label="下一个" title="下一个（Enter）"><ChevronDown size={15} /></button>
      <button onClick={onClose} aria-label="关闭搜索" title="关闭搜索（Esc）"><X size={15} /></button>
    </div>
  </div>
}

function JsonTool({ mode = 'format', onBack }) {
  const [activeMode, setActiveMode] = useState(mode)
  const [source, setSource] = useState(TOOL_SAMPLE)
  const [left, setLeft] = useState(`{\n  "name": "one-for-all",\n  "version": 1,\n  "features": ["assets", "tools"]\n}`)
  const [right, setRight] = useState(`{\n  "name": "one-for-all",\n  "version": 2,\n  "features": ["assets", "tools", "json-diff"],\n  "settings": { "theme": "light" }\n}`)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [parseNotice, setParseNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [nestedParse, setNestedParse] = useState(true)
  const [formatFullscreen, setFormatFullscreen] = useState(false)
  const [diffOnly, setDiffOnly] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQueryText] = useState('')
  const [searchScope, setSearchScope] = useState('both')
  const [matchCase, setMatchCase] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [activeMatch, setActiveMatch] = useState(-1)
  const searchInputRef = useRef(null)
  const sourceEditorRef = useRef(null)
  const resultEditorRef = useRef(null)
  const leftEditorRef = useRef(null)
  const rightEditorRef = useRef(null)
  const fileRef = useRef(null)
  const diffState = useMemo(() => {
    try {
      const leftValue = JSON.parse(left); const rightValue = JSON.parse(right)
      const rows = makeDiffRows(leftValue, rightValue)
      return { leftValue, rightValue, rows, error: '' }
    } catch (err) { return { rows: [], error: err.message } }
  }, [left, right])
  const searchData = useMemo(() => collectSearchMatches(
    activeMode === 'format' ? { input: source, result } : { left, right },
    searchScope, searchOpen ? searchQuery : '', { caseSensitive: matchCase, regexp: useRegex, wholeWord }
  ), [activeMode, source, result, left, right, searchScope, searchOpen, searchQuery, matchCase, useRegex, wholeWord])
  const searchRefMap = () => activeMode === 'format' ? { input: sourceEditorRef, result: resultEditorRef } : { left: leftEditorRef, right: rightEditorRef }
  const revealSearchMatch = (match) => {
    const refs = searchRefMap()
    Object.values(refs).forEach(ref => ref.current?.clearMatch())
    if (match) refs[match.side]?.current?.revealMatch(match)
  }
  useEffect(() => {
    const refs = searchRefMap()
    Object.entries(refs).forEach(([key, ref]) => {
      const enabled = searchOpen && (searchScope === 'both' || searchScope === key)
      ref.current?.setSearch(enabled ? searchQuery : '', { caseSensitive: matchCase, regexp: useRegex, wholeWord })
    })
    setActiveMatch(searchData.matches.length ? 0 : -1)
    revealSearchMatch(searchData.matches[0])
  }, [searchData])
  useEffect(() => { if (searchOpen) searchInputRef.current?.focus() }, [searchOpen])
  const moveSearch = (direction) => {
    const index = nextSearchIndex(activeMatch, searchData.matches.length, direction)
    setActiveMatch(index)
    revealSearchMatch(searchData.matches[index])
  }
  const openGlobalSearch = (scope = 'both') => {
    setSearchScope(scope); setSearchOpen(true); searchInputRef.current?.focus()
  }
  const closeGlobalSearch = () => setSearchOpen(false)
  const searchStatus = !searchQuery ? '输入关键词' : !searchData.matches.length ? '无匹配' : `${activeMatch + 1} / ${searchData.matches.length}${searchData.truncated ? '+' : ''} · ${activeMode === 'format' ? (searchData.matches[activeMatch]?.side === 'result' ? '结果' : '输入') : (searchData.matches[activeMatch]?.side === 'right' ? '右侧' : '左侧')}`

  const runFormat = (action = 'pretty') => {
    try { const { output, recovered } = prettyJson(source, action === 'compact' ? 0 : 2, action === 'sort', nestedParse); setResult(output); setError(''); setParseNotice(recovered ? '已自动修复非标准 JSON：补全外层对象并规范化字段名。' : '') } catch (err) { setError(`JSON 无法解析：${err.message}`); setParseNotice(''); setResult('') }
  }
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {} }
  const download = (text, filename) => { const blob = new Blob([text], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }
  const importFile = (event, setter) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setter(String(reader.result || '')); reader.readAsText(file); event.target.value = '' }
  const stat = activeMode === 'diff' ? diffState.rows.filter((row) => row.status !== 'same').length : result ? result.split('\n').length : 0
  return <div className={`tool-workspace ${formatFullscreen && activeMode === 'format' ? 'format-fullscreen' : ''}`} onKeyDownCapture={(event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); event.stopPropagation(); const panel = event.target.closest('.json-cm-editor'); openGlobalSearch(panel ? (activeMode === 'format' ? (panel.classList.contains('json-result') ? 'result' : 'input') : (panel === rightEditorRef.current?.element ? 'right' : 'left')) : 'both') } }}><div className="tool-topline"><button className="back-tool" onClick={onBack}><ArrowLeft size={16} /> 工具库</button><div className="tool-title"><div className="tool-title-icon"><Braces size={18} /></div><div><h1>JSON 工具</h1><span>在浏览器本地处理，不上传内容</span></div></div><div className="tool-mode-tabs"><button className={activeMode === 'format' ? 'active' : ''} onClick={() => { setActiveMode('format'); setSearchScope('both') }}><AlignLeft size={15} /> 格式化</button><button className={activeMode === 'diff' ? 'active' : ''} onClick={() => { setActiveMode('diff'); setSearchScope('both') }}><FileDiff size={15} /> Diff</button></div></div>{searchOpen && <JsonSearchBar mode={activeMode} query={searchQuery} setQuery={setSearchQueryText} scope={searchScope} setScope={setSearchScope} matchCase={matchCase} setMatchCase={setMatchCase} useRegex={useRegex} setUseRegex={setUseRegex} wholeWord={wholeWord} setWholeWord={setWholeWord} onPrevious={() => moveSearch('previous')} onNext={() => moveSearch('next')} onClose={closeGlobalSearch} inputRef={searchInputRef} status={searchStatus} error={searchData.error} hasMatches={searchData.matches.length > 0} />} {activeMode === 'format' ? <><div className="tool-actionbar"><div><button className="soft-button" onClick={() => { setSource(TOOL_SAMPLE); setResult(''); setError(''); setParseNotice('') }}><WandSparkles size={15} /> 示例</button><button className="soft-button" onClick={() => fileRef.current?.click()}><Upload size={15} /> 导入 JSON</button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(event) => importFile(event, setSource)} /><label className="nested-toggle" title="自动展开值为 JSON 的字符串"><input type="checkbox" checked={nestedParse} onChange={(event) => setNestedParse(event.target.checked)} /> 嵌套解析</label></div><div className="tool-actionbar-right"><span className="tool-stat">{stat ? `${stat} 行` : '等待处理'}</span><button className="soft-button" onClick={() => openGlobalSearch()}><Search size={15} /> 搜索</button><button className="soft-button" onClick={() => setFormatFullscreen((value) => !value)}>{formatFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />} {formatFullscreen ? '退出全屏' : '全屏'}</button><button className="soft-button" onClick={() => { setSource(''); setResult(''); setError(''); setParseNotice('') }}><RotateCcw size={15} /> 清空</button></div></div><div className="json-format-grid"><section className="json-editor-panel"><div className="panel-label"><div><span>输入 JSON</span><small>粘贴或导入文件</small></div><EditorActions editorRef={sourceEditorRef} onSearch={() => openGlobalSearch('input')} compact /></div><JsonEditor ref={sourceEditorRef} className="json-editor" value={source} onChange={setSource} placeholder="粘贴 JSON，或点击上方导入文件…" /></section><section className="json-result-panel"><div className="panel-label"><div><span>处理结果</span><small>{result ? '已生成 · 可折叠' : '运行操作后显示'}</small></div><EditorActions editorRef={resultEditorRef} onSearch={() => openGlobalSearch('result')} compact /></div><JsonEditor ref={resultEditorRef} className="json-result" value={result} readOnly placeholder="格式化结果会显示在这里…" /></section></div><div className="format-actions"><button className="primary-button" onClick={() => runFormat('pretty')}><Braces size={16} /> 格式化</button><button className="secondary-button" onClick={() => runFormat('compact')}><Minimize2 size={15} /> 压缩</button><button className="secondary-button" onClick={() => runFormat('sort')}><ListFilter size={15} /> 格式化并排序</button>{result && <><button className="secondary-button action-right" onClick={() => copy(result)}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? '已复制' : '复制结果'}</button><button className="secondary-button" onClick={() => download(result, 'formatted.json')}><Download size={15} /> 下载</button></>}</div>{error && <div className="tool-error"><AlertCircle size={16} /> {error}</div>}{parseNotice && <div className="tool-recovery-notice"><Check size={16} /> {parseNotice}</div>}<div className="tool-tip"><ShieldCheck size={16} /><span><strong>隐私提示</strong> 所有 JSON 仅在你的浏览器内处理，不会发送到服务器。<em>嵌套解析会将合法的 JSON 字符串转换为对象。</em></span></div></> : <><div className="tool-actionbar diff-toolbar"><div><span className="diff-legend"><i className="legend-added" /> 新增 <i className="legend-removed" /> 删除 <i className="legend-changed" /> 修改</span><label className="nested-toggle diff-toggle"><input type="checkbox" checked={diffOnly} onChange={(event) => setDiffOnly(event.target.checked)} /> 仅显示差异</label></div><div className="tool-actionbar-right"><span className="tool-stat">{diffState.error ? 'JSON 待修正' : `${stat} 处差异`}</span><button className="soft-button" onClick={() => openGlobalSearch()}><Search size={15} /> 搜索</button><button className="soft-button" onClick={() => { setLeft(''); setRight('') }}><RotateCcw size={15} /> 清空</button></div></div><div className="diff-input-grid"><section className="json-editor-panel"><div className="panel-label"><div><span>原始 JSON <em>LEFT</em></span></div><EditorActions editorRef={leftEditorRef} onSearch={() => openGlobalSearch('left')} compact /><button className="panel-import" onClick={() => document.getElementById('diff-file-left')?.click()}><Upload size={13} /> 导入</button><input id="diff-file-left" type="file" accept=".json,application/json" hidden onChange={(event) => importFile(event, setLeft)} /></div><JsonEditor ref={leftEditorRef} className="json-editor diff-input" value={left} onChange={setLeft} placeholder="输入左侧 JSON…" /></section><section className="json-editor-panel"><div className="panel-label"><div><span>对比 JSON <em>RIGHT</em></span></div><EditorActions editorRef={rightEditorRef} onSearch={() => openGlobalSearch('right')} compact /><button className="panel-import" onClick={() => document.getElementById('diff-file-right')?.click()}><Upload size={13} /> 导入</button><input id="diff-file-right" type="file" accept=".json,application/json" hidden onChange={(event) => importFile(event, setRight)} /></div><JsonEditor ref={rightEditorRef} className="json-editor diff-input" value={right} onChange={setRight} placeholder="输入右侧 JSON…" /></section></div>{diffState.error ? <div className="tool-error"><AlertCircle size={16} /> 对比内容格式错误：{diffState.error}</div> : <section className="diff-result"><div className="diff-result-head"><div><strong>差异结果</strong><span>按字段路径展开对比</span></div><button className="secondary-button" onClick={() => copy(JSON.stringify(diffState.rows, null, 2))}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? '已复制' : '复制差异'}</button></div><div className="diff-rows">{diffState.rows.filter((row) => !diffOnly || row.status !== 'same').map((row, index) => <div className={`diff-row ${row.status}`} key={`${row.path}-${index}`}><div className="diff-status">{row.status === 'added' ? '+' : row.status === 'removed' ? '−' : row.status === 'changed' ? '↕' : '·'}</div><code>{row.path}</code><div className="diff-value left-value">{row.status === 'added' ? <span className="muted-value">—</span> : displayValue(row.left)}</div><div className="diff-value right-value">{row.status === 'removed' ? <span className="muted-value">—</span> : displayValue(row.right)}</div><span className="diff-status-label">{row.status === 'added' ? '新增' : row.status === 'removed' ? '删除' : row.status === 'changed' ? '修改' : '相同'}</span></div>)}</div></section>}</>}</div>
}

function MarkdownTool({ onBack }) {
  const [source, setSource] = useState(MD_SAMPLE)
  const [copied, setCopied] = useState('')
  const [syncScroll, setSyncScroll] = useState(true)
  const editorRef = useRef(null)
  const previewRef = useRef(null)
  const stats = useMemo(() => { const text = source.replace(/\s/g, ''); return { lines: source.split('\n').length, words: text.length, chars: source.length } }, [source])
  const flagCopied = () => { setCopied('md'); setTimeout(() => setCopied((current) => current === 'md' ? '' : current), 1800) }
  const copySource = async () => { try { await writeClipboardText(source); flagCopied() } catch {} }
  const downloadSource = () => { const blob = new Blob([source], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'document.md'; a.click(); URL.revokeObjectURL(url) }
  const wrap = (before, after = before, sample = '文本') => { const view = editorRef.current?.view; if (!view) return; const { from, to } = view.state.selection.main; const selected = view.state.doc.sliceString(from, to) || sample; view.dispatch({ changes: { from, to, insert: `${before}${selected}${after}` }, selection: { anchor: from + before.length, head: from + before.length + selected.length }, scrollIntoView: true }); view.focus() }
  const prefix = (marker, sample) => { const view = editorRef.current?.view; if (!view) return; const { from, to } = view.state.selection.main; const selected = view.state.doc.sliceString(from, to) || sample; const prefixed = selected.split('\n').map((line) => `${marker}${line}`).join('\n'); view.dispatch({ changes: { from, to, insert: prefixed }, selection: { anchor: from, head: from + prefixed.length }, scrollIntoView: true }); view.focus() }
  const insert = (text) => { const view = editorRef.current?.view; if (!view) return; const { from, to } = view.state.selection.main; const next = from + text.length; view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: next, head: next }, scrollIntoView: true }); view.focus() }
  const onPreviewScroll = () => { if (!syncScroll) return; const view = editorRef.current?.view; const preview = previewRef.current; if (!view || !preview) return; const pMax = preview.scrollHeight - preview.clientHeight; const eMax = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight; if (pMax > 0 && eMax > 0) view.scrollDOM.scrollTop = (preview.scrollTop / pMax) * eMax }
  useEffect(() => { const view = editorRef.current?.view; const dom = view?.scrollDOM; if (!dom) return; const onEditorScroll = () => { const preview = previewRef.current; if (!syncScroll || !preview) return; const eMax = dom.scrollHeight - dom.clientHeight; const pMax = preview.scrollHeight - preview.clientHeight; if (eMax > 0 && pMax > 0) preview.scrollTop = (dom.scrollTop / eMax) * pMax }; dom.addEventListener('scroll', onEditorScroll); return () => dom.removeEventListener('scroll', onEditorScroll) }, [syncScroll])
  return <div className="tool-workspace"><div className="tool-topline"><button className="back-tool" onClick={onBack}><ArrowLeft size={16} /> 工具库</button><div className="tool-title"><div className="tool-title-icon amber-bg"><FilePenLine size={18} /></div><div><h1>Markdown 编辑器</h1><span>本地实时预览，不上传内容</span></div></div></div><div className="md-toolbar"><button title="一级标题" onClick={() => prefix('# ', '标题 1')}>H1</button><button title="二级标题" onClick={() => prefix('## ', '标题 2')}>H2</button><button title="三级标题" onClick={() => prefix('### ', '标题 3')}>H3</button><span className="md-tool-sep" /><button title="加粗" onClick={() => wrap('**', '**', '加粗文本')}>B</button><button title="斜体" onClick={() => wrap('*', '*', '斜体文本')}>I</button><button title="删除线" onClick={() => wrap('~~', '~~', '删除文本')}>S</button><button title="行内代码" onClick={() => wrap('`', '`', 'code')}>`</button><span className="md-tool-sep" /><button title="无序列表" onClick={() => prefix('- ', '列表项')}>- 列表</button><button title="有序列表" onClick={() => prefix('1. ', '列表项')}>1. 列表</button><button title="引用" onClick={() => prefix('> ', '引用内容')}>引用</button><span className="md-tool-sep" /><button title="代码块" onClick={() => wrap('\n```\n', '\n```\n', '代码')}>代码块</button><button title="链接" onClick={() => wrap('[', '](https://tools.chatcanvas.online)', '链接文本')}>链接</button><button title="图片" onClick={() => insert('\n![图片描述](https://example.com/image.png)\n')}>图片</button><button title="表格" onClick={() => insert('\n| 列 1 | 列 2 |\n| --- | --- |\n| 单元格 | 单元格 |\n')}>表格</button><button title="分割线" onClick={() => insert('\n\n---\n\n')}>分割线</button><div className="md-toolbar-right"><label className="md-sync-toggle"><input type="checkbox" checked={syncScroll} onChange={(event) => setSyncScroll(event.target.checked)} /> 同步滚动</label><span className="md-stat">{stats.lines} 行 · {stats.words} 字 · {stats.chars} 字符</span></div></div><div className="md-grid"><section className="json-editor-panel"><div className="panel-label"><div><span>编辑 Markdown</span></div><small>支持常用语法</small></div><MarkdownEditor ref={editorRef} value={source} onChange={setSource} placeholder="在这里输入 Markdown…" /></section><section className="md-preview-panel"><div className="panel-label"><div><span>预览</span></div><small>与资产文档一致的渲染效果 · 复制仍为原文</small></div><div className="md-preview md-body" ref={previewRef} onScroll={onPreviewScroll} dangerouslySetInnerHTML={{ __html: markdownToHtml(source) }} /></section></div><div className="md-actions"><button className="primary-button" onClick={() => setSource(MD_SAMPLE)}><WandSparkles size={15} /> 示例</button><button className="secondary-button" onClick={() => setSource('')}><RotateCcw size={15} /> 清空</button><button className="secondary-button" onClick={copySource}>{copied === 'md' ? <Check size={15} /> : <Copy size={15} />} {copied === 'md' ? '已复制' : '复制 Markdown'}</button><button className="secondary-button" onClick={downloadSource}><Download size={15} /> 下载 .md</button></div></div>
}

function App() {
  const initialRoute = viewFromPath(window.location.pathname); const [assets, setAssets] = useState(readLocal); const [toolsMode, setToolsMode] = useState(initialRoute.tools); const [user, setUser] = useState(null); const [authChecked, setAuthChecked] = useState(false); const [mode, setMode] = useState('local'); const [activeType, setActiveType] = useState(initialRoute.type); const [view, setView] = useState(initialRoute.view); const [query, setQuery] = useState(''); const [selected, setSelected] = useState(null); const [showAdd, setShowAdd] = useState(false); const [pendingMigration, setPendingMigration] = useState(null); const [migrationBusy, setMigrationBusy] = useState(false); const [toast, setToast] = useState(''); const [mobileNav, setMobileNav] = useState(false); const fileRef = useRef(null)
  useEffect(() => { apiRequest('/auth/me').then(async ({ user: currentUser }) => { setUser(currentUser); setMode('remote'); const data = await apiRequest('/assets'); setAssets(data.assets.map(fromApi)); const localAssets = readStoredLocal(); if (localAssets.length) setPendingMigration(localAssets) }).catch(() => {}).finally(() => setAuthChecked(true)) }, [])
  useEffect(() => { if (mode !== 'local') return; const hasCustomAssets = assets.some((asset) => !seedAssetIds.has(asset.id)); if (hasCustomAssets) localStorage.setItem(localKey, JSON.stringify(assets)); else localStorage.removeItem(localKey) }, [assets, mode]); useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2800); return () => clearTimeout(t) } }, [toast]); useEffect(() => { const handler = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector('.search-box input')?.focus() } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) }, [])
  useEffect(() => { const currentPath = window.location.pathname; const target = pathForRoute(toolsMode, view, activeType); if (currentPath === target) return; const slug = currentPath.replace(/^\/+|\/+$/g, ''); const known = ROUTES.some(([candidate]) => candidate === slug); if (known) { window.history.pushState({}, '', target) } else { window.history.replaceState({}, '', target) } }, [toolsMode, view, activeType]); useEffect(() => { const onPopState = () => { const next = viewFromPath(window.location.pathname); setToolsMode(next.tools); setActiveType(next.type); setView(next.view) }; window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState) }, [])
  const filtered = useMemo(() => assets.filter((asset) => { const haystack = `${asset.title} ${asset.description} ${asset.tags.join(' ')} ${asset.sharedContent}`.toLowerCase(); return (activeType === 'all' || asset.typeKey === activeType) && (view === 'all' || (view === 'favorites' && asset.favorite) || (view === 'recent' && ['刚刚使用', '今天使用', '昨天使用'].includes(asset.used))) && (!query.trim() || haystack.includes(query.toLowerCase())) }), [assets, activeType, query, view])
  const markUsed = async (asset) => { if (mode === 'remote') { const { asset: updated } = await apiRequest(`/assets/${asset.id}/use`, { method: 'POST' }); return fromApi(updated) } return { ...asset, used: '刚刚使用', updated: '刚刚' } }
  const openAsset = async (asset) => { if (mode === 'remote') { try { const { privateBindings } = await apiRequest(`/assets/${asset.id}/private`); setSelected({ ...asset, privateBindings, sensitive: Object.keys(privateBindings).length > 0 }) } catch { setToast('无法读取私密配置') } } else setSelected(asset) }
  const writeClipboard = async (text) => { let done = false; try { if (navigator.clipboard?.writeText) { await Promise.race([navigator.clipboard.writeText(text).then(() => { done = true }), new Promise((_, reject) => setTimeout(() => reject(new Error('clipboard-timeout')), 1200))]) } else done = true } catch {} if (done) return; const area = document.createElement('textarea'); area.value = text; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;top:-999px;left:0;opacity:0'; document.body.appendChild(area); area.select(); let copied = false; try { copied = document.execCommand('copy') } catch {} area.remove(); if (!copied) throw new Error('clipboard-blocked') }
  const copyAsset = async (asset, kind = 'template') => { let current = asset; if (kind === 'private' && mode === 'remote' && !Object.keys(asset.privateBindings || {}).length) { try { current = { ...asset, privateBindings: (await apiRequest(`/assets/${asset.id}/private`)).privateBindings } } catch { setToast('无法读取私密配置'); return false } } const text = kind === 'private' ? `请在当前项目中复用以下开发资产，并将私密配置写入本地 .env.local（不要提交到 Git）：\n\n## 共享模板\n${current.sharedContent}\n\n## 私密配置（仅用于当前本地项目）\n${envText(current.privateBindings)}\n\n请说明安装依赖和验证方式。` : kind === 'raw' ? current.sharedContent : `请在当前项目中复用以下开发资产。私密配置已拆分为环境变量，请优先读取项目本地 .env.local，不要把密钥写进源码：\n\n${current.sharedContent}\n\n请说明需要安装的依赖、需要的环境变量和验证方式。`; try { await writeClipboard(text) } catch { setToast('复制失败：浏览器未允许访问剪贴板'); return false } try { const updated = await markUsed(current); setAssets((items) => items.map((item) => item.id === asset.id ? { ...item, ...updated, privateBindings: current.privateBindings || item.privateBindings } : item)) } catch {} setToast(kind === 'private' ? '已复制模板 + 私密配置' : kind === 'raw' ? '已复制原文' : '已复制安全模板上下文'); return true }
  const toggleFavorite = async (id) => { const target = assets.find((asset) => asset.id === id); if (!target) return; const previous = target.favorite; const favorite = !previous; setAssets((items) => items.map((item) => item.id === id ? { ...item, favorite } : item)); setSelected((item) => item?.id === id ? { ...item, favorite } : item); if (mode === 'remote') { try { await apiRequest(`/assets/${id}`, { method: 'PUT', body: JSON.stringify({ favorite }) }) } catch { setAssets((items) => items.map((item) => item.id === id ? { ...item, favorite: previous } : item)); setSelected((item) => item?.id === id ? { ...item, favorite: previous } : item); setToast('收藏状态同步失败') } } }
  const removeAsset = async (id) => { if (mode === 'remote') await apiRequest(`/assets/${id}`, { method: 'DELETE' }); setAssets((items) => items.filter((item) => item.id !== id)); setSelected(null); setToast('资产已删除') }
  const updatePrivate = async (id, privateBindings) => { try { if (mode === 'remote') await apiRequest(`/assets/${id}/private`, { method: 'PUT', body: JSON.stringify({ privateBindings }) }); setAssets((items) => items.map((item) => item.id === id ? { ...item, privateBindings, privateBindingMeta: Object.fromEntries(Object.entries(privateBindings).map(([key, value]) => [key, { length: value.length }])) } : item)); setSelected((item) => item?.id === id ? { ...item, privateBindings } : item); setToast('私密绑定已保存'); return true } catch { setToast('私密绑定保存失败'); return false } }
  const exportAssets = async (includePrivate = false) => { let payload = assets; if (includePrivate && mode === 'remote') payload = await Promise.all(assets.map(async (asset) => ({ ...asset, privateBindings: (await apiRequest(`/assets/${asset.id}/private`)).privateBindings }))); if (!includePrivate) payload = payload.map((asset) => ({ ...asset, privateBindings: {}, sensitive: false })); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); link.download = includePrivate ? 'one-for-all-assets-private.json' : 'one-for-all-assets.json'; link.click(); setToast(includePrivate ? '已导出私密备份' : '已导出共享资产') }
  const importAssets = (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { try { const incoming = JSON.parse(reader.result); if (!Array.isArray(incoming)) throw new Error(); if (mode === 'remote') { const created = await Promise.all(incoming.map((asset) => apiRequest('/assets', { method: 'POST', body: JSON.stringify({ title: asset.title, typeKey: asset.typeKey, description: asset.description, tags: asset.tags, sharedContent: asset.sharedContent || asset.content, privateBindings: asset.privateBindings || {} }) }))); setAssets((items) => [...created.map(({ asset }) => fromApi(asset)), ...items]) } else setAssets(incoming.map(normalizeLocal)); setToast(`已导入 ${incoming.length} 个资产`) } catch { setToast('导入失败：JSON 格式不正确') } }; reader.readAsText(file); event.target.value = '' }
  const addAsset = async (asset) => { if (mode === 'remote') { const { asset: created } = await apiRequest('/assets', { method: 'POST', body: JSON.stringify(asset) }); setAssets((items) => [fromApi(created), ...items]) } else setAssets((items) => [{ ...asset, id: `asset-${Date.now()}`, updated: '刚刚', used: '尚未使用' }, ...items]); setShowAdd(false); setToast('资产已添加') }
  const login = async (credentials) => { const localAssets = readStoredLocal(); const result = credentials.mode === 'register' ? await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(credentials) }) : await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }); setUser(result.user); setMode('remote'); const data = await apiRequest('/assets'); setAssets(data.assets.map(fromApi)); setShowAdd(false); if (localAssets.length) setPendingMigration(localAssets); setToast('已连接云端工作区') }
  const migrateLocal = async (includePrivate) => { if (!pendingMigration?.length || migrationBusy) return; setMigrationBusy(true); const migrated = readMigrationMap(); const created = []; try { for (const asset of pendingMigration) { if (migrated[asset.id]) continue; const result = await apiRequest('/assets', { method: 'POST', body: JSON.stringify({ title: asset.title, typeKey: asset.typeKey, description: asset.description, tags: asset.tags, sharedContent: asset.sharedContent, privateBindings: includePrivate ? asset.privateBindings : {} }) }); created.push(result); migrated[asset.id] = result.asset.id; localStorage.setItem(migrationKey, JSON.stringify(migrated)) } setAssets((items) => [...created.map(({ asset }) => fromApi(asset)), ...items]); localStorage.removeItem(localKey); localStorage.removeItem(migrationKey); setPendingMigration(null); setToast(includePrivate ? `已迁移 ${pendingMigration.length} 个资产和私密配置` : `已迁移 ${pendingMigration.length} 个共享资产`) } catch { localStorage.setItem(migrationKey, JSON.stringify(migrated)); setPendingMigration(readStoredLocal()); setToast('迁移未完成，已成功的资产不会重复上传') } finally { setMigrationBusy(false) } }
  const logout = async () => { await apiRequest('/auth/logout', { method: 'POST' }); setUser(null); setMode('local'); setAssets(readLocal()); setToast('已退出云端工作区') }
  if (!authChecked) return <div className="loading-screen"><div className="brand-mark"><Zap size={17} /></div><span>正在连接工作区…</span></div>
  const types = [['all', '全部资产', Layers3], ...Object.entries(palette).map(([key, value]) => [key, value[0], value[1]])]; const count = (key) => key === 'all' ? assets.length : assets.filter((asset) => asset.typeKey === key).length
  return <div className="app-shell"><aside className={`sidebar ${mobileNav ? 'open' : ''}`}><div className="brand"><div className="brand-mark"><Zap size={17} /></div><span>one-for-all</span><span className="brand-dot" /></div><div className="workspace-switch"><div className="workspace-avatar">{user ? user.name.slice(0, 1).toUpperCase() : 'L'}</div><div><strong>{user ? `${user.name} 的工作区` : '本地工作区'}</strong><small>{user ? user.email : '仅当前浏览器'}</small></div><ChevronDown size={15} /></div><nav className="side-nav"><div className="nav-label">资产库</div>{types.map(([key, label, Icon]) => <button key={key} className={`nav-item ${activeType === key && view === 'all' ? 'active' : ''}`} onClick={() => { setToolsMode(false); setActiveType(key); setView('all'); setMobileNav(false) }}><Icon size={17} /><span>{label}</span><em>{count(key)}</em></button>)}<button className={`nav-item tool-nav-item ${toolsMode ? 'active' : ''}`} onClick={() => { setToolsMode('library'); setMobileNav(false) }}><Wrench size={17} /><span>工具库</span><em>03</em></button><div className="nav-label nav-label-space">视图</div><button className={`nav-item ${view === 'favorites' ? 'active' : ''}`} onClick={() => { setToolsMode(false); setView('favorites'); setActiveType('all'); setMobileNav(false) }}><Star size={17} /><span>已收藏</span><em>{assets.filter((asset) => asset.favorite).length}</em></button><button className={`nav-item ${view === 'recent' ? 'active' : ''}`} onClick={() => { setToolsMode(false); setView('recent'); setActiveType('all'); setMobileNav(false) }}><Bookmark size={17} /><span>最近使用</span></button></nav><div className="sidebar-bottom"><button className="nav-item" onClick={() => exportAssets(false)}><Download size={17} /><span>导出共享资产</span></button><button className="nav-item" onClick={() => fileRef.current?.click()}><Upload size={17} /><span>导入资产库</span></button>{user ? <button className="nav-item muted" onClick={logout}><LogOut size={17} /><span>退出登录</span></button> : <button className="nav-item muted" onClick={() => setToast('点击右上角账户按钮登录云端')}><UserRound size={17} /><span>连接云端</span></button>}</div><input ref={fileRef} type="file" accept="application/json" hidden onChange={importAssets} /></aside>{mobileNav && <button className="scrim" aria-label="关闭导航" onClick={() => setMobileNav(false)} />}<main className="main-content">{toolsMode ? <>{toolsMode === 'library' ? <ToolsShell onSelect={setToolsMode} /> : toolsMode === 'markdown' ? <MarkdownTool onBack={() => setToolsMode('library')} /> : <JsonTool mode={toolsMode === 'json-diff' ? 'diff' : 'format'} onBack={() => setToolsMode('library')} />}</> : <><header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="打开导航"><Menu size={21} /></button><div className="breadcrumbs"><span>工作区</span><span>/</span><strong>{view === 'favorites' ? '已收藏' : view === 'recent' ? '最近使用' : (types.find((item) => item[0] === activeType)?.[1] || '全部资产')}</strong></div><div className="top-actions"><div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索资产、标签或内容…" /><kbd>⌘ K</kbd></div>{user ? <button className="account-button" onClick={logout} title="退出登录"><span>{user.name.slice(0, 1).toUpperCase()}</span><LogOut size={14} /></button> : <button className="account-button" onClick={() => setShowAdd('auth')} title="登录云端"><UserRound size={16} /><span>登录</span></button>}<button className="primary-button" onClick={() => setShowAdd(true)}><Plus size={17} /> 新建资产</button></div></header><section className="content-wrap"><div className="page-intro"><div><p className="eyebrow">DEVELOPER KNOWLEDGE BASE <span>·</span> {user ? '云端工作区' : '本地工作区'}</p><h1>把好用的东西，留在手边。</h1><p className="intro-copy">共享模板和私人配置分开管理，按需组合，安全地复制到你的下一个项目。</p></div><button className="text-button" onClick={() => exportAssets(false)}><Download size={15} /> 备份共享资产 <ArrowUpRight size={14} /></button></div><div className="stats-row"><Stat icon={Layers3} cls="blue-bg" value={assets.length} label="全部资产" note={mode === 'remote' ? '已同步数据库' : '本地存储'} /><Stat icon={Copy} cls="amber-bg" value="24" label="本月复制" note="+18%" positive /><Stat icon={ShieldCheck} cls="green-bg" value={assets.filter((asset) => bindingCount(asset) > 0).length} label="含私密绑定" note="默认遮罩" /></div><div className="section-toolbar"><div className="tabs"><button className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>全部资产 <span>{assets.length}</span></button><button className={view === 'recent' ? 'active' : ''} onClick={() => setView('recent')}>最近使用</button><button className={view === 'favorites' ? 'active' : ''} onClick={() => setView('favorites')}>已收藏 <span>{assets.filter((asset) => asset.favorite).length}</span></button></div><div className="result-meta">{filtered.length} 个结果 <button className="sort-button">最近更新 <ChevronDown size={14} /></button></div></div>{filtered.length ? <div className="asset-grid">{filtered.map((asset) => <AssetCard key={asset.id} asset={asset} onSelect={openAsset} onCopy={copyAsset} onFavorite={toggleFavorite} />)}</div> : <Empty query={query} onClear={() => setQuery('')} onAdd={() => setShowAdd(true)} />}<footer className="page-footer"><span>{mode === 'remote' ? '云端工作区 · 数据已同步 PostgreSQL' : '本地工作区 · 数据仅保存在当前浏览器'}</span><span><i className="status-dot" /> 已自动保存</span></footer></section></>}</main>{selected && <AssetModal asset={selected} onClose={() => setSelected(null)} onCopy={copyAsset} onFavorite={toggleFavorite} onDelete={removeAsset} onUpdatePrivate={updatePrivate} onExportPrivate={() => exportAssets(true)} />}{pendingMigration && <MigrationModal assets={pendingMigration} busy={migrationBusy} onClose={() => setPendingMigration(null)} onMigrate={migrateLocal} />}{showAdd === true && <AddModal onClose={() => setShowAdd(false)} onAdd={addAsset} />}{showAdd === 'auth' && <AuthModal onClose={() => setShowAdd(false)} onSubmit={login} />}{toast && <div className="toast"><Check size={16} /> {toast}</div>}</div>
}

function Stat({ icon: Icon, cls, value, label, note, positive }) { return <div className="stat-card"><div className={`stat-icon ${cls}`}><Icon size={18} /></div><div><strong>{value}</strong><span>{label}</span></div><small className={positive ? 'positive' : ''}>{note}</small></div> }
function AssetCard({ asset, onSelect, onCopy, onFavorite }) { const [copied, setCopied] = useState(false); const [label, Icon, color] = meta(asset.typeKey); return <article className="asset-card" onClick={() => onSelect(asset)}><div className="card-top"><div className={`asset-icon ${color}`}><Icon size={18} /></div><div className="card-actions"><button className={`star-button ${asset.favorite ? 'is-favorite' : ''}`} title={asset.favorite ? '取消收藏' : '收藏'} onClick={(e) => { e.stopPropagation(); onFavorite(asset.id) }}><Star size={16} fill={asset.favorite ? 'currentColor' : 'none'} /></button><button className="more-button" title="更多操作" onClick={(e) => e.stopPropagation()}><MoreHorizontal size={17} /></button></div></div><div className="card-heading"><h3>{asset.title}</h3><span className={`type-pill ${color}`}>{label}</span></div><p className="card-description">{asset.description}</p><div className="tag-list">{asset.tags.map((tag) => <span key={tag}><Tag size={11} />{tag}</span>)}</div><div className="asset-privacy"><span className="shared-badge"><Code2 size={11} />共享模板</span>{bindingCount(asset) > 0 && <span className="private-badge"><KeyRound size={11} />{bindingCount(asset)} 个私密绑定</span>}</div><div className="card-footer"><span>{asset.used}</span><button className={`copy-button ${copied ? 'copied' : ''}`} onClick={async (e) => { e.stopPropagation(); if (await onCopy(asset)) { setCopied(true); setTimeout(() => setCopied(false), 1800) } }}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? '已复制' : '复制安全模板'}</button></div></article> }
function Empty({ query, onClear, onAdd }) { return <div className="empty-state"><div className="empty-icon"><Search size={23} /></div><h3>没有找到匹配的资产</h3><p>{query ? `没有与“${query}”匹配的内容，试试其他关键词。` : '这个视图里还没有资产。'}</p><div><button className="secondary-button" onClick={onClear}>清除搜索</button><button className="primary-button" onClick={onAdd}><Plus size={16} /> 新建资产</button></div></div> }
function AssetModal({ asset, onClose, onCopy, onFavorite, onDelete, onUpdatePrivate, onExportPrivate }) { const [tab, setTab] = useState('content'); const [editing, setEditing] = useState(false); const [draftText, setDraftText] = useState(envText(asset.privateBindings)); const [copied, setCopied] = useState(''); const [mdView, setMdView] = useState(() => { try { return (JSON.parse(localStorage.getItem(mdPrefKey)) || {})[asset.id] !== false } catch { return true } }); const [label, Icon, color] = meta(asset.typeKey); const bindings = Object.entries(asset.privateBindings || {}); const toggleMdView = () => { const next = !mdView; setMdView(next); try { const prefs = JSON.parse(localStorage.getItem(mdPrefKey)) || {}; prefs[asset.id] = next; localStorage.setItem(mdPrefKey, JSON.stringify(prefs)) } catch {} }; const copyAndFlag = async (kind, key) => { if (await onCopy(asset, kind)) { setCopied(key); setTimeout(() => setCopied((current) => current === key ? '' : current), 1800) } }; return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="detail-modal"><div className="modal-header"><div className={`asset-icon ${color}`}><Icon size={19} /></div><div><div className="modal-kicker">{label} · {asset.updated}</div><h2>{asset.title}</h2></div><button className="close-button" onClick={onClose}><X size={19} /></button></div><p className="modal-description">{asset.description}</p><div className="modal-tags">{asset.tags.map((tag) => <span key={tag}><Tag size={11} />{tag}</span>)}</div><div className="privacy-summary"><div><Code2 size={15} /><span><strong>共享模板</strong><small>可以安全分享和复制</small></span><b>已启用</b></div><div className={bindingCount(asset) ? '' : 'empty-private'}><KeyRound size={15} /><span><strong>私密配置</strong><small>{bindingCount(asset) ? `${bindingCount(asset)} 个变量，仅保存在本机或账号下` : '暂无私密绑定'}</small></span><b>{bindingCount(asset) ? '已绑定' : '空'}</b></div></div><div className="modal-tabs"><button className={tab === 'content' ? 'active' : ''} onClick={() => setTab('content')}>共享模板</button><button className={tab === 'private' ? 'active' : ''} onClick={() => setTab('private')}>私密配置</button><button className={tab === 'usage' ? 'active' : ''} onClick={() => setTab('usage')}>组合方式</button></div>{tab === 'content' ? <div className={`code-panel ${mdView ? 'md-doc' : ''}`}><div className="code-panel-bar"><span><i className="window-dot red" /><i className="window-dot yellow" /><i className="window-dot green" /></span><span>{mdView ? '渲染视图 · 复制按原文' : '可分享内容 · 不含真实密钥'}</span><button onClick={toggleMdView} title={mdView ? '切换为代码视图' : '切换为渲染视图'}>{mdView ? <FileCode2 size={14} /> : <WandSparkles size={14} />} {mdView ? '代码' : '渲染'}</button><button className={copied === 'raw' ? 'copied' : ''} onClick={() => copyAndFlag('raw', 'raw')}>{copied === 'raw' ? <Check size={14} /> : <Copy size={14} />} {copied === 'raw' ? '已复制' : '复制原文'}</button><button className={copied === 'template' ? 'copied' : ''} onClick={() => copyAndFlag('template', 'template')}>{copied === 'template' ? <Check size={14} /> : <Copy size={14} />} {copied === 'template' ? '已复制' : '复制模板'}</button></div>{mdView ? <div className="md-body" dangerouslySetInnerHTML={{ __html: markdownToHtml(asset.sharedContent) }} /> : <pre>{asset.sharedContent}</pre>}</div> : tab === 'private' ? <div className="private-panel"><div className="private-notice"><ShieldCheck size={17} /><span><strong>私密配置默认不进入共享链路</strong><small>数据库中加密保存，接口只对资产所有者开放。</small></span></div>{editing ? <div className="private-edit"><textarea className="private-input" rows="6" value={draftText} onChange={(e) => setDraftText(e.target.value)} autoFocus /><div className="edit-actions"><button className="secondary-button" onClick={() => setEditing(false)}>取消</button><button className="primary-button" onClick={async () => { if (await onUpdatePrivate(asset.id, parseEnvText(draftText))) setEditing(false) }}><Check size={15} /> 保存绑定</button></div></div> : <>{bindings.length ? bindings.map(([key, value]) => <div className="binding-row" key={key}><code>{key}</code><span>••••••••••••••••</span><small>{value.length} 字符</small></div>) : <div className="no-bindings">这个资产没有私密配置，可以直接分享。</div>}<button className="private-export" onClick={() => { setDraftText(envText(asset.privateBindings)); setEditing(true) }}><KeyRound size={14} /> 编辑私密绑定</button></>}<button className="private-export" onClick={onExportPrivate}><Download size={14} /> 导出含私密配置的备份</button></div> : <div className="usage-panel"><Usage n="01" title="日常复制：只带共享模板">使用卡片上的「复制安全模板」或模板面板的「复制模板」，不携带任何真实值，适合分享给团队。</Usage><Usage n="02" title="本地接入：复制模板 + 私密配置">「复制给 Codex」一键组合复制模板与私密配置，建议只粘贴到本地 Codex/CLI，并让工具写入 `.env.local`。</Usage><Usage n="03" title="更安全的长期方案">优先使用短期 Key、项目级 Secret Manager，避免把长期生产密钥放进对话历史。</Usage></div>}<div className="modal-footer"><button className="danger-button" onClick={() => onDelete(asset.id)}><Trash2 size={15} /> 删除</button><div><button className="secondary-button" onClick={() => onFavorite(asset.id)}><Star size={15} fill={asset.favorite ? 'currentColor' : 'none'} /> {asset.favorite ? '已收藏' : '收藏'}</button>{bindings.length > 0 && <button className={`private-copy-button direct-private-copy ${copied === 'private' ? 'copied' : ''}`} onClick={() => copyAndFlag('private', 'private')}>{copied === 'private' ? <Check size={15} /> : <KeyRound size={15} />} {copied === 'private' ? '已复制' : '复制含私密配置'}</button>}<button className={`primary-button ${copied === 'codex' ? 'copied' : ''}`} onClick={() => copyAndFlag(bindings.length ? 'private' : 'template', 'codex')}>{copied === 'codex' ? <Check size={16} /> : <Copy size={16} />} {copied === 'codex' ? '已复制' : '复制给 Codex'}</button></div></div></section></div> }
function Usage({ n, title, children }) { return <div className="usage-row"><span className="usage-number">{n}</span><div><strong>{title}</strong><p>{children}</p></div></div> }
function MigrationModal({ assets, busy, onClose, onMigrate }) { const [includePrivate, setIncludePrivate] = useState(false); const privateCount = assets.filter((asset) => bindingCount(asset) > 0).length; return <div className="modal-backdrop"><section className="migration-modal"><div className="modal-header"><div><div className="modal-kicker">发现本地资产</div><h2>迁移到云端工作区</h2></div><button className="close-button" onClick={onClose} disabled={busy} aria-label="关闭迁移窗口"><X size={19} /></button></div><p>检测到 {assets.length} 个本地资产。默认只迁移共享模板，私密配置需要单独确认。</p><label className="migration-option"><input type="checkbox" checked={includePrivate} onChange={(event) => setIncludePrivate(event.target.checked)} disabled={busy} /><span>同时迁移 {privateCount} 个资产的私密配置<small>私密值会加密保存到当前账号；迁移完成后会删除本地副本。</small></span></label><div className="modal-footer"><button className="secondary-button" onClick={onClose} disabled={busy}>稍后处理</button><button className="primary-button" onClick={() => onMigrate(includePrivate)} disabled={busy}>{busy ? '正在迁移…' : '开始迁移'}</button></div></section></div> }
function AddModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ title: '', typeKey: 'snippet', description: '', tags: '', sharedContent: '', privateText: '' })
  const [detectNote, setDetectNote] = useState('')
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const mergePrivate = (currentText, found) => envText({ ...parseEnvText(currentText), ...found })
  const applyDetection = (text) => { const result = splitSensitiveContent(text); if (!result.detected.length) return null; setForm((current) => ({ ...current, sharedContent: result.sharedContent, privateText: mergePrivate(current.privateText, result.privateBindings) })); setDetectNote(`已识别 ${result.detected.length} 个私密值并移入私密配置：${result.detected.join('、')}`); return result }
  const handlePaste = (event) => { const pasted = event.clipboardData?.getData('text'); if (!pasted) return; const result = splitSensitiveContent(pasted); if (!result.detected.length) return; event.preventDefault(); const target = event.currentTarget; const start = target.selectionStart ?? target.value.length; const end = target.selectionEnd ?? start; const nextText = `${target.value.slice(0, start)}${result.sharedContent}${target.value.slice(end)}`; setForm((current) => ({ ...current, sharedContent: nextText, privateText: mergePrivate(current.privateText, result.privateBindings) })); setDetectNote(`已识别 ${result.detected.length} 个私密值并移入私密配置：${result.detected.join('、')}`) }
  const submit = (event) => { event.preventDefault(); if (!form.title.trim() || !form.sharedContent.trim()) return; onAdd({ title: form.title.trim(), typeKey: form.typeKey, description: form.description, sharedContent: form.sharedContent, tags: form.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), privateBindings: parseEnvText(form.privateText), favorite: false }) }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="add-modal"><div className="modal-header"><div><div className="modal-kicker">新增开发资产</div><h2>沉淀一个可复用单元</h2></div><button className="close-button" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><label>名称<input autoFocus value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="例如：S3 上传签名服务" required /></label><div className="form-grid"><label>类型<select value={form.typeKey} onChange={(event) => update('typeKey', event.target.value)}>{Object.entries(palette).map(([key, value]) => <option key={key} value={key}>{value[0]}</option>)}</select></label><label>标签<input value={form.tags} onChange={(event) => update('tags', event.target.value)} placeholder="React, API, 部署" /></label></div><label>一句话描述<textarea rows="2" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="它解决什么问题？" /></label><label><div className="content-label-row"><span className="label-with-note">共享模板 <small>可分享，不放真实密钥；用 {'{{ENV_NAME}}'} 留占位符</small></span><button type="button" className="detect-button" onClick={() => applyDetection(form.sharedContent)}><ShieldCheck size={13} /> 识别私密值</button></div><textarea className="content-input" rows="7" value={form.sharedContent} onChange={(event) => update('sharedContent', event.target.value)} onPaste={handlePaste} placeholder="直接粘贴完整代码、curl 或配置…" required />{detectNote && <small className="detect-note"><ShieldCheck size={13} /> {detectNote}</small>}</label><label><span className="label-with-note">私密配置 <small>可选，仅账号/本地保存；每行 KEY=VALUE</small></span><textarea className="private-input" rows="4" value={form.privateText} onChange={(event) => update('privateText', event.target.value)} placeholder={'OPENROUTER_API_KEY=sk-…\nAPP_URL=http://localhost:3000'} /></label><div className="private-form-note"><ShieldCheck size={15} /> 私密配置默认不参与搜索、共享复制和普通导出。</div><div className="modal-footer"><span className="form-hint">共享模板和私密配置分层保存</span><div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button"><Plus size={16} /> 保存资产</button></div></div></form></section></div>
}

function LegacyAddModal({ onClose, onAdd }) { const [form, setForm] = useState({ title: '', typeKey: 'snippet', description: '', tags: '', sharedContent: '', privateText: '' }); const update = (key, value) => setForm({ ...form, [key]: value }); const submit = (event) => { event.preventDefault(); if (!form.title.trim() || !form.sharedContent.trim()) return; onAdd({ title: form.title.trim(), typeKey: form.typeKey, description: form.description, sharedContent: form.sharedContent, tags: form.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), privateBindings: parseEnvText(form.privateText), favorite: false }) }; return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="add-modal"><div className="modal-header"><div><div className="modal-kicker">新增开发资产</div><h2>沉淀一个可复用单元</h2></div><button className="close-button" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><label>名称<input autoFocus value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="例如：S3 上传签名服务" required /></label><div className="form-grid"><label>类型<select value={form.typeKey} onChange={(e) => update('typeKey', e.target.value)}>{Object.entries(palette).map(([key, value]) => <option key={key} value={key}>{value[0]}</option>)}</select></label><label>标签<input value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="React, API, 部署" /></label></div><label>一句话描述<textarea rows="2" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="它解决什么问题？" /></label><label><span className="label-with-note">共享模板 <small>可分享，不放真实密钥；用 {'{{ENV_NAME}}'} 留占位符</small></span><textarea className="content-input" rows="7" value={form.sharedContent} onChange={(e) => update('sharedContent', e.target.value)} placeholder="粘贴通用代码、配置或提示词…" required /></label><label><span className="label-with-note">私密配置 <small>可选，仅账号/本地保存；每行 KEY=VALUE</small></span><textarea className="private-input" rows="4" value={form.privateText} onChange={(e) => update('privateText', e.target.value)} placeholder={'OPENROUTER_API_KEY=sk-…\nAPP_URL=http://localhost:3000'} /></label><div className="private-form-note"><ShieldCheck size={15} /> 私密配置默认不参与搜索、共享复制和普通导出。</div><div className="modal-footer"><span className="form-hint">{onAdd ? '共享模板和私密配置分层保存' : ''}</span><div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button"><Plus size={16} /> 保存资产</button></div></div></form></section></div> }
function AuthModal({ onClose, onSubmit }) { const [mode, setMode] = useState('login'); const [form, setForm] = useState({ email: '', password: '', name: '' }); const [error, setError] = useState(''); const submit = async (event) => { event.preventDefault(); try { await onSubmit({ ...form, mode }) } catch (err) { setError(err.message) } }; return <div className="modal-backdrop"><section className="auth-modal"><div className="auth-brand"><div className="brand-mark"><Zap size={17} /></div><strong>连接 one-for-all 云端</strong></div><h2>{mode === 'login' ? '欢迎回来' : '创建你的工作区'}</h2><p>登录后资产会保存到 PostgreSQL，并按账号隔离。</p><div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>登录</button><button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>注册</button></div><form onSubmit={submit}>{mode === 'register' && <label>姓名<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="你的名字" /></label>}<label>邮箱<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required /></label><label>密码<input type="password" minLength="10" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="至少 10 位" required /></label>{error && <div className="auth-error">{error}</div>}<div className="auth-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button">{mode === 'login' ? '登录并同步' : '创建账号'}</button></div></form></section></div> }
createRoot(document.getElementById('root')).render(<App />)
