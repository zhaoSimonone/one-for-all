# One for All - 后端开发交接文档

更新时间：2026-09-07 16:45

## 本次任务目标

将 One for All 从纯前端 localStorage 架构升级为多用户后端架构（Express + PostgreSQL）。

---

## ✅ 已完成的工作

### 1. 后端架构设计与实现

**技术栈选型**（参考 aigc-workbench 项目）：
- 后端框架：Express.js（轻量级，最小依赖）
- 数据库：PostgreSQL 16
- 数据库驱动：原生 `pg`（不使用 ORM）
- 部署方式：Docker Compose

**依赖极简化**：
```json
{
  "bcryptjs": "^2.4.3",      // 密码加密
  "dotenv": "^16.4.7",       // 环境变量
  "express": "^4.21.2",      // Web 框架
  "pg": "^8.13.1"            // PostgreSQL 驱动
}
```

### 2. 数据库设计（方案 A：最小两表）

**users 表**：
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**assets 表**：
```sql
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type_key TEXT NOT NULL CHECK (type_key IN ('credentials', 'infra', 'prompt', 'snippet', 'database', 'component')),
  description TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  shared_content TEXT NOT NULL,
  private_bindings JSONB NOT NULL DEFAULT '{}',
  favorite BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX assets_user_id_idx ON assets(user_id);
CREATE INDEX assets_type_key_idx ON assets(type_key);
CREATE INDEX assets_favorite_idx ON assets(favorite);
CREATE INDEX assets_used_at_idx ON assets(used_at DESC);
CREATE INDEX assets_user_updated_idx ON assets(user_id, updated_at DESC);
```

**设计说明**：
- `private_bindings` 存储为 JSONB（应用层加密）
- 暂缓功能：workspaces、版本历史、审计日志、团队协作
- 文档：`docs/DATABASE.md`

### 3. 后端服务实现

**文件结构**：
```
server/
├── src/
│   └── index.js           # Express 服务（健康检查 + CORS）
├── schema.sql             # 数据库 Schema
├── Dockerfile             # Node.js Alpine 容器
└── package.json           # 依赖配置
```

**API 端点**（当前仅骨架）：
- `GET /health` - 健康检查（含数据库连接测试）
- `GET /api/v1` - API 信息

**CORS 配置**：
- 允许来源：`http://localhost:5173`（开发）、`https://tools.chatcanvas.online`（生产）
- 支持凭证传递

### 4. Docker 部署配置

**docker-compose.yml**：
- `db` 服务：PostgreSQL 16 Alpine，数据持久化到 volume `one_for_all_pgdata`
- `api` 服务：Express 应用，依赖 db 健康检查，端口 `127.0.0.1:3001`（仅本地）
- 网络隔离：独立 Docker 网络 `one_for_all_net`

**环境变量**（`.env.example`）：
```bash
POSTGRES_DB=one_for_all
POSTGRES_USER=one_for_all
POSTGRES_PASSWORD=<需要设置强密码>
```

### 5. 部署脚本与文档

**deploy-full.sh**（自动化部署脚本）：
1. 打包项目文件
2. 上传到服务器 `/var/www/one-for-all-backend`
3. 启动 Docker 容器（PostgreSQL + API）
4. 初始化数据库 Schema
5. 配置 Nginx 反向代理（添加 `/api/` 路由）
6. 验证部署状态

**文档**：
- `docs/DATABASE.md` - 数据库设计详细说明
- `docs/DEPLOYMENT.md` - 手动部署步骤
- `docs/DEPLOY_NOW.md` - 快速部署指南

### 6. 服务器隔离设计

为避免影响现有前端服务，采用完全隔离：

| 资源 | 前端（现有） | 后端（新增） |
|------|-------------|-------------|
| 目录 | `/var/www/one-for-all` | `/var/www/one-for-all-backend` |
| 端口 | 80/443 (Nginx) | 3001 (仅 127.0.0.1) |
| Docker | 无 | 独立网络和 volumes |
| Nginx | 静态文件 + HTTPS | 新增 `/api/` 反向代理 |

### 7. Git 提交记录

```
86d231f - fix: change backend deployment directory to avoid conflict with frontend
cd91364 - docs: add complete deployment script and instructions
09cb18e - feat: add backend with Express + PostgreSQL
```

---

## ❌ 未完成的工作

### 1. 部署执行（阻塞原因：环境限制）

**当前状态**：
- 代码已完成，打包文件已生成
- 部署脚本已准备好
- **但 Claude Code 环境无法执行 SSH 连接**（系统级网络限制）

**需要操作**：
在系统终端执行一条命令即可完成部署：
```bash
/Users/simon/Desktop/dev/code/one-for-all/deploy-full.sh
```

预计耗时：1-2 分钟

### 2. 用户认证 API（未开始）

需要实现：
- `POST /api/v1/auth/register` - 用户注册（email + password）
- `POST /api/v1/auth/login` - 用户登录（返回 JWT token）
- `POST /api/v1/auth/logout` - 用户登出（清除 session）
- `GET /api/v1/auth/me` - 获取当前用户信息

**安全要点**：
- 使用 bcryptjs 加密密码（已安装）
- JWT token 管理
- Session 持久化（可选：存储到数据库或 Redis）

### 3. 资产管理 API（未开始）

需要实现：
- `GET /api/v1/assets` - 获取资产列表（分页、过滤、搜索）
- `POST /api/v1/assets` - 创建资产
- `GET /api/v1/assets/:id` - 获取资产详情
- `PUT /api/v1/assets/:id` - 更新资产
- `DELETE /api/v1/assets/:id` - 删除资产

**查询功能**：
- 按 type_key 过滤
- 按 favorite 过滤
- 按 tags 搜索
- 按 used_at 排序（最近使用）
- 全文搜索（title + description + shared_content）

### 4. 私密配置加密（未开始）

`private_bindings` 字段需要应用层加密：

**推荐方案**：
- 使用环境变量存储加密密钥（`ENCRYPTION_KEY`）
- 采用 AES-256-GCM 加密
- 存储格式：`{ key: encryptedValue }`
- 或接入云 KMS（AWS KMS / Google Cloud KMS）

**Node.js 实现参考**：
```javascript
const crypto = require('crypto');

function encrypt(text, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedData, key) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 5. 前端对接后端（未开始）

需要修改：
- 从 localStorage 切换到 API 调用
- 实现用户登录/注册界面
- JWT token 管理（存储、刷新、过期处理）
- API 请求封装（axios/fetch + 拦截器）
- 错误处理和用户反馈

**数据迁移**：
1. 导出现有 localStorage 数据
2. 用户注册账号
3. 通过 API 导入资产数据

### 6. 认证中间件（未开始）

需要实现 JWT 验证中间件：

```javascript
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// 使用示例
app.get('/api/v1/assets', authenticateToken, async (req, res) => {
  // req.user.id 是当前用户 ID
});
```

### 7. 数据库连接池优化（未开始）

当前使用默认连接池配置，生产环境需要优化：

```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // 最大连接数
  idleTimeoutMillis: 30000,   // 空闲连接超时
  connectionTimeoutMillis: 2000,
});
```

### 8. 错误处理和日志（未开始）

需要添加：
- 统一错误处理中间件
- 结构化日志（推荐 pino 或 winston）
- 请求日志（记录 user_id, method, path, duration）
- 数据库错误分类处理

### 9. 测试（未开始）

需要编写：
- 单元测试（认证逻辑、加密解密）
- 集成测试（API 端到端）
- 数据库迁移测试

### 10. 生产优化（未开始）

- API 速率限制（express-rate-limit）
- 请求体大小限制（防止攻击）
- Helmet.js（安全头）
- 监控和告警（Prometheus / Grafana）
- 数据库备份策略

---

## 🔄 下一步建议执行顺序

### 阶段 1：部署验证（立即）
1. 执行 `deploy-full.sh` 部署后端到服务器
2. 验证 API 健康检查：`curl https://tools.chatcanvas.online/api/health`
3. 检查 Docker 容器运行状态

### 阶段 2：核心 API 开发（优先）
1. 实现用户认证 API（注册、登录）
2. 实现认证中间件
3. 实现资产 CRUD API
4. 添加私密配置加密/解密

### 阶段 3：前端集成（次优先）
1. 创建登录/注册界面
2. API 请求封装和 token 管理
3. 从 localStorage 迁移到 API
4. 数据迁移工具

### 阶段 4：生产就绪（最后）
1. 错误处理和日志
2. 测试覆盖
3. 性能优化
4. 监控和备份

---

## 📋 技术决策记录

### 为什么不用 Prisma/ORM？
- 参考现有项目 `aigc-workbench` 的架构
- 保持依赖最小化
- 性能更好，SQL 更灵活
- 团队熟悉原生 pg

### 为什么不用 Hono/NestJS？
- Express 更成熟稳定
- 团队现有项目都用 Express
- 依赖更少，学习成本低

### 为什么 private_bindings 用 JSONB？
- 简化数据模型（避免单独表）
- 应用层加密足够安全
- 后续可按需拆分到独立表

### 为什么端口只监听 127.0.0.1？
- 安全：API 不直接对外暴露
- 通过 Nginx 反向代理统一入口
- 便于添加 rate limit、缓存等

---

## 🔒 安全注意事项

1. **数据库密码**：部署时会自动生成随机密码，存储在服务器 `/var/www/one-for-all-backend/.env`
2. **JWT Secret**：需要在 `.env` 中设置强随机字符串
3. **私密配置加密密钥**：需要在 `.env` 中设置（256-bit hex）
4. **HTTPS**：已配置 Certbot 自动续期
5. **API 端口**：仅监听 127.0.0.1，不对公网暴露

---

## 📞 故障排查

### 部署失败
```bash
ssh -i /Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem ubuntu@124.223.212.122
cd /var/www/one-for-all-backend
sudo docker-compose logs api
sudo docker-compose logs db
```

### API 无响应
```bash
# 检查容器状态
sudo docker-compose ps

# 测试本地连接
curl http://127.0.0.1:3001/health

# 检查 Nginx 配置
sudo nginx -t
sudo cat /etc/nginx/sites-available/tools.chatcanvas.online | grep -A 10 "location /api/"
```

### 数据库连接失败
```bash
# 进入数据库容器
sudo docker-compose exec db psql -U one_for_all -d one_for_all

# 检查数据库表
\dt
\d users
\d assets
```

---

## 📚 相关文档

- `docs/DATABASE.md` - 数据库设计详细说明
- `docs/DEPLOYMENT.md` - 手动部署步骤
- `docs/DEPLOY_NOW.md` - 快速部署指南
- `docs/HANDOFF.md` - 原项目交接文档（前端 MVP 阶段）

---

## 联系信息

- 服务器 IP: 124.223.212.122
- SSH 用户: ubuntu
- SSH 密钥: /Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem
- 前端目录: /var/www/one-for-all
- 后端目录: /var/www/one-for-all-backend
- 域名: https://tools.chatcanvas.online
