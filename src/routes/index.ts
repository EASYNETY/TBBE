import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from '../services/notificationService';

// Notifications routes
const notificationsRouter = express.Router();
notificationsRouter.use(authenticateToken);

notificationsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { page = '1', limit = '20', read } = req.query;
    const pageNum = Number.parseInt(page as string);
    const limitNum = Number.parseInt(limit as string);

    let sqlQuery = "SELECT * FROM notifications WHERE user_id = ?";
    const params: any[] = [req.user.id];

    if (read !== undefined) {
      sqlQuery += " AND read_at IS " + (read === 'true' ? "NOT NULL" : "NULL");
    }

    sqlQuery += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limitNum, (pageNum - 1) * limitNum);

    const notifications = await query(sqlQuery, params);

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as total FROM notifications WHERE user_id = ?";
    const countParams: any[] = [req.user.id];

    if (read !== undefined) {
      countQuery += " AND read_at IS " + (read === 'true' ? "NOT NULL" : "NULL");
    }

    const countResult = await query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    res.json({
      notifications: notifications.map((n: any) => ({
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
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

notificationsRouter.put('/:id/read', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    await query(
      "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

notificationsRouter.get('/unread/count', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const count = await NotificationService.getUnreadCount(req.user.id);

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

notificationsRouter.post('/:id/read', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Get notification details
    const notificationResult = await query(
      "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    if (notificationResult.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const notification = notificationResult[0];

    // Mark as read if not already read
    if (!notification.read_at) {
      await query(
        "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        [id, req.user.id]
      );
    }

    res.json({
      message: 'Notification marked as read',
      notification: {
        ...notification,
        data: notification.data ? JSON.parse(notification.data) : null,
      },
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

export const notifications = notificationsRouter;

// Metadata routes
const metadataRouter = express.Router();

metadataRouter.get('/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;

    // Get property by token ID
    const propertyResult = await query(`
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
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

export const metadata = metadataRouter;

// Vouchers routes
const vouchersRouter = express.Router();
vouchersRouter.use(authenticateToken);

vouchersRouter.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // For now, return empty array as vouchers are not implemented in database
    res.json({
      vouchers: [],
      message: 'Vouchers feature not yet implemented'
    });
  } catch (error) {
    console.error('Get vouchers error:', error);
    res.status(500).json({ error: 'Failed to fetch vouchers' });
  }
});

vouchersRouter.post('/sign', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Placeholder for voucher signing
    res.json({
      message: 'Voucher signing not yet implemented',
      voucher: null
    });
  } catch (error) {
    console.error('Sign voucher error:', error);
    res.status(500).json({ error: 'Failed to sign voucher' });
  }
});

export const vouchers = vouchersRouter;

// Blockchain routes
const blockchainRouter = express.Router();

blockchainRouter.get('/events', async (req, res) => {
  try {
    // Placeholder for blockchain events
    res.json({
      events: [],
      message: 'Blockchain events monitoring not yet implemented'
    });
  } catch (error) {
    console.error('Get blockchain events error:', error);
    res.status(500).json({ error: 'Failed to fetch blockchain events' });
  }
});

export const blockchain = blockchainRouter;

// Analytics routes
const analyticsRouter = express.Router();

// Protected analytics endpoint - requires authentication
analyticsRouter.get('/dashboard', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Get comprehensive analytics data
    const [propertyStats, listingStats, bidStats, userStats] = await Promise.all([
      // Property statistics
      query(`
        SELECT
          COUNT(*) as total_properties,
          COUNT(DISTINCT p.location) as unique_locations,
          AVG(p.assessed_value) as avg_property_value,
          SUM(p.assessed_value) as total_aum
        FROM properties p
      `),
      // Listing statistics
      query(`
        SELECT
          COUNT(*) as total_listings,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_listings,
          COUNT(CASE WHEN listing_type = 'auction' THEN 1 END) as auction_listings,
          COUNT(CASE WHEN listing_type = 'fixed_price' THEN 1 END) as fixed_price_listings,
          AVG(CASE WHEN status = 'active' THEN price END) as avg_active_price,
          SUM(CASE WHEN status = 'active' THEN price END) as total_active_volume
        FROM listings
      `),
      // Bid statistics
      query(`
        SELECT
          COUNT(*) as total_bids,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_bids,
          AVG(CASE WHEN status = 'active' THEN amount END) as avg_bid_amount,
          MAX(CASE WHEN status = 'active' THEN amount END) as max_bid_amount
        FROM bids
      `),
      // User statistics
      query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'investor' THEN 1 END) as investor_count,
          COUNT(CASE WHEN role = 'seller' THEN 1 END) as seller_count,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_30d
        FROM users
        WHERE status = 'active'
      `)
    ]);

    const props = propertyStats[0];
    const listings = listingStats[0];
    const bids = bidStats[0];
    const users = userStats[0];

    // Calculate platform yield (simplified: average returns)
    const platformYield = listings.avg_active_price ? (listings.avg_active_price / (props.avg_property_value || 1)) * 100 : 7.4;

    res.json({
      metrics: {
        totalAUM: props.total_aum || 0,
        activeProperties: props.total_properties || 0,
        platformYield: parseFloat(platformYield.toFixed(1)),
        activeInvestors: users.investor_count || 0,
      },
      propertyMetrics: {
        totalProperties: props.total_properties || 0,
        uniqueLocations: props.unique_locations || 0,
        avgPropertyValue: props.avg_property_value || 0,
      },
      listingMetrics: {
        totalListings: listings.total_listings || 0,
        activeListings: listings.active_listings || 0,
        auctionListings: listings.auction_listings || 0,
        fixedPriceListings: listings.fixed_price_listings || 0,
        avgActivePrice: listings.avg_active_price || 0,
        totalActiveVolume: listings.total_active_volume || 0,
      },
      bidMetrics: {
        totalBids: bids.total_bids || 0,
        activeBids: bids.active_bids || 0,
        avgBidAmount: bids.avg_bid_amount || 0,
        maxBidAmount: bids.max_bid_amount || 0,
      },
      userMetrics: {
        totalUsers: users.total_users || 0,
        investorCount: users.investor_count || 0,
        sellerCount: users.seller_count || 0,
        newUsers30d: users.new_users_30d || 0,
      },
    });
  } catch (error) {
    console.error('Get analytics dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics dashboard' });
  }
});

analyticsRouter.get('/market-insights', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Get market statistics
    const stats = await query(`
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
  } catch (error) {
    console.error('Get market insights error:', error);
    res.status(500).json({ error: 'Failed to fetch market insights' });
  }
});

analyticsRouter.get('/real-time', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Get real-time statistics
    const realtimeStats = await query(`
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
  } catch (error) {
    console.error('Get real-time analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch real-time analytics' });
  }
});

export const analytics = analyticsRouter;

// Billing routes
const billingRouter = express.Router();
billingRouter.use(authenticateToken);

billingRouter.get('/subscriptions', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Placeholder for subscriptions
    res.json({
      subscriptions: [],
      message: 'Subscriptions feature not yet implemented'
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

billingRouter.post('/subscriptions', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Placeholder for subscription creation
    res.status(201).json({
      message: 'Subscription creation not yet implemented',
      subscription: null
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

billingRouter.get('/subscriptions/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Placeholder for subscription details
    res.json({
      message: 'Subscription details not yet implemented',
      subscription: null
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

billingRouter.post('/webhooks/stripe', async (req, res) => {
  try {
    // Placeholder for Stripe webhook handling
    console.log('Stripe webhook received:', req.body);

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export const billing = billingRouter;

// Investments routes
const investmentsRouter = express.Router();
investmentsRouter.use(authenticateToken);

investmentsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Placeholder for investments
    res.json({
      investments: [],
      message: 'Investments feature not yet implemented'
    });
  } catch (error) {
    console.error('Get investments error:', error);
    res.status(500).json({ error: 'Failed to fetch investments' });
  }
});

investmentsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Placeholder for investment creation
    res.status(201).json({
      message: 'Investment creation not yet implemented',
      investment: null
    });
  } catch (error) {
    console.error('Create investment error:', error);
    res.status(500).json({ error: 'Failed to create investment' });
  }
});

export const investments = investmentsRouter;