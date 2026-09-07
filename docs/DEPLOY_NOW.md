# One for All 部署说明

## 当前状态

由于系统安全策略限制，Claude Code 环境无法直接执行 SSH 连接。

## 部署方法

### 方法一：在系统终端执行（推荐）

打开 macOS 终端（Terminal.app），执行：

```bash
cd /Users/simon/Desktop/dev/code/one-for-all
./deploy-full.sh
```

这个脚本会自动完成：
1. 打包项目文件
2. 上传到服务器
3. 部署 Docker 容器
4. 初始化数据库
5. 配置 Nginx 反向代理
6. 验证部署状态

### 方法二：分步手动执行

如果自动脚本遇到问题，可以按照 `docs/DEPLOYMENT.md` 中的步骤手动执行。

## 已完成的准备工作

✅ 后端代码（Express + PostgreSQL）
✅ Docker Compose 配置
✅ 数据库 Schema（users + assets 两表）
✅ 部署脚本
✅ 详细文档

## 部署后验证

部署成功后，访问以下地址验证：

1. **API 健康检查**
   ```bash
   curl https://tools.chatcanvas.online/api/health
   ```
   
   预期响应：
   ```json
   {"status":"ok","timestamp":"2026-09-07T..."}
   ```

2. **前端页面**
   浏览器打开：https://tools.chatcanvas.online/

## 后续开发任务

部署完成后，下一步需要：

1. **实现用户认证 API**
   - POST /api/v1/auth/register - 用户注册
   - POST /api/v1/auth/login - 用户登录
   - POST /api/v1/auth/logout - 用户登出
   - GET /api/v1/auth/me - 获取当前用户信息

2. **实现资产管理 API**
   - GET /api/v1/assets - 获取资产列表
   - POST /api/v1/assets - 创建资产
   - GET /api/v1/assets/:id - 获取资产详情
   - PUT /api/v1/assets/:id - 更新资产
   - DELETE /api/v1/assets/:id - 删除资产

3. **前端对接后端**
   - 从 localStorage 迁移到 API
   - 实现用户登录界面
   - 添加 JWT token 管理

4. **数据迁移**
   - 导出现有 localStorage 数据
   - 导入到数据库

## 技术架构

- **前端**: React + Vite（静态文件，Nginx 服务）
- **后端**: Express.js（Docker 容器，端口 3001）
- **数据库**: PostgreSQL 16（Docker 容器）
- **反向代理**: Nginx（HTTPS，Certbot 证书）

## 目录结构

```
/var/www/one-for-all/          # 服务器部署目录
├── docker-compose.yml         # 容器编排
├── .env                       # 环境变量（含数据库密码）
└── server/
    ├── src/index.js          # Express 服务
    ├── schema.sql            # 数据库 Schema
    ├── Dockerfile
    └── package.json

/var/www/one-for-all-frontend/ # 前端静态文件（已存在）
└── dist/                     # Vite 构建产物
```

## 端口分配

- **3001**: API 服务（仅本地访问）
- **80/443**: Nginx（对外访问）
- **5432**: PostgreSQL（仅 Docker 内网）

## 故障排查

如果部署遇到问题，SSH 到服务器检查：

```bash
ssh -i /Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem ubuntu@124.223.212.122

# 查看容器状态
cd /var/www/one-for-all
sudo docker-compose ps

# 查看日志
sudo docker-compose logs api
sudo docker-compose logs db

# 测试 API
curl http://127.0.0.1:3001/health
```

## 联系信息

- 服务器 IP: 124.223.212.122
- SSH 用户: ubuntu
- SSH 密钥: /Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem
