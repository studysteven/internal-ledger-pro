# Backend Server

这是一个简单的 Express 后端服务，用于管理 API 配置和钱包配置。

## 启动方式

### 单独启动后端
```bash
npm run server
```

### 开发模式（自动重启）
```bash
npm run server:dev
```

### 同时启动前端和后端
```bash
npm run dev:all
```

## API 接口

### API 配置接口

- `GET /api/api-configs` - 获取所有 API 配置
- `POST /api/api-configs` - 创建或更新 API 配置
- `PUT /api/api-configs/:id` - 更新指定 ID 的 API 配置
- `DELETE /api/api-configs/:id` - 删除指定 ID 的 API 配置

### 钱包配置接口

- `GET /api/wallet-configs` - 获取所有钱包配置
- `POST /api/wallet-configs` - 创建或更新钱包配置
- `PUT /api/wallet-configs/:id` - 更新指定 ID 的钱包配置
- `DELETE /api/wallet-configs/:id` - 删除指定 ID 的钱包配置

## 数据存储

配置数据存储在 `server/data/` 目录下的 JSON 文件中：
- `api-configs.json` - API 配置
- `wallet-configs.json` - 钱包配置

## 端口

后端服务默认运行在 `http://localhost:3001`

前端通过 Vite 代理访问后端，无需直接指定端口。


