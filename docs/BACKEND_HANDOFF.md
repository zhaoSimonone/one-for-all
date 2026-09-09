# One for All 后端交接

更新时间：2026-09-07

## 当前结论

Claude Code 之前提交的后端已经从部署骨架扩展为可用的 MVP 多用户 API。当前实现适合个人/小规模使用，已经具备账号隔离和数据库持久化，但还不是团队协作版，也没有接入云 Secret Manager。

本轮 review 发现并修正：

- 旧 `private_bindings` JSONB 数据不能直接 cast 成 TEXT，否则会把明文秘密伪装成密文；schema 现在遇到非空旧数据会主动失败，要求人工加密迁移。
- 更新资产元数据时保留已有密文，不再因解密失败而把私密绑定重置为空。
- Cookie 解析改为容错实现，畸形 Cookie 返回正常 401 而不是抛出解析异常。
- 资产 ID 增加 UUID 校验，非法 ID 返回 400。
- API 可在测试中导入而不自动监听端口，增加 Node 原生 API 回归测试。
- 部署脚本固定 Nginx 备份路径，并只向 HTTPS server 块插入 API location，失败时可准确恢复。

## 已实现接口

所有 `/api/v1/assets*` 接口都要求登录，并且 SQL 查询包含当前用户的 `user_id`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | 注册并设置 HttpOnly 会话 Cookie |
| POST | `/api/v1/auth/login` | 登录并设置会话 Cookie |
| POST | `/api/v1/auth/logout` | 清除会话 Cookie |
| GET | `/api/v1/auth/me` | 获取当前用户 |
| GET | `/api/v1/assets` | 当前用户资产列表，支持 `type`、`favorite`、`recent`、`q`、分页 |
| POST | `/api/v1/assets` | 创建资产 |
| GET | `/api/v1/assets/:id` | 获取资产（不返回私密值） |
| PUT | `/api/v1/assets/:id` | 更新共享字段、标签、收藏状态 |
| DELETE | `/api/v1/assets/:id` | 删除资产 |
| POST | `/api/v1/assets/:id/use` | 更新最近使用时间 |
| GET | `/api/v1/assets/:id/private` | owner-only 读取私密绑定，`Cache-Control: no-store` |
| PUT | `/api/v1/assets/:id/private` | owner-only 加密保存私密绑定 |

认证支持 HttpOnly Cookie，也兼容 `Authorization: Bearer <jwt>`，便于未来 CLI 使用。JWT 有效期为 7 天，签发方为 `one-for-all`。

## 数据与隐私边界

```text
Asset {
  sharedContent: string                  # 可共享模板，使用 {{ENV_NAME}} 占位符
  privateBindings: Record<string,string> # 只在 owner-only 接口返回
}
```

- `users` 保存邮箱、显示名和 bcrypt 密码哈希。
- `assets.private_bindings` 是 TEXT，保存 AES-256-GCM 密文：`base64url(iv).base64url(tag).base64url(ciphertext)`。
- `audit_logs` 保存注册、登录、资产变更和私密读取事件，只记录 action、资源 ID、来源 IP 和非敏感元数据。
- 普通资产列表/详情只返回 `privateBindingMeta`（变量名和长度），不会返回真实值。
- 私密接口按 `asset.id + user_id` 查询；其他用户看到 404，不泄露资产是否存在。
- Cookie 写操作会校验 `Origin` 白名单；无 Origin 的 CLI/Bearer 请求仍可使用。
- 本地未登录模式仍使用浏览器 `localStorage`，其中私密值是明文；这只适合作为本机临时工作区，不等同于加密存储。
- 生产依赖使用 lockfile，`qs` 通过 npm override 固定到 `6.16.0`，当前 `npm audit --omit=dev` 无告警。
- 注册/登录按来源 IP 使用进程内限流：15 分钟最多 10 次，超限返回 429；多副本部署时应迁移到 Redis/网关限流。

## 代码位置

```text
server/src/index.js       Express 应用、认证、资产 API、加密
server/schema.sql         PostgreSQL schema 和安全迁移检查
server/test/api.test.js   Node 原生回归测试（mock pg）
server/package.json       start/test 脚本和生产依赖
docker-compose.yml        PostgreSQL + API 隔离部署
deploy-full.sh            服务器部署、密钥生成和 Nginx 接入
src/main.jsx              前端 API/本地双模式和复制流程
```

## 配置要求

API 启动必须设置：

```bash
DATABASE_URL=postgres://...
JWT_SECRET=<至少 32 个字符的随机值>
ENCRYPTION_KEY=<64 位十六进制字符，256 bit>
CORS_ORIGINS=https://tools.chatcanvas.online,http://localhost:5173
```

`deploy-full.sh` 在服务器首次部署时生成数据库密码、JWT secret 和加密密钥，并只写入服务器 `/var/www/one-for-all-backend/.env`。密钥不能提交到 Git、文档或聊天记录。

## 验证命令

```bash
cd /Users/simon/Desktop/dev/code/one-for-all
npm run build
node --check server/src/index.js
cd server && npm test
```

线上部署事实：

- 前端：`/var/www/one-for-all`
- 后端：`/var/www/one-for-all-backend`
- API 容器仅监听服务器 `127.0.0.1:3001`
- PostgreSQL 使用 Docker volume `one_for_all_pgdata`
- Nginx 将 `/api/` 反向代理到 API
- 域名：<https://tools.chatcanvas.online>

## 已知限制与后续顺序

1. 未登录 localStorage 私密值仍是明文；登录后仅对用户新增或导入的本地资产显示显式迁移向导，内置演示资产不会迁移。
2. 限流目前是单进程内存实现；审计日志已落库，但还没有 retention、告警和密钥轮换策略。生产环境应补数据库备份和告警。
3. 当前模型是单用户资产，没有 `workspace`、成员角色或公开资产目录；团队共享应新增 `workspaces`、`workspace_members`、`visibility`，并将私密绑定按 `asset_id + user_id` 拆表。
4. `/private` 和“复制并注入配置”会在 owner 明确操作时返回/使用明文，这是功能需要；长期生产密钥应改用 Secret Manager 或短期 token。
5. 旧数据库若存在非空 JSONB 明文，schema 会故意失败。迁移流程应为：受控导出 -> 使用当前加密密钥加密导入 -> 轮换旧秘密 -> 再执行 schema。

推荐下一步：补速率限制和审计日志，增加真实 PostgreSQL 集成测试，做本地数据显式迁移向导，再设计 workspace/团队权限和 Secret Manager 接入。
