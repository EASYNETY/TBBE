"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.investments = exports.billing = exports.analytics = exports.blockchain = exports.vouchers = exports.metadata = exports.notifications = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const database_1 = require("../utils/database");
// Notifications routes
const notificationsRouter = express_1.default.Router();
notificationsRouter.use(auth_1.authenticateToken);
notificationsRouter.get('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { page = '1', limit = '20', read } = req.query;
        const pageNum = Number.parseInt(page);
        const limitNum = Number.parseInt(limit);
        let sqlQuery = "SELECT * FROM notifications WHERE user_id = ?";
        const params = [req.user.id];
        if (read !== undefined) {
            sqlQuery += " AND read_at IS " + (read === 'true' ? "NOT NULL" : "NULL");
        }
        sqlQuery += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        params.push(limitNum, (pageNum - 1) * limitNum);
        const notifications = await (0, database_1.query)(sqlQuery, params);
        // Get total count for pagination
        let countQuery = "SELECT COUNT(*) as total FROM notifications WHERE user_id = ?";
        const countParams = [req.user.id];
        if (read !== undefined) {
            countQuery += " AND read_at IS " + (read === 'true' ? "NOT NULL" : "NULL");
        }
        const countResult = await (0, database_1.query)(countQuery, countParams);
        const total = countResult[0]?.total || 0;
        res.json({
            notifications: notifications.map((n) => ({
                ...n,
                data: n.data ? JSON.parse(n.data) : null,
            })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});
notificationsRouter.put('/:id/read', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        await (0, database_1.query)("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?", [id, req.user.id]);
        res.json({ message: 'Notification marked as read' });
    }
    catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});
exports.notifications = notificationsRouter;
// Metadata routes
const metadataRouter = express_1.default.Router();
metadataRouter.get('/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        // Get property by token ID
        const propertyResult = await (0, database_1.query)(`
      SELECT p.*, u.username as owner_username, u.wallet_address as owner_address
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.token_id = ?
    `, [tokenId]);
        if (propertyResult.length === 0) {
            return res.status(404).json({ error: 'Property not found' });
        }
        const property = propertyResult[0];
        // Generate NFT metadata
        const metadata = {
            name: property.title,
            description: property.description,
            image: property.images ? JSON.parse(property.images)[0] : null,
            attributes: [
                {
                    trait_type: "Property Type",
                    value: property.property_type,
                },
                {
                    trait_type: "Location",
                    value: property.address,
                },
                {
                    trait_type: "Square Footage",
                    value: property.square_footage,
                },
                {
                    trait_type: "Bedrooms",
                    value: property.bedrooms,
                },
                {
                    trait_type: "Bathrooms",
                    value: property.bathrooms,
                },
                {
                    trait_type: "Year Built",
                    value: property.year_built,
                },
            ],
            external_url: `${process.env.FRONTEND_URL}/property/${property.id}`,
        };
        res.json(metadata);
    }
    catch (error) {
        console.error('Get metadata error:', error);
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
});
exports.metadata = metadataRouter;
// Vouchers routes
const vouchersRouter = express_1.default.Router();
vouchersRouter.use(auth_1.authenticateToken);
vouchersRouter.get('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // For now, return empty array as vouchers are not implemented in database
        res.json({
            vouchers: [],
            message: 'Vouchers feature not yet implemented'
        });
    }
    catch (error) {
        console.error('Get vouchers error:', error);
        res.status(500).json({ error: 'Failed to fetch vouchers' });
    }
});
vouchersRouter.post('/sign', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Placeholder for voucher signing
        res.json({
            message: 'Voucher signing not yet implemented',
            voucher: null
        });
    }
    catch (error) {
        console.error('Sign voucher error:', error);
        res.status(500).json({ error: 'Failed to sign voucher' });
    }
});
exports.vouchers = vouchersRouter;
// Blockchain routes
const blockchainRouter = express_1.default.Router();
blockchainRouter.get('/events', async (req, res) => {
    try {
        // Placeholder for blockchain events
        res.json({
            events: [],
            message: 'Blockchain events monitoring not yet implemented'
        });
    }
    catch (error) {
        console.error('Get blockchain events error:', error);
        res.status(500).json({ error: 'Failed to fetch blockchain events' });
    }
});
exports.blockchain = blockchainRouter;
// Analytics routes
const analyticsRouter = express_1.default.Router();
analyticsRouter.get('/market-insights', async (req, res) => {
    try {
        // Get market statistics
        const stats = await (0, database_1.query)(`
      SELECT
        COUNT(DISTINCT p.id) as total_properties,
        COUNT(DISTINCT l.id) as total_listings,
        COUNT(DISTINCT b.id) as total_bids,
        AVG(l.price) as average_price,
        MAX(l.price) as highest_price,
        MIN(l.price) as lowest_price
      FROM properties p
      LEFT JOIN listings l ON p.id = l.property_id AND l.status = 'active'
      LEFT JOIN bids b ON l.id = b.listing_id AND b.status = 'active'
    `);
        const insights = stats[0];
        res.json({
            insights: {
                totalProperties: insights.total_properties || 0,
                totalListings: insights.total_listings || 0,
                totalBids: insights.total_bids || 0,
                averagePrice: insights.average_price || 0,
                priceRange: {
                    highest: insights.highest_price || 0,
                    lowest: insights.lowest_price || 0,
                },
            },
        });
    }
    catch (error) {
        console.error('Get market insights error:', error);
        res.status(500).json({ error: 'Failed to fetch market insights' });
    }
});
analyticsRouter.get('/real-time', async (req, res) => {
    try {
        // Get real-time statistics
        const realtimeStats = await (0, database_1.query)(`
      SELECT
        COUNT(*) as active_listings,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as listings_24h,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as listings_1h,
        AVG(price) as average_price_24h
      FROM listings
      WHERE status = 'active' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
        const stats = realtimeStats[0];
        res.json({
            realtime: {
                activeListings: stats.active_listings || 0,
                newListings24h: stats.listings_24h || 0,
                newListings1h: stats.listings_1h || 0,
                averagePrice24h: stats.average_price_24h || 0,
            },
        });
    }
    catch (error) {
        console.error('Get real-time analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch real-time analytics' });
    }
});
exports.analytics = analyticsRouter;
// Billing routes
const billingRouter = express_1.default.Router();
billingRouter.use(auth_1.authenticateToken);
billingRouter.get('/subscriptions', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Placeholder for subscriptions
        res.json({
            subscriptions: [],
            message: 'Subscriptions feature not yet implemented'
        });
    }
    catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
});
billingRouter.post('/subscriptions', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Placeholder for subscription creation
        res.status(201).json({
            message: 'Subscription creation not yet implemented',
            subscription: null
        });
    }
    catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});
billingRouter.get('/subscriptions/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Placeholder for subscription details
        res.json({
            message: 'Subscription details not yet implemented',
            subscription: null
        });
    }
    catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});
billingRouter.post('/webhooks/stripe', async (req, res) => {
    try {
        // Placeholder for Stripe webhook handling
        console.log('Stripe webhook received:', req.body);
        res.json({ received: true });
    }
    catch (error) {
        console.error('Stripe webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});
exports.billing = billingRouter;
// Investments routes
const investmentsRouter = express_1.default.Router();
investmentsRouter.use(auth_1.authenticateToken);
investmentsRouter.get('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Placeholder for investments
        res.json({
            investments: [],
            message: 'Investments feature not yet implemented'
        });
    }
    catch (error) {
        console.error('Get investments error:', error);
        res.status(500).json({ error: 'Failed to fetch investments' });
    }
});
investmentsRouter.post('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Placeholder for investment creation
        res.status(201).json({
            message: 'Investment creation not yet implemented',
            investment: null
        });
    }
    catch (error) {
        console.error('Create investment error:', error);
        res.status(500).json({ error: 'Failed to create investment' });
    }
});
exports.investments = investmentsRouter;
//# sourceMappingURL=index.js.map