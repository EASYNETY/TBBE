# Property Subscription & Distribution Channel System

Complete end-to-end system for managing property subscriptions and distributing returns to all subscribers.

## Overview

This system provides:
- **Subscription Management**: Track property subscriptions with ownership percentages
- **Disbursement Management**: Create and execute disbursements to subscribers
- **Complete Audit Trail**: Full tracking of all transactions and distributions
- **Batch Operations**: Efficient processing of multiple disbursements
- **Real-time Statistics**: Live metrics on subscriptions and distributions

## Architecture

### Database Schema

#### Subscriptions Table
Tracks all property subscriptions:
```sql
CREATE TABLE subscriptions (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36),
  subscriber_user_id VARCHAR(36),
  subscriber_wallet_address VARCHAR(42),
  subscription_amount VARCHAR(255),
  subscription_date TIMESTAMP,
  status ENUM('ACTIVE', 'INACTIVE', 'CANCELLED', 'EXPIRED'),
  share_percentage DECIMAL(10,4),
  currency VARCHAR(20),
  transaction_hash VARCHAR(66),
  kyc_verified BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

#### Disbursements Table
Tracks all disbursements to subscribers:
```sql
CREATE TABLE disbursements (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36),
  distribution_id VARCHAR(36),
  subscriber_id VARCHAR(36),
  subscriber_wallet_address VARCHAR(42),
  disbursement_amount VARCHAR(255),
  disbursement_date TIMESTAMP,
  currency VARCHAR(20),
  type ENUM('YIELD', 'RETURN', 'REVENUE', 'DIVIDEND'),
  status ENUM('PENDING', 'EXECUTED', 'FAILED'),
  transaction_hash VARCHAR(66),
  executed_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Services

### 1. SubscriptionService
**Location**: `src/services/subscriptionService.ts`

Handles all subscription and disbursement operations.

#### Key Methods

##### Subscription Management
- `createSubscription()` - Create new subscription
- `getSubscriptionsByProperty()` - Get all subscriptions for property
- `getActiveSubscriptionsByProperty()` - Get active subscriptions
- `getSubscriptionsBySubscriber()` - Get user's subscriptions
- `cancelSubscription()` - Cancel subscription
- `verifySubscriptionKYC()` - Verify KYC for subscription

##### Statistics
- `getTotalSubscriberCount()` - Total active subscribers
- `getTotalSubscriptionAmount()` - Total subscription value

##### Disbursement Management
- `createDisbursement()` - Create single disbursement
- `createDisbursementsForAllSubscribers()` - Create for all subscribers
- `getDisbursementsByProperty()` - Get property disbursements
- `getPendingDisbursements()` - Get pending disbursements
- `executeDisbursement()` - Execute single disbursement
- `executeBatchDisbursements()` - Execute multiple disbursements

##### Analytics
- `getDisbursementsByDateRange()` - Get disbursements in date range
- `getTotalDisbursedBySubscriber()` - Total disbursed to subscriber
- `getTotalDisbursedByProperty()` - Total disbursed from property

### 2. SubscriptionDistributionChannelService
**Location**: `src/services/subscriptionDistributionChannelService.ts`

High-level orchestration of the complete subscription and distribution flow.

#### Key Methods

- `initializeDistributionChannel()` - Set up channel for property
- `createAndProcessDisbursements()` - Create and optionally execute disbursements
- `executePendingDisbursements()` - Execute all pending disbursements
- `getChannelStatistics()` - Get channel metrics
- `getPropertyOverview()` - Complete property view
- `getSubscriberDetails()` - Subscriber info with history
- `validateDisbursements()` - Validate before execution
- `generatePropertyReport()` - Generate comprehensive report

## API Endpoints

### Subscription Endpoints

#### Create Subscription
```
POST /api/subscriptions/subscribe/:propertyId
```

Request body:
```json
{
  "subscriberUserId": "user-123",
  "subscriberWalletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f42b",
  "subscriptionAmount": "1000",
  "currency": "USDC",
  "transactionHash": "0x..."
}
```

#### Get Property Subscribers
```
GET /api/subscriptions/properties/:propertyId/subscribers
```

#### Get Active Subscribers
```
GET /api/subscriptions/properties/:propertyId/subscribers/active
```

#### Get User Subscriptions
```
GET /api/subscriptions/users/:userId
```

#### Get Subscriptions by Wallet
```
GET /api/subscriptions/wallet/:walletAddress
```

#### Cancel Subscription
```
POST /api/subscriptions/:subscriptionId/cancel
```

#### Verify KYC
```
POST /api/subscriptions/:subscriptionId/verify-kyc
Body:
{
  "verified": true
}
```

#### Get Subscriber Statistics
```
GET /api/subscriptions/properties/:propertyId/stats
```

### Disbursement Endpoints

#### Create Disbursements
```
POST /api/subscriptions/properties/:propertyId/disburse
```

Request body:
```json
{
  "distributionId": "dist-123",
  "disbursementAmount": "500",
  "currency": "USDC",
  "type": "YIELD"
}
```

Disbursement types: `YIELD`, `RETURN`, `REVENUE`, `DIVIDEND`

#### Get Property Disbursements
```
GET /api/subscriptions/properties/:propertyId/disbursements
```

#### Get Distribution Disbursements
```
GET /api/subscriptions/distribution/:distributionId/disbursements
```

#### Get Subscriber Disbursements
```
GET /api/subscriptions/:subscriptionId/disbursements
```

#### Get Pending Disbursements
```
GET /api/subscriptions/disbursements/pending
```

#### Execute Single Disbursement
```
POST /api/subscriptions/disbursements/:disbursementId/execute
Body:
{
  "tokenAddress": "0x..."
}
```

#### Execute Batch Disbursements
```
POST /api/subscriptions/disbursements/execute-batch
Body:
{
  "disbursementIds": ["id-1", "id-2", ...],
  "tokenAddress": "0x..."
}
```

#### Get Total Disbursed (Subscriber)
```
GET /api/subscriptions/:subscriptionId/total-disbursed
```

#### Get Total Disbursed (Property)
```
GET /api/subscriptions/properties/:propertyId/total-disbursed
```

#### Get Disbursements by Date Range
```
GET /api/subscriptions/properties/:propertyId/disbursements/date-range?startDate=2024-01-01&endDate=2024-12-31
```

## Complete Subscription Flow

### Step 1: Property Setup
Property owner creates a property with fractional shares enabled.

### Step 2: Subscriber Registration
1. Subscriber calls `/subscribe/:propertyId`
2. Amount is calculated as percentage of property supply
3. Subscription record is created in database
4. Status set to ACTIVE

### Step 3: KYC Verification
1. Admin verifies subscriber KYC via `/verify-kyc`
2. `kyc_verified` flag updated in subscription
3. Subscriber becomes eligible for disbursements

### Step 4: Revenue/Yield Generation
Property generates revenue through rental, appreciation, or other means.

### Step 5: Create Disbursements
1. Admin initiates disbursement via `/disburse`
2. System creates disbursement record for each active subscriber
3. Amount distributed proportionally based on `share_percentage`
4. Disbursements status set to PENDING

### Step 6: Execute Disbursements
Choose one of two approaches:

**Automatic Execution** (during creation):
```json
{
  "distributionId": "...",
  "disbursementAmount": "1000",
  "currency": "USDC",
  "type": "YIELD",
  "autoExecute": true,
  "tokenAddress": "0x..."
}
```

**Manual Execution**:
```
POST /disbursements/:disbursementId/execute
Body: { "tokenAddress": "0x..." }
```

### Step 7: Verification
- Check disbursement status via API
- View transaction hash on blockchain
- Validate received amount in subscriber wallet

## Example Usage Scenarios

### Scenario 1: Monthly Rental Distribution
```javascript
// 1. Get active subscribers
const subscribers = await subscriptionService.getActiveSubscriptionsByProperty(propertyId);

// 2. Calculate per-subscriber amount
const monthlyRental = 10000; // USDC
const perSubscriberAmount = (monthlyRental / subscribers.length).toString();

// 3. Create disbursements
const disbursements = await subscriptionService.createDisbursementsForAllSubscribers(
  propertyId,
  distributionId,
  perSubscriberAmount,
  'USDC',
  'YIELD'
);

// 4. Execute batch
const results = await subscriptionService.executeBatchDisbursements(
  disbursements.map(d => d.id),
  USDC_TOKEN_ADDRESS
);
```

### Scenario 2: Annual Return Distribution (Proportional)
```javascript
// 1. Get subscriber stats
const stats = await channelService.getChannelStatistics(propertyId);

// 2. Create proportional disbursements
const annualReturn = 50000; // USDC
const result = await channelService.createAndProcessDisbursements(
  propertyId,
  distributionId,
  annualReturn.toString(),
  'USDC',
  'RETURN',
  USDC_TOKEN_ADDRESS,
  true // auto execute
);

// 3. Get execution status
console.log(result.executionResults);
```

### Scenario 3: Check Subscriber History
```javascript
// 1. Get subscriber details
const details = await channelService.getSubscriberDetails(subscriptionId);

// 2. View disbursement history
console.log(details.disbursements);
console.log(`Total received: ${details.totalDisbursed}`);
```

### Scenario 4: Generate Property Report
```javascript
// 1. Generate comprehensive report
const report = await channelService.generatePropertyReport(propertyId);

// Report includes:
// - Total subscribers
// - Total subscription amount
// - Disbursement breakdown
// - Revenue metrics
// - Activity timeline
```

## Data Flow Diagram

```
Property Created
       ↓
   Subscriber Registers
       ↓
   Create Subscription
   (Calculate share %)
       ↓
   KYC Verification
       ↓
   Revenue Generated
       ↓
   Create Disbursements
   (Proportional to shares)
       ↓
   Execute Disbursement
   (Token transfer)
       ↓
   Subscriber Receives
   Return/Yield
       ↓
   Record in Audit Trail
```

## Security Considerations

1. **KYC Verification**: Always verify KYC before enabling disbursements
2. **Authorization**: Implement proper role-based access control
3. **Fund Validation**: Validate available funds before executing disbursements
4. **Transaction Verification**: Always verify blockchain transaction hash
5. **Audit Logging**: All operations are logged with timestamps
6. **Rate Limiting**: Implement rate limits on API endpoints
7. **Input Validation**: Validate all wallet addresses and amounts

## Database Indexes

For optimal performance, the following indexes are created:
- `idx_property_id` - Fast property lookups
- `idx_subscriber_wallet_address` - Fast wallet lookups
- `idx_status` - Filter by status
- `idx_disbursement_date` - Date range queries
- `UNIQUE idx` - Prevent duplicate subscriptions per property/user

## Monitoring & Analytics

### Key Metrics
- Total subscribers per property
- Average subscription amount
- Subscription growth rate
- Disbursement success rate
- Average disbursement amount
- Failed disbursements count
- Pending disbursements count

### Queries for Analytics

```sql
-- Total subscribers by status
SELECT status, COUNT(*) as count
FROM subscriptions
GROUP BY status;

-- Top properties by subscriber count
SELECT property_id, COUNT(*) as subscriber_count
FROM subscriptions
WHERE status = 'ACTIVE'
GROUP BY property_id
ORDER BY subscriber_count DESC;

-- Disbursement success rate
SELECT
  type,
  SUM(CASE WHEN status = 'EXECUTED' THEN 1 ELSE 0 END) as executed,
  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
  SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
FROM disbursements
GROUP BY type;
```

## Migration & Setup

### 1. Run Migration
```bash
npm run setup-db
# or
ts-node src/migrations/create-subscriptions-tables.ts
```

### 2. Update Server Routes
Update `src/server.ts` to include subscription routes:
```typescript
import { createSubscriptionRoutes } from './routes/subscriptionRoutes';

app.use('/api/subscriptions', createSubscriptionRoutes(db));
```

### 3. Add Environment Variables
```env
SUBSCRIPTION_CONTRACT_ADDRESS=0x...
USDC_ADDRESS=0x...
PRIVATE_KEY=0x...
BASE_RPC_URL=https://...
```

## Troubleshooting

### Issue: Disbursement Execution Fails
1. Check token balance in contract
2. Verify wallet address format
3. Check transaction gas estimation
4. Review blockchain explorer for transaction details

### Issue: Subscriber Not Receiving Disbursement
1. Verify subscriber is ACTIVE (not CANCELLED/EXPIRED)
2. Confirm KYC is verified
3. Check disbursement status in database
4. Validate transaction hash on blockchain

### Issue: High Gas Costs
1. Batch multiple disbursements in single transaction
2. Use Layer 2 solutions if available
3. Optimize contract calls
4. Schedule disbursements during low-gas periods

## Future Enhancements

1. **Vesting Schedules**: Implement time-locked disbursements
2. **Multi-currency Support**: Seamless cross-currency distributions
3. **Automated Triggers**: Auto-create disbursements based on events
4. **Advanced Analytics**: Machine learning for distribution optimization
5. **Governance**: DAO voting on distribution parameters
6. **NFT Integration**: Subscription tokens as NFTs
7. **DeFi Integration**: Yield farming for subscription proceeds
8. **Mobile App**: Mobile disbursement and portfolio tracking

## Support & Documentation

For questions or issues:
1. Review this guide thoroughly
2. Check database schema comments
3. Review service method documentation
4. Check API response examples
5. Review error logs in console

## License

Property of the platform. All rights reserved.
