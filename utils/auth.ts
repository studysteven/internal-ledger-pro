/**
 * Authentication Utilities
 * 
 * Provides helper functions for managing authentication state,
 * token storage, and API request headers.
 */

export interface User {
  id: number;
  username: string;
}

const TOKEN_KEY = 'authToken';
const USER_KEY = 'user';

/**
 * Get stored authentication token from localStorage
 */
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Get stored user information from localStorage
 */
export const getUser = (): User | null => {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
};

/**
 * Store authentication token and user info
 */
export const setAuth = (token: string, user: User): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

/**
 * Clear authentication data (logout)
 */
export const clearAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/**
 * Check if user is authenticated (has valid token)
 */
export const isAuthenticated = (): boolean => {
  return getToken() !== null;
};

/**
 * Get Authorization header for API requests
 * Returns header object with Bearer token
 */
export const getAuthHeaders = (): HeadersInit => {
  const token = getToken();
  
  if (!token) {
    return {};
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Verify token with backend
 * Returns true if token is valid, false otherwise
 */
export const verifyToken = async (): Promise<boolean> => {
  const token = getToken();
  
  if (!token) {
    return false;
  }
  
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
};

/**
 * Enhanced fetch wrapper that automatically adds Authorization header
 */
export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };
  
  return fetch(url, {
    ...options,
    headers,
  });
};


