# Property Subscription & Distribution Channel - Integration Guide

Complete step-by-step integration guide for implementing the subscription and disbursement system.

## Quick Start (5 minutes)

### 1. Install and Build
```bash
npm install
npm run build
```

### 2. Create Database Tables
```bash
ts-node src/migrations/create-subscriptions-tables.ts
```

### 3. Register Routes in Server
Update `src/server.ts`:

```typescript
// Add this import
import { createSubscriptionRoutes } from './routes/subscriptionRoutes';

// Add this line in startServer() function after other routes
app.use('/api/subscriptions', createSubscriptionRoutes(db));
```

### 4. Start Server
```bash
npm run dev
```

### 5. Test API
```bash
# Create a subscription
curl -X POST http://localhost:5000/api/subscriptions/subscribe/prop-001 \
  -H "Content-Type: application/json" \
  -d '{
    "subscriberUserId": "user-001",
    "subscriberWalletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f42b1",
    "subscriptionAmount": "1000",
    "currency": "USDC"
  }'
```

## Detailed Setup

### Prerequisites
- Node.js 16+
- MySQL 5.7+
- Environment variables configured (`.env` file)

### Required Environment Variables
```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=property_db

# Blockchain
BASE_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=0x...

# Smart Contracts
SUBSCRIPTION_CONTRACT_ADDRESS=0x...
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
DNZD_ADDRESS=0x...
DAUD_ADDRESS=0x...

# Server
PORT=5000
NODE_ENV=development
```

## File Structure

```
backend/
├── src/
│   ├── controllers/
│   │   └── subscriptionController.ts        ← API handlers
│   ├── services/
│   │   ├── subscriptionService.ts           ← Core subscription logic
│   │   └── subscriptionDistributionChannelService.ts ← Channel orchestration
│   ├── models/
│   │   └── subscriptionModel.ts             ← Data models & SQL queries
│   ├── routes/
│   │   └── subscriptionRoutes.ts            ← API route definitions
│   ├── migrations/
│   │   └── create-subscriptions-tables.ts   ← Database setup
│   ├── scripts/
│   │   └── subscriptionExample.ts           ← Usage examples
│   └── server.ts                            ← Main server file
├── SUBSCRIPTION_DISTRIBUTION_GUIDE.md       ← Full documentation
├── SUBSCRIPTION_INTEGRATION.md              ← This file
└── package.json
```

## Implementation Steps

### Step 1: Database Setup

Create the subscription and disbursement tables:

```bash
# Using TypeScript
ts-node src/migrations/create-subscriptions-tables.ts

# Or run manually
mysql> USE your_database;
mysql> [paste SQL from subscriptionModel.ts]
```

Verify tables were created:
```sql
SHOW TABLES LIKE '%subscri%';
SHOW TABLES LIKE '%disburs%';
```

### Step 2: Register Routes

Edit `src/server.ts`:

```typescript
import express from 'express';
import { createSubscriptionRoutes } from './routes/subscriptionRoutes';

const app = express();

// ... other middleware ...

let db: Pool;

async function startServer() {
  try {
    await connectDB();
    db = getPool();

    // ... other routes ...

    // Add subscription routes
    app.use('/api/subscriptions', createSubscriptionRoutes(db));

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

### Step 3: Add npm Scripts (Optional)

Update `package.json`:

```json
{
  "scripts": {
    "setup-subscriptions": "ts-node src/migrations/create-subscriptions-tables.ts",
    "subscription-examples": "ts-node src/scripts/subscriptionExample.ts"
  }
}
```

### Step 4: Test Basic Functionality

```bash
# Start server
npm run dev

# In another terminal, test subscription creation
curl -X POST http://localhost:5000/api/subscriptions/subscribe/test-property-1 \
  -H "Content-Type: application/json" \
  -d '{
    "subscriberUserId": "test-user-1",
    "subscriberWalletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f42b1",
    "subscriptionAmount": "1000",
    "currency": "USDC",
    "transactionHash": "0xabc123"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "data": {
    "id": "uuid",
    "property_id": "test-property-1",
    "subscriber_user_id": "test-user-1",
    "subscription_amount": "1000",
    "share_percentage": 50,
    "status": "ACTIVE",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

## Integration with Existing Code

### Frontend Integration Example (TypeScript/React)

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api/subscriptions';

// Subscribe to property
async function subscribeToProperty(
  propertyId: string,
  walletAddress: string,
  amount: string,
  txHash: string
) {
  try {
    const response = await axios.post(
      `${API_BASE}/subscribe/${propertyId}`,
      {
        subscriberUserId: getCurrentUserId(),
        subscriberWalletAddress: walletAddress,
        subscriptionAmount: amount,
        currency: 'USDC',
        transactionHash: txHash,
      }
    );
    return response.data;
  } catch (error) {
    console.error('Subscription failed:', error);
    throw error;
  }
}

// Get subscriber stats
async function getPropertyStats(propertyId: string) {
  const response = await axios.get(
    `${API_BASE}/properties/${propertyId}/stats`
  );
  return response.data;
}

// Get user's subscriptions
async function getUserSubscriptions(userId: string) {
  const response = await axios.get(`${API_BASE}/users/${userId}`);
  return response.data;
}

// Get disbursement history
async function getDisbursementHistory(subscriptionId: string) {
  const response = await axios.get(
    `${API_BASE}/${subscriptionId}/disbursements`
  );
  return response.data;
}
```

### Smart Contract Integration Example

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPropertySubscription {
    function subscribe(uint256 propertyId, uint256 amount) external;
    function distributeReturns(
        uint256 propertyId,
        address[] calldata subscribers,
        uint256[] calldata payouts
    ) external;
}

contract PropertySubscriptionManager {
    IPropertySubscription public subscriptionContract;
    
    // When subscriber pays, record on backend
    function onSubscriptionPayment(
        string memory propertyId,
        address subscriber,
        uint256 amount,
        string memory transactionHash
    ) public {
        // Backend API call to create subscription
        // This is typically done off-chain
    }
    
    // Execute disbursement from smart contract
    function executePropertyDisbursement(
        uint256 propertyId,
        address[] memory subscribers,
        uint256[] memory amounts
    ) public {
        subscriptionContract.distributeReturns(
            propertyId,
            subscribers,
            amounts
        );
    }
}
```

### Admin Dashboard Integration Example

```typescript
// Admin component to manage disbursements
import React, { useState, useEffect } from 'react';

export function PropertyDisbursementPanel({ propertyId }) {
  const [stats, setStats] = useState(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    loadStats();
  }, [propertyId]);

  async function loadStats() {
    const response = await fetch(
      `/api/subscriptions/properties/${propertyId}/stats`
    );
    setStats(await response.json());
  }

  async function createAndExecuteDisbursement(amount, type) {
    setExecuting(true);
    try {
      const response = await fetch(
        `/api/subscriptions/properties/${propertyId}/disburse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            distributionId: `dist-${Date.now()}`,
            disbursementAmount: amount,
            currency: 'USDC',
            type,
          }),
        }
      );
      const result = await response.json();
      console.log('Disbursements created:', result);
      loadStats();
    } finally {
      setExecuting(false);
    }
  }

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="disbursement-panel">
      <h2>Property Disbursement Manager</h2>
      
      <div className="stats">
        <p>Active Subscribers: {stats.data.totalSubscribers}</p>
        <p>Total Subscribed: {stats.data.totalSubscriptionAmount} USDC</p>
        <p>Total Disbursed: {stats.data.totalDisbursed} USDC</p>
      </div>

      <div className="actions">
        <button
          onClick={() => createAndExecuteDisbursement('5000', 'YIELD')}
          disabled={executing}
        >
          {executing ? 'Processing...' : 'Disburse 5000 USDC (Yield)'}
        </button>

        <button
          onClick={() => createAndExecuteDisbursement('10000', 'RETURN')}
          disabled={executing}
        >
          {executing ? 'Processing...' : 'Disburse 10000 USDC (Return)'}
        </button>
      </div>
    </div>
  );
}
```

## Testing Checklist

### Unit Tests
- [ ] Subscription creation
- [ ] Share percentage calculation
- [ ] KYC verification
- [ ] Subscription cancellation

### Integration Tests
- [ ] Create subscription via API
- [ ] Get subscribers list
- [ ] Create disbursements
- [ ] Execute single disbursement
- [ ] Execute batch disbursements
- [ ] Verify database records

### End-to-End Tests
- [ ] Full subscription flow
- [ ] Disbursement execution
- [ ] Error handling
- [ ] Concurrent operations

### Performance Tests
- [ ] Batch disbursement execution (100+ disbursements)
- [ ] Query performance with large datasets
- [ ] Concurrent API requests

## Troubleshooting

### Database Connection Issues
```bash
# Check MySQL is running
mysql -u root -p

# Verify connection parameters
echo $DB_HOST $DB_USER $DB_NAME
```

### Migration Failures
```bash
# Check table structure
DESCRIBE subscriptions;
DESCRIBE disbursements;

# Check indices
SHOW INDEX FROM subscriptions;
```

### API Not Responding
```bash
# Check server is running
curl http://localhost:5000/api/subscriptions/disbursements/pending

# Check logs for errors
tail -f nohup.out
```

### Transaction Failures
```bash
# Check blockchain transaction
https://basescan.org/tx/{transaction_hash}

# Verify gas estimation
const gasEstimate = await contract.estimateGas.transfer(...)
```

## Performance Optimization

### Database Optimization
```sql
-- Add composite index for common queries
CREATE INDEX idx_property_status 
ON subscriptions(property_id, status);

-- Analyze query performance
EXPLAIN SELECT * FROM disbursements 
WHERE property_id = ? AND status = 'PENDING';
```

### API Caching
```typescript
// Add caching for frequently accessed data
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

async function getCachedStats(propertyId: string) {
  const key = `stats:${propertyId}`;
  let stats = cache.get(key);
  
  if (!stats) {
    stats = await getChannelStatistics(propertyId);
    cache.set(key, stats);
  }
  
  return stats;
}
```

### Batch Processing
```typescript
// Process disbursements in smaller batches
async function processDisbursementsInBatches(
  disbursementIds: string[],
  batchSize: number = 10
) {
  const results = new Map();
  
  for (let i = 0; i < disbursementIds.length; i += batchSize) {
    const batch = disbursementIds.slice(i, i + batchSize);
    const batchResults = await executeBatchDisbursements(batch, tokenAddress);
    
    batchResults.forEach((value, key) => {
      results.set(key, value);
    });
  }
  
  return results;
}
```

## Deployment

### Production Checklist
- [ ] Environment variables set securely
- [ ] Database backups configured
- [ ] API rate limiting enabled
- [ ] Error monitoring enabled (Sentry, etc.)
- [ ] Access logs enabled
- [ ] SSL/TLS configured
- [ ] Private key stored securely (use wallet service)

### Docker Deployment
```dockerfile
FROM node:18

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000
CMD ["npm", "start"]
```

### Environment Setup
```bash
# Create .env.production
DB_HOST=production-db.example.com
DB_USER=prod_user
DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id db-password)
PRIVATE_KEY=$(aws secretsmanager get-secret-value --secret-id private-key)
```

## Monitoring & Alerts

### Key Metrics to Monitor
- Subscription creation rate
- Disbursement success rate
- Pending disbursements count
- Database query performance
- API response times
- Transaction gas costs

### Alert Thresholds
- Failed disbursements > 5%
- Pending disbursements > 100
- API response time > 5s
- Database connection pool exhausted

## Support

For issues or questions:
1. Check the main guide: `SUBSCRIPTION_DISTRIBUTION_GUIDE.md`
2. Review API documentation in routes files
3. Check database schema in models files
4. Run example script: `npm run subscription-examples`
5. Review error logs: `tail -f error.log`

## Next Steps

1. **Complete**: Set up database and routes
2. **Test**: Run example script and API tests
3. **Integrate**: Connect to frontend and smart contracts
4. **Deploy**: Deploy to staging environment
5. **Monitor**: Set up alerts and monitoring
6. **Scale**: Optimize for production loads

---

**Last Updated**: January 2024
**Version**: 1.0.0
