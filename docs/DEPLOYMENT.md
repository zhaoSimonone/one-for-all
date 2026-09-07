# One for All 部署指南

## 服务器信息

- 服务器 IP: `124.223.212.122`
- SSH 用户: `ubuntu`
- SSH 密钥: `/Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem`
- 部署目录: `/var/www/one-for-all`
- API 端口: `3001` (仅监听 127.0.0.1)

## 快速部署

### 方式一：使用部署脚本（推荐）

```bash
cd /Users/simon/Desktop/dev/code/one-for-all
./deploy.sh
```

### 方式二：手动部署

#### 1. 打包项目

```bash
cd /Users/simon/Desktop/dev/code/one-for-all
tar -czf one-for-all-backend.tar.gz docker-compose.yml .env.example server/
```

#### 2. 上传到服务器

```bash
scp -i /Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem \
  one-for-all-backend.tar.gz \
  ubuntu@124.223.212.122:/tmp/
```

#### 3. SSH 登录服务器

```bash
ssh -i /Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem ubuntu@124.223.212.122
```

#### 4. 在服务器上执行

```bash
# 创建目录
sudo mkdir -p /var/www/one-for-all
cd /var/www/one-for-all

# 解压
sudo tar -xzf /tmp/one-for-all-backend.tar.gz

# 配置环境变量
sudo cp .env.example .env
sudo nano .env  # 设置安全的数据库密码

# 启动服务
sudo docker-compose up -d

# 等待数据库启动
sleep 10

# 初始化数据库
sudo docker-compose exec -T db psql -U one_for_all -d one_for_all < server/schema.sql

# 查看服务状态
sudo docker-compose ps
sudo docker-compose logs api
```

## 配置 Nginx 反向代理

在服务器上编辑 Nginx 配置：

```bash
sudo nano /etc/nginx/sites-available/tools.chatcanvas.online
```

添加 API 路由：

```nginx
# 在现有 server 块中添加
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 验证部署

### 本地测试（服务器上）

```bash
curl http://127.0.0.1:3001/health
```

### 远程测试

```bash
curl https://tools.chatcanvas.online/api/health
```

## 管理命令

### 查看日志

```bash
cd /var/www/one-for-all
sudo docker-compose logs -f api
sudo docker-compose logs -f db
```

### 重启服务

```bash
cd /var/www/one-for-all
sudo docker-compose restart api
```

### 停止服务

```bash
cd /var/www/one-for-all
sudo docker-compose down
```

### 更新代码

```bash
# 本地打包新代码
cd /Users/simon/Desktop/dev/code/one-for-all
tar -czf one-for-all-backend.tar.gz docker-compose.yml server/

# 上传
scp -i /Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem \
  one-for-all-backend.tar.gz \
  ubuntu@124.223.212.122:/tmp/

# 服务器上更新
ssh -i /Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem ubuntu@124.223.212.122
cd /var/www/one-for-all
sudo tar -xzf /tmp/one-for-all-backend.tar.gz
sudo docker-compose up -d --build
```

## 数据库管理

### 连接数据库

```bash
cd /var/www/one-for-all
sudo docker-compose exec db psql -U one_for_all -d one_for_all
```

### 备份数据库

```bash
cd /var/www/one-for-all
sudo docker-compose exec db pg_dump -U one_for_all one_for_all > backup-$(date +%Y%m%d).sql
```

### 恢复数据库

```bash
cd /var/www/one-for-all
sudo docker-compose exec -T db psql -U one_for_all -d one_for_all < backup.sql
```

## 架构说明

### 技术栈
- **后端**: Express.js (Node.js)
- **数据库**: PostgreSQL 16
- **部署**: Docker Compose
- **反向代理**: Nginx

### 端口说明
- API: `127.0.0.1:3001` (仅本地访问)
- 数据库: 仅 Docker 内网访问，不对外暴露

### 数据持久化
- 数据库数据存储在 Docker volume: `one_for_all_pgdata`
- 即使容器删除，数据仍然保留

## 安全注意事项

1. **数据库密码**: 必须在 `.env` 中设置强密码
2. **API 端口**: 只监听 `127.0.0.1`，不直接对外暴露
3. **通过 Nginx 访问**: 所有外部请求通过 Nginx 反向代理
4. **HTTPS**: 已配置 Certbot 自动续期

## 故障排查

### API 无法启动

```bash
sudo docker-compose logs api
```

### 数据库连接失败

```bash
# 检查数据库是否运行
sudo docker-compose ps

# 检查数据库日志
sudo docker-compose logs db

# 检查网络
sudo docker network ls | grep one_for_all
```

### 端口冲突

```bash
# 检查端口占用
sudo netstat -tlnp | grep 3001

# 如需更改端口，编辑 docker-compose.yml
sudo nano docker-compose.yml
```
