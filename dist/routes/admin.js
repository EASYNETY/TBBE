"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const database_1 = require("../utils/database");
const uuid_1 = require("uuid");
const blockchain_1 = require("../services/blockchain");
console.log('Loaded MINTER_ADDRESS:', process.env.MINTER_ADDRESS);
console.log('Loaded PRIVATE_KEY:', process.env.PRIVATE_KEY ? '✔️ Exists' : '❌ Missing');
const router = express_1.default.Router();
// Apply authentication and admin role check to all routes
router.use(auth_1.authenticateToken);
router.use((0, auth_1.requireRole)(['admin', 'super-admin']));
// Users routes
router.get('/users', async (req, res) => {
    try {
        const { page = '1', limit = '20' } = req.query;
        const pageNum = Number.parseInt(page);
        const limitNum = Number.parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        const [users, countResult] = await Promise.all([
            (0, database_1.query)(`
          SELECT id, username, email, wallet_address, kyc_status, created_at
          FROM users
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `, [limitNum, offset]),
            (0, database_1.query)('SELECT COUNT(*) as total FROM users')
        ]);
        const total = countResult[0]?.total || 0;
        res.json({
            users: users.map((u) => ({
                ...u,
                wallet_address: u.wallet_address ? `${u.wallet_address.slice(0, 6)}...${u.wallet_address.slice(-4)}` : null,
                joinedAt: new Date(u.created_at).toISOString().split('T')[0],
                lastActive: u.last_login ? new Date(u.last_login).toISOString().split('T')[0] : null
            })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    }
    catch (error) {
        console.error('Failed to fetch users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// Properties routes - Show ALL properties for admin
router.get('/properties', async (req, res) => {
    try {
        const { page = '1', limit = '20', status } = req.query;
        const pageNum = Number.parseInt(page);
        const limitNum = Number.parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        let sqlQuery = `
        SELECT p.*, u.username as owner_username, u.wallet_address as owner_address
        FROM properties p
        LEFT JOIN users u ON p.owner_id = u.id
        WHERE 1=1
      `;
        const params = [];
        if (status && status !== 'undefined' && status !== '') {
            sqlQuery += " AND p.status = ?";
            params.push(status);
        }
        sqlQuery += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
        params.push(limitNum, offset);
        const [properties, countResult] = await Promise.all([
            (0, database_1.query)(sqlQuery, params),
            (0, database_1.query)(`
          SELECT COUNT(*) as total FROM properties p
          WHERE 1=1 ${status && status !== 'undefined' && status !== '' ? 'AND p.status = ?' : ''}
        `, status && status !== 'undefined' && status !== '' ? [status] : [])
        ]);
        const total = countResult[0]?.total || 0;
        res.json({
            properties: properties.map((p) => ({
                ...p,
                owner: p.owner_address ? `${p.owner_address.slice(0, 6)}...${p.owner_address.slice(-4)}` : p.owner_username,
                createdAt: new Date(p.created_at).toISOString().split('T')[0],
                images: p.images ? JSON.parse(p.images) : [],
                documents: p.documents ? JSON.parse(p.documents) : [],
                verification_documents: p.verification_documents ? JSON.parse(p.verification_documents) : [],
                metadata_tags: p.metadata_tags ? JSON.parse(p.metadata_tags) : [],
                hidden: p.hidden || false
            })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    }
    catch (error) {
        console.error('Failed to fetch properties:', error);
        res.status(500).json({ error: 'Failed to fetch properties' });
    }
});
// Analytics routes
router.get('/analytics', async (req, res) => {
    try {
        const [totalUsers, activeProperties, pendingReviews, totalVolumeResult] = await Promise.all([
            (0, database_1.query)('SELECT COUNT(*) as count FROM users'),
            (0, database_1.query)('SELECT COUNT(*) as count FROM properties WHERE verification_status = "approved"'),
            (0, database_1.query)('SELECT COUNT(*) as count FROM properties WHERE verification_status = "pending"'),
            (0, database_1.query)('SELECT COALESCE(SUM(amount), 0) as total FROM payments')
        ]);
        res.json({
            stats: {
                totalUsers: totalUsers[0].count,
                activeProperties: activeProperties[0].count,
                totalVolume: `$${parseFloat(totalVolumeResult[0].total).toLocaleString()}`,
                pendingReviews: pendingReviews[0].count
            }
        });
    }
    catch (error) {
        console.error('Failed to fetch analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});
// Distribution routes
router.get('/distributions', (req, res) => {
    res.json({ message: 'Distributions endpoint' });
});
router.post('/distributions/process', (req, res) => {
    res.json({ message: 'Process distributions endpoint' });
});
router.get('/distributions/export', (req, res) => {
    res.json({ message: 'Export distributions endpoint' });
});
// Activity routes
router.get('/activity', async (req, res) => {
    try {
        const [recentUsers, recentPayments, recentListings] = await Promise.all([
            (0, database_1.query)('SELECT username, wallet_address, created_at FROM users ORDER BY created_at DESC LIMIT 5'),
            (0, database_1.query)('SELECT amount, status, created_at FROM payments ORDER BY created_at DESC LIMIT 5'),
            (0, database_1.query)('SELECT l.property_title, l.created_at FROM listings l ORDER BY l.created_at DESC LIMIT 5'),
        ]);
        const activities = [
            ...recentListings.map((l) => ({
                type: 'property',
                action: 'New property listed',
                details: l.property_title,
                time: new Date(l.created_at).toISOString(),
            })),
            ...recentUsers.map((u) => ({
                type: 'user',
                action: 'New user registered',
                details: u.username,
                time: new Date(u.created_at).toISOString(),
            })),
            ...recentPayments.map((p) => ({
                type: 'transaction',
                action: 'Transaction completed',
                details: `$${p.amount || 0}`,
                time: new Date(p.created_at).toISOString(),
            })),
        ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);
        res.json({ activities });
    }
    catch (error) {
        console.error('Failed to fetch activity:', error);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});
// Payment Options routes
router.get('/payment-options', async (req, res) => {
    try {
        const options = await (0, database_1.query)('SELECT * FROM payment_options ORDER BY created_at DESC');
        res.json({ paymentOptions: options });
    }
    catch (error) {
        console.error('Failed to fetch payment options:', error);
        res.status(500).json({ error: 'Failed to fetch payment options' });
    }
});
router.post('/payment-options', async (req, res) => {
    try {
        const { name, type, currency, provider, fee_percentage, is_active, config } = req.body;
        if (!name || !type) {
            return res.status(400).json({ error: 'Name and type are required' });
        }
        const id = (0, uuid_1.v4)();
        await (0, database_1.query)('INSERT INTO payment_options (id, name, type, currency, provider, fee_percentage, is_active, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, name, type, currency || null, provider || null, fee_percentage || 0, is_active || false, JSON.stringify(config || {})]);
        res.status(201).json({ message: 'Payment option created successfully', id });
    }
    catch (error) {
        console.error('Failed to create payment option:', error);
        res.status(500).json({ error: 'Failed to create payment option' });
    }
});
router.put('/payment-options/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, currency, provider, fee_percentage, is_active, config } = req.body;
        if (!name || !type) {
            return res.status(400).json({ error: 'Name and type are required' });
        }
        await (0, database_1.query)('UPDATE payment_options SET name = ?, type = ?, currency = ?, provider = ?, fee_percentage = ?, is_active = ?, config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, type, currency || null, provider || null, fee_percentage || 0, is_active || false, JSON.stringify(config || {}), id]);
        const updated = await (0, database_1.query)('SELECT * FROM payment_options WHERE id = ?', [id]);
        if (updated.length === 0) {
            return res.status(404).json({ error: 'Payment option not found' });
        }
        res.json({ message: 'Payment option updated successfully', option: updated[0] });
    }
    catch (error) {
        console.error('Failed to update payment option:', error);
        res.status(500).json({ error: 'Failed to update payment option' });
    }
});
// Settings routes
router.get('/settings', async (req, res) => {
    try {
        // Assume a settings table with a single row or use defaults
        const settingsResult = await (0, database_1.query)('SELECT * FROM platform_settings LIMIT 1');
        let settings = {
            platformName: 'TitleBase',
            maintenanceMode: false,
            newUserRegistration: true,
            kycRequired: true,
            emailNotifications: true,
            smsNotifications: false,
            marketplaceFee: '1.0',
            minimumInvestment: '100',
            maxPropertiesPerUser: '50',
            // Add more defaults as needed
        };
        if (settingsResult.length > 0) {
            settings = {
                ...settings,
                ...JSON.parse(settingsResult[0].config || '{}')
            };
        }
        res.json({ settings });
    }
    catch (error) {
        console.error('Failed to fetch settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});
router.put('/settings', async (req, res) => {
    try {
        const settings = req.body;
        const [existing] = await (0, database_1.query)('SELECT * FROM platform_settings LIMIT 1');
        if (existing) {
            await (0, database_1.query)('UPDATE platform_settings SET config = ?, updated_at = CURRENT_TIMESTAMP', [JSON.stringify(settings)]);
        }
        else {
            const id = (0, uuid_1.v4)();
            await (0, database_1.query)('INSERT INTO platform_settings (id, config) VALUES (?, ?)', [id, JSON.stringify(settings)]);
        }
        res.json({ message: 'Settings updated successfully', settings });
    }
    catch (error) {
        console.error('Failed to update settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});
// Property status update
router.put('/properties/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const result = await (0, database_1.query)('UPDATE properties SET verification_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Property not found' });
        }
        res.json({ message: `Property ${status} successfully`, status });
    }
    catch (error) {
        console.error('Failed to update property status:', error);
        res.status(500).json({ error: 'Failed to update property status' });
    }
});
// Property approval route
router.post('/properties/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await (0, database_1.query)('UPDATE properties SET verification_status = "verified", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Property not found' });
        }
        res.json({ message: 'Property approved successfully', status: 'verified' });
    }
    catch (error) {
        console.error('Failed to approve property:', error);
        res.status(500).json({ error: 'Failed to approve property' });
    }
});
// Property reject route
router.post('/properties/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await (0, database_1.query)('UPDATE properties SET verification_status = "rejected", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Property not found' });
        }
        res.json({ message: 'Property rejected successfully', status: 'rejected' });
    }
    catch (error) {
        console.error('Failed to reject property:', error);
        res.status(500).json({ error: 'Failed to reject property' });
    }
});
router.post('/properties/:id/mint', async (req, res) => {
    try {
        const { id } = req.params;
        // Get property details
        const [property] = await (0, database_1.query)(`
      SELECT p.*, u.wallet_address as owner_wallet_address
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
    `, [id]);
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }
        if (property.verification_status !== 'verified') {
            return res.status(400).json({ error: 'Property must be verified before minting' });
        }
        if (property.token_id) {
            return res.status(400).json({ error: 'Property already minted' });
        }
        // Check for required details
        if (!property.legal_description || !property.assessed_value || !property.jurisdiction || !property.document_hash) {
            return res.status(400).json({
                error: 'Missing required property details for minting. Ensure legal_description, assessed_value, jurisdiction, and document_hash are set.'
            });
        }
        // Use system wallet for minting
        const minterAddress = process.env.MINTER_ADDRESS;
        const privateKey = process.env.PRIVATE_KEY;
        if (!minterAddress || !privateKey) {
            return res.status(500).json({ error: 'Minter wallet not configured on server' });
        }
        // Mint NFT using system wallet
        const { tokenId, transactionHash } = await (0, blockchain_1.mintTitleNFT)(minterAddress, property.id, property.legal_description, property.assessed_value, property.jurisdiction, property.document_hash);
        // Update property with token ID and transaction hash
        await (0, database_1.query)('UPDATE properties SET token_id = ?, mint_transaction_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [tokenId, transactionHash, id]);
        // Create transaction record
        const transactionId = (0, uuid_1.v4)();
        await (0, database_1.query)('INSERT INTO transactions (id, property_id, transaction_type, status, transaction_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)', [transactionId, id, 'mint', 'confirmed', transactionHash, new Date().toISOString()]);
        console.log('✅ Property minted successfully:', { tokenId, transactionHash, propertyId: id });
        res.json({
            message: 'Property minted successfully',
            tokenId,
            transactionId,
            transactionHash,
            minterAddress,
            status: 'verified'
        });
    }
    catch (error) {
        console.error('❌ Failed to mint property:', error);
        res.status(500).json({ error: 'Failed to mint property' });
    }
});
// Property CRUD
router.post('/properties', async (req, res) => {
    try {
        const propertyData = req.body;
        const id = (0, uuid_1.v4)();
        await (0, database_1.query)('INSERT INTO properties (id, owner_id, title, description, address, property_type, ownership_type, fractional, supply, project_id, square_footage, bedrooms, bathrooms, year_built, lot_size, images, documents, video_tour_url, metadata_tags, legal_description, assessed_value, jurisdiction, document_hash, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending")', [id, propertyData.owner_id || req.user?.id || null, propertyData.title, propertyData.description, propertyData.address, propertyData.property_type, propertyData.ownership_type || 'fractional', propertyData.fractional || false, propertyData.supply || null, propertyData.project_id || null, propertyData.square_footage || null, propertyData.bedrooms || null, propertyData.bathrooms || null, propertyData.year_built || null, propertyData.lot_size || null, JSON.stringify(propertyData.images || []), JSON.stringify(propertyData.documents || []), propertyData.video_tour_url || null, JSON.stringify(propertyData.metadata_tags || []), propertyData.legal_description || null, propertyData.assessed_value || null, propertyData.jurisdiction || null, propertyData.document_hash || null]);
        res.status(201).json({ message: 'Property created successfully', id });
    }
    catch (error) {
        console.error('Failed to create property:', error);
        res.status(500).json({ error: 'Failed to create property' });
    }
});
router.put('/properties/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const updateFields = Object.keys(updates).filter(key => key !== 'id' && updates[key] !== undefined);
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        const setClause = updateFields.map(field => `${field} = ?`).join(', ');
        const values = updateFields.map(field => {
            if (['images', 'documents', 'metadata_tags'].includes(field)) {
                return JSON.stringify(updates[field] || []);
            }
            // Handle new fields that are not JSON but might be null
            if (['legal_description', 'assessed_value', 'jurisdiction', 'document_hash'].includes(field)) {
                return updates[field] || null;
            }
            return updates[field];
        });
        values.push(id);
        await (0, database_1.query)(`UPDATE properties SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
        res.json({ message: 'Property updated successfully' });
    }
    catch (error) {
        console.error('Failed to update property:', error);
        res.status(500).json({ error: 'Failed to update property' });
    }
});
router.delete('/properties/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // First, check the property status and visibility
        const [property] = await (0, database_1.query)('SELECT verification_status, hidden FROM properties WHERE id = ?', [id]);
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }
        // Business rules for deletion:
        // 1. Approved properties cannot be deleted unless rejected first
        // 2. Properties that are still visible (not hidden) cannot be deleted
        if (property.verification_status === 'approved') {
            return res.status(400).json({
                error: 'Cannot delete approved property. Property must be rejected first before deletion.'
            });
        }
        if (!property.hidden) {
            return res.status(400).json({
                error: 'Cannot delete visible property. Property must be hidden first before deletion.'
            });
        }
        // Check if property has any active listings
        const [activeListings] = await (0, database_1.query)('SELECT COUNT(*) as count FROM listings WHERE property_id = ? AND status = "active"', [id]);
        if (activeListings.count > 0) {
            return res.status(400).json({
                error: 'Cannot delete property with active listings. Cancel all listings first.'
            });
        }
        const result = await (0, database_1.query)('DELETE FROM properties WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Property not found' });
        }
        res.json({ message: 'Property deleted successfully' });
    }
    catch (error) {
        console.error('Failed to delete property:', error);
        res.status(500).json({ error: 'Failed to delete property' });
    }
});
router.delete('/payment-options/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await (0, database_1.query)('DELETE FROM payment_options WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Payment option not found' });
        }
        res.json({ message: 'Payment option deleted successfully' });
    }
    catch (error) {
        console.error('Failed to delete payment option:', error);
        res.status(500).json({ error: 'Failed to delete payment option' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map