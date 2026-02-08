# API 文档（概要）

后端 API 统一以 `/api` 为前缀。除登录接口外，所有接口都需要携带：
- `Authorization: Bearer <token>`

## 1. 认证

### 1.1 登录
POST `/api/auth/login`

Body：
```json
{ "password": "你的 ADMIN_PASSWORD" }
```

Response：
```json
{ "token": "<jwt>" }
```

## 2. 系统设置

### 2.1 获取设置
GET `/api/settings`

Response：
```json
{
  "autoDownloadAttachmentsFromNewLinks": false,
  "attachmentDateAfter": "",
  "attachmentLogLevel": "info",
  "maxNewLinksPerCheck": 20
}
```

### 2.2 更新设置（可部分更新）
PUT `/api/settings`

Body：
```json
{
  "autoDownloadAttachmentsFromNewLinks": true,
  "attachmentDateAfter": "2026-01-01",
  "attachmentLogLevel": "debug",
  "maxNewLinksPerCheck": 20
}
```

## 3. 任务（监控项）

### 3.1 创建任务
POST `/api/monitors`

Body（常用字段示例，实际可按前端表单提交）：
```json
{
  "name": "示例任务",
  "url": "https://example.com/list",
  "selectorType": "css",
  "selector": "#content",
  "frequency": "*/30 * * * *",
  "status": "active",
  "saveHtml": true,
  "trackLinks": false,
  "linkScopeSelector": "",
  "matchType": "none",
  "matchPattern": "",
  "matchIgnoreCase": true,
  "downloadAttachments": false,
  "downloadAttachmentsFromNewLinks": false,
  "attachmentTypes": "pdf,doc,docx,xls,xlsx,zip,rar"
}
```

### 3.2 任务列表
GET `/api/monitors`

### 3.3 获取任务详情
GET `/api/monitors/:id`

### 3.4 更新任务
PUT `/api/monitors/:id`

### 3.5 删除任务
DELETE `/api/monitors/:id`

### 3.6 手动触发一次检查
POST `/api/monitors/:id/check`

Response：
```json
{ "message": "Check triggered successfully" }
```

## 4. 历史记录与统计

### 4.1 查看某任务历史记录
GET `/api/monitors/:id/history`

### 4.2 Dashboard 统计
GET `/api/dashboard/stats`

## 5. 附件下载列表（聚合）

### 5.1 下载列表
GET `/api/dashboard/downloads`

Query：
- `q`：文件名关键字
- `monitorId`：任务 id
- `ext`：后缀（不含点）
- `limit`：最大 200

Response（items 字段示例）：
```json
{
  "items": [
    {
      "monitorId": 1,
      "monitorName": "xxx",
      "monitorUrl": "https://example.com/list",
      "changeHistoryId": 123,
      "checkTime": "2026-02-06T00:00:00.000Z",
      "fileName": "a.pdf",
      "storedPath": "monitor_1_...._a.pdf",
      "size": 12345,
      "sourceLink": "https://example.com/article/1",
      "sourceTitle": "文章标题",
      "downloadUrl": "/api/storage/downloads/monitor_1_...._a.pdf"
    }
  ]
}
```

## 6. 链接监控（用于“新增链接触发”）

### 6.1 获取已发现链接
GET `/api/monitors/:id/links`

说明：返回该任务已发现的链接集合（用于识别新增链接）。

### 6.2 链接日志
GET `/api/monitors/:id/link-logs`

Query：
- `limit`：默认 200，最大 500
- `minLevel`：`error|warn|info|debug`

## 7. 附件监控与日志

### 7.1 获取已发现/跟踪的附件
GET `/api/monitors/:id/attachments`

### 7.2 附件日志
GET `/api/monitors/:id/attachment-logs`

Query：
- `limit`：默认 200，最大 500
- `minLevel`：`error|warn|info|debug`（返回该级别及更严重级别）
- `attachmentId`：仅看某一个附件的日志

## 8. 静态文件访问

说明：以下路径均为后端静态目录映射（见后端 `storage/`）。
- `/api/storage/downloads/<filename>`：下载已落盘的附件
- `/api/storage/screenshots/<filename>`：查看截图
- `/api/storage/archives/<filename>`：查看 HTML 快照（已注入 base href，快照内相对链接可跳原站）
