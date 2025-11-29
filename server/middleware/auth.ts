/**
 * Authentication Middleware
 * 
 * This middleware verifies JWT tokens in incoming requests.
 * It extracts the token from the Authorization header and validates it.
 * 
 * Usage:
 *   app.use('/api/protected-route', authenticateToken, handler);
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT Secret Key - In production, this should be stored in environment variables
// Set JWT_SECRET in .env file for production use
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

/**
 * Extended Request interface to include user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
}

/**
 * Authentication Middleware
 * 
 * Verifies JWT token from Authorization header.
 * Format: Authorization: Bearer <token>
 * 
 * If token is valid, adds user info to req.user and calls next().
 * If token is invalid or missing, returns 401 Unauthorized.
 */
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Extract token from Authorization header
  const authHeader = req.headers['authorization'];
  
  // Check if Authorization header exists and has correct format
  // Format: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1]; // Split by space and get second part
  
  if (!token) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'No token provided. Please login first.' 
    });
    return;
  }
  
  // Verify token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      // Token is invalid or expired
      res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Invalid or expired token. Please login again.' 
      });
      return;
    }
    
    // Token is valid - attach user info to request object
    // decoded contains the payload we set when creating the token (id, username)
    req.user = decoded as { id: number; username: string };
    next(); // Continue to next middleware/route handler
  });
};


