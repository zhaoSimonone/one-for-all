# 远程服务器与站点（共享模板）

> 本文件只包含**可共享**信息。密码与私钥内容**不写在这里**，统一放在项目根目录的 `.env.local`（已被 `.gitignore` 忽略，不提交 Git）。
> 引用方式：`${SSH_PASSWORD}` / `${SSH_PRIVATE_KEY}`。

## 共享模板

### 腾讯云上海服务器（SSH 与站点）

- 主机：`124.223.212.122`（腾讯云，上海）
- 用户：`ubuntu`
- 密码：见私密绑定 `${SSH_PASSWORD}`
- 私钥：见私密绑定 `${SSH_PRIVATE_KEY}`（本机副本 `/Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem`，RSA 2048）

### 连接方式

```bash
# 密钥认证（推荐，部署脚本使用的方式）
ssh -i "$SSH_PRIVATE_KEY_PATH" ubuntu@124.223.212.122

# 密码认证（需要 sshpass 或 expect）
ssh ubuntu@124.223.212.122
```

### 该服务器托管的网站

| 站点 | 域名 | 部署方式 |
|---|---|---|
| one-for-all 资产库（本项目） | https://tools.chatcanvas.online/ | 静态前端 `/var/www/one-for-all` + Docker 后端 `/var/www/one-for-all-backend` |
| ChatCanvas | https://canvas.chatcanvas.online/ | Nginx 站点（`/etc/nginx/sites-enabled/chatcanvas-canvas`），API 由 `chatcanvas-api-canvas.service` 托管 |
| AIGC 书架 | https://aigc.chatcanvas.online/ | Docker Compose `/opt/aigc-shelf` |
| Money Adventure | https://money.chatcanvas.online/ | systemd 托管的 Node 服务 `127.0.0.1:3460`（Nginx 默认站点） |

### 运维备注

- 后端 API 端口仅监听 `127.0.0.1:3001`，由 Nginx 反向代理；部署入口为仓库根目录的 `deploy-full.sh`。
- 数据库为 PostgreSQL 容器，密钥与加密用 AES 密钥只存放在服务器 `.env`（不提交 Git）。
- 部署前建议先确认工作区没有其他会话的未提交改动，`deploy-full.sh` 会直接从工作区构建。

---

## 私密绑定（仅本地，不提交 Git）

放在项目根目录 **`.env.local`**（`.gitignore` 第 5 行已覆盖）：

| 变量 | 说明 |
|---|---|
| `SSH_PASSWORD` | 服务器登录密码 |
| `SSH_PRIVATE_KEY` | 完整 PEM 私钥（多行，dotenv 双引号包裹） |
| `SSH_PRIVATE_KEY_PATH` | 本机私钥副本路径 |

可选覆盖（当前不在 `.env.local` 中，脚本使用内置默认值）：`SSH_HOST`、`SSH_USER`。

`deploy-full.sh` 的私钥来源优先级：

1. `.env.local` 的 `SSH_PRIVATE_KEY`（内嵌私钥，落成权限 600 的临时文件，用完自动删除）
2. `.env.local` 的 `SSH_PRIVATE_KEY_PATH`
3. 内置默认路径 `/Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem`

> 注意：`.env.example` 在服务器上被用作 `.env` 的初始模板，**不要**把 SSH 相关变量写进 `.env.example`，否则会随部署下发到服务器。
> `deploy-full.sh` 只按需解析 `SSH_*` 键，不 `source` 整个 `.env.local`，避免执行其中内容。

---

## 安装依赖

### 本地（macOS）

```bash
# 必需：系统自带
ssh -V        # OpenSSH 客户端
node -v       # 需要 Node.js 18+（当前 v22.22.1）
npm -v

# 项目依赖
cd /Users/simon/Desktop/dev/code/one-for-all
npm install          # 安装前端依赖（node_modules/）
cd server && npm install && cd ..   # 安装后端依赖（server/node_modules/）

# 可选：密码认证用
brew install sshpass
# 或直接用系统自带 expect（macOS 自带）
```

### 服务器侧

部署脚本依赖服务器已具备（当前已就绪）：

- `docker` + `docker-compose`（v1，脚本用 `docker-compose` 而非 `docker compose`）
- `nginx`（含 `/etc/nginx/sites-available/tools.chatcanvas.online`）
- `openssl`、`curl`、`tar`、`sudo` 免密
- PostgreSQL 以 Docker 容器运行，不需本地安装

---

## 验证方式

### 第 0 层：本地配置（不联网）

```bash
cd /Users/simon/Desktop/dev/code/one-for-all
./deploy-full.sh preflight
```

预检会检查私钥是否存在且权限为 600、本地工具链、`node_modules` 是否就绪、SSH 密钥登录是否可用，并列出工作区未提交改动。**只读，不触碰线上。**

### 第 1 层：SSH 连通性

```bash
ssh -i /Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem \
    -o StrictHostKeyChecking=accept-new ubuntu@124.223.212.122 'hostname; uptime'
```

### 第 2 层：服务器服务状态

```bash
ssh -i /Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem ubuntu@124.223.212.122 '
  sudo docker ps --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"
  systemctl is-active money-adventure.service chatcanvas-api-canvas.service
  sudo ss -ltnp | grep -E "3001|3460|18080"
'
```

期望看到：`one-for-all-backend-api-1`（Up，`127.0.0.1:3001`）、`one-for-all-backend-db-1`（healthy）、`aigc-shelf-api-1`（`127.0.0.1:18080`）、`money-adventure.service` 与 `chatcanvas-api-canvas.service` 均为 `active`。

### 第 3 层：线上站点

```bash
# 本项目 API 健康检查
curl -fsS https://tools.chatcanvas.online/api/health

# 各站点首页 HTTP 状态
for d in tools canvas aigc money; do
  printf "%-8s %s\n" "$d" "$(curl -s -o /dev/null -w '%{http_code}' https://$d.chatcanvas.online/)"
done
```

### 第 4 层：部署后验证

`deploy-full.sh` 自带 `[5/6] 验证部署` 步骤，会在服务器上执行 `docker-compose ps` 与 `curl http://127.0.0.1:3001/health`，随后由 `[6/6]` 校验 Nginx 配置并 reload。
