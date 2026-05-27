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

没有持久化磁盘也能启动，但 SQLite 数据会在服务重建后丢失。
