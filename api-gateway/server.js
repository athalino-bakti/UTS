const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { verifyJWT, fetchPublicKey } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3002', // Frontend
    'http://localhost:3000', // Gateway itself
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      'user-service': process.env.REST_API_URL || 'http://localhost:3001',
      'task-service': process.env.GRAPHQL_API_URL || 'http://localhost:4000'
    }
  });
});

// Fetch public key on startup
fetchPublicKey().catch(err => {
  console.error('Failed to fetch public key on startup:', err.message);
});

// Proxy configuration for REST API (User Service)
const restApiProxy = createProxyMiddleware({
  target: process.env.REST_API_URL || 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api', // Keep the /api prefix
  },
  onError: (err, req, res) => {
    console.error('User Service Proxy Error:', err.message);
    res.status(500).json({ 
      error: 'User Service unavailable',
      message: err.message 
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[User Service] ${req.method} ${req.url} -> ${proxyReq.path}`);
  }
});

// Proxy configuration for GraphQL API (Task Service)
const graphqlApiProxy = createProxyMiddleware({
  target: process.env.GRAPHQL_API_URL || 'http://localhost:4000',
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying for subscriptions
  onError: (err, req, res) => {
    console.error('Task Service Proxy Error:', err.message);
    res.status(500).json({ 
      error: 'Task Service unavailable',
      message: err.message 
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Task Service] ${req.method} ${req.url} -> ${proxyReq.path}`);
  }
});

// Public routes (no authentication required)
app.use('/api/auth/login', restApiProxy);
app.use('/api/auth/register', restApiProxy);
app.use('/api/auth/public-key', restApiProxy);

// Protected routes (authentication required)
app.use('/api/auth/me', verifyJWT, restApiProxy);
app.use('/api/users', verifyJWT, restApiProxy);
app.use('/api/teams', verifyJWT, restApiProxy);
app.use('/graphql', verifyJWT, graphqlApiProxy);

// Catch-all route
app.get('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    availableRoutes: [
      '/health',
      '/api/auth/login (POST, public)',
      '/api/auth/register (POST, public)',
      '/api/auth/me (GET, protected)',
      '/api/users/* (protected)',
      '/api/teams/* (protected)',
      '/graphql (protected)'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Gateway Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Proxying /api/* to: ${process.env.REST_API_URL || 'http://localhost:3001'} (User Service)`);
  console.log(`🔄 Proxying /graphql to: ${process.env.GRAPHQL_API_URL || 'http://localhost:4000'} (Task Service)`);
  console.log(`🔐 JWT Authentication enabled on protected routes`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;