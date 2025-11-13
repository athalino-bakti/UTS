const jwt = require('jsonwebtoken');
const axios = require('axios');

let publicKey = null;
let publicKeyLastFetched = null;
const PUBLIC_KEY_CACHE_DURATION = 3600000; // 1 hour in milliseconds

// Fetch public key from User Service
async function fetchPublicKey() {
  const now = Date.now();
  
  // Return cached key if still valid
  if (publicKey && publicKeyLastFetched && (now - publicKeyLastFetched < PUBLIC_KEY_CACHE_DURATION)) {
    return publicKey;
  }
  
  try {
    const restApiUrl = process.env.REST_API_URL || 'http://localhost:3001';
    const response = await axios.get(`${restApiUrl}/api/auth/public-key`);
    publicKey = response.data.publicKey;
    publicKeyLastFetched = now;
    console.log('✅ Public key fetched successfully from User Service');
    return publicKey;
  } catch (error) {
    console.error('❌ Failed to fetch public key from User Service:', error.message);
    throw new Error('Unable to fetch public key for JWT verification');
  }
}

// JWT verification middleware
async function verifyJWT(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Fetch public key if not cached
    const key = await fetchPublicKey();
    
    // Verify token
    const decoded = jwt.verify(token, key, { algorithms: ['RS256'] });
    
    // Add user info to request headers for downstream services
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-email'] = decoded.email;
    req.headers['x-user-role'] = decoded.role;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    } else {
      console.error('JWT verification error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Token verification failed'
      });
    }
  }
}

// Optional JWT verification - doesn't fail if no token
async function optionalJWT(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.substring(7);
    const key = await fetchPublicKey();
    const decoded = jwt.verify(token, key, { algorithms: ['RS256'] });
    
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-email'] = decoded.email;
    req.headers['x-user-role'] = decoded.role;
    
    next();
  } catch (error) {
    // Just continue without user info if token is invalid
    next();
  }
}

module.exports = { verifyJWT, optionalJWT, fetchPublicKey };
