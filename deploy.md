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
  - `ARK_API_KEY=你的火山方舟 API Key`，推荐；配置后启用豆包图片识别
  - `ARK_VISION_MODEL=你的豆包视觉模型 ID 或推理接入点 ID`，推荐；例如在火山方舟开通的视觉模型
  - `ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3`，可选；不填时使用默认火山方舟地址
  - `OPENAI_API_KEY=你的 OpenAI API Key`，可选；只作为备用图片识别
  - `OPENAI_VISION_MODEL=gpt-4.1-mini`，可选；不填时默认使用 `gpt-4.1-mini`

没有持久化磁盘也能启动，但 SQLite 数据会在服务重建后丢失。

## 图片识别说明

当前版本的拍照识别逻辑是：

1. 如果配置了 `ARK_API_KEY` 和 `ARK_VISION_MODEL`，后端会优先把图片传给豆包/火山方舟视觉模型做识别。
2. 如果豆包未配置或调用失败，再尝试 `OPENAI_API_KEY`。
3. 如果没有可用 AI Key 或 AI 请求失败，系统不会随机猜测食物，而是返回“待确认食物”，让用户用常见食物按钮或手动输入修正。
4. 包装食品的热量仍建议按营养成分表修改，因为图片估算无法保证 100% 准确。

## Render 上配置豆包

进入 Render 服务的 `Environment` 页面，点 `Edit`，添加：

```text
ARK_API_KEY=你的火山方舟 API Key
ARK_VISION_MODEL=你的豆包视觉模型 ID 或推理接入点 ID
```

保存后 Render 会重新部署。部署完成后，App 拍照页面会显示“已接入豆包视觉识别”。
