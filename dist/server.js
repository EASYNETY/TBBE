"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./utils/database");
const auth_1 = __importDefault(require("./routes/auth"));
const admin_1 = __importDefault(require("./routes/admin"));
const marketplace_1 = __importDefault(require("./routes/marketplace"));
const properties_1 = __importDefault(require("./routes/properties"));
const payments_1 = __importDefault(require("./routes/payments"));
const escrow_1 = __importDefault(require("./routes/escrow"));
const kyc_1 = __importDefault(require("./routes/kyc"));
const index_1 = require("./routes/index");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/marketplace', marketplace_1.default);
app.use('/api/properties', properties_1.default);
app.use('/api/payments', payments_1.default);
app.use('/api/escrow', escrow_1.default);
app.use('/api/kyc', kyc_1.default);
app.use('/api/notifications', index_1.notifications);
app.use('/api/metadata', index_1.metadata);
app.use('/api/vouchers', index_1.vouchers);
app.use('/api/blockchain', index_1.blockchain);
app.use('/api/analytics', index_1.analytics);
app.use('/api/billing', index_1.billing);
app.use('/api/investments', index_1.investments);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});
// Connect to database and start server
(0, database_1.connectDB)().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch((error) => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
});
exports.default = app;
//# sourceMappingURL=server.js.map