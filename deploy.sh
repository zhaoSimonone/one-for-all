#!/bin/bash
# One for All 部署脚本

SERVER_HOST="124.223.212.122"
SERVER_USER="ubuntu"
SSH_KEY="/Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem"
REMOTE_DIR="/var/www/one-for-all"

echo "开始部署 One for All 后端..."

# 1. 打包项目
echo "1. 打包项目文件..."
tar -czf one-for-all-backend.tar.gz \
  docker-compose.yml \
  .env.example \
  server/

# 2. 上传到服务器
echo "2. 上传到服务器..."
scp -i "$SSH_KEY" one-for-all-backend.tar.gz "$SERVER_USER@$SERVER_HOST:/tmp/"

# 3. 在服务器上部署
echo "3. 在服务器上部署..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
  # 创建项目目录
  sudo mkdir -p /var/www/one-for-all
  cd /var/www/one-for-all

  # 解压
  sudo tar -xzf /tmp/one-for-all-backend.tar.gz
  rm /tmp/one-for-all-backend.tar.gz

  # 检查是否已有 .env
  if [ ! -f .env ]; then
    echo "创建 .env 文件..."
    sudo cp .env.example .env
    echo ""
    echo "警告: 请编辑 /var/www/one-for-all/.env 设置数据库密码"
    echo "  sudo nano /var/www/one-for-all/.env"
    echo ""
  fi

  # 启动服务
  echo "启动 Docker 服务..."
  sudo docker-compose up -d

  # 等待数据库启动
  echo "等待数据库启动..."
  sleep 10

  # 初始化数据库
  echo "初始化数据库..."
  sudo docker-compose exec -T db psql -U one_for_all -d one_for_all < server/schema.sql

  echo "部署完成！"
  echo ""
  echo "检查服务状态："
  sudo docker-compose ps
ENDSSH

# 4. 清理本地临时文件
rm one-for-all-backend.tar.gz

echo ""
echo "部署完成！"
echo "API 地址: http://127.0.0.1:3001"
echo "健康检查: curl http://127.0.0.1:3001/health"
