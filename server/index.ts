/**
 * Backend Server Entry Point
 * 
 * This file sets up an Express server that provides REST API endpoints
 * for the internal-ledger-pro frontend application.
 * 
 * Features:
 * - Express server with TypeScript support
 * - CORS enabled for frontend communication
 * - JSON body parsing
 * - Health check endpoint
 * - API configuration and wallet configuration management
 * - External transaction fetching
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
// This allows the backend to read TRON_API_BASE_URL and TRON_API_KEY
dotenv.config({ path: resolve(process.cwd(), '.env') });

// Import route handlers
import authRouter from './routes/auth.js';
import transactionsRouter from './routes/transactions.js';
import usersRouter from './routes/users.js';
import settlementsRouter from './routes/settlements.js';
import configsRouter from './routes/configs.js';
import walletsRouter from './routes/wallets.js';
import externalRouter from './routes/external.js';
import devRouter from './routes/dev.js';
import sharesRouter from './routes/shares.js';
import shareLogsRouter from './routes/shareLogs.js';
import { walletConfigStore, ensureDefaultWalletConfigs, ensureDefaultApiConfigs, ensureDefaultUsers } from './models/store.js';
import { syncWalletById } from './services/walletMonitor.js';
import { authenticateToken } from './middleware/auth.js';

// Get __dirname equivalent for ES modules (needed for ESM imports)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// ========== Middleware Configuration ==========
// CORS configuration: Allow requests from frontend development server
// Frontend runs on localhost:5173 (Vite default) or localhost:3000
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:3000',
    'http://localhost:5174',
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/ // Allow local network IPs (e.g., 192.168.1.108:5174)
  ],
  credentials: true
}));

// JSON body parser: Parse incoming JSON request bodies
app.use(express.json());

// ========== Health Check Route ==========
// Simple health check endpoint to verify server is running
// GET /health - Returns { ok: true }
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// ========== Test Route ==========
// GET /api/test - Simple test endpoint
app.get('/api/test', (req, res) => {
  console.log('[GET /api/test] Request received');
  res.json({ ok: true, message: 'test api is working' });
});

// ========== Public Routes (No Authentication Required) ==========
// Authentication routes - must be public
app.use('/api/auth', authRouter);
console.log('✅ Auth router mounted at /api/auth');

// Health check and test routes - public
// (already defined above)

// ========== Protected API Routes (Authentication Required) ==========
// All routes below require valid JWT token in Authorization header

try {
  app.use('/api/transactions', authenticateToken, transactionsRouter);
  console.log('✅ Transactions router mounted at /api/transactions (protected)');
} catch (error) {
  console.error('⚠️ Failed to mount transactions router:', error);
}

app.use('/api/users', authenticateToken, usersRouter);
console.log('✅ Users router mounted at /api/users (protected)');

app.use('/api/settlements', authenticateToken, settlementsRouter);
console.log('✅ Settlements router mounted at /api/settlements (protected)');

app.use('/api', authenticateToken, configsRouter);
console.log('✅ Configs router mounted at /api (protected)');

app.use('/api/external', authenticateToken, externalRouter);
console.log('✅ External API router mounted at /api/external (protected)');

app.use('/api/wallets', authenticateToken, walletsRouter);
console.log('✅ Wallets router mounted at /api/wallets (protected)');

app.use('/api/dev', authenticateToken, devRouter);
console.log('✅ Dev router mounted at /api/dev (protected)');

app.use('/api/transactions', authenticateToken, sharesRouter);
console.log('✅ Shares router mounted at /api/transactions (protected)');

app.use('/api/share-logs', authenticateToken, shareLogsRouter);
console.log('✅ Share logs router mounted at /api/share-logs (protected)');

// ========== Initialize Default Configurations ==========
// Seed default wallet, API configurations, and users on server startup
console.log('\n🌱 Initializing default configurations...');
ensureDefaultUsers();
ensureDefaultWalletConfigs();
ensureDefaultApiConfigs();
console.log('✅ Default configurations initialized\n');

// ========== Server Startup ==========
// Start the Express server on the specified port
// Handle port already in use error gracefully
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`✅ Test route: http://localhost:${PORT}/api/test`);
  console.log(`✅ Transactions: http://localhost:${PORT}/api/transactions`);
  console.log(`📋 API Routes:`);
  console.log(`   GET  /api/transactions`);
  console.log(`   POST /api/transactions/manual`);
  console.log(`   PATCH /api/transactions/:id/splits`);
  console.log(`   GET  /api/users`);
  console.log(`   POST /api/users`);
  console.log(`   POST /api/settlements`);
  console.log(`   GET  /api/api-configs`);
  console.log(`   POST /api/api-configs`);
  console.log(`   GET  /api/wallet-configs`);
  console.log(`   POST /api/wallet-configs`);
  console.log(`   POST /api/wallets/:id/sync`);
  
  // ========== Auto Wallet Sync ==========
  // Start automatic wallet synchronization every 60 seconds
  console.log(`\n🔄 Starting automatic wallet sync (every 60 seconds)...`);
  
  // Initial sync after 5 seconds (give server time to start)
  setTimeout(() => {
    syncAllActiveWallets();
  }, 5000);
  
  // Then sync every 60 seconds
  setInterval(() => {
    syncAllActiveWallets();
  }, 60_000);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error(`\n💡 Solutions:`);
    console.error(`   1. Run: npm run kill-port`);
    console.error(`   2. Or run: npm run server:safe (auto-kills port before starting)`);
    console.error(`   3. Or manually kill the process:`);
    console.error(`      netstat -ano | findstr :${PORT}`);
    console.error(`      taskkill /PID <PID> /F`);
    process.exit(1);
  } else {
    throw err;
  }
});

/**
 * Sync all active wallets
 * This function is called periodically to automatically sync wallet transactions
 */
/**
 * Sync all active wallets
 * This function is called periodically to automatically sync wallet transactions
 * 
 * Verification steps:
 * A. Open AdminPanel, add a new wallet address, click save
 *    - Refresh GET /api/wallet-configs, should see the new wallet
 * B. In browser Console, manually execute:
 *    fetch('/api/wallets/<new_wallet_id>/sync', { method: 'POST' }).then(r => r.json()).then(console.log)
 *    - Should return ok: true, indicating backend can fetch data from TronGrid using this wallet
 * C. Wait for a period (e.g., 1 minute), check backend logs:
 *    - Should see auto-sync logic calling syncWalletById for the new wallet id
 *    - /api/transactions should contain transactions from this wallet (if there are historical records on-chain)
 */
async function syncAllActiveWallets(): Promise<void> {
  try {
    // Get all wallet configs from unified store
    // Filter: only sync Active wallets with TRC20 network (TRON network)
    const wallets = walletConfigStore.getAll().filter(w => 
      w.status === 'Active' && w.network === 'TRC20'
    );
    
    if (wallets.length === 0) {
      console.log('[AutoSync] No active TRON wallets to sync');
      return;
    }
    
    console.log(`[AutoSync] Syncing ${wallets.length} active TRON wallet(s)...`);
    
    for (const wallet of wallets) {
      try {
        const newTxs = await syncWalletById(wallet.id);
        if (newTxs.length > 0) {
          console.log(`[AutoSync] Wallet ${wallet.label} (${wallet.id}): ${newTxs.length} new transaction(s)`);
        }
      } catch (error) {
        console.error(`[AutoSync] Failed to sync wallet ${wallet.id} (${wallet.label}):`, error);
        // Continue with other wallets even if one fails
      }
    }
    
    console.log('[AutoSync] Sync cycle completed');
  } catch (error) {
    console.error('[AutoSync] Error in sync cycle:', error);
    // Don't throw - we want the server to keep running even if sync fails
  }
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

