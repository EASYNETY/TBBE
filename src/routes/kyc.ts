import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';

const router = express.Router();

// KYC routes
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await query("SELECT kyc_status, kyc_data FROM users WHERE id = ?", [req.user.id]);

    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult[0];

    res.json({
      status: user.kyc_status || 'pending',
      data: user.kyc_data ? JSON.parse(user.kyc_data) : null,
      isVerified: user.kyc_status === 'approved',
    });
  } catch (error) {
    console.error('Get KYC status error:', error);
    res.status(500).json({ error: 'Failed to get KYC status' });
  }
});

router.post('/submit', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      fullName,
      dateOfBirth,
      nationality,
      address,
      idType,
      idNumber,
      documents,
    } = req.body;

    // Validate required fields
    if (!fullName || !dateOfBirth || !nationality || !address || !idType || !idNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const kycData = {
      fullName,
      dateOfBirth,
      nationality,
      address,
      idType,
      idNumber,
      documents: documents || [],
      submittedAt: new Date().toISOString(),
    };

    // Update user KYC data
    await query(
      "UPDATE users SET kyc_status = 'pending', kyc_data = ? WHERE id = ?",
      [JSON.stringify(kycData), req.user.id]
    );

    // Create notification for admin
    const adminUsers = await query("SELECT id FROM users WHERE role = 'admin' OR role = 'super-admin'");

    for (const admin of adminUsers) {
      const notificationId = require('crypto').randomUUID();
      await query(`
        INSERT INTO notifications (
          id, user_id, type, title, message, data
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        notificationId,
        admin.id,
        'kyc_submission',
        'New KYC Submission',
        `User ${req.user.address} has submitted KYC verification`,
        JSON.stringify({ userId: req.user.id, userAddress: req.user.address }),
      ]);
    }

    res.json({
      message: 'KYC submitted successfully',
      status: 'pending',
      data: kycData,
    });
  } catch (error) {
    console.error('Submit KYC error:', error);
    res.status(500).json({ error: 'Failed to submit KYC' });
  }
});

// Admin route to approve/reject KYC (should be protected by admin middleware)
router.post('/:userId/approve', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const { approved, rejectionReason } = req.body;

    if (approved) {
      await query("UPDATE users SET kyc_status = 'approved' WHERE id = ?", [userId]);
    } else {
      await query(
        "UPDATE users SET kyc_status = 'rejected', kyc_data = JSON_SET(kyc_data, '$.rejectionReason', ?) WHERE id = ?",
        [rejectionReason, userId]
      );
    }

    // Create notification for user
    const notificationId = require('crypto').randomUUID();
    await query(`
      INSERT INTO notifications (
        id, user_id, type, title, message, data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      notificationId,
      userId,
      approved ? 'kyc_approved' : 'kyc_rejected',
      approved ? 'KYC Approved' : 'KYC Rejected',
      approved
        ? 'Your KYC verification has been approved!'
        : `Your KYC verification has been rejected: ${rejectionReason}`,
      JSON.stringify({ approved, rejectionReason }),
    ]);

    res.json({
      message: `KYC ${approved ? 'approved' : 'rejected'} successfully`,
    });
  } catch (error) {
    console.error('Approve KYC error:', error);
    res.status(500).json({ error: 'Failed to process KYC approval' });
  }
});

// Get all KYC submissions (admin only)
router.get('/admin/all', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { page = '1', limit = '20', status } = req.query;
    const pageNum = Number.parseInt(page as string);
    const limitNum = Number.parseInt(limit as string);

    let sqlQuery = `
      SELECT id, wallet_address, username, email, kyc_status, kyc_data, created_at
      FROM users
      WHERE kyc_status IS NOT NULL
    `;
    const params: any[] = [];

    if (status) {
      sqlQuery += " AND kyc_status = ?";
      params.push(status);
    }

    sqlQuery += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limitNum, (pageNum - 1) * limitNum);

    const kycSubmissions = await query(sqlQuery, params);

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as total FROM users WHERE kyc_status IS NOT NULL";
    const countParams: any[] = [];

    if (status) {
      countQuery += " AND kyc_status = ?";
      countParams.push(status);
    }

    const countResult = await query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    res.json({
      submissions: kycSubmissions.map((submission: any) => ({
        ...submission,
        kyc_data: submission.kyc_data ? JSON.parse(submission.kyc_data) : null,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get KYC submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch KYC submissions' });
  }
});

export default router;