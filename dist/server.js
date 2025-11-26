"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // Load environment variables at the very top
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./utils/database"); // Import connectDB
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const properties_1 = __importDefault(require("./routes/properties"));
const marketplace_1 = __importDefault(require("./routes/marketplace"));
const escrow_1 = __importDefault(require("./routes/escrow"));
const kyc_1 = __importDefault(require("./routes/kyc"));
const minting_1 = __importDefault(require("./routes/minting"));
const payments_1 = __importDefault(require("./routes/payments"));
const admin_1 = __importDefault(require("./routes/admin"));
const subscription_1 = require("./routes/subscription");
const wallet_1 = require("./routes/wallet");
const walletTransactions_1 = require("./routes/walletTransactions");
const kycWallet_1 = require("./routes/kycWallet");
const index_1 = require("./routes/index");
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
let db;
async function startServer() {
    try {
        // First, connect to the database and wait for the connection to be established.
        await (0, database_1.connectDB)();
        db = (0, database_1.getPool)(); // Now, get the initialized pool.
        // Setup routes
        app.use('/api/auth', auth_1.default);
        app.use('/api/properties', properties_1.default);
        app.use('/api/marketplace', marketplace_1.default);
        app.use('/api/escrow', escrow_1.default);
        app.use('/api/kyc', kyc_1.default);
        app.use('/api/minting', minting_1.default);
        app.use('/api/payments', payments_1.default);
        app.use('/api/admin', admin_1.default);
        app.use('/api/notifications', index_1.notifications);
        app.use('/api/metadata', index_1.metadata);
        app.use('/api/vouchers', index_1.vouchers);
        app.use('/api/blockchain', index_1.blockchain);
        app.use('/api/analytics', index_1.analytics);
        app.use('/api/billing', index_1.billing);
        app.use('/api/investments', index_1.investments);
        app.use('/api/wallet', (0, wallet_1.createWalletRoutes)(db)); // Pass the initialized db pool
        app.use('/api/wallet/transactions', (0, walletTransactions_1.createWalletTransactionRoutes)(db)); // Pass the initialized db pool
        app.use('/api/kyc-wallet', (0, kycWallet_1.createKYCWalletRoutes)(db)); // Pass the initialized db pool
        app.use('/api/subscriptions', (0, subscription_1.createSubscriptionRoutes)(db)); // Pass the initialized db pool
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=server.js.map