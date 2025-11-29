/**
 * Authentication Routes
 * 
 * Handles authentication-related endpoints:
 * - POST /api/auth/login - User login (username + password)
 * - POST /api/auth/verify - Verify current token
 * - POST /api/auth/logout - Logout (client-side, but can be used for token blacklisting)
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createScopedLogger } from '../utils/logger.js';

const router = Router();
const log = createScopedLogger('Auth');

// JWT Secret Key - Should match the one in auth middleware
// In production, set JWT_SECRET in .env file
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// JWT Token expiration time (1 hour = 3600 seconds)
const JWT_EXPIRES_IN = '1h';

/**
 * Hardcoded Users Database
 * 
 * In production, this should be stored in a real database.
 * Passwords are hashed using bcrypt.
 * 
 * Default credentials:
 * - Username: admin
 * - Password: admin123 (hashed)
 */
const users = [
  {
    id: 1,
    username: 'admin',
    // Password: 'admin123' hashed with bcrypt (cost factor 10)
    // You can generate new hashes using: bcrypt.hashSync('your-password', 10)
    password: '$2b$10$XPeqaeYBgZ.cB.iP9BABouhyrEpaQ81GNht4ILb.7P6e7D09Uosae'
  }
];

/**
 * POST /api/auth/login
 * 
 * Request Body:
 * {
 *   "username": "admin",
 *   "password": "admin123"
 * }
 * 
 * Response (Success):
 * {
 *   "success": true,
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "user": {
 *     "id": 1,
 *     "username": "admin"
 *   }
 * }
 * 
 * Response (Error):
 * {
 *   "success": false,
 *   "error": "Invalid username or password"
 * }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      log.warn('Login attempt with missing credentials');
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }
    
    // Find user by username
    const user = users.find(u => u.username === username);
    
    if (!user) {
      log.warn(`Login attempt with invalid username: ${username}`);
      // Don't reveal whether username exists or not (security best practice)
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }
    
    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      log.warn(`Login attempt with invalid password for user: ${username}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }
    
    // Password is correct - generate JWT token
    // Token payload includes user ID and username
    const tokenPayload = {
      id: user.id,
      username: user.username
    };
    
    // Sign token with secret and expiration time
    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
    
    log.info(`User ${username} logged in successfully`);
    
    // Return token and user info
    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        username: user.username
      }
    });
    
  } catch (error) {
    log.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during login'
    });
  }
});

/**
 * POST /api/auth/verify
 * 
 * Verifies if the current token is valid.
 * Requires Authorization header with Bearer token.
 * 
 * Response (Success):
 * {
 *   "valid": true,
 *   "user": {
 *     "id": 1,
 *     "username": "admin"
 *   }
 * }
 * 
 * Response (Error):
 * {
 *   "valid": false,
 *   "error": "Invalid or expired token"
 * }
 */
router.post('/verify', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        valid: false,
        error: 'No token provided'
      });
    }
    
    // Verify token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({
          valid: false,
          error: 'Invalid or expired token'
        });
      }
      
      // Token is valid
      res.json({
        valid: true,
        user: decoded
      });
    });
    
  } catch (error) {
    log.error('Token verification error:', error);
    res.status(500).json({
      valid: false,
      error: 'Internal server error during token verification'
    });
  }
});

export default router;

