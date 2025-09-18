"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const database_1 = require("../utils/database");
const uuid_1 = require("uuid");
const router = express_1.default.Router();
// Properties routes
router.get('/', async (req, res) => {
    try {
        const { page = '1', limit = '20', category, minPrice, maxPrice, location, status = 'active' } = req.query;
        const pageNum = Number.parseInt(page);
        const limitNum = Number.parseInt(limit);
        let sqlQuery = `
      SELECT p.*, u.username as owner_username, u.wallet_address as owner_address
      FROM properties p
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
        sqlQuery += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
        params.push(limitNum, (pageNum - 1) * limitNum);
        const properties = await (0, database_1.query)(sqlQuery, params);
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
        const countResult = await (0, database_1.query)(countQuery, countParams);
        const total = countResult[0]?.total || 0;
        res.json({
            properties: properties.map((p) => ({
                ...p,
                images: p.images ? JSON.parse(p.images) : [],
                documents: p.documents ? JSON.parse(p.documents) : [],
                verification_documents: p.verification_documents ? JSON.parse(p.verification_documents) : [],
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
        console.error('Properties API error:', error);
        res.status(500).json({ error: 'Failed to fetch properties' });
    }
});
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { title, description, address, property_type, square_footage, bedrooms, bathrooms, year_built, lot_size, images, documents, } = req.body;
        // Validate required fields
        if (!title || !description || !address || !property_type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const propertyId = (0, uuid_1.v4)();
        const sqlQuery = `
      INSERT INTO properties (
        id, owner_id, title, description, address, property_type,
        square_footage, bedrooms, bathrooms, year_built, lot_size,
        images, documents, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;
        await (0, database_1.query)(sqlQuery, [
            propertyId,
            req.user.id,
            title,
            description,
            address,
            property_type,
            square_footage || null,
            bedrooms || null,
            bathrooms || null,
            year_built || null,
            lot_size || null,
            JSON.stringify(images || []),
            JSON.stringify(documents || []),
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
        // Check if property exists and user owns it
        const propertyResult = await (0, database_1.query)("SELECT * FROM properties WHERE id = ? AND owner_id = ?", [id, req.user.id]);
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
            if (['images', 'documents', 'verification_documents'].includes(field)) {
                return JSON.stringify(updates[field] || []);
            }
            return updates[field];
        });
        values.push(id);
        await (0, database_1.query)(`UPDATE properties SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
        // Fetch updated property
        const updatedResult = await (0, database_1.query)("SELECT * FROM properties WHERE id = ?", [id]);
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
        // Check if property exists and user owns it
        const propertyResult = await (0, database_1.query)("SELECT * FROM properties WHERE id = ? AND owner_id = ?", [id, req.user.id]);
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