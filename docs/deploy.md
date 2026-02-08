# 部署指南（生产环境）

本项目推荐以“后端 API + 前端静态站点 + MySQL”方式部署。你可以将前后端部署在同一台服务器，也可以拆分部署（前端走 Nginx，后端单独监听端口）。

## 1. 前置要求
- Node.js 18+（建议 20+）
- MySQL 8.x（或兼容版本）
- Puppeteer 运行环境（需要可执行的 Chromium）

Linux 常见依赖（按发行版略有差异）：
- `libnss3`、`libatk-bridge2.0-0`、`libgtk-3-0`、`libgbm1`、`fonts-liberation` 等

## 2. 生产环境配置（backend/.env）

生产环境必须配置以下变量（缺失会拒绝启动）：
- `NODE_ENV=production`
- `PORT=3000`
- `ADMIN_PASSWORD=...`
- `JWT_SECRET=...`（务必随机且保密）

数据库（两种模式二选一）：
- MySQL（默认）：
  - `DB_DIALECT=mysql`
  - `DB_HOST=...`
  - `DB_NAME=...`
  - `DB_USER=...`
  - `DB_PASS=...`
- SQLite（单机部署/轻量部署）：
  - `DB_DIALECT=sqlite`
  - `DB_STORAGE=./data/website_check.sqlite`
  - 说明：SQLite 不适合多实例同时写入；建议只跑一个后端实例。

可选稳定性配置：
- `MAX_CONCURRENT_CHECKS=2`（全局并发执行检查上限）

数据库表同步策略（生产建议保持默认，不要自动改表结构）：
- 默认：`sequelize.sync()`（不会自动 alter 表结构）
- 开发/测试如需自动对齐：`DB_SYNC_ALTER=true`（仅非生产环境生效）

## 3. 部署后端

### 3.1 安装依赖并启动
```bash
cd backend
npm ci
npm start
```

启动后默认监听：
- `http://127.0.0.1:3000`

### 3.2 进程守护（推荐）
任选一种方式即可：
- Linux：systemd / pm2
- Windows：NSSM / pm2-windows-service

## 4. 部署前端（静态资源）

### 4.1 构建
```bash
cd frontend
npm ci
npm run build
```

构建产物在 `frontend/dist/`，使用 Nginx 或任意静态文件服务器托管即可。

### 4.2 Nginx 同域反向代理示例（推荐）
同域的好处是前端请求 `/api/...` 无需额外跨域配置。

```nginx
server {
  listen 80;
  server_name your-domain.com;

  root /var/www/website-check/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

如果要开启 HTTPS，请在 Nginx 层接入证书（例如使用 Certbot/ACME），与前端无关。

## 5. 数据与文件存储
- 数据库：MySQL（监控任务、历史记录、附件/链接状态、日志等）
- 文件：后端 `backend/storage/` 目录
  - `storage/downloads/`：已下载附件
  - `storage/screenshots/`：截图
  - `storage/archives/`：HTML 快照

建议将 `backend/storage/` 做定期备份（尤其是 downloads 与 archives）。

## 6. 常见问题排查
- 前端报 `ECONNREFUSED /api/...`：后端未启动或端口/防火墙不通；检查后端是否监听 3000。
- 登录失败：确认 `ADMIN_PASSWORD` 正确配置；生产环境必须配置 `JWT_SECRET`。
- 无法抓取页面：目标站点可能有验证码/强反爬/需要登录；同时确认服务器网络可访问目标站点。
- Puppeteer 启动失败：Linux 缺依赖的概率最高，按错误提示补齐系统依赖。
- 检查堆积/卡顿：降低任务频率，或调小 `MAX_CONCURRENT_CHECKS`，避免同一时间触发过多任务。
