import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import { env } from './config/env';
import { connectDB } from './config/database'; // Import connectDB
import gatewayRoutes from './routes/gateway.routes';
import authRoutes from './routes/auth.routes';
import analyticsRoutes from './routes/analytics.routes';
import { proxyMiddleware } from './middleware/proxy.middleware';

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

// Proxy Middleware
// Catches everything else.
// Logic: If request Host is a subdomain (and not just API hitting IP directly), process it.
// If it's a direct IP hit to root path not /api, what happens?
// proxyMiddleware handles 404 if gateway not found.
app.use(proxyMiddleware);

const PORT = env.PORT || 3000;

// Connect to DB then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Gate402 Core Engine running on port ${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
});
