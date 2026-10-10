# One for All 数据库设计

当前 schema 在 `server/schema.sql`，数据库为 PostgreSQL 16，使用 Docker volume `one_for_all_pgdata` 持久化。

## 表结构

### users

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键，数据库生成 |
| `email` | TEXT | 唯一、登录邮箱 |
| `name` | TEXT | 显示名称 |
| `password_hash` | TEXT | bcrypt 哈希，不保存明文密码 |
| `avatar_url` | TEXT | 可空 |
| `created_at` / `updated_at` | TIMESTAMPTZ | 创建和更新时间 |

### assets

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `user_id` | UUID | `users.id` 外键，删除用户时级联删除 |
| `title` / `description` | TEXT | 资产名称和描述 |
| `type_key` | TEXT | `credentials`、`infra`、`prompt`、`snippet`、`database`、`component` |
| `tags` | JSONB | 字符串数组 |
| `shared_content` | TEXT | 可分享模板，使用 `{{ENV_NAME}}` 占位符 |
| `private_bindings` | TEXT | AES-256-GCM 密文，不是 JSONB |
| `favorite` | BOOLEAN | 收藏状态 |
| `used_at` | TIMESTAMPTZ，可空 | 最近一次实际复制/使用时间；未使用资产为 `NULL` |
| `created_at` / `updated_at` | TIMESTAMPTZ | 创建和更新时间 |

`private_bindings` 的密文格式为：

```text
base64url(iv).base64url(auth_tag).base64url(ciphertext)
```

应用层使用 `ENCRYPTION_KEY`（32 bytes、64 位十六进制字符）加解密。数据库、日志和普通 API 响应都不应出现私密明文。

### audit_logs

审计表保存安全相关事件：`actor_user_id`、`action`、可选 `asset_id`、来源 IP、JSON 元数据和时间。元数据只允许计数、类型等非敏感信息，禁止写入密码、Token 或私密绑定值。后续应增加按时间清理和异常访问告警。

## 隔离规则

- 所有资产读写 SQL 都带 `user_id = 当前登录用户`。
- 资产不存在和跨用户访问统一返回 404。
- 普通列表/详情只返回私密变量名及长度。
- `/api/v1/assets/:id/private` 仅 owner 可读写，并设置 `Cache-Control: no-store`。
- 未登录 localStorage 模式不写数据库；其中私密值是浏览器明文，仅适合本机临时使用。

## 迁移注意事项

早期 skeleton 曾将 `private_bindings` 建成 JSONB。当前 schema 会检查该旧列：

- 只有空对象 `{}` 才会安全转换为空字符串；
- 只要存在非空 JSONB，就主动抛错，防止把明文秘密 cast 成 TEXT 后继续运行。

旧数据迁移必须走受控流程：导出旧数据 -> 在应用层用当前密钥加密 -> 导入密文 -> 轮换旧秘密。不要直接执行 `ALTER COLUMN ... TYPE TEXT`。

## 索引

已创建 `user_id`、`type_key`、`favorite`、`used_at` 和 `(user_id, updated_at)` 索引，覆盖用户列表、筛选和最近更新排序。

## 后续扩展

团队共享阶段再增加：

- `workspaces`、`workspace_members` 和资产 `visibility`；
- 独立的 `asset_private_bindings(asset_id, user_id, encrypted_value)`；
- `asset_versions`、`audit_logs`；
- KMS/Secret Manager 的 envelope encryption、密钥轮换和备份恢复。
