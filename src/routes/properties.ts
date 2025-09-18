import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Properties routes
router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '20', category, minPrice, maxPrice, location, status = 'verified' } = req.query;

    const pageNum = Number.parseInt(page as string);
    const limitNum = Number.parseInt(limit as string);

    let sqlQuery = `
      SELECT p.*, p.is_featured, l.listing_type, l.price as listing_price, l.end_time,
             u.username as owner_username, u.wallet_address as owner_address
      FROM properties p
      LEFT JOIN listings l ON p.id = l.property_id AND l.status = 'active'
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

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

    const properties = await query(sqlQuery, params);

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as total FROM properties p WHERE 1=1";
    const countParams: any[] = [];

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

    const countResult = await query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    res.json({
      properties: properties.map((p: any) => ({
        ...p,
        images: p.images ? JSON.parse(p.images) : [],
        documents: p.documents ? JSON.parse(p.documents) : [],
        verification_documents: p.verification_documents ? JSON.parse(p.verification_documents) : [],
        listing_price: p.listing_price ? Number(p.listing_price).toFixed(2) : null,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Properties API error:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      title,
      description,
      address,
      property_type,
      square_footage,
      bedrooms,
      bathrooms,
      year_built,
      lot_size,
      images,
      documents,
    } = req.body;

    // Validate required fields
    if (!title || !description || !address || !property_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const propertyId = uuidv4();
    const sqlQuery = `
      INSERT INTO properties (
        id, owner_id, title, description, address, property_type,
        square_footage, bedrooms, bathrooms, year_built, lot_size,
        images, documents, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    await query(sqlQuery, [
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
    const propertyResult = await query("SELECT * FROM properties WHERE id = ?", [propertyId]);
    const property = propertyResult[0];

    res.status(201).json({
      property: {
        ...property,
        images: property.images ? JSON.parse(property.images) : [],
        documents: property.documents ? JSON.parse(property.documents) : [],
      },
    });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const propertyResult = await query(`
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
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const updates = req.body;

    // Check if property exists (for admins) or exists and user owns it
    let propertyResult;
    if (req.user.role === 'admin') {
      propertyResult = await query("SELECT * FROM properties WHERE id = ?", [id]);
    } else {
      propertyResult = await query("SELECT * FROM properties WHERE id = ? AND owner_id = ?", [id, req.user.id]);
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
      if (['images', 'documents', 'verification_documents'].includes(field)) {
        return JSON.stringify(updates[field] || []);
      }
      return updates[field];
    });

    values.push(id);

    await query(`UPDATE properties SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);

    // Fetch updated property
    const updatedResult = await query("SELECT p.*, l.listing_type, l.price as listing_price, l.end_time FROM properties p LEFT JOIN listings l ON p.id = l.property_id AND l.status = 'active' WHERE p.id = ?", [id]);
    const property = updatedResult[0];

    res.json({
      property: {
        ...property,
        images: property.images ? JSON.parse(property.images) : [],
        documents: property.documents ? JSON.parse(property.documents) : [],
        verification_documents: property.verification_documents ? JSON.parse(property.verification_documents) : [],
      },
    });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Check if property exists and user owns it
    const propertyResult = await query("SELECT * FROM properties WHERE id = ? AND owner_id = ?", [id, req.user.id]);

    if (propertyResult.length === 0) {
      return res.status(404).json({ error: 'Property not found or unauthorized' });
    }

    await query("DELETE FROM properties WHERE id = ?", [id]);

    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
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
  } catch (error) {
    console.error('Get property investors error:', error);
    res.status(500).json({ error: 'Failed to fetch property investors' });
  }
});

export default router;