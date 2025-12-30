# Gate402 Backend Development Prompt

## Project Context

You are building **Gate402** - a payment proxy platform for monetizing APIs using the x402 payment standard.

**What it does:**

- Developers register their API with us and get a subdomain like `alice-weather.gate402.io`
- When AI agents/clients hit that subdomain, we check for payment proof
- If no payment → return 402 Payment Required
- If valid payment → proxy the request to developer's actual server
- We log everything for analytics dashboard

**Tech Stack:**

- Express.js backend (TypeScript)
- PostgreSQL with Prisma ORM
- Redis for caching
- Payment networks: Solana USDC, Base USDC
- Hosting: Dokploy (self-hosted)

**Key Constraint:**
We have wildcard DNS setup (`*.gate402.io` → our server). All subdomains hit the same Express app. We differentiate by reading the `Host` header.

---

## Database Schema (Prisma)

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?

  payoutWallet  String?  // Where they receive payments
  payoutNetwork String?  // 'solana', 'base'

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  gateways  Gateway[]
}

model Gateway {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Domain config
  subdomain      String   @unique  // 'alice-weather'
  customDomain   String?  @unique  // 'api.weatherpro.com' (optional)

  // Origin config
  originUrl      String  // 'https://internal-api.weatherpro.com'
  secretToken    String  @unique // 'gw_sk_abc123...' - sent to origin for auth

  // Payment config
  pricePerRequest   Decimal  @db.Decimal(10, 6) // 0.010000 USD
  acceptedNetworks  String[] // ['solana-usdc', 'base-usdc']

  // Status
  status     String   @default("active") // 'active', 'paused', 'deleted'

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  payments      Payment[]
  requestLogs   RequestLog[]

  @@index([subdomain])
  @@index([customDomain])
  @@index([userId])
}

model Payment {
  id          String   @id @default(uuid())
  gatewayId   String?
  gateway     Gateway? @relation(fields: [gatewayId], references: [id], onDelete: SetNull)

  // Payment details
  amount      Decimal  @db.Decimal(20, 6)
  network     String   // 'solana-usdc', 'base-usdc'

  // Blockchain data
  transactionHash String @unique
  fromWallet      String  // Payer's wallet
  toWallet        String  // Receiver's wallet
  blockNumber     BigInt?

  // Status
  status           String    @default("pending") // 'pending', 'confirmed', 'failed'
  confirmationTime DateTime?

  // x402 proof (the actual proof string from header)
  paymentProof  String @db.Text

  // Economics
  platformFee     Decimal @db.Decimal(20, 6) @default(0)    // Our 2-3% cut
  providerRevenue Decimal @db.Decimal(20, 6)                // Gateway owner's cut

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([gatewayId])
  @@index([transactionHash])
  @@index([fromWallet])
  @@index([createdAt])
}

model RequestLog {
  id        String   @id @default(uuid())
  gatewayId String
  gateway   Gateway  @relation(fields: [gatewayId], references: [id], onDelete: Cascade)

  // Request details
  method     String
  path       String
  statusCode Int

  // Payment funnel tracking
  paymentRequired Boolean @default(false)  // Did we send 402?
  paymentProvided Boolean @default(false)  // Did they send proof?
  paymentValid    Boolean @default(false)  // Was proof valid?

  paymentId String?  // Link to payment if successful

  // Performance
  durationMs Int?

  // Client info
  clientWallet String?
  clientIp     String?

  createdAt DateTime @default(now())

  @@index([gatewayId, createdAt])
  @@index([clientWallet])
}
```

---

## Request Flow Architecture

```
1. Request arrives at alice-weather.gate402.io/weather?city=SF

2. Express reads req.hostname → "alice-weather.gate402.io"

3. Extract subdomain → "alice-weather"

4. Check Redis cache: gateway:alice-weather
   - HIT: Use cached config
   - MISS: Query PostgreSQL → Cache for 5 minutes

5. Check for x402-payment header
   - NOT PRESENT:
     → Return 402 Payment Required
     → Log to RequestLog (paymentRequired=true, paymentProvided=false)
     → END

   - PRESENT:
     → Continue to step 6

6. Validate payment proof
   - Check Redis: payment_proof:{hash}
   - If cached → Use result
   - If not cached:
     → Check PostgreSQL for existing payment
     → If not found, validate on blockchain (Solana/Base)
     → Store in PostgreSQL
     → Cache result for 1 hour

   - INVALID:
     → Return 402 Payment Required
     → Log to RequestLog (paymentRequired=true, paymentProvided=true, paymentValid=false)
     → END

   - VALID:
     → Continue to step 7

7. Proxy to origin
   - Build target URL: gateway.originUrl + req.path + req.query
   - Add header: X-Gate402-Secret: gateway.secretToken
   - Forward request with all original headers (except Host)
   - Get response from origin

8. Log analytics
   - Create RequestLog entry
   - Track: gateway, method, path, status, payment info, duration
   - Store client wallet for "whale customer" analysis

9. Return origin's response to client
```

---

## What You Need to Build

### 1. API Routes (REST endpoints for dashboard)

**Gateway Management:**

- `POST /api/gateways` - Create new gateway
  - Input: originUrl, pricePerRequest, acceptedNetworks
  - Generate unique subdomain (check for conflicts)
  - Generate secure secretToken (use crypto.randomBytes)
  - Return: gateway object with subdomain URL
- `GET /api/gateways` - List user's gateways
- `GET /api/gateways/:id` - Get single gateway
- `PATCH /api/gateways/:id` - Update gateway
- `DELETE /api/gateways/:id` - Soft delete (set status='deleted')

**Analytics:**

- `GET /api/analytics/overview?gatewayId=xyz` - Dashboard stats
  - Total revenue (all time, 24h, 7d)
  - Total requests, successful payments
  - Conversion rate (402 challenges → successful payments)
- `GET /api/analytics/top-payers?gatewayId=xyz` - Top 10 wallets by spend

### 2. Proxy Middleware (The Core Engine)

This middleware runs on EVERY request to `*.gate402.io`

**Responsibilities:**

- Extract subdomain from hostname
- Look up gateway config (use Redis cache!)
- Check x402-payment header
- Validate payment if provided
- Proxy to origin if valid
- Log everything to RequestLog
- Handle errors gracefully

**Critical Points:**

- Run this middleware AFTER your API routes (so /api/\* bypasses proxy)
- Set `app.set('trust proxy', true)` to get real client IP behind Dokploy
- Don't leak gateway.originUrl to clients (security risk)
- Cache gateway lookups aggressively (5 min TTL)
- Cache payment validations (1 hour TTL, payments are immutable)

### 3. Payment Validation Service

**For MVP, focus on Solana USDC:**

- Use `@solana/web3.js` to query transaction
- Input: payment proof (assume it's a transaction signature)
- Fetch transaction from Solana RPC
- Verify:
  - Transaction exists and is confirmed
  - Amount matches gateway.pricePerRequest (or close enough, account for rounding)
  - Recipient wallet is correct (gateway owner's wallet)
  - Token is USDC (mint address check)

**Store payment in database:**

- Extract fromWallet from transaction
- Calculate platformFee (2% of amount)
- Calculate providerRevenue (98% of amount)
- Set status='confirmed'

**Important:** Don't re-validate same proof twice. Check PostgreSQL first, then cache result.

### 4. HTTP Proxying Logic

Use `http-proxy-middleware` or `axios` to forward requests:

**Headers to add when proxying:**

- `X-Gate402-Secret: {gateway.secretToken}` (for origin to verify)
- `X-Forwarded-For: {clientIP}` (preserve real client IP)

**Headers to remove:**

- `Host` (don't leak gate402.io domain)

**Error handling:**

- Origin timeout (30s max) → return 504 Gateway Timeout
- Origin unreachable → return 502 Bad Gateway
- Origin returns error → pass through to client

### 5. Caching Strategy

**Redis keys:**

- `gateway:{subdomain}` → Gateway config (TTL: 5 minutes)
- `gateway:{customDomain}` → Gateway config (TTL: 5 minutes)
- `payment_proof:{hash}` → Payment validation result (TTL: 1 hour)

**Why cache:**

- Gateway lookups happen on EVERY request
- PostgreSQL query = ~50ms, Redis = ~1ms
- Payment validation = blockchain RPC call = ~200ms

**Cache invalidation:**

- When gateway is updated → delete cache key
- When payment is validated → set cache key
- Use Redis SETEX for automatic TTL

---

## Best Practices & Watch-Outs

### Security

- **Never expose origin URLs in responses** - if gateway not found, just say "Gateway not found"
- **Validate subdomain format** - only allow alphanumeric + hyphens
- **Rate limit API endpoints** - prevent abuse (use express-rate-limit)
- **Secret tokens must be crypto-secure** - use `crypto.randomBytes(32).toString('hex')`
- **Sanitize all user inputs** - especially originUrl (validate it's a valid URL)

### Performance

- **Cache everything possible** - gateway config, payment validations
- **Don't await logging** - use fire-and-forget for RequestLog creation (don't slow down proxy)
- **Connection pooling** - configure Prisma with connection limits
- **Timeouts everywhere** - origin requests, blockchain RPC calls, database queries

### Error Handling

- **Proxy errors shouldn't leak internals** - return generic 502/504, log details server-side
- **Payment validation failures** - distinguish between "invalid proof" vs "RPC down"
- **Database errors** - have fallbacks (e.g., if Redis down, query DB directly)
- **Graceful degradation** - if analytics logging fails, still proxy the request

### Database

- **Use indexes!** - subdomain, customDomain, transactionHash must be indexed
- **Soft delete gateways** - set status='deleted' instead of actual DELETE
- **Clean old RequestLogs** - retention policy (7 days for free users, 90 days for paid)
- **Use transactions for payments** - create Payment + update Gateway revenue atomically

### TypeScript

- **Define strong types** - create interfaces for Gateway, Payment, RequestLog
- **Avoid `any`** - be explicit with types
- **Use Prisma generated types** - import from @prisma/client
- **Handle nulls properly** - customDomain is optional, paymentId is optional

### Monitoring

- **Log important events** - payment validations, proxy errors, cache misses
- **Track metrics** - request count, payment success rate, proxy latency
- **Health check endpoint** - `/health` should check DB + Redis connectivity
- **Structured logging** - use JSON format for easy parsing

---

## Project Structure

```
src/
├── index.ts                    # Express app setup + middleware order
├── config/
│   ├── database.ts             # Prisma client singleton
│   ├── redis.ts                # Redis client singleton
│   └── env.ts                  # Environment variable validation
├── middleware/
│   ├── auth.middleware.ts      # JWT auth for API routes
│   ├── proxy.middleware.ts     # Main x402 proxy logic
│   └── error.middleware.ts     # Global error handler
├── services/
│   ├── gateway.service.ts      # Gateway CRUD + caching
│   ├── payment.service.ts      # Payment validation + blockchain
│   ├── proxy.service.ts        # HTTP proxying logic
│   └── analytics.service.ts    # Logging + stats queries
├── routes/
│   ├── gateway.routes.ts       # Gateway API endpoints
│   └── analytics.routes.ts     # Analytics API endpoints
└── utils/
    ├── subdomain.util.ts       # Extract/validate subdomains
    ├── crypto.util.ts          # Generate tokens, hash
    └── cache.util.ts           # Redis wrapper functions
```

---

## Environment Variables

```env
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."

SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
BASE_RPC_URL="https://mainnet.base.org"

JWT_SECRET="your-jwt-secret"

# For production
NODE_ENV="production"
PORT=3000
```

---

## Testing Strategy

1. **Unit tests** - Payment validation logic, subdomain parsing
2. **Integration tests** - API endpoints (create gateway, list gateways)
3. **E2E tests** - Full proxy flow (mock blockchain responses)
4. **Manual testing:**
   - Create gateway via API
   - Send request to subdomain without payment → expect 402
   - Send request with fake payment → expect 402
   - Send request with valid payment → expect proxied response

---

## Deployment Notes (Dokploy)

- Set environment variables in Dokploy dashboard
- Ensure PostgreSQL and Redis are accessible
- Configure health check endpoint: `/health`
- Set up reverse proxy (Dokploy handles this, but verify wildcard works)
- Monitor logs for errors on first deploy

---

## Your Task Summary

Build an Express.js backend that:

1. Manages gateway configurations via REST API
2. Intercepts all `*.gate402.io` requests
3. Enforces x402 payment before proxying
4. Validates payments on Solana blockchain
5. Proxies valid requests to origin servers
6. Logs everything for analytics

**Priority order:**

1. Database schema + migrations
2. Gateway API (create, list, update)
3. Proxy middleware (subdomain → gateway lookup)
4. Payment validation (Solana only for MVP)
5. HTTP proxying logic
6. Analytics endpoints

Focus on making it work correctly first. Optimize performance after MVP is functional.

Good luck! 🚀
