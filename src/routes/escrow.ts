import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Escrow routes
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { page = '1', limit = '20', status } = req.query;
    const pageNum = Number.parseInt(page as string);
    const limitNum = Number.parseInt(limit as string);

    let sqlQuery = `
      SELECT e.*, p.title as property_title, buyer.username as buyer_username,
             buyer.wallet_address as buyer_address, seller.username as seller_username,
             seller.wallet_address as seller_address
      FROM escrows e
      LEFT JOIN payments pay ON e.payment_id = pay.id
      LEFT JOIN listings l ON pay.listing_id = l.id
      LEFT JOIN properties p ON l.property_id = p.id
      LEFT JOIN users buyer ON e.buyer_id = buyer.id
      LEFT JOIN users seller ON e.seller_id = seller.id
      WHERE e.buyer_id = ? OR e.seller_id = ?
    `;
    const params: any[] = [req.user.id, req.user.id];

    if (status) {
      sqlQuery += " AND e.status = ?";
      params.push(status);
    }

    sqlQuery += " ORDER BY e.created_at DESC LIMIT ? OFFSET ?";
    params.push(limitNum, (pageNum - 1) * limitNum);

    const escrows = await query(sqlQuery, params);

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as total FROM escrows WHERE buyer_id = ? OR seller_id = ?";
    const countParams: any[] = [req.user.id, req.user.id];

    if (status) {
      countQuery += " AND status = ?";
      countParams.push(status);
    }

    const countResult = await query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    res.json({
      escrows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get escrows error:', error);
    res.status(500).json({ error: 'Failed to fetch escrows' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { paymentId, amount, currency = 'ETH' } = req.body;

    // Validate required fields
    if (!paymentId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if payment exists
    const paymentResult = await query("SELECT * FROM payments WHERE id = ?", [paymentId]);

    if (paymentResult.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult[0];

    // Get seller from listing
    const listingResult = await query(`
      SELECT l.*, u.id as seller_id FROM listings l
      LEFT JOIN users u ON l.seller_id = u.id
      WHERE l.id = ?
    `, [payment.listing_id]);

    if (listingResult.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = listingResult[0];

    const escrowId = uuidv4();

    const sqlQuery = `
      INSERT INTO escrows (
        id, payment_id, buyer_id, seller_id, amount, currency, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'active')
    `;

    await query(sqlQuery, [
      escrowId,
      paymentId,
      req.user.id,
      listing.seller_id,
      amount,
      currency,
    ]);

    // Update payment with escrow ID
    await query("UPDATE payments SET escrow_id = ? WHERE id = ?", [escrowId, paymentId]);

    // Fetch the created escrow
    const escrowResult = await query(`
      SELECT e.*, p.title as property_title, buyer.username as buyer_username,
             buyer.wallet_address as buyer_address, seller.username as seller_username,
             seller.wallet_address as seller_address
      FROM escrows e
      LEFT JOIN payments pay ON e.payment_id = pay.id
      LEFT JOIN listings l ON pay.listing_id = l.id
      LEFT JOIN properties p ON l.property_id = p.id
      LEFT JOIN users buyer ON e.buyer_id = buyer.id
      LEFT JOIN users seller ON e.seller_id = seller.id
      WHERE e.id = ?
    `, [escrowId]);

    const escrow = escrowResult[0];

    res.status(201).json({ escrow });
  } catch (error) {
    console.error('Create escrow error:', error);
    res.status(500).json({ error: 'Failed to create escrow' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const escrowResult = await query(`
      SELECT e.*, p.title as property_title, buyer.username as buyer_username,
             buyer.wallet_address as buyer_address, seller.username as seller_username,
             seller.wallet_address as seller_address
      FROM escrows e
      LEFT JOIN payments pay ON e.payment_id = pay.id
      LEFT JOIN listings l ON pay.listing_id = l.id
      LEFT JOIN properties p ON l.property_id = p.id
      LEFT JOIN users buyer ON e.buyer_id = buyer.id
      LEFT JOIN users seller ON e.seller_id = seller.id
      WHERE e.id = ? AND (e.buyer_id = ? OR e.seller_id = ?)
    `, [id, req.user.id, req.user.id]);

    if (escrowResult.length === 0) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    const escrow = escrowResult[0];

    res.json({ escrow });
  } catch (error) {
    console.error('Get escrow error:', error);
    res.status(500).json({ error: 'Failed to fetch escrow' });
  }
});

// Escrow dispute routes
router.post('/:id/dispute', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { reason, description } = req.body;

    // Check if escrow exists and user is involved
    const escrowResult = await query(`
      SELECT * FROM escrows
      WHERE id = ? AND (buyer_id = ? OR seller_id = ?)
    `, [id, req.user.id, req.user.id]);

    if (escrowResult.length === 0) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    const escrow = escrowResult[0];

    if (escrow.status !== 'active') {
      return res.status(400).json({ error: 'Escrow is not active' });
    }

    // Update escrow status to disputed
    await query(
      "UPDATE escrows SET status = 'disputed', dispute_reason = ?, dispute_description = ?, disputed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [reason, description, id]
    );

    // Create notification for the other party
    const otherPartyId = escrow.buyer_id === req.user.id ? escrow.seller_id : escrow.buyer_id;

    const notificationId = uuidv4();
    await query(`
      INSERT INTO notifications (
        id, user_id, type, title, message, data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      notificationId,
      otherPartyId,
      'escrow_dispute',
      'Escrow Dispute Filed',
      `A dispute has been filed for escrow ${id}`,
      JSON.stringify({ escrowId: id, reason, description }),
    ]);

    res.json({
      message: 'Dispute filed successfully',
      escrowId: id
    });
  } catch (error) {
    console.error('Create escrow dispute error:', error);
    res.status(500).json({ error: 'Failed to file dispute' });
  }
});

// Escrow release routes
router.post('/:id/release', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { transactionHash } = req.body;

    // Check if escrow exists and user is the buyer
    const escrowResult = await query(`
      SELECT * FROM escrows
      WHERE id = ? AND buyer_id = ?
    `, [id, req.user.id]);

    if (escrowResult.length === 0) {
      return res.status(404).json({ error: 'Escrow not found or unauthorized' });
    }

    const escrow = escrowResult[0];

    if (escrow.status !== 'active') {
      return res.status(400).json({ error: 'Escrow is not active' });
    }

    // Update escrow status to released
    await query(
      "UPDATE escrows SET status = 'released', released_at = CURRENT_TIMESTAMP, release_tx_hash = ? WHERE id = ?",
      [transactionHash, id]
    );

    // Update payment status
    await query("UPDATE payments SET status = 'completed' WHERE id = ?", [escrow.payment_id]);

    // Update listing status
    await query("UPDATE listings SET status = 'sold' WHERE id = (SELECT listing_id FROM payments WHERE id = ?)", [escrow.payment_id]);

    // Create notification for seller
    const notificationId = uuidv4();
    await query(`
      INSERT INTO notifications (
        id, user_id, type, title, message, data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      notificationId,
      escrow.seller_id,
      'escrow_released',
      'Escrow Funds Released',
      `Funds have been released for escrow ${id}`,
      JSON.stringify({ escrowId: id, transactionHash }),
    ]);

    res.json({
      message: 'Escrow funds released successfully',
      escrowId: id,
      transactionHash
    });
  } catch (error) {
    console.error('Release escrow error:', error);
    res.status(500).json({ error: 'Failed to release escrow funds' });
  }
});

export default router;