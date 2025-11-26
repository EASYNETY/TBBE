import dotenv from 'dotenv';
dotenv.config(); // Load environment variables at the very top

import express from 'express';
import cors from 'cors';
import { Pool } from 'mysql2/promise';
import { connectDB, getPool } from './utils/database'; // Import connectDB

// Import routes
import authRoutes from './routes/auth';
import propertiesRoutes from './routes/properties';
import marketplaceRoutes from './routes/marketplace';
import escrowRoutes from './routes/escrow';
import kycRoutes from './routes/kyc';
import mintingRoutes from './routes/minting';
import paymentsRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import { createSubscriptionRoutes } from './routes/subscription';
import { createWalletRoutes } from './routes/wallet';
import { createWalletTransactionRoutes } from './routes/walletTransactions';
import { createKYCWalletRoutes } from './routes/kycWallet';
import { 
    notifications, 
    metadata, 
    vouchers, 
    blockchain, 
    analytics, 
    billing, 
    investments 
} from './routes/index';
import { createSubscriptionsTables } from './migrations/create-subscriptions-tables';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let db: Pool;

async function startServer() {
    try {
        // First, connect to the database and wait for the connection to be established.
        await connectDB();
        db = getPool(); // Now, get the initialized pool.

        // Run migrations to create necessary tables
        try {
            await createSubscriptionsTables();
        } catch (migrationError) {
            console.warn('Migration warning (tables may already exist):', migrationError instanceof Error ? migrationError.message : 'Unknown error');
            // Continue anyway - tables might already exist
        }

        // Setup routes
        app.use('/api/auth', authRoutes);
        app.use('/api/properties', propertiesRoutes);
        app.use('/api/marketplace', marketplaceRoutes);
        app.use('/api/escrow', escrowRoutes);
        app.use('/api/kyc', kycRoutes);
        app.use('/api/minting', mintingRoutes);
        app.use('/api/payments', paymentsRoutes);
        app.use('/api/admin', adminRoutes);
        app.use('/api/notifications', notifications);
        app.use('/api/metadata', metadata);
        app.use('/api/vouchers', vouchers);
        app.use('/api/blockchain', blockchain);
        app.use('/api/analytics', analytics);
        app.use('/api/billing', billing);
        app.use('/api/investments', investments);
        app.use('/api/wallet', createWalletRoutes(db)); // Pass the initialized db pool
        app.use('/api/wallet/transactions', createWalletTransactionRoutes(db)); // Pass the initialized db pool
        app.use('/api/kyc-wallet', createKYCWalletRoutes(db)); // Pass the initialized db pool
        app.use('/api/subscriptions', createSubscriptionRoutes(db)); // Pass the initialized db pool

        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();