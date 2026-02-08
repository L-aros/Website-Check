# 网站监控系统

这是一个“网页内容变化监控 + 附件自动发现/下载”的小型系统：后端负责抓取、对比、记录历史与通知；前端提供任务管理、历史查看、下载管理与设置中心。

## 主要能力
- 监控页面变化：支持 CSS 选择器或 XPath
- 监控“页面链接集合”变化：识别新增链接（适合新闻/公告列表页）
- 新增链接触发：发现新增文章后进入文章页查找附件并下载
- 附件下载管理：下载列表、来源文章跳转、按任务/关键字/后缀筛选
- 历史追踪：截图、HTML 快照、变更记录
- 通知：邮件、飞书（Webhook）、短信（按项目配置）

## 技术栈
- 后端：Node.js + Express + Sequelize(MySQL) + Puppeteer + node-cron
- 前端：React + Vite + Ant Design + axios + react-router + i18next

## 环境要求
- Node.js 18+（建议 20+）
- MySQL 8.x（或兼容版本）
- 能运行 Chromium 的环境（Puppeteer 需要；Linux 可能需要额外系统依赖）

## 目录结构
```
Website-Check/
├── backend/            # 后端 API（抓取/对比/通知）
├── frontend/           # 前端管理界面
└── docs/               # 文档（配置、部署、API、使用指南）
```

## 快速开始（本地开发）

### 1) 准备数据库
创建数据库：
```sql
CREATE DATABASE website_check;
```

### 2) 启动后端
在 `backend/.env` 配置数据库与登录信息（开发环境可按需配置，生产环境必须配置的项见 docs）：
- `ADMIN_PASSWORD`：管理端登录密码
- `JWT_SECRET`：JWT 签名密钥
- `DB_HOST`、`DB_NAME`、`DB_USER`、`DB_PASS`

启动：
```bash
cd backend
npm install
npm start
```

后端默认监听：`http://127.0.0.1:3000`

### 3) 启动前端
```bash
cd frontend
npm install
npm run dev
```

前端默认监听：`http://localhost:5173`（端口占用会自动尝试下一个）

## 使用流程（概览）
- 登录：使用 `ADMIN_PASSWORD`
- 新建任务：填写 URL、选择 CSS/XPath、设置频率（cron）
- 如需“新增链接触发下载附件”：
  - 系统设置开启“新增链接时自动查找并下载附件”
  - 任务高级选项开启“监控页面链接变化”与“新增链接时查找并下载附件”
  - 配置允许的附件后缀（如 `pdf,docx,xlsx,zip`）
- 查看结果：
  - 历史记录：截图、快照、附件列表
  - 已下载附件：可查看附件来源文章并一键跳转

## 文档
- 配置说明： [config.md](docs/config.md)
- 部署指南： [deploy.md](docs/deploy.md)
- API 概要： [api.md](docs/api.md)
- 用户指南： [user-guide.md](docs/user-guide.md)
