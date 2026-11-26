import { defineConfig } from 'vite'

// 部署平台会注入 PORT 环境变量，服务必须监听该端口才能被反向代理访问；
// 本地未设置 PORT 时沿用 Vite 默认端口（dev 5173 / preview 4173）。
const deployPort = process.env.PORT ? Number(process.env.PORT) : undefined

export default defineConfig({
  // 相对资源路径，保证部署到任意子路径下都能正确加载 assets
  base: './',
  server: { host: '0.0.0.0', port: deployPort, strictPort: true, allowedHosts: true },
  preview: { host: '0.0.0.0', port: deployPort, strictPort: true, allowedHosts: true },
})
