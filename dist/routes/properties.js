"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const database_1 = require("../utils/database");
const uuid_1 = require("uuid");
function safeParseArray(input) {
    if (input === null || input === undefined)
        return [];
    try {
        const v = typeof input === 'string' ? JSON.parse(input) : input;
        return Array.isArray(v) ? v : [];
    }
    catch {
        return [];
    }
}
const router = express_1.default.Router();
// Get user's own properties (or all properties for admin)
router.get('/my-properties', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { page = '1', limit = '20' } = req.query;
        let pageNum = Number.parseInt(page);
        if (isNaN(pageNum) || pageNum < 1) {
            pageNum = 1;
        }
        let limitNum = Number.parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            limitNum = 20;
        }
        let sqlQuery;
        let params;
        let countQuery;
        // Admin sees all properties, users see only their own
        if (req.user.role === 'admin' || req.user.role === 'super-admin') {
            sqlQuery = `
        SELECT p.*, l.listing_type, l.price as listing_price, l.end_time, l.status as listing_status,
               u.username as owner_username, u.wallet_address as owner_address
        FROM properties p
        LEFT JOIN listings l ON p.id = l.property_id AND l.status IN ('active', 'pending')
        LEFT JOIN users u ON p.owner_id = u.id
        ORDER BY p.created_at DESC LIMIT ? OFFSET ?
      `;
            params = [limitNum, (pageNum - 1) * limitNum];
            countQuery = "SELECT COUNT(*) as total FROM properties";
        }
        else {
            sqlQuery = `
        SELECT p.*, l.listing_type, l.price as listing_price, l.end_time, l.status as listing_status,
               u.username as owner_username, u.wallet_address as owner_address
        FROM properties p
        LEFT JOIN listings l ON p.id = l.property_id AND l.status IN ('active', 'pending')
        LEFT JOIN users u ON p.owner_id = u.id
        WHERE p.owner_id = ?
        ORDER BY p.created_at DESC LIMIT ? OFFSET ?
      `;
            params = [req.user.id, limitNum, (pageNum - 1) * limitNum];
            countQuery = "SELECT COUNT(*) as total FROM properties WHERE owner_id = ?";
        }
        const properties = await (0, database_1.query)(sqlQuery, params);
        // Get total count
        const countParams = req.user.role === 'admin' || req.user.role === 'super-admin' ? [] : [req.user.id];
        const countResult = await (0, database_1.query)(countQuery, countParams);
        const total = countResult[0]?.total || 0;
        res.json({
            properties: properties.map((p) => {
                const images = safeParseArray(p.images);
                const documents = safeParseArray(p.documents);
                const verification_documents = safeParseArray(p.verification_documents);
                let listing_price = null;
                try {
                    listing_price = p?.listing_price != null ? Number(p.listing_price).toFixed(2) : null;
                }
                catch {
                    listing_price = null;
                }
                return {
                    ...p,
                    images,
                    documents,
                    verification_documents,
                    listing_price,
                };
            }),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        console.error('My properties API error:', error);
        res.status(500).json({ error: 'Failed to fetch properties' });
    }
});
// Properties routes
router.get('/', async (req, res) => {
    try {
        const { page = '1', limit = '20', category, minPrice, maxPrice, location, status = 'verified' } = req.query;
        let pageNum = Number.parseInt(page);
        if (isNaN(pageNum) || pageNum < 1) {
            pageNum = 1;
        }
        let limitNum = Number.parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            limitNum = 20;
        }
        let sqlQuery = `
      SELECT p.*, p.is_featured, l.listing_type, l.price as listing_price, l.end_time,
             u.username as owner_username, u.wallet_address as owner_address
      FROM properties p
      LEFT JOIN listings l ON p.id = l.property_id AND l.status = 'active'
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE 1=1
    `;
        const params = [];
        if (status) {
            sqlQuery += " AND p.verification_status = ?";
            params.push(status);
        }
        if (category) {
            sqlQuery += " AND p.property_type = ?";
            params.push(category);
        }
        if (location) {
            sqlQuery += " AND p.address LIKE ?";
            params.push(`%${location}%`);
        }
        if (req.query.featured) {
            sqlQuery += " AND p.is_featured = ?";
            params.push(1);
        }
        sqlQuery += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
        params.push(limitNum, (pageNum - 1) * limitNum);
        // Normalize SQL to remove extra whitespace and newlines
        sqlQuery = sqlQuery.replace(/\s+/g, ' ').trim();
        console.log('Properties query SQL:', sqlQuery);
        console.log('Properties query params:', params);
        console.log('Properties query param types:', params.map(p => typeof p));
        console.log('Properties query param values:', params.map(p => p === null ? 'null' : p === undefined ? 'undefined' : p));
        let properties;
        try {
            properties = await (0, database_1.query)(sqlQuery, params);
        }
        catch (err) {
            console.error('Properties primary query failed:', { message: err?.message, code: err?.code, sql: sqlQuery });
            // Fallback: minimal query without joins/fields that may not exist in older schemas
            const fallbackSql = "SELECT * FROM properties p ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
            const fallbackParams = [limitNum, (pageNum - 1) * limitNum];
            properties = await (0, database_1.query)(fallbackSql, fallbackParams);
        }
        // Get total count for pagination
        let countQuery = "SELECT COUNT(*) as total FROM properties p WHERE 1=1";
        const countParams = [];
        if (status) {
            countQuery += " AND p.verification_status = ?";
            countParams.push(status);
        }
        if (category) {
            countQuery += " AND p.property_type = ?";
            countParams.push(category);
        }
        if (location) {
            countQuery += " AND p.address LIKE ?";
            countParams.push(`%${location}%`);
        }
        if (req.query.featured) {
            countQuery += " AND p.is_featured = ?";
            countParams.push(1);
        }
        // Normalize count query as well
        countQuery = countQuery.replace(/\s+/g, ' ').trim();
        let total = 0;
        try {
            const countResult = await (0, database_1.query)(countQuery, countParams);
            total = countResult[0]?.total || 0;
        }
        catch (err) {
            console.error('Properties count query failed:', { message: err?.message, code: err?.code, sql: countQuery });
            const fallbackCountResult = await (0, database_1.query)("SELECT COUNT(*) as total FROM properties p", []);
            total = fallbackCountResult[0]?.total || 0;
        }
        res.json({
            properties: properties.map((p) => {
                const images = safeParseArray(p.images);
                const documents = safeParseArray(p.documents);
                const verification_documents = safeParseArray(p.verification_documents);
                let listing_price = null;
                try {
                    listing_price = p?.listing_price != null ? Number(p.listing_price).toFixed(2) : null;
                }
                catch {
                    listing_price = null;
                }
                return {
                    ...p,
                    images,
                    documents,
                    verification_documents,
                    listing_price,
                };
            }),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        console.error('Properties API error:', error);
        res.status(500).json({ error: 'Failed to fetch properties' });
    }
});
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { title, description, address, property_type, ownership_type, fractional, supply, project_id, square_footage, bedrooms, bathrooms, year_built, lot_size, images, documents, video_tour_url, metadata_tags, legal_description, assessed_value, jurisdiction, document_hash, } = req.body;
        // Validate required fields
        if (!title || !description || !address || !property_type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const propertyId = (0, uuid_1.v4)();
        const sqlQuery = `
      INSERT INTO properties (
        id, owner_id, title, description, address, property_type, ownership_type, fractional, supply, project_id,
        square_footage, bedrooms, bathrooms, year_built, lot_size,
        images, documents, video_tour_url, metadata_tags, legal_description, assessed_value, jurisdiction, document_hash, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;
        await (0, database_1.query)(sqlQuery, [
            propertyId,
            req.user.id,
            title,
            description,
            address,
            property_type,
            ownership_type || null,
            fractional || false,
            supply || null,
            project_id || null,
            square_footage || null,
            bedrooms || null,
            bathrooms || null,
            year_built || null,
            lot_size || null,
            JSON.stringify(images || []),
            JSON.stringify(documents || []),
            video_tour_url || null,
            JSON.stringify(metadata_tags || []),
            legal_description || null,
            assessed_value || null,
            jurisdiction || null,
            document_hash || null,
        ]);
        // Fetch the created property
        const propertyResult = await (0, database_1.query)("SELECT * FROM properties WHERE id = ?", [propertyId]);
        const property = propertyResult[0];
        res.status(201).json({
            property: {
                ...property,
                images: property.images ? JSON.parse(property.images) : [],
                documents: property.documents ? JSON.parse(property.documents) : [],
            },
        });
    }
    catch (error) {
        console.error('Create property error:', error);
        res.status(500).json({ error: 'Failed to create property' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const propertyResult = await (0, database_1.query)(`
      SELECT p.*, u.username as owner_username, u.wallet_address as owner_address
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
    `, [id]);
        if (propertyResult.length === 0) {
            return res.status(404).json({ error: 'Property not found' });
        }
        const property = propertyResult[0];
        res.json({
            property: {
                ...property,
                images: property.images ? JSON.parse(property.images) : [],
                documents: property.documents ? JSON.parse(property.documents) : [],
                verification_documents: property.verification_documents ? JSON.parse(property.verification_documents) : [],
            },
        });
    }
    catch (error) {
        console.error('Get property error:', error);
        res.status(500).json({ error: 'Failed to fetch property' });
    }
});
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const updates = req.body;
        // Check if property exists (for admins) or exists and user owns it
        let propertyResult;
        if (req.user.role === 'admin') {
            propertyResult = await (0, database_1.query)("SELECT * FROM properties WHERE id = ?", [id]);
        }
        else {
            propertyResult = await (0, database_1.query)("SELECT * FROM properties WHERE id = ? AND owner_id = ?", [id, req.user.id]);
        }
        if (propertyResult.length === 0) {
            return res.status(404).json({ error: 'Property not found or unauthorized' });
        }
        // Build update query
        const updateFields = Object.keys(updates).filter(key => updates[key] !== undefined);
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        const setClause = updateFields.map(field => `${field} = ?`).join(', ');
        const values = updateFields.map(field => {
            if (['images', 'documents', 'verification_documents', 'metadata_tags'].includes(field)) {
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
        // Fetch updated property
        const updatedResult = await (0, database_1.query)("SELECT p.*, l.listing_type, l.price as listing_price, l.end_time FROM properties p LEFT JOIN listings l ON p.id = l.property_id AND l.status = 'active' WHERE p.id = ?", [id]);
        const property = updatedResult[0];
        res.json({
            property: {
                ...property,
                images: property.images ? JSON.parse(property.images) : [],
                documents: property.documents ? JSON.parse(property.documents) : [],
                verification_documents: property.verification_documents ? JSON.parse(property.verification_documents) : [],
            },
        });
    }
    catch (error) {
        console.error('Update property error:', error);
        res.status(500).json({ error: 'Failed to update property' });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        // Check if property exists and user owns it (or user is admin)
        let propertyResult;
        if (req.user.role === 'admin' || req.user.role === 'super-admin') {
            propertyResult = await (0, database_1.query)("SELECT * FROM properties WHERE id = ?", [id]);
        }
        else {
            propertyResult = await (0, database_1.query)("SELECT * FROM properties WHERE id = ? AND owner_id = ?", [id, req.user.id]);
        }
        if (propertyResult.length === 0) {
            return res.status(404).json({ error: 'Property not found or unauthorized' });
        }
        await (0, database_1.query)("DELETE FROM properties WHERE id = ?", [id]);
        res.json({ message: 'Property deleted successfully' });
    }
    catch (error) {
        console.error('Delete property error:', error);
        res.status(500).json({ error: 'Failed to delete property' });
    }
});
// Property investors routes
router.get('/:id/investors', async (req, res) => {
    try {
        const { id } = req.params;
        // This would typically involve a more complex query joining with investments/payments
        // For now, return empty array as placeholder
        res.json({
            investors: [],
            propertyId: id
        });
    }
    catch (error) {
        console.error('Get property investors error:', error);
        res.status(500).json({ error: 'Failed to fetch property investors' });
    }
});
exports.default = router;
//# sourceMappingURL=properties.js.map