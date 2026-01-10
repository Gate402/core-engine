# Gate402 Core Engine

> A payment proxy platform for monetizing APIs using the x402 payment standard

## 🚀 Overview

**Gate402** enables developers to monetize their APIs with blockchain-based micropayments. By registering an API with Gate402, developers receive a subdomain (e.g., `alice-weather.gate402.xyz`) that acts as a payment gateway. When clients make requests:

1. **No payment** → Returns `402 Payment Required`
2. **Invalid payment** → Returns `402 Payment Required`
3. **Valid payment** → Proxies request to the origin API server

All transactions are logged for comprehensive analytics and revenue tracking.

## 🏗️ Architecture

Gate402 consists of three separate Express.js servers:

### 1. **Manager API Server** (Port 3031)

- REST API for gateway management
- Analytics endpoints
- User authentication
- Swagger documentation at `/api/docs`

### 2. **Proxy Server** (Port 3030)

- Handles all `*.gate402.xyz` wildcard requests
- Payment validation and enforcement
- Request proxying to origin servers
- Request logging for analytics

### 3. **Facilitator Server** (Port 3033)

- x402 payment facilitator service
- Handles payment proof generation and validation
- Manages blockchain interactions

### Request Flow

```
Client Request → alice-weather.gate402.xyz/weather
    ↓
[1] Extract subdomain from Host header
    ↓
[2] Lookup Gateway config (Redis cache → PostgreSQL)
    ↓
[3] Check for x402-payment header
    ↓
[4] Validate payment proof (blockchain verification)
    ↓
[5] Proxy to origin server with X-Gate402-Secret header
    ↓
[6] Log request metrics to database
    ↓
Return response to client
```

## 📦 Tech Stack

- **Runtime**: Node.js with Bun/npm
- **Framework**: Express.js (TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **API Documentation**: TSOA with Swagger UI
- **Authentication**: JWT with Google OAuth

## 🔧 Prerequisites

- Node.js 18+ (or Bun)
- PostgreSQL 14+
- Redis 6+

## 📋 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd core-engine
npm install
# or
bun install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Configure the following required variables:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/gate402"
REDIS_URL="redis://localhost:6379"

# Core engine specific
PROXY_PORT=3030
API_PORT=3031
JWT_SECRET="super-secret-jwt-key-change-me"
FACILITATOR_URL="http://localhost:3033"
DEFAULT_OTP_VALUE=123456  # For development only

# Facilitator specific
FACILITATOR_PORT=3033
FACILITATOR_PRIVATE_KEY=0xYourFacilitatorPrivateKey
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

#### Adding Chains and Tokens

After running migrations, you need to manually add supported chains and tokens to the database:

**Option 1: Using Prisma Studio** (Recommended)

```bash
npm run prisma:studio
```

Then navigate to the `Chain` and `Token` models to add entries.

### 4. Build and Run

**Development Mode:**

```bash
# Start Manager API (with hot reload)
npm run dev

# Start Facilitator proxy (in separate terminal)
npm run dev-facilitator
```

**Production Mode:**

```bash
# Build TypeScript
npm run build

# Start Manager API
npm start

# Start Facilitator proxy (in separate terminal)
npm run start-facilitator
```

## 📚 API Documentation

Once the server is running, access the interactive Swagger documentation:

```
http://localhost:3031/api/docs
```

### Key Endpoints

#### Authentication

- `POST /api/v1/auth/siwe/nonce` - Get nonce for SIWE authentication
- `POST /api/v1/auth/siwe/verify` - Verify SIWE signature and login
- `POST /api/v1/auth/siwe/complete-profile` - Complete profile after SIWE login
- `POST /api/v1/auth/refresh` - Refresh access token

#### Gateway Management

- `POST /api/v1/gateways` - Create new gateway
- `GET /api/v1/gateways` - List user's gateways
- `GET /api/v1/gateways/:uuid` - Get gateway details
- `PATCH /api/v1/gateways/:uuid` - Update gateway
- `DELETE /api/v1/gateways/:uuid` - Delete gateway

#### Analytics

- `GET /api/v1/analytics/overview` - Revenue and usage statistics
- `GET /api/v1/analytics/daily-stats` - Daily aggregated stats
- `GET /api/v1/analytics/request-logs` - Individual request logs

#### Configuration

- `GET /api/v1/config/chains` - Supported blockchain networks
- `GET /api/v1/config/tokens` - Supported payment tokens

## 🗂️ Project Structure

```
core-engine/
├── src/
│   ├── index.ts              # Manager API server entry point
│   ├── facilitator.ts        # Proxy server entry point
│   ├── config/               # Configuration (database, Redis, env)
│   ├── controllers/          # TSOA controllers (API endpoints)
│   ├── middleware/           # Express middleware (auth, proxy, error)
│   ├── services/             # Business logic layer
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── prisma/
│   ├── schema.prisma         # Database schema
│   ├── migrations/           # Database migrations
│   └── seed.ts               # Database seeding script
├── http/                     # HTTP request examples for testing
├── scripts/                  # Utility scripts
└── build/                    # Compiled output (generated)
```

## 🔐 Authentication

Gate402 uses JWT-based authentication with two token types:

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to obtain new access tokens

### Making Authenticated Requests

Include the access token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer <access_token>" \
     http://localhost:3031/api/v1/gateways
```

## 💰 Payment Flow

### For API Consumers

1. Make a request to a Gate402 subdomain
2. Receive `402 Payment Required` response with payment details
3. Send blockchain transaction (USDC on Base)
4. Include transaction hash in `x402-payment` header
5. Request is validated and proxied to origin

### For API Providers

1. Register gateway via `/api/v1/gateways`
2. Configure origin URL, price per request, and accepted networks
3. Receive subdomain and secret token
4. Add secret token validation to your origin API
5. Monitor revenue via analytics endpoints

## 🧹 Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format
```

The `http/` directory contains sample HTTP requests for manual testing with tools like REST Client or HTTPie.

## 🐳 Docker Deployment

Build and run with Docker:

```bash
# Build Manager API image
docker build -t gate402-api -f Dockerfile .

# Build Facilitator proxy image
docker build -t gate402-facilitator -f Dockerfile.facilitator .

# Run containers (example)
docker run -p 3031:3031 --env-file .env gate402-api
docker run -p 3030:3030 --env-file .env gate402-facilitator
```

## 📊 Database Schema

### Core Models

- **User**: User accounts with authentication and payout configuration
- **Gateway**: API gateway configurations (subdomain, pricing, origin)
- **RequestLog**: Individual request logs for analytics
- **DailyStats**: Aggregated daily statistics per gateway
- **Chain**: Supported blockchain networks
- **Token**: Supported payment tokens

Run `npm run prisma:studio` to explore the database with Prisma Studio.

## 🛠️ Development Scripts

| Command                     | Description                           |
| --------------------------- | ------------------------------------- |
| `npm run dev`               | Start Manager API with hot reload     |
| `npm run dev-facilitator`   | Start Proxy server with hot reload    |
| `npm run build`             | Compile TypeScript to JavaScript      |
| `npm start`                 | Run compiled Manager API              |
| `npm run start-facilitator` | Run compiled Proxy server             |
| `npm run prisma:generate`   | Generate Prisma client                |
| `npm run prisma:migrate`    | Run database migrations               |
| `npm run prisma:studio`     | Open Prisma Studio                    |
| `npm run swagger:generate`  | Generate TSOA routes and Swagger spec |
| `npm run lint`              | Lint TypeScript files                 |
| `npm run format`            | Format code with Prettier             |

## 🔍 Monitoring & Health Checks

**Health Check Endpoint:**

```bash
curl http://localhost:3031/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2026-01-15T12:38:05.000Z"
}
```

## 🌐 Environment Variables

### Core Engine

| Variable            | Description                          | Required           |
| ------------------- | ------------------------------------ | ------------------ |
| `NODE_ENV`          | Environment (development/production) | Yes                |
| `PORT`              | General port (fallback)              | No (default: 3000) |
| `API_PORT`          | Manager API port                     | No (default: 3031) |
| `PROXY_PORT`        | Proxy server port                    | No (default: 3030) |
| `DATABASE_URL`      | PostgreSQL connection string         | Yes                |
| `REDIS_URL`         | Redis connection string              | Yes                |
| `JWT_SECRET`        | Secret for JWT tokens                | Yes                |
| `FACILITATOR_URL`   | x402 facilitator service URL         | Yes                |
| `DEFAULT_OTP_VALUE` | Default OTP for development          | No (dev only)      |

### Facilitator Service

| Variable                  | Description                 | Required           |
| ------------------------- | --------------------------- | ------------------ |
| `FACILITATOR_PORT`        | Facilitator server port     | No (default: 3033) |
| `FACILITATOR_PRIVATE_KEY` | Private key for facilitator | Yes                |

## 🤝 Contributing

1. Follow TypeScript best practices
2. Use Prettier for code formatting
3. Run linter before committing
4. Update Swagger documentation for API changes
5. Add tests for new features

## 📄 License

ISC

## 🔗 Related Projects

- **x402 Protocol**: Payment standard specification
- **Gate402 Frontend**: Dashboard application for managing gateways
- **x402 SDK**: Client libraries for making x402 payments

## 📞 Support

For issues, questions, or contributions, please refer to the project documentation or contact the development team.

---

**Built with ❤️ using the x402 payment standard**
