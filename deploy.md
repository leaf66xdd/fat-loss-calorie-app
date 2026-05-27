# 部署说明

## 推荐方式

使用支持 Docker 和持久化磁盘的云平台，例如 Render、Railway、Fly.io 或自己的 VPS。

这个项目需要：

- Node 24
- 一个长期运行的 Web 服务
- 一个持久化目录：`/app/server/data`
- 环境变量：`DATABASE_PATH=/app/server/data/app.sqlite`

## Docker 本地验证

```bash
docker build -t minimal-fat-loss-app .
docker run -p 4000:4000 -v calorie-data:/app/server/data minimal-fat-loss-app
```

访问：

```text
http://localhost:4000
```

## 云平台配置要点

- Build：使用仓库根目录的 `Dockerfile`
- Port：`4000`
- Persistent disk / volume：挂载到 `/app/server/data`
- Health check：`/api/health`
- Environment variables:
  - `DATABASE_PATH=/app/server/data/app.sqlite`
  - `OPENAI_API_KEY=你的 OpenAI API Key`，可选；配置后启用真实 AI 图片识别
  - `OPENAI_VISION_MODEL=gpt-4.1-mini`，可选；不填时默认使用 `gpt-4.1-mini`

没有持久化磁盘也能启动，但 SQLite 数据会在服务重建后丢失。

## 图片识别说明

当前版本的拍照识别逻辑是：

1. 如果配置了 `OPENAI_API_KEY`，后端会把图片传给 OpenAI Responses API 做视觉识别。
2. 如果未配置 API Key 或 AI 请求失败，系统不会随机猜测食物，而是返回“待确认食物”，让用户用常见食物按钮或手动输入修正。
3. 包装食品的热量仍建议按营养成分表修改，因为图片估算无法保证 100% 准确。
