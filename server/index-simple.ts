/**
 * Simple Test Server
 * 
 * This is a minimal version to test if routing works at all.
 * If this works, the issue is with module imports.
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory store
let transactions: any[] = [];

// Routes
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/test', (req, res) => {
  console.log('[TEST] /api/test hit');
  res.json({ message: 'API routing works!' });
});

app.get('/api/transactions', (req, res) => {
  console.log('[GET] /api/transactions hit');
  res.json(transactions);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple test server running on http://localhost:${PORT}`);
  console.log(`✅ Test: http://localhost:${PORT}/api/test`);
  console.log(`✅ Transactions: http://localhost:${PORT}/api/transactions`);
});


