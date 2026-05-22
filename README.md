# Momentum Daily Background

[English](#english) | [中文](#中文)

---

## English

Fetch [Momentum](https://momentumdash.com/) browser extension's daily high-resolution background images. Supports both local extraction and cloud API.

### Overview

Momentum is a browser new tab extension that displays a beautiful landscape photo each day. This project provides two ways to fetch these images:

- **Local script** (`fetch-daily.js`) — Extract today's image from Chrome local cache
- **Cloud function** (`index.js`) — Deploy to Alibaba Cloud ESA EdgeRoutine, fetch via API with multiple output formats

### Project Structure

```
├── index.js          # Alibaba Cloud ESA EdgeRoutine entry (cloud)
├── fetch-daily.js    # Local Node.js script (local extraction)
├── package.json
└── README.md
```

### Option 1: Local Script

#### Prerequisites

- [Momentum](https://chrome.google.com/webstore/detail/laookkfknpbbblfpciffpaejjkokdgca) extension installed
- Used Momentum for some time (cache contains image data)
- Node.js environment

#### Usage

```bash
npm run fetch
```

The script extracts the latest Momentum background image from Chrome's Service Worker cache and saves it to the `output/` directory.

#### Extraction Logic

1. **Primary**: Scan Chrome Service Worker cache for the latest cached JPEG image
2. **Fallback**: Select from Momentum extension's 24 built-in images based on daily rotation

### Option 2: Cloud Function (Alibaba Cloud ESA EdgeRoutine)

#### Deployment

Deploy the content of `index.js` to Alibaba Cloud ESA EdgeRoutine.

#### Access Formats

Supports 4 access modes after deployment:

| URL Parameter | Content-Type | Description |
|--------------|-------------|-------------|
| `/` | `text/html` | HTML page, displays image directly in browser |
| `?format=url` | `text/plain` | Plain text image URL |
| `?format=json` | `application/json` | JSON data (includes title, source, etc.) |
| `?format=image` | `image/*` | Image binary stream (proxy) |

#### Usage Examples

**Get image URL (for website integration)**

```javascript
const res = await fetch('https://your-domain/?format=url');
const imageUrl = await res.text();
document.querySelector('img').src = imageUrl;
```

**Get JSON data**

```bash
curl https://your-domain/?format=json
```

Response example:

```json
{
  "url": "https://momentum.photos/img/xxx.jpg",
  "title": "Mountain Sunrise",
  "source": "John Doe",
  "sourceUrl": "https://unsplash.com/...",
  "uuid": "3596af9e-4d1f-492d-a95e-2e8ddc0e3af5"
}
```

#### API Fallback Mechanism

The cloud function attempts to fetch the image in the following order:

1. `GET /feed/bulk` — Momentum main API
2. `GET /backgrounds/history` — History API
3. CDN path probing (`momentum.photos/img/`, `images/`, `backgrounds/`)
4. Hardcoded fallback image

#### CORS Support

All responses include `Access-Control-Allow-Origin: *`, allowing direct cross-origin calls from frontend.

### License

MIT

---

## 中文

获取 [Momentum](https://momentumdash.com/) 浏览器扩展的每日高清背景图片，支持本地提取和云端 API 两种方式。

### 项目简介

Momentum 是一个浏览器新标签页扩展，每天展示一张精美的风景图片。本项目提供两种方式获取这些图片：

- **本地脚本** (`fetch-daily.js`) — 从 Chrome 本地缓存中提取今日图片
- **云端函数** (`index.js`) — 部署到阿里云 ESA EdgeRoutine，通过 API 获取图片并提供多种访问格式

### 文件结构

```
├── index.js          # 阿里云 ESA EdgeRoutine 入口（云端）
├── fetch-daily.js    # 本地 Node.js 脚本（本地提取）
├── package.json
└── README.md
```

### 方式一：本地脚本

#### 前置条件

- 已安装 [Momentum](https://chrome.google.com/webstore/detail/laookkfknpbbblfpciffpaejjkokdgca) 浏览器扩展
- 使用过一段时间 Momentum（缓存中有图片数据）
- Node.js 环境

#### 使用方法

```bash
npm run fetch
```

脚本会从 Chrome 的 Service Worker 缓存中提取最新的 Momentum 背景图片，保存到 `output/` 目录。

#### 提取逻辑

1. **优先**：扫描 Chrome Service Worker 缓存，提取最新缓存的 JPEG 图片
2. **回退**：从 Momentum 扩展本地安装目录的 24 张内置图片中，按日期轮询选择

### 方式二：云端函数（阿里云 ESA EdgeRoutine）

#### 部署

将 `index.js` 的内容部署到阿里云 ESA EdgeRoutine。

#### 访问格式

部署后支持 4 种访问方式：

| URL 参数 | Content-Type | 说明 |
|---------|-------------|------|
| `/` | `text/html` | HTML 页面，浏览器直接展示图片 |
| `?format=url` | `text/plain` | 纯文本图片链接 |
| `?format=json` | `application/json` | JSON 数据（含标题、来源等） |
| `?format=image` | `image/*` | 图片二进制流（代理转发） |

#### 使用示例

**获取图片链接（供网站调用）**

```javascript
const res = await fetch('https://your-domain/?format=url');
const imageUrl = await res.text();
document.querySelector('img').src = imageUrl;
```

**获取 JSON 数据**

```bash
curl https://your-domain/?format=json
```

返回示例：

```json
{
  "url": "https://momentum.photos/img/xxx.jpg",
  "title": "Mountain Sunrise",
  "source": "John Doe",
  "sourceUrl": "https://unsplash.com/...",
  "uuid": "3596af9e-4d1f-492d-a95e-2e8ddc0e3af5"
}
```

#### API 回退机制

云端函数按以下顺序尝试获取图片：

1. `GET /feed/bulk` — Momentum 主 API
2. `GET /backgrounds/history` — 历史记录 API
3. CDN 路径探测（`momentum.photos/img/`、`images/`、`backgrounds/`）
4. 硬编码 fallback 图片

#### 跨域支持

所有响应均包含 `Access-Control-Allow-Origin: *`，可直接在前端跨域调用。

### 开源协议

MIT
