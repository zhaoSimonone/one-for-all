# One for All - 任务交接

更新时间：2026-09-07

## 当前状态

项目是一个已上线的开发资产库，线上地址为 <https://tools.chatcanvas.online>。后端已部署到同一域名的 `/api/` 路由，前端支持本地工作区和登录后的云端工作区。

已完成：

- React + Vite 前端，静态部署到 Nginx。
- 资产分类、搜索、标签、收藏、最近使用、新建、删除。
- JSON 导入/导出。
- 资产详情页、复制给 Codex、复制共享模板。
- “复制给 Codex”支持选择仅共享模板，或在确认后同时复制私密配置。
- “共享模板 + 私密配置”双层数据模型和旧 `content` 字段迁移。
- 新建资产支持直接粘贴完整 curl/配置，在浏览器端识别 Bearer Token、API Key 等私密值并自动拆分。
- 私密配置遮罩展示、编辑、私密备份、组合复制前确认提示。
- HTTPS 已由服务器 Certbot 配置并自动续期。
- Express + PostgreSQL 后端已部署，提供注册/登录、资产 CRUD、owner-only 私密绑定接口。

## 当前架构事实

前端默认打开本地工作区；用户登录后切换到后端会话，资产从 PostgreSQL 加载并按账号隔离。两种模式并行存在，登录不会自动上传本地数据，避免未经确认的私密迁移。

| 关注点 | 当前实现 | 结论 |
| --- | --- | --- |
| 共享代码 | `asset.sharedContent`，使用 `{{ENV_NAME}}` 占位符 | 可安全复制、搜索、普通导出 |
| 私密配置 | `asset.privateBindings`，`{ KEY: VALUE }` | 与单个资产关联 |
| 资产关联 | 一个资产拥有一组 `privateBindings` | 已实现组件/资产级关联 |
| 用户隔离 | 后端 JWT + `user_id` 条件 | 已实现于 API 和云端前端模式 |
| 服务端 API | Express `/api/v1` | 已实现并已部署 |
| 数据库 | PostgreSQL 16 Docker volume | 已实现并已部署 |
| 数据持久化 | 云端 PostgreSQL；本地模式 `localStorage` | 云端数据落 DB，本地数据只在当前浏览器 |
| 私密值安全 | 后端 AES-256-GCM；普通响应不回显 | 云端已实现；本地模式仍是明文浏览器存储 |

## 当前数据模型

```ts
type Asset = {
  id: string
  title: string
  typeKey: 'credentials' | 'infra' | 'prompt' | 'snippet' | 'database' | 'component'
  description: string
  tags: string[]
  sharedContent: string
  privateBindings: Record<string, string>
  favorite: boolean
  updated: string
  used: string
}
```

示例：OpenRouter 资产的共享内容只保留：

```env
OPENROUTER_API_KEY={{OPENROUTER_API_KEY}}
APP_URL={{APP_URL}}
```

真实值存在同一资产的 `privateBindings` 中。普通“复制给 Codex”不带真实值；“复制并注入配置”会提示确认后才把模板和私密配置放入剪贴板。

## 主要代码位置

| 文件 | 责任 |
| --- | --- |
| `src/main.jsx` | 全部 UI、资产模型、`localStorage`、复制/导入导出逻辑 |
| `src/styles.css` | 主界面样式 |
| `src/privacy.css` | 共享/私密分层 UI、遮罩和确认样式 |
| `README.md` | 现有架构和部署概览 |
| `deploy/nginx-tools.conf` | `tools.chatcanvas.online` 的 Nginx 模板 |
| `Dockerfile` / `nginx.conf` | 容器化静态部署方案 |

## 已知问题与技术债

1. `src/main.jsx` 仍是单文件实现，后续可拆分 API client、资产列表和详情弹窗。
2. 登录后的资产已走 API；检测到用户新增或导入的本地资产时，会显示显式迁移向导，确认后才迁移并清理本地副本。内置演示资产不会触发迁移。
3. 普通 JSON 导出会移除私密绑定；“含私密配置备份”是明文 JSON，应仅用于受控本地备份。
4. 私密值在用户确认“复制并注入”后会进入系统剪贴板，也可能进入编程工具的对话记录。长期生产密钥不应走这个链路。
5. 后端 `private_bindings` 的旧 JSONB 明文数据不能自动安全迁移；若未来已有旧数据，必须先人工导出、加密导入并轮换密钥。

## 推荐下一阶段：团队共享 + 更强密钥管理

当前 MVP 基础设施已完成，下一阶段应围绕权限、审计和密钥托管收敛风险。

建议技术栈：

- 后端：Node.js（Fastify / Hono / NestJS 任选其一）或将前端迁移到 Next.js。
- 数据库：PostgreSQL。
- ORM：Prisma 或 Drizzle。
- 身份认证：OIDC（Google / GitHub）或成熟身份服务。
- 秘密存储：优先接入云 Secret Manager；若必须保存到 DB，使用 envelope encryption，并将 KEK 放在 KMS/Secret Manager。

建议的核心表：

```text
users
workspaces
workspace_members
assets
asset_versions
asset_private_bindings
audit_logs
```

建议关键隔离规则：

```text
assets:
  workspace_id
  visibility: private | workspace | public
  owner_id
  shared_content

asset_private_bindings:
  asset_id
  user_id
  encrypted_value
  key_name
```

共享模板按 `workspace_id` / `visibility` 授权；私密绑定必须按 `asset_id + user_id` 读取。团队成员可以共享 OpenRouter 接入模板，但每个人只能读取和注入自己的 OpenRouter Key。

## 推荐执行顺序

1. 增加登录/注册速率限制、审计日志、备份恢复和密钥轮换。
2. 增加真实 PostgreSQL 集成测试，以及对本地迁移向导的端到端测试。
3. 增加项目级 `.env.local` 生成或本地 CLI，尽量避免把秘密粘贴进 Codex 对话。
4. 设计 workspace、成员角色、资产 visibility 和按用户的私密绑定表。
5. 接入 Secret Manager，逐步淘汰长期密钥进数据库的方案。

## 部署信息

- 域名：`tools.chatcanvas.online`
- 主机：`124.223.212.122`
- SSH 用户：`ubuntu`
- 静态文件目录：`/var/www/one-for-all`
- Nginx 站点：`/etc/nginx/sites-available/tools.chatcanvas.online`
- HTTPS：Certbot 管理，证书为 `tools.chatcanvas.online`

部署凭证由用户保存在仓库外的本地目录；不要将密钥、登录密码或私密 JSON 写入仓库、文档或聊天记录。原有部署流程为：`npm run build`，同步 `dist/` 到服务器静态目录，执行 `nginx -t` 后 reload Nginx。

## 最近验证

- `npm run build` 在最近一次改动后通过。
- 线上 `https://tools.chatcanvas.online/` 返回 HTTP 200。
- 最近上线构建包含共享/私密分层、私密绑定编辑和确认复制功能。
