# One for All 部署指南

## 线上拓扑

- 域名：`tools.chatcanvas.online`
- 服务器：`124.223.212.122`，用户 `ubuntu`
- 前端目录：`/var/www/one-for-all`
- 后端目录：`/var/www/one-for-all-backend`
- API：Docker 内部服务映射到服务器 `127.0.0.1:3001`
- PostgreSQL：Docker volume `one_for_all_pgdata`
- Nginx：`/api/` 反向代理到 API，HTTPS 由 Certbot 管理

## 自动部署

在本地项目根目录执行：

```bash
cd /Users/simon/Desktop/dev/code/one-for-all
./deploy-full.sh
```

脚本会先构建前端，再分别上传 `dist/` 和后端文件，启动/重建容器，执行 schema，并在 Nginx 的 HTTPS server 块中添加 `/api/` 代理。首次部署自动生成数据库密码、`JWT_SECRET` 和 `ENCRYPTION_KEY`，只写服务器 `.env`。

重复部署不会覆盖已有 `.env`，也不会重新生成密钥。不要把服务器 `.env`、备份文件或私密资产 JSON 带回仓库。

## 手动操作

```bash
ssh -i /Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem ubuntu@124.223.212.122
cd /var/www/one-for-all-backend
sudo docker-compose up -d --build
sudo docker-compose exec -T db psql -U one_for_all -d one_for_all < server/schema.sql
sudo docker-compose ps
sudo docker-compose logs --tail=100 api
```

如果 `.env` 自定义了 `POSTGRES_USER` 或 `POSTGRES_DB`，初始化命令也必须使用对应值。schema 对旧 JSONB 非空私密数据会主动失败，详见 `docs/DATABASE.md`。

## 验证

```bash
curl -fsS http://127.0.0.1:3001/health
curl -fsS https://tools.chatcanvas.online/api/health
curl -fsS https://tools.chatcanvas.online/api/v1
```

预期健康响应包含 `{"status":"ok"}`。注册、登录和资产隔离回归测试在本地执行：

```bash
cd /Users/simon/Desktop/dev/code/one-for-all/server
npm test
```

## 运维

```bash
cd /var/www/one-for-all-backend
sudo docker-compose ps
sudo docker-compose logs -f api
sudo docker-compose restart api
sudo nginx -t && sudo systemctl reload nginx
```

数据库备份示例（将备份保存到受控目录）：

```bash
sudo docker-compose exec -T db pg_dump -U one_for_all one_for_all > backup-$(date +%Y%m%d).sql
```

当前已具备登录/注册限流和审计日志。生产环境还应补充定期备份验证、审计日志留存/告警、密钥轮换和 Secret Manager。详见 `docs/BACKEND_HANDOFF.md`。
