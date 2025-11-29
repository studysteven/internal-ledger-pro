import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,  // Vite default port, matches frontend access
        host: '0.0.0.0',
        // Proxy configuration: Forward all /api/* requests to backend server
        // This allows frontend to call /api/... without CORS issues
        // Backend runs on http://localhost:3001
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
            // Handle connection errors gracefully when backend is not running
            configure: (proxy, options) => {
              proxy.on('error', (err, req, res) => {
                console.error('Proxy error - Backend server may not be running:', err.message);
                if (!res.headersSent) {
                  res.writeHead(503, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ 
                    error: 'Backend server is not running', 
                    message: 'Please start the backend server with: npm run server:dev' 
                  }));
                }
              });
            },
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
