#!/bin/bash
# One for All 完整部署脚本
# 请在系统终端中执行此脚本

set -euo pipefail

SERVER_HOST="124.223.212.122"
SERVER_USER="ubuntu"
SSH_KEY="/Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem"
PROJECT_DIR="/Users/simon/Desktop/dev/code/one-for-all"

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
echo "  查看日志: ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST 'cd /var/www/one-for-all-backend && sudo docker-compose logs -f api'"
echo "  重启服务: ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST 'cd /var/www/one-for-all-backend && sudo docker-compose restart api'"
echo ""
