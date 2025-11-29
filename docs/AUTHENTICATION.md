# JWT 认证系统文档

## 概述

本项目实现了基于 JWT (JSON Web Token) 的登录验证系统。所有需要授权的 API 路由都受到保护，只有通过身份验证的用户才能访问。

## 默认账号

- **用户名**: `admin`
- **密码**: `admin123`

⚠️ **重要**: 在生产环境中，请务必修改默认密码！

## 配置

### 环境变量

在项目根目录创建 `.env` 文件，添加以下配置：

```env
# JWT Secret Key (必需)
# 在生产环境中，请使用强随机字符串
# 生成方式: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### 修改默认密码

1. 使用 Node.js 生成新的密码哈希：
   ```bash
   node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your-new-password', 10));"
   ```

2. 将生成的哈希值更新到 `server/routes/auth.ts` 文件中的 `users` 数组。

## 后端实现

### 文件结构

- `server/routes/auth.ts` - 认证路由（登录、验证）
- `server/middleware/auth.ts` - JWT 验证中间件

### API 端点

#### POST /api/auth/login

用户登录接口。

**请求体**:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**成功响应** (200):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

**失败响应** (401):
```json
{
  "success": false,
  "error": "Invalid username or password"
}
```

#### POST /api/auth/verify

验证当前 token 是否有效。

**请求头**:
```
Authorization: Bearer <token>
```

**成功响应** (200):
```json
{
  "valid": true,
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

### 受保护的路由

以下路由需要有效的 JWT token：

- `/api/transactions/*`
- `/api/users/*`
- `/api/settlements/*`
- `/api/api-configs/*`
- `/api/wallet-configs/*`
- `/api/wallets/*`
- `/api/external/*`
- `/api/dev/*`
- `/api/share-logs/*`

**请求格式**:
```
Authorization: Bearer <your-jwt-token>
```

**未授权响应** (401/403):
```json
{
  "error": "Unauthorized",
  "message": "No token provided. Please login first."
}
```

## 前端实现

### 文件结构

- `components/LoginPage.tsx` - 登录页面组件
- `utils/auth.ts` - 认证工具函数

### 认证流程

1. **登录**:
   - 用户输入用户名和密码
   - 前端发送 POST 请求到 `/api/auth/login`
   - 成功后，将 token 和用户信息存储到 `localStorage`

2. **Token 存储**:
   - Token 存储在 `localStorage` 的 `authToken` 键中
   - 用户信息存储在 `localStorage` 的 `user` 键中

3. **API 请求**:
   - 所有受保护的 API 请求自动在 `Authorization` 头中添加 token
   - 使用 `authenticatedFetch` 函数代替普通的 `fetch`

4. **Token 验证**:
   - 应用启动时自动验证 token 有效性
   - Token 过期后自动跳转到登录页面

5. **登出**:
   - 清除 `localStorage` 中的 token 和用户信息
   - 重置应用状态

### 使用示例

```typescript
import { authenticatedFetch, getToken, clearAuth } from './utils/auth';

// 发起认证请求
const response = await authenticatedFetch('/api/transactions', {
  method: 'GET'
});

// 获取当前 token
const token = getToken();

// 登出
clearAuth();
```

## 安全性

### JWT 配置

- **算法**: HS256 (HMAC SHA-256)
- **过期时间**: 1 小时
- **Secret Key**: 从环境变量 `JWT_SECRET` 读取

### 安全最佳实践

1. **密码加密**: 使用 bcrypt 加密存储密码（cost factor: 10）
2. **Token 过期**: Token 设置 1 小时过期时间，过期后需要重新登录
3. **HTTPS**: 在生产环境中必须使用 HTTPS 传输
4. **Secret Key**: 使用强随机字符串作为 JWT secret
5. **XSS 防护**: Token 存储在 `localStorage`，注意防范 XSS 攻击
6. **CSRF 防护**: 使用 SameSite cookie 属性（如果使用 cookie）

### 密码哈希生成

```bash
# 使用 Node.js
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your-password', 10));"

# 或使用在线工具（不推荐用于生产环境）
```

## 错误处理

### 常见错误

1. **401 Unauthorized**: Token 缺失或无效
   - 解决方案: 重新登录

2. **403 Forbidden**: Token 已过期
   - 解决方案: 重新登录

3. **500 Internal Server Error**: 服务器内部错误
   - 检查后端日志
   - 确认 JWT_SECRET 已正确配置

## 测试

### 测试登录

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 测试受保护的路由

```bash
# 1. 先登录获取 token
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

# 2. 使用 token 访问受保护的路由
curl http://localhost:3001/api/transactions \
  -H "Authorization: Bearer $TOKEN"
```

## 故障排除

### Token 验证失败

1. 检查 `.env` 文件中的 `JWT_SECRET` 是否配置
2. 确认前后端使用相同的 secret key
3. 检查 token 是否过期（1 小时后）

### 登录失败

1. 确认用户名和密码正确（默认: admin / admin123）
2. 检查后端服务是否正常运行
3. 查看后端日志获取详细错误信息

### 前端无法访问 API

1. 确认已成功登录
2. 检查 `localStorage` 中是否有 `authToken`
3. 查看浏览器控制台的网络请求，确认 `Authorization` 头已添加

## 生产环境部署

### 必须修改的配置

1. **JWT_SECRET**: 使用强随机字符串
   ```bash
   openssl rand -base64 32
   ```

2. **默认密码**: 修改 `server/routes/auth.ts` 中的密码哈希

3. **HTTPS**: 确保使用 HTTPS 传输

4. **环境变量**: 不要在代码中硬编码敏感信息

### 安全检查清单

- [ ] 修改默认密码
- [ ] 设置强 JWT_SECRET
- [ ] 启用 HTTPS
- [ ] 配置 CORS 白名单
- [ ] 设置合理的 token 过期时间
- [ ] 启用日志记录
- [ ] 定期审查访问日志

## 相关文件

- `server/routes/auth.ts` - 认证路由
- `server/middleware/auth.ts` - JWT 验证中间件
- `components/LoginPage.tsx` - 登录页面
- `utils/auth.ts` - 前端认证工具
- `App.tsx` - 主应用组件（包含认证逻辑）


