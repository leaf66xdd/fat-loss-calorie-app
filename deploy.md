# 部署说明

## 推荐方式

使用支持 Docker 和持久化磁盘的云平台，例如 Render、Railway、Fly.io 或自己的 VPS。

这个项目需要：

- Node 24
- 一个长期运行的 Web 服务
- Supabase Postgres 数据库，生产环境不再依赖 Render 本地磁盘

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
- Health check：`/api/health`
- Environment variables:
  - `SUPABASE_DATABASE_URL=你的 Supabase Session pooler 数据库连接串`
  - `APP_USER_ID=default`，可选；个人使用保持默认即可
  - `ARK_API_KEY=你的火山方舟 API Key`，推荐；配置后启用豆包图片识别
  - `ARK_VISION_MODEL=你的豆包视觉模型 ID 或推理接入点 ID`，推荐；例如在火山方舟开通的视觉模型
  - `ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3`，可选；不填时使用默认火山方舟地址
  - `OPENAI_API_KEY=你的 OpenAI API Key`，可选；只作为备用图片识别
  - `OPENAI_VISION_MODEL=gpt-4.1-mini`，可选；不填时默认使用 `gpt-4.1-mini`

没有 `SUPABASE_DATABASE_URL` 时，服务会回退到 SQLite，仅适合本地开发；Render 免费版重建容器时 SQLite 数据仍可能丢失。

## Supabase 配置步骤

1. 打开 Supabase，创建一个新项目。
2. 进入 `Project Settings` -> `Database`。
3. 找到 `Connection string`。
4. 选择 `Session pooler`，复制 URI 连接串。
5. 如果连接串里有 `[YOUR-PASSWORD]`，替换成你创建 Supabase 项目时设置的数据库密码。
6. 回到 Render 服务的 `Environment` 页面，点 `Edit`。
7. 添加：

```text
SUPABASE_DATABASE_URL=postgresql://...
APP_USER_ID=default
```

8. 保留现有豆包变量：

```text
ARK_API_KEY=你的火山方舟 API Key
ARK_VISION_MODEL=你的火山方舟推理接入点 ID
```

9. 点 `Save, rebuild, and deploy`。
10. 部署完成后访问 `/api/health`，如果返回 `storage: "supabase"`，说明已经切到 Supabase。

后端启动时会自动在 Supabase 里创建这些表：

- `profiles`：基础资料、BMR、维持热量、目标热量、开始日期
- `daily_targets`：按日期保存每天的 BMR、维持热量和目标热量
- `meal_entries`：每日食物记录、热量、蛋白质、碳水、脂肪
- `weight_entries`：每日体重记录

所有查询都会按 `APP_USER_ID` 和日期分类。当前 App 是个人工具，不做登录系统；如果以后要多人使用，再加 Supabase Auth。

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
