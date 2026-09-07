# One for All

个人开发资产库：把代码片段、API 配置、基础设施接入方式和 Prompt 结构化沉淀，搜索后即可复制成可直接交给 Codex 的上下文。

## 方案结论

这类产品可以借鉴 massCode / Snibox 的“代码片段 + 标签 + 搜索”模型，以及 Pieces 的“最近使用和跨工具复用”思路。但 API Key、云厂商 Secret 这类内容不适合和通用代码混成一个可分享文本，因此首版采用 **local-first + 双层资产**：

- `sharedContent` 是共享模板，使用 `{{ENV_NAME}}` 占位符；它会被搜索、预览和普通复制。
- `privateBindings` 是本机私密配置，按 `KEY=VALUE` 保存；默认不参与搜索、共享复制和普通导出。
- 普通“复制给 Codex”只复制共享模板，并要求工具读取当前项目的 `.env.local`。
- “复制并注入配置”是一个需要明确确认的动作，会把模板和私密配置组合到剪贴板，适合本地 Codex/CLI；远程 Agent 或长期生产 Key 不建议使用。
- 打开资产详情的“私密配置”页即可编辑绑定；OpenRouter 示例可填写真实的 `OPENROUTER_API_KEY`，共享模板仍保持占位符。
- 私密配置页只显示遮罩和长度；“导出含私密配置的备份”单独提供，避免误把 Secret 放进共享备份。
- 数据存储在浏览器 `localStorage`，支持 JSON 导入/导出，便于备份、迁移和未来接入同步服务。

当前 MVP 的私密值是“本地隔离”，不是“加密存储”：能访问该浏览器用户目录的人仍可能读取 `localStorage`。生产版本应改为 Web Crypto 加密或接入系统 Secret Manager。
- 分类、标签、全文检索、收藏、最近使用、新建和删除均已覆盖。

## 技术实现

- React + Vite + lucide-react
- Nginx 静态托管，Dockerfile 可用于任意云主机
- 不依赖服务端数据库，不收集 API Key

第二阶段建议增加：账号登录（OIDC）、SQLite/PostgreSQL、端到端加密字段、版本历史、团队共享空间、Secret Manager 连接和 CLI（例如 `ofa copy openrouter --with-local-secrets`）。服务端同步时应始终把共享字段和私密字段分开加密，不能只依赖前端遮罩。

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 部署

当前版本已发布到 [tools.chatcanvas.online](https://tools.chatcanvas.online)。服务器静态目录为 `/var/www/one-for-all`，Nginx 配置模板位于 `deploy/nginx-tools.conf`，HTTPS 由 Certbot 自动续期。

更新部署时重新构建 `dist`，同步到该目录并 reload Nginx 即可。仓库不应提交真实密钥；示例资产里的值均为占位符。
