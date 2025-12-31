import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import { env } from './config/env';
import { connectDB } from './config/database';
import { X402Service } from './services/x402.service';
import gatewayRoutes from './routes/gateway.routes';
import authRoutes from './routes/auth.routes';
import analyticsRoutes from './routes/analytics.routes';
import { createProxyMiddleware } from './middleware/proxy.middleware';

const app = express();

app.set('trust proxy', true); // Important for generic deployment/proxies

// Global Middleware
app.use(cors());
app.use(helmet());
app.use(bodyParser.json());

// API Routes (Prefix /api)
// IMPORTANT: These MUST be before the proxy middleware to ensure they are reachable!
app.use('/api/auth', authRoutes);
app.use('/api/gateways', gatewayRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = env.PORT || 3000;

// Connect to DB and initialize x402, then start server
connectDB().then(async () => {
  console.log('🔧 Initializing x402 service...');
  const x402Service = new X402Service();
  await x402Service.initialize();

  // Proxy Middleware (applied after x402 initialization)
  app.use(createProxyMiddleware(x402Service));

  app.listen(PORT, () => {
    console.log(`Gate402 Core Engine running on port ${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
});
