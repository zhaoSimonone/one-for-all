# One for All - 任务交接

更新时间：2026-09-07

## 当前状态

项目是一个已上线的个人开发资产库 MVP，线上地址为 <https://tools.chatcanvas.online>。

已完成：

- React + Vite 前端，静态部署到 Nginx。
- 资产分类、搜索、标签、收藏、最近使用、新建、删除。
- JSON 导入/导出。
- 资产详情页、复制给 Codex、复制共享模板。
- “共享模板 + 私密配置”双层数据模型和旧 `content` 字段迁移。
- 私密配置遮罩展示、编辑、私密备份、组合复制前确认提示。
- HTTPS 已由服务器 Certbot 配置并自动续期。

## 当前架构事实

这是 **local-first 单浏览器 MVP**，不是多用户产品。

| 关注点 | 当前实现 | 结论 |
| --- | --- | --- |
| 共享代码 | `asset.sharedContent`，使用 `{{ENV_NAME}}` 占位符 | 可安全复制、搜索、普通导出 |
| 私密配置 | `asset.privateBindings`，`{ KEY: VALUE }` | 与单个资产关联 |
| 资产关联 | 一个资产拥有一组 `privateBindings` | 已实现组件/资产级关联 |
| 用户隔离 | 无登录、无 `userId`、无 workspace | **未实现** |
| 服务端 API | 无 | **未实现** |
| 数据库 | 无 | **未实现** |
| 数据持久化 | 浏览器 `localStorage`，key 为 `ofa-assets` | 仅当前浏览器用户可见，但不是安全隔离/加密 |
| 私密值安全 | UI 遮罩、普通导出默认剔除 | 不等于加密；本机浏览器数据可被有本机权限的人读取 |

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

1. `src/main.jsx` 是单文件实现，且目前有一个未使用的 `AssetModalLegacy` 组件，应在下一次重构时删除。
2. `privateBindings` 是 `localStorage` 明文，不具备账号隔离、跨设备同步、服务端审计或强加密。
3. 普通 JSON 导出会移除私密绑定；“含私密配置备份”是明文 JSON，应仅用于受控本地备份。
4. 私密值在用户确认“复制并注入配置”后会进入系统剪贴板，也可能进入编程工具的对话记录。长期生产密钥不应走这个链路。
5. 当前项目未发现可用的 Git 仓库元数据，执行 `git status` 返回“not a git repository”。开始改动前请再次确认实际版本控制目录。

## 推荐下一阶段：多用户 + 数据库

优先完成后端基础设施，暂不继续堆叠前端功能。

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

1. 在本地创建真实 Git 仓库或确认仓库根目录，并清理 `AssetModalLegacy`。
2. 设计并落地 PostgreSQL schema、migration、最小后端 API。
3. 实现登录、session 和 workspace membership 授权中间件。
4. 将共享资产迁移到数据库；私密绑定先做加密存储，再开放同步。
5. 用 API 替代 `localStorage` 主存储；本地缓存仅保留非敏感内容。
6. 增加项目级 `.env.local` 生成或本地 CLI，尽量避免把秘密粘贴进 Codex 对话。
7. 增加权限、审计、密钥轮换、备份恢复和端到端测试。

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
