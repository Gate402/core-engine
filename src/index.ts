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

const apiApp = express();
const proxyApp = express();

apiApp.set('trust proxy', true);
proxyApp.set('trust proxy', true);

// API Middleware
apiApp.use(cors());
apiApp.use(helmet());
apiApp.use(bodyParser.json());

// API Routes (Prefix /api)
apiApp.use('/api/auth', authRoutes);
apiApp.use('/api/gateways', gatewayRoutes);
apiApp.use('/api/analytics', analyticsRoutes);

apiApp.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = env.API_PORT || 3000;
const PROXY_PORT = env.PROXY_PORT || 3001;

// Connect to DB and initialize x402, then start servers
connectDB().then(async () => {
  console.log('🔧 Initializing x402 service...');
  const x402Service = new X402Service();
  await x402Service.initialize();

  // Proxy Middleware (attached to proxyApp)
  proxyApp.use(createProxyMiddleware(x402Service));

  // Start Manager API
  apiApp.listen(PORT, () => {
    console.log(`Gate402 Manager API running on port ${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });

  // Start Proxy Server
  proxyApp.listen(PROXY_PORT, () => {
    console.log(`Gate402 Proxy Server running on port ${PROXY_PORT}`);
  });
});
