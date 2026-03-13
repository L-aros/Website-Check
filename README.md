# Website Check

Website Check 是一个面向网页内容巡检的全栈项目，提供从“定时抓取、内容比对、链接追踪、附件下载、历史留痕、通知告警”到“前端管理界面”的完整闭环。

项目由 React 前端和 Express + Sequelize 后端组成，支持：
- 页面正文监控
- XPath / CSS 选择器监控
- 页面链接集合变化监控
- 新链接页面附件发现与下载
- 截图与 HTML 快照留档
- 历史记录查询
- 邮件、短信、飞书通知
- 基于 Cookie 的后台登录会话

## 适用场景

- 招生简章、政策公告、通知栏变更监控
- 招投标、采购、公示页更新监控
- 文档下载页、附件列表页跟踪
- 新闻列表页新增文章发现
- 需要保留“截图 + 快照 + 附件”证据链的内部巡检场景

## 核心能力

### 1. 页面内容监控
- 支持使用 CSS Selector 或 XPath 提取目标区域
- 对提取文本计算摘要并建立基线
- 发生变化时记录历史并触发通知

### 2. 链接集合监控
- 可监控一个列表区域中的链接集合变化
- 记录新增链接
- 可将“新增链接”作为附件发现入口

### 3. 附件发现与下载
- 支持在当前页直接发现附件链接
- 支持进入新增链接页面进一步扫描附件
- 对附件文件名、扩展名和落盘名做统一安全处理
- 保留短时下载令牌 `/d/:token`

### 4. 变更留痕
- 自动保存截图
- 可选保存 HTML 快照
- 历史记录中可查看变更摘要、截图、快照、附件

### 5. 安全预览
- HTML 快照不再以公开静态文件暴露
- 快照在后端净化后返回
- 前端通过沙箱 iframe 在应用内预览

### 6. 会话与权限
- 登录改为 `HttpOnly` Cookie 会话
- 前端不再依赖 `localStorage token`
- 新增会话查询与登出接口

## 架构概览

### 前端
- React 18
- Vite
- Ant Design
- React Router
- i18next
- axios

### 后端
- Node.js 20.17+
- Express
- Sequelize
- SQLite / MySQL
- Puppeteer
- node-cron

### 存储内容
- 数据库存储监控配置、历史记录、附件记录、通知日志
- 文件系统存储截图、HTML 快照、已下载附件

## 最近的安全与行为变更

当前版本已经完成一轮针对认证、文件暴露、输入校验和调度的安全收敛：

- 登录态改为 `HttpOnly` Cookie
- 新增 `GET /api/auth/session`
- 新增 `POST /api/auth/logout`
- 登录接口增加限流
- `JWT_SECRET` 与 `ADMIN_PASSWORD` 在所有环境都必须配置
- 原 `/api/storage/screenshots/*` 与 `/api/storage/archives/*` 公开访问已移除
- 截图与快照改为绑定监控历史记录的鉴权接口
- 快照内容经过服务端净化
- 监控创建/更新使用字段白名单
- 删除监控会联动清理关联数据库记录与落盘文件
- 调度器新增去重，避免同一监控重复入队

详细说明见：
- [API 文档](docs/api.md)
- [部署文档](docs/deploy.md)
- [安全更新说明](docs/security-update.md)

## 运行要求

- Node.js `>= 20.17.0`
- npm
- Windows / Linux / macOS 均可
- 需要一个可供 Puppeteer 使用的浏览器

本地开发建议：
- Windows: 安装 Chrome 或 Edge
- Linux: 安装 Chromium
- Docker: 容器内已预装 Chromium

## 本地快速开始

### 1. 配置后端环境变量

从 [backend/.env.example](backend/.env.example) 复制出 `backend/.env`，至少配置以下项目：

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=replace-with-long-random-secret
ADMIN_PASSWORD=replace-with-admin-password

DB_DIALECT=sqlite
DB_STORAGE=./data/website_check.sqlite

CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
```

如需使用 MySQL，可改为：

```env
DB_DIALECT=mysql
DB_HOST=127.0.0.1
DB_NAME=website_check
DB_USER=root
DB_PASS=your-password
```

### 2. 启动后端

```bash
cd backend
npm install
npm start
```

默认监听：
- `http://127.0.0.1:3000`

### 3. 启动前端开发环境

```bash
cd frontend
npm install
npm run dev
```

默认监听：
- `http://localhost:5173`

### 4. 启动前端预览模式

```bash
cd frontend
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

预览地址：
- `http://127.0.0.1:4173`

## 默认本地运行方式

当前仓库更适合以下本地组合：
- 后端运行在 `3000`
- 前端开发模式运行在 `5173`
- 前端预览模式运行在 `4173`

Vite 已配置代理：
- `/api` -> `http://127.0.0.1:3000`
- `/d` -> `http://127.0.0.1:3000`

## 登录方式

当前版本使用 Cookie 会话：

- 登录接口：`POST /api/auth/login`
- 会话接口：`GET /api/auth/session`
- 登出接口：`POST /api/auth/logout`

登录成功后服务端会写入：
- `HttpOnly`
- `SameSite=Lax`
- `Path=/`
- `7d`
- 生产环境额外启用 `Secure`

前端无需自己保存 token。

## 数据与文件目录

后端运行时会使用：

- `backend/storage/screenshots`
- `backend/storage/archives`
- `backend/storage/downloads`

SQLite 模式下数据库通常位于：
- `backend/data/*.sqlite`

## 典型使用流程

1. 登录后台
2. 新建监控任务
3. 填写 URL、选择器类型、选择器、频率
4. 按需开启：
   - 保存 HTML 快照
   - 跟踪链接变化
   - 自动下载附件
   - 从新增链接中继续查找附件
5. 保存后手动触发一次检查建立基线
6. 在历史页查看截图、快照、附件与变更记录

## 监控配置建议

### 对公告列表页
- `selectorType`: `xpath` 或 `css`
- 开启 `trackLinks`
- 列表区域尽量缩小，避免抓整页导航链接

### 对单一正文页
- 直接监控正文区域
- 可不开启 `trackLinks`

### 对附件型页面
- 开启 `downloadAttachments`
- 配置明确的 `attachmentTypes`

### 对“文章页里才有附件”的列表页
- 开启 `trackLinks`
- 开启 `downloadAttachmentsFromNewLinks`
- 配合系统设置中的 `maxNewLinksPerCheck`

## 项目结构

```text
Website-Check/
├─ backend/                  # Express + Sequelize + Puppeteer 后端
│  ├─ config/                # DB / env 配置
│  ├─ controllers/           # 路由控制器
│  ├─ models/                # Sequelize 模型
│  ├─ routes/                # API 路由
│  ├─ services/              # 检测、调度、通知、清理等核心逻辑
│  ├─ storage/               # 截图 / 快照 / 下载文件
│  └─ utils/                 # 安全、日志、下载令牌等工具
├─ frontend/                 # React 管理界面
│  ├─ src/auth/              # 会话上下文
│  ├─ src/components/        # 通用组件
│  ├─ src/layouts/           # 页面布局
│  ├─ src/lib/               # API 封装
│  └─ src/pages/             # 页面
├─ docs/                     # API / 部署 / 安全文档
├─ Dockerfile                # 单镜像构建
└─ docker-compose.yml        # 一键容器启动
```

## 构建

### 前端

```bash
cd frontend
npm run build
```

### 后端

后端是直接运行型项目，没有单独的打包产物：

```bash
cd backend
npm start
```

## Docker

仓库已提供单镜像 Docker 构建：
- [Dockerfile](Dockerfile)
- [docker-compose.yml](docker-compose.yml)

容器内默认：
- 前端构建产物由后端统一提供
- 使用 SQLite
- 使用 `/usr/bin/chromium`

如果后续部署到有 Docker 的环境，可直接基于这套文件进行一键启动。

### GitHub 自动构建与发布

仓库已提供 GitHub Actions 工作流：
- [docker-publish.yml](.github/workflows/docker-publish.yml)

触发条件：
- 推送到 `main`
- 推送 `v*` 标签
- 手动触发 `workflow_dispatch`

发布目标：
- `ghcr.io/l-aros/website-check`

常用镜像标签：
- `ghcr.io/l-aros/website-check:latest`
- `ghcr.io/l-aros/website-check:main`
- `ghcr.io/l-aros/website-check:sha-<commit>`
- `ghcr.io/l-aros/website-check:vX.Y.Z`

首次使用时，如果需要公开拉取，请在 GitHub 包页面把镜像可见性调整为 public。

## 常见问题

### 1. 登录成功，但监控接口失败
- 检查 `JWT_SECRET` 和 `ADMIN_PASSWORD` 是否正确配置
- 检查数据库是否初始化成功
- 当前版本在数据库初始化失败时会直接拒绝启动，而不是半可用状态

### 2. 检测长时间没有结果
- 检查目标站点是否可访问
- 检查浏览器是否可用
- 对链接追踪型任务，首次基线或新链接扫描会明显更慢
- XPath / CSS 作用域写得太大时，会拖慢链接提取和附件扫描

### 3. 看不到快照预览
- 需要先有历史记录
- 快照只通过鉴权接口返回
- 预览在前端沙箱 iframe 中打开，不再直接暴露原始 HTML 文件

### 4. 附件没下载下来
- 检查 `attachmentTypes`
- 检查目标链接最终响应的文件类型
- 检查该附件是否位于当前页还是新增文章页

## 文档入口

- [API 文档](docs/api.md)
- [部署文档](docs/deploy.md)
- [安全更新说明](docs/security-update.md)

## 许可证

项目当前未单独声明开源许可证。如需公开发布，建议补充 `LICENSE` 文件。
