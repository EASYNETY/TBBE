"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const database_1 = require("../utils/database");
const uuid_1 = require("uuid");
const notificationService_1 = require("../services/notificationService");
const router = express_1.default.Router();
// Listings routes
router.get('/listings', async (req, res) => {
    try {
        const { page = '1', limit = '20', status = 'active', propertyId } = req.query;
        const pageNum = Number.parseInt(page);
        const limitNum = Number.parseInt(limit);
        if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
            return res.status(400).json({ error: 'Invalid page or limit parameters' });
        }
        let sqlQuery = `
      SELECT l.*, p.title as property_title, p.description as property_description,
             p.images as property_images, p.assessed_value, u.username as seller_username,
             u.wallet_address as seller_address
      FROM listings l
      LEFT JOIN properties p ON l.property_id = p.id
      LEFT JOIN users u ON l.seller_id = u.id
      WHERE 1=1
    `;
        const params = [];
        if (status) {
            sqlQuery += " AND l.status = ?";
            params.push(status);
        }
        if (propertyId) {
            sqlQuery += " AND l.property_id = ?";
            params.push(propertyId);
        }
        sqlQuery += " ORDER BY l.created_at DESC LIMIT ? OFFSET ?";
        const offset = (pageNum - 1) * limitNum;
        params.push(limitNum, offset);
        console.log('SQL Query:', sqlQuery);
        console.log('Query params:', params.map(p => typeof p + ': ' + p)); // Debug log with types
        const listings = await (0, database_1.query)(sqlQuery, params);
        // Get total count for pagination
        let countQuery = "SELECT COUNT(*) as total FROM listings l WHERE 1=1";
        const countParams = [];
        if (status) {
            countQuery += " AND l.status = ?";
            countParams.push(status);
        }
        if (propertyId) {
            countQuery += " AND l.property_id = ?";
            countParams.push(propertyId);
        }
        const countResult = await (0, database_1.query)(countQuery, countParams);
        const total = countResult[0]?.total || 0;
        res.json({
            listings: listings.map((l) => ({
                ...l,
                property_images: l.property_images ? JSON.parse(l.property_images) : [],
                price: Number(l.price).toFixed(2),
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
        console.error('Get listings error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to fetch listings', details: errorMessage });
    }
});
router.post('/listings', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { propertyId, price, duration, listingType } = req.body;
        // Validate required fields
        if (!propertyId || !price || !listingType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Check if property exists and user owns it
        const propertyResult = await (0, database_1.query)("SELECT * FROM properties WHERE id = ? AND owner_id = ?", [propertyId, req.user.id]);
        if (propertyResult.length === 0) {
            return res.status(404).json({ error: 'Property not found or unauthorized' });
        }
        // Check if property is already listed
        const existingListing = await (0, database_1.query)("SELECT * FROM listings WHERE property_id = ? AND status = 'active'", [propertyId]);
        if (existingListing.length > 0) {
            return res.status(409).json({ error: 'Property is already listed' });
        }
        const listingId = (0, uuid_1.v4)();
        const startTime = new Date();
        const endTime = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;
        const sqlQuery = `
      INSERT INTO listings (
        id, property_id, seller_id, listing_type, price, currency,
        start_time, end_time, status
      ) VALUES (?, ?, ?, ?, ?, 'ETH', ?, ?, 'active')
    `;
        await (0, database_1.query)(sqlQuery, [
            listingId,
            propertyId,
            req.user.id,
            listingType,
            price,
            startTime,
            endTime,
        ]);
        // Fetch the created listing with property details
        const listingResult = await (0, database_1.query)(`
      SELECT l.*, p.title as property_title, p.description as property_description,
             p.images as property_images, p.assessed_value, u.username as seller_username,
             u.wallet_address as seller_address
      FROM listings l
      LEFT JOIN properties p ON l.property_id = p.id
      LEFT JOIN users u ON l.seller_id = u.id
      WHERE l.id = ?
    `, [listingId]);
        const listing = listingResult[0];
        res.status(201).json({
            listing: {
                ...listing,
                property_images: listing.property_images ? JSON.parse(listing.property_images) : [],
            },
        });
    }
    catch (error) {
        console.error('Create listing error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to create listing', details: errorMessage });
    }
});
router.get('/listings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const listingResult = await (0, database_1.query)(`
      SELECT l.*, p.title as property_title, p.description as property_description,
             p.images as property_images, p.address as property_address, p.assessed_value,
             u.username as seller_username, u.wallet_address as seller_address
      FROM listings l
      LEFT JOIN properties p ON l.property_id = p.id
      LEFT JOIN users u ON l.seller_id = u.id
      WHERE l.id = ?
    `, [id]);
        if (listingResult.length === 0) {
            return res.status(404).json({ error: 'Listing not found' });
        }
        const listing = listingResult[0];
        res.json({
            listing: {
                ...listing,
                property_images: listing.property_images ? JSON.parse(listing.property_images) : [],
                price: Number(listing.price).toFixed(2),
            },
        });
    }
    catch (error) {
        console.error('Get listing error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to fetch listing', details: errorMessage });
    }
});
router.put('/listings/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const updates = req.body;
        // Check if listing exists and user owns it
        const listingResult = await (0, database_1.query)(`
      SELECT l.* FROM listings l
      WHERE l.id = ? AND l.seller_id = ?
    `, [id, req.user.id]);
        if (listingResult.length === 0) {
            return res.status(404).json({ error: 'Listing not found or unauthorized' });
        }
        // Build update query
        const updateFields = Object.keys(updates).filter(key => updates[key] !== undefined && key !== 'id');
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        const setClause = updateFields.map(field => `${field} = ?`).join(', ');
        const values = updateFields.map(field => updates[field]);
        values.push(id);
        await (0, database_1.query)(`UPDATE listings SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
        // Fetch updated listing
        const updatedResult = await (0, database_1.query)(`
      SELECT l.*, p.title as property_title, p.description as property_description,
             p.images as property_images, u.username as seller_username,
             u.wallet_address as seller_address
      FROM listings l
      LEFT JOIN properties p ON l.property_id = p.id
      LEFT JOIN users u ON l.seller_id = u.id
      WHERE l.id = ?
    `, [id]);
        const listing = updatedResult[0];
        res.json({
            listing: {
                ...listing,
                property_images: listing.property_images ? JSON.parse(listing.property_images) : [],
                price: Number(listing.price).toFixed(2),
            },
        });
    }
    catch (error) {
        console.error('Update listing error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to update listing', details: errorMessage });
    }
});
router.delete('/listings/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        // Check if listing exists and user owns it
        const listingResult = await (0, database_1.query)(`
      SELECT l.* FROM listings l
      WHERE l.id = ? AND l.seller_id = ?
    `, [id, req.user.id]);
        if (listingResult.length === 0) {
            return res.status(404).json({ error: 'Listing not found or unauthorized' });
        }
        await (0, database_1.query)("UPDATE listings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
        res.json({ message: 'Listing cancelled successfully' });
    }
    catch (error) {
        console.error('Delete listing error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to cancel listing', details: errorMessage });
    }
});
// Bids routes
router.get('/bids', async (req, res) => {
    try {
        const { listingId, bidderId, status } = req.query;
        let sqlQuery = `
      SELECT b.*, p.title as listing_title, u.username as bidder_username,
             u.wallet_address as bidder_address
      FROM bids b
      LEFT JOIN listings l ON b.listing_id = l.id
      LEFT JOIN properties p ON l.property_id = p.id
      LEFT JOIN users u ON b.bidder_id = u.id
      WHERE 1=1
    `;
        const params = [];
        if (listingId) {
            sqlQuery += " AND b.listing_id = ?";
            params.push(listingId);
        }
        if (bidderId) {
            sqlQuery += " AND b.bidder_id = ?";
            params.push(bidderId);
        }
        if (status) {
            sqlQuery += " AND b.status = ?";
            params.push(status);
        }
        sqlQuery += " ORDER BY b.created_at DESC";
        const bids = await (0, database_1.query)(sqlQuery, params);
        res.json({ bids });
    }
    catch (error) {
        console.error('Get bids error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to fetch bids', details: errorMessage });
    }
});
router.post('/bids', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { listingId, amount, currency = 'ETH' } = req.body;
        // Validate required fields
        if (!listingId || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Check if listing exists and is active
        const listingResult = await (0, database_1.query)("SELECT * FROM listings WHERE id = ? AND status = 'active'", [listingId]);
        if (listingResult.length === 0) {
            return res.status(404).json({ error: 'Listing not found or not active' });
        }
        const listing = listingResult[0];
        // Check if user is not the seller
        if (listing.seller_id === req.user.id) {
            return res.status(400).json({ error: 'Cannot bid on your own listing' });
        }
        // Check if bid amount is higher than current price
        if (parseFloat(amount) <= parseFloat(listing.price)) {
            return res.status(400).json({ error: 'Bid amount must be higher than listing price' });
        }
        const bidId = (0, uuid_1.v4)();
        const sqlQuery = `
      INSERT INTO bids (
        id, listing_id, bidder_id, amount, currency, status
      ) VALUES (?, ?, ?, ?, ?, 'active')
    `;
        await (0, database_1.query)(sqlQuery, [
            bidId,
            listingId,
            req.user.id,
            amount,
            currency,
        ]);
        // Update other bids to 'outbid' status
        await (0, database_1.query)(`
      UPDATE bids SET status = 'outbid'
      WHERE listing_id = ? AND id != ? AND status = 'active'
    `, [listingId, bidId]);
        // Fetch the created bid
        const bidResult = await (0, database_1.query)(`
      SELECT b.*, p.title as listing_title, u.username as bidder_username,
             u.wallet_address as bidder_address
      FROM bids b
      LEFT JOIN listings l ON b.listing_id = l.id
      LEFT JOIN properties p ON l.property_id = p.id
      LEFT JOIN users u ON b.bidder_id = u.id
      WHERE b.id = ?
    `, [bidId]);
        const bid = bidResult[0];
        // Notify the property owner about the new bid
        try {
            await notificationService_1.NotificationService.notifyBidReceived(listing.seller_id, req.user.name || req.user.address, listing.property_title, amount, listingId);
        }
        catch (notificationError) {
            console.error('Error creating bid notification:', notificationError);
            // Don't fail the bid creation if notification fails
        }
        res.status(201).json({ bid });
    }
    catch (error) {
        console.error('Create bid error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to create bid', details: errorMessage });
    }
});
router.get('/bids/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const bidResult = await (0, database_1.query)(`
      SELECT b.*, p.title as listing_title, u.username as bidder_username,
             u.wallet_address as bidder_address
      FROM bids b
      LEFT JOIN listings l ON b.listing_id = l.id
      LEFT JOIN properties p ON l.property_id = p.id
      LEFT JOIN users u ON b.bidder_id = u.id
      WHERE b.id = ?
    `, [id]);
        if (bidResult.length === 0) {
            return res.status(404).json({ error: 'Bid not found' });
        }
        const bid = bidResult[0];
        res.json({ bid });
    }
    catch (error) {
        console.error('Get bid error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to fetch bid', details: errorMessage });
    }
});
router.put('/bids/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const updates = req.body; // e.g., { status: 'accepted' }
        // Check if bid exists and user owns it or is seller
        const bidResult = await (0, database_1.query)(`
      SELECT b.* FROM bids b
      LEFT JOIN listings l ON b.listing_id = l.id
      WHERE b.id = ? AND (b.bidder_id = ? OR l.seller_id = ?)
    `, [id, req.user.id, req.user.id]);
        if (bidResult.length === 0) {
            return res.status(404).json({ error: 'Bid not found or unauthorized' });
        }
        // Validate updates
        const allowedUpdates = ['status', 'amount'];
        const updateFields = Object.keys(updates).filter(key => allowedUpdates.includes(key));
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        const setClause = updateFields.map(field => `${field} = ?`).join(', ');
        const values = updateFields.map(field => updates[field]);
        values.push(id);
        await (0, database_1.query)(`UPDATE bids SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
        // Fetch updated bid
        const updatedResult = await (0, database_1.query)(`
      SELECT b.*, p.title as listing_title, u.username as bidder_username,
             u.wallet_address as bidder_address
      FROM bids b
      LEFT JOIN listings l ON b.listing_id = l.id
      LEFT JOIN properties p ON l.property_id = p.id
      LEFT JOIN users u ON b.bidder_id = u.id
      WHERE b.id = ?
    `, [id]);
        const bid = updatedResult[0];
        res.json({ bid });
    }
    catch (error) {
        console.error('Update bid error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to update bid', details: errorMessage });
    }
});
router.delete('/bids/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        // Check if bid exists and user owns it
        const bidResult = await (0, database_1.query)(`
      SELECT b.* FROM bids b
      WHERE b.id = ? AND b.bidder_id = ?
    `, [id, req.user.id]);
        if (bidResult.length === 0) {
            return res.status(404).json({ error: 'Bid not found or unauthorized' });
        }
        await (0, database_1.query)("UPDATE bids SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
        res.json({ message: 'Bid cancelled successfully' });
    }
    catch (error) {
        console.error('Delete bid error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to cancel bid', details: errorMessage });
    }
});
exports.default = router;
//# sourceMappingURL=marketplace.js.map