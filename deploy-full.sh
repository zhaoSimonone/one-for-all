#!/bin/bash
# One for All 完整部署脚本
# 请在系统终端中执行此脚本

set -euo pipefail

PROJECT_DIR="/Users/simon/Desktop/dev/code/one-for-all"
ENV_FILE="$PROJECT_DIR/.env.local"

# 从 .env.local 读取私密绑定（该文件已被 .gitignore 忽略，不会提交）。
# 只解析需要的键，不 source 整个文件，避免误执行其中内容。
read_env_value() {
  local key="$1"
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^${key}=\(.*\)\$/\1/p" "$ENV_FILE" | head -n 1 | sed 's/^"\(.*\)"$/\1/'
}

# 读取多行值（dotenv 双引号包裹的 PEM 私钥）。
read_env_multiline() {
  local key="$1"
  [ -f "$ENV_FILE" ] || return 0
  awk -v k="$key" '
    index($0, k "=") == 1 {
      line = substr($0, index($0, "=") + 1)
      if (line ~ /^"/) {
        sub(/^"/, "", line)
        print line
        while ((getline l) > 0) {
          if (l ~ /"$/) { sub(/"$/, "", l); print l; exit }
          print l
        }
      } else {
        print line
      }
      exit
    }
  ' "$ENV_FILE"
}

# 非机密默认值写在这里（可提交 Git），机密值从 .env.local 覆盖。
SERVER_HOST="$(read_env_value SSH_HOST)"
[ -n "$SERVER_HOST" ] || SERVER_HOST="124.223.212.122"

SERVER_USER="$(read_env_value SSH_USER)"
[ -n "$SERVER_USER" ] || SERVER_USER="ubuntu"

# 私钥来源优先级：.env.local 内嵌私钥 > .env.local 私钥副本路径 > 内置默认路径
TMP_KEY_FILE=""
cleanup() {
  [ -n "$TMP_KEY_FILE" ] && [ -f "$TMP_KEY_FILE" ] && rm -f "$TMP_KEY_FILE"
  return 0
}
trap cleanup EXIT

SSH_KEY_INLINE="$(read_env_multiline SSH_PRIVATE_KEY)"
SSH_KEY_PATH="$(read_env_value SSH_PRIVATE_KEY_PATH)"

SSH_KEY=""
SSH_KEY_SOURCE=""
if [ -n "$SSH_KEY_INLINE" ]; then
  TMP_KEY_FILE="$(mktemp -t ofa_ssh_key.XXXXXX)"
  chmod 600 "$TMP_KEY_FILE"
  printf '%s\n' "$SSH_KEY_INLINE" > "$TMP_KEY_FILE"
  SSH_KEY="$TMP_KEY_FILE"
  SSH_KEY_SOURCE="内嵌私钥（.env.local SSH_PRIVATE_KEY，临时文件权限 600）"
elif [ -n "$SSH_KEY_PATH" ]; then
  SSH_KEY="$SSH_KEY_PATH"
  SSH_KEY_SOURCE="私钥副本（.env.local SSH_PRIVATE_KEY_PATH）"
else
  SSH_KEY="/Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem"
  SSH_KEY_SOURCE="私钥副本（内置默认路径）"
fi

# 供脚本尾部提示使用：内嵌私钥是临时文件，退出即删，提示里改为说明来源。
SSH_KEY_DISPLAY="$SSH_KEY"
if [ -n "$TMP_KEY_FILE" ]; then
  SSH_KEY_DISPLAY="<.env.local 内嵌私钥>"
fi

# 预检：只做检查，不构建、不上传、不改动线上。
run_preflight() {
  echo "=========================================="
  echo "部署预检（只读，不改动线上）"
  echo "=========================================="
  echo "目标: $SERVER_USER@$SERVER_HOST"
  echo ""

  echo "[1/4] 私钥来源: $SSH_KEY_SOURCE"
  if [ ! -f "$SSH_KEY" ]; then
    echo "  ✗ 不存在: $SSH_KEY"
    echo "    可在 .env.local 设置 SSH_PRIVATE_KEY / SSH_PRIVATE_KEY_PATH，或使用 SSH_PASSWORD + sshpass/expect"
    return 1
  fi
  local perm
  if stat -c '%a' "$SSH_KEY" >/dev/null 2>&1; then
    perm="$(stat -c '%a' "$SSH_KEY")"
  else
    perm="$(stat -f '%Lp' "$SSH_KEY")"
  fi
  if [ "$perm" != "600" ]; then
    echo "权限 $perm 过宽，正在修正为 600"
    chmod 600 "$SSH_KEY"
  else
    echo "✓ 存在且权限 600"
  fi

  echo -n "[2/4] 本地工具链 "
  local missing=0
  for cmd in node npm ssh scp tar; do
    command -v "$cmd" >/dev/null 2>&1 || { echo "✗ 缺少 $cmd"; missing=1; }
  done
  [ "$missing" -eq 0 ] || return 1
  echo "✓ node $(node -v) / npm $(npm -v) / ssh $(ssh -V 2>&1 | awk '{print $2}')"

  echo -n "[3/4] 本地依赖 "
  if [ -d "$PROJECT_DIR/node_modules" ]; then
    echo "✓ node_modules 已就绪"
  else
    echo "! node_modules 缺失，请先执行: cd $PROJECT_DIR && npm install"
  fi

  echo -n "[4/4] SSH 连通性 "
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o BatchMode=yes \
      "$SERVER_USER@$SERVER_HOST" 'echo OK' >/dev/null 2>&1; then
    echo "✓ 密钥登录正常"
  else
    echo "✗ 密钥登录失败"
    return 1
  fi

  if [ -d "$PROJECT_DIR/.git" ]; then
    local changed
    changed="$(cd "$PROJECT_DIR" && git status --porcelain)"
    if [ -n "$changed" ]; then
      echo ""
      echo "! 工作区存在未提交改动，deploy-full.sh 会直接从工作区构建："
      echo "$changed" | head -20
    else
      echo ""
      echo "✓ 工作区干净"
    fi
  fi

  echo ""
  echo "预检通过，可以执行: ./deploy-full.sh"
}

if [ "${1:-}" = "preflight" ]; then
  cd "$PROJECT_DIR"
  run_preflight
  exit $?
fi

echo "=========================================="
echo "One for All 后端部署"
echo "=========================================="
echo ""

# 切换到项目目录
cd "$PROJECT_DIR"

# 1. 打包项目
echo "[1/6] 构建前端并打包项目文件..."
npm run build
tar -czf one-for-all-backend.tar.gz \
  --exclude='server/node_modules' \
  docker-compose.yml \
  .env.example \
  server/
tar -czf one-for-all-frontend.tar.gz -C dist .

echo "✓ 打包完成"
echo ""

# 2. 上传到服务器
echo "[2/6] 上传到服务器..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no \
  one-for-all-backend.tar.gz one-for-all-frontend.tar.gz \
  "$SERVER_USER@$SERVER_HOST:/tmp/"

echo "✓ 上传完成"
echo ""

# 3. 在服务器上部署
echo "[3/6] 部署到服务器..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
set -e

echo "  - 创建后端目录..."
sudo mkdir -p /var/www/one-for-all-backend
cd /var/www/one-for-all-backend

echo "  - 解压文件..."
sudo tar -xzf /tmp/one-for-all-backend.tar.gz
sudo rm /tmp/one-for-all-backend.tar.gz

# 检查是否已有 .env
if [ ! -f .env ]; then
  echo "  - 创建 .env 配置..."
  sudo cp .env.example .env

  # 生成数据库、JWT 和字段加密密钥。密钥只写入服务器 .env，不回显。
  DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
  sudo sed -i "s/your_secure_password_here/$DB_PASSWORD/g" .env
  JWT_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-64)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  sudo sed -i "s#replace-with-at-least-32-random-characters#$JWT_SECRET#" .env
  sudo sed -i "s#replace-with-64-lowercase-hex-characters#$ENCRYPTION_KEY#" .env

  echo "  ✓ 已生成数据库和应用密钥"
else
  echo "  - .env 已存在，跳过"
fi

echo "  - 启动 Docker 服务..."
sudo docker-compose up -d --build

echo "  - 等待数据库就绪..."
sleep 15

echo "  - 初始化数据库..."
POSTGRES_USER=$(sudo grep '^POSTGRES_USER=' .env | cut -d= -f2-)
POSTGRES_DB=$(sudo grep '^POSTGRES_DB=' .env | cut -d= -f2-)
sudo docker-compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < server/schema.sql

echo "✓ 部署完成"
ENDSSH

echo ""

# 4. 发布前端静态文件
echo "[4/6] 发布前端静态文件..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
set -e
sudo mkdir -p /var/www/one-for-all
sudo tar -xzf /tmp/one-for-all-frontend.tar.gz -C /var/www/one-for-all
sudo rm /tmp/one-for-all-frontend.tar.gz
echo "✓ 前端发布完成"
ENDSSH

echo ""

# 5. 验证部署
echo "[5/6] 验证部署..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
set -e
cd /var/www/one-for-all-backend

echo ""
echo "Docker 容器状态："
sudo docker-compose ps

echo ""
echo "API 健康检查："
sleep 2
curl -fsS http://127.0.0.1:3001/health
ENDSSH

echo ""

# 6. 配置 Nginx
echo "[6/6] 配置 Nginx..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
set -e -o pipefail
NGINX_CONF="/etc/nginx/sites-available/tools.chatcanvas.online"

# 检查 Nginx 配置是否已包含 API 路由
if sudo grep -q "location /api/" "$NGINX_CONF"; then
  echo "  - Nginx 已配置 API 路由"
else
  echo "  - 添加 API 路由到 Nginx..."

  # 备份原配置，并保留确切路径以便失败时恢复。
  BACKUP_CONF="$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"
  sudo cp "$NGINX_CONF" "$BACKUP_CONF"

  # 插入到 HTTPS server 块的 server_name 后面。按行匹配最后一个 `}`
  # 会把 location 插入嵌套块，导致 Nginx 配置损坏。
  sudo awk '
    BEGIN { inserted = 0; seen_https = 0 }
    /listen[[:space:]]+443/ { seen_https = 1 }
    !inserted && seen_https && /server_name[[:space:]]+tools[.]chatcanvas[.]online[;]/ {
      print
      print "    # API proxy"
      print "    location /api/ {"
      print "        proxy_pass http://127.0.0.1:3001;"
      print "        proxy_http_version 1.1;"
      print "        proxy_set_header Host $host;"
      print "        proxy_set_header X-Real-IP $remote_addr;"
      print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
      print "        proxy_set_header X-Forwarded-Proto $scheme;"
      print "    }"
      inserted = 1
      next
    }
    { print }
    END { if (!inserted) exit 1 }
  ' "$NGINX_CONF" | sudo tee "$NGINX_CONF.tmp" >/dev/null
  sudo mv "$NGINX_CONF.tmp" "$NGINX_CONF"

  # 测试配置
  if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "  ✓ Nginx 配置测试通过"
    sudo systemctl reload nginx
    echo "  ✓ Nginx 已重载"
  else
    echo "  ✗ Nginx 配置测试失败，恢复备份"
    sudo cp "$BACKUP_CONF" "$NGINX_CONF"
    sudo systemctl reload nginx
  fi
fi
ENDSSH

# 6. 清理本地临时文件
rm -f one-for-all-backend.tar.gz one-for-all-frontend.tar.gz

echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo ""
echo "访问地址："
echo "  - API 健康检查: https://tools.chatcanvas.online/api/health"
echo "  - 前端页面: https://tools.chatcanvas.online/"
echo ""
echo "管理命令："
echo "  查看日志: ssh -i $SSH_KEY_DISPLAY $SERVER_USER@$SERVER_HOST 'cd /var/www/one-for-all-backend && sudo docker-compose logs -f api'"
echo "  重启服务: ssh -i $SSH_KEY_DISPLAY $SERVER_USER@$SERVER_HOST 'cd /var/www/one-for-all-backend && sudo docker-compose restart api'"
echo ""
