#!/bin/bash
# One for All 完整部署脚本
# 请在系统终端中执行此脚本

set -e

SERVER_HOST="124.223.212.122"
SERVER_USER="ubuntu"
SSH_KEY="/Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem"
REMOTE_DIR="/var/www/one-for-all-backend"
FRONTEND_DIR="/var/www/one-for-all"
PROJECT_DIR="/Users/simon/Desktop/dev/code/one-for-all"

echo "=========================================="
echo "One for All 后端部署"
echo "=========================================="
echo ""

# 切换到项目目录
cd "$PROJECT_DIR"

# 1. 打包项目
echo "[1/5] 打包项目文件..."
tar -czf one-for-all-backend.tar.gz \
  docker-compose.yml \
  .env.example \
  server/

echo "✓ 打包完成"
echo ""

# 2. 上传到服务器
echo "[2/5] 上传到服务器..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no \
  one-for-all-backend.tar.gz \
  "$SERVER_USER@$SERVER_HOST:/tmp/"

echo "✓ 上传完成"
echo ""

# 3. 在服务器上部署
echo "[3/5] 部署到服务器..."
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

  # 生成随机密码
  DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
  sudo sed -i "s/your_secure_password_here/$DB_PASSWORD/g" .env

  echo "  ✓ 已生成数据库密码"
else
  echo "  - .env 已存在，跳过"
fi

echo "  - 启动 Docker 服务..."
sudo docker-compose up -d --build

echo "  - 等待数据库就绪..."
sleep 15

echo "  - 初始化数据库..."
sudo docker-compose exec -T db psql -U one_for_all -d one_for_all < server/schema.sql || true

echo "✓ 部署完成"
ENDSSH

echo ""

# 4. 验证部署
echo "[4/5] 验证部署..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
cd /var/www/one-for-all-backend

echo ""
echo "Docker 容器状态："
sudo docker-compose ps

echo ""
echo "API 健康检查："
sleep 2
curl -s http://127.0.0.1:3001/health || echo "API 未就绪，请稍后检查"
ENDSSH

echo ""

# 5. 配置 Nginx
echo "[5/5] 配置 Nginx..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
NGINX_CONF="/etc/nginx/sites-available/tools.chatcanvas.online"

# 检查 Nginx 配置是否已包含 API 路由
if sudo grep -q "location /api/" "$NGINX_CONF"; then
  echo "  - Nginx 已配置 API 路由"
else
  echo "  - 添加 API 路由到 Nginx..."

  # 备份原配置
  sudo cp "$NGINX_CONF" "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"

  # 在 server 块中添加 API 路由（在最后一个 } 之前）
  sudo sed -i '/^}$/i \    # API proxy\n    location /api/ {\n        proxy_pass http://127.0.0.1:3001;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection '"'"'upgrade'"'"';\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_cache_bypass $http_upgrade;\n    }\n' "$NGINX_CONF"

  # 测试配置
  if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "  ✓ Nginx 配置测试通过"
    sudo systemctl reload nginx
    echo "  ✓ Nginx 已重载"
  else
    echo "  ✗ Nginx 配置测试失败，恢复备份"
    sudo cp "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)" "$NGINX_CONF"
    sudo systemctl reload nginx
  fi
fi
ENDSSH

# 6. 清理本地临时文件
rm -f one-for-all-backend.tar.gz

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
