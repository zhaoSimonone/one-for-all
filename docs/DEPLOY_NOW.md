# One for All 快速部署

前端和后端的全量部署脚本已经准备完成。在 macOS 系统终端执行：

```bash
cd /Users/simon/Desktop/dev/code/one-for-all
./deploy-full.sh
```

脚本目标服务器为 `124.223.212.122`，SSH 密钥从仓库外的本地目录读取。首次运行会在 `/var/www/one-for-all-backend/.env` 生成并保存数据库密码、JWT 密钥和 AES 加密密钥；之后重复部署会保留已有密钥。

部署后验证：

```bash
curl -fsS https://tools.chatcanvas.online/api/health
curl -fsS https://tools.chatcanvas.online/api/v1
```

前端地址：<https://tools.chatcanvas.online>

常用排查：

```bash
ssh -i /Users/simon/Desktop/dev/cloud/tencent/lhkp-pdok1duo.pem ubuntu@124.223.212.122
cd /var/www/one-for-all-backend
sudo docker-compose ps
sudo docker-compose logs --tail=100 api
sudo nginx -t
```

schema、密钥和旧数据迁移规则见 `docs/DATABASE.md`；完整 API、隐私边界和后续工作见 `docs/BACKEND_HANDOFF.md`。
