# 极简减脂热量记录 App

一个移动端优先的 Web App，用来回答三个问题：

- 今天建议吃多少
- 今天已经吃了多少
- 今天还可以吃什么

## 技术栈

- 前端：React + TailwindCSS + Vite
- 后端：Node.js + Express
- 数据库：SQLite（使用 Node 内置 `node:sqlite`）
- 图片识别：支持 OpenAI 视觉识别；未配置 API Key 时进入手动确认模式
- PWA：支持 manifest 和 service worker，可添加到手机桌面

## 安装

当前 Windows PowerShell 可能会拦截 `npm.ps1`，建议使用：

```bash
npm.cmd install
```

如果 npm 官方源连接慢，可以使用：

```bash
npm.cmd install --registry=https://registry.npmmirror.com
```

## 启动开发环境

```bash
npm.cmd run dev
```

默认地址：

- 前端：http://localhost:5173
- 后端：http://localhost:4000

手机访问时，请确保手机和电脑在同一局域网，然后用电脑局域网 IP 访问 Vite 地址，例如：

```text
http://192.168.x.x:5173
```

## 生产构建

```bash
npm.cmd run build
npm.cmd start
```

构建后后端会自动托管 `client/dist`。

## 部署

项目已提供 `Dockerfile`，适合部署到 Render、Railway、Fly.io 或 VPS。

详见 [deploy.md](deploy.md)。

## 主要功能

- 首次进入填写身体数据，自动计算 BMR、TDEE 和推荐减脂热量
- 首页显示今日建议摄入、已摄入、剩余热量
- 拍照/上传食物图片，mock AI 识别食物、重量、热量和三大营养素
- 配置 `OPENAI_API_KEY` 后，拍照会调用 AI 视觉识别食物、重量、热量和三大营养素
- 未配置 `OPENAI_API_KEY` 时，不再随机假识别，默认生成“待确认食物”，用户可快速选择常见食物或手动修改
- 确认记录后自动扣除今日剩余热量
- 根据剩余热量推荐中国常见食物
- 历史记录只显示日期、总热量、是否超标
- 每日体重记录和最近 7 天趋势
- 每天保存体重后，自动用最新体重重新推算维持热量和目标热量
- 首页显示减脂第几天
- 手机本地备份基础资料，云端免费实例数据丢失时会自动恢复基础信息
- 首页显示连续记录热量天数和连续记录体重天数
- 晚上 10 点后接近超标时显示轻提醒
- 每日随机短句，风格克制直接
