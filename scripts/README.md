# 服务器启动脚本说明

## 问题说明

如果遇到 `EADDRINUSE: address already in use :::3001` 错误，说明端口 3001 已被占用。

## 解决方案

### 方法1：使用安全启动脚本（推荐）

```bash
npm run server:safe
```

这个脚本会：
1. 自动检查并关闭占用端口 3001 的进程
2. 等待端口释放
3. 启动服务器

### 方法2：手动关闭端口

```bash
npm run kill-port
```

这会关闭所有占用端口 3001 的进程。

### 方法3：手动查找并关闭

```powershell
# 1. 查找占用端口的进程
netstat -ano | findstr :3001

# 2. 关闭进程（替换 <PID> 为实际的进程ID）
taskkill /PID <PID> /F
```

## 脚本文件

- `scripts/kill-port.ps1` - 关闭指定端口的进程
- `scripts/start-server.ps1` - 安全启动服务器（自动清理端口）

## 注意事项

- 如果使用 `npm run server:safe`，每次启动前都会自动清理端口
- 如果使用 `npm run server`，遇到端口占用时需要手动运行 `npm run kill-port`


