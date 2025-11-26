import express from 'express';
import { mintingService } from '../services/mintingService';
import { metadataService } from '../services/metadataService';
import { tbaService } from '../services/tbaService';
import { marketplaceRegistrationService } from '../services/marketplaceRegistrationService';
import { distributionService } from '../services/distributionService';
import { propertySyncService } from '../services/propertySyncService';
import { query } from '../utils/database';

const router = express.Router();

// Middleware to check admin/superadmin role
const requireAdmin = (req: any, res: express.Response, next: express.NextFunction) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Rate limiting middleware for sensitive operations
const rateLimit = (req: any, res: express.Response, next: express.NextFunction) => {
  // Simple in-memory rate limiting (use Redis in production)
  const clientId = req.user?.id || req.ip;
  const key = `ratelimit:${clientId}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 10;

  // This is a simplified implementation - use a proper rate limiter in production
  if (!(global as any).rateLimitStore) {
    (global as any).rateLimitStore = new Map();
  }

  const store = (global as any).rateLimitStore as Map<string, { count: number; resetTime: number }>;
  const record = store.get(key);

  if (!record || now > record.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }

  record.count++;
  next();
};

// Get minting status for a property
router.get('/status/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const status = await mintingService.getMintingStatus(propertyId);
    res.json(status);
  } catch (error: any) {
    console.error('Error getting minting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual minting for approved property
router.post('/mint/:propertyId', requireAdmin, rateLimit, async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Check if property is approved
    const property = await query(
      'SELECT status FROM properties WHERE id = ?',
      [propertyId]
    );

    if (!property || property.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property[0].status !== 'APPROVED') {
      return res.status(400).json({ error: 'Property must be approved before minting' });
    }

    // Start minting process
    const result = await mintingService.mintToken(propertyId);

    res.json({
      success: true,
      tokenId: result.tokenId,
      transactionHash: result.transactionHash,
      message: 'Minting initiated successfully'
    });

  } catch (error: any) {
    console.error('Minting error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Retry failed minting
router.post('/retry/:propertyId', requireAdmin, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const result = await mintingService.retryMint(propertyId);

    res.json({
      success: true,
      tokenId: result.tokenId,
      transactionHash: result.transactionHash,
      message: 'Mint retry successful'
    });

  } catch (error: any) {
    console.error('Mint retry error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create TBA for minted token
router.post('/tba/:tokenId', requireAdmin, async (req, res) => {
  try {
    const { tokenId } = req.params;

    // Get property and owner info
    const property = await query(
      'SELECT p.id, u.wallet_address FROM properties p JOIN users u ON p.user_id = u.id WHERE p.token_id = ?',
      [tokenId]
    );

    if (!property || property.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const result = await tbaService.createTBA(parseInt(tokenId), property[0].wallet_address);

    res.json({
      success: true,
      tbaAddress: result.tbaAddress,
      transactionHash: result.transactionHash
    });

  } catch (error: any) {
    console.error('TBA creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize PolicyModule for TBA
router.post('/policy/:tbaAddress', requireAdmin, async (req, res) => {
  try {
    const { tbaAddress } = req.params;
    const config = req.body; // PolicyModuleConfig

    const txHash = await tbaService.initializePolicyModule(tbaAddress, config);

    res.json({
      success: true,
      transactionHash: txHash
    });

  } catch (error: any) {
    console.error('PolicyModule initialization error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Register token with marketplace
router.post('/marketplace/:tokenId', requireAdmin, async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { projectId } = req.body;

    const result = await marketplaceRegistrationService.setupMarketplaceReadiness(parseInt(tokenId), projectId);

    res.json({
      success: true,
      registration: result.registration,
      paymentTokens: result.paymentTokens,
      policyFlags: result.policyFlags
    });

  } catch (error: any) {
    console.error('Marketplace registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Distribute initial shares
router.post('/distribute/:propertyId', requireAdmin, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { tokenId } = req.body;

    await distributionService.distributeInitialShares(propertyId, tokenId);

    res.json({
      success: true,
      message: 'Initial shares distributed successfully'
    });

  } catch (error: any) {
    console.error('Distribution error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get TBA balance
router.get('/tba/:tbaAddress/balance/:tokenAddress', async (req, res) => {
  try {
    const { tbaAddress, tokenAddress } = req.params;
    const balance = await tbaService.getTBABalance(tbaAddress, tokenAddress);
    res.json({ balance });
  } catch (error: any) {
    console.error('Balance check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate withdrawal voucher
router.post('/voucher', requireAdmin, rateLimit, async (req, res) => {
  try {
    const { tbaAddress, recipient, amount, tokenAddress } = req.body;

    const result = await tbaService.generateWithdrawalVoucher(
      tbaAddress,
      recipient,
      amount,
      tokenAddress
    );

    res.json({
      success: true,
      voucher: result.voucher,
      signature: result.signature
    });

  } catch (error: any) {
    console.error('Voucher generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute withdrawal
router.post('/withdraw', rateLimit, async (req, res) => {
  try {
    const { voucher, signature } = req.body;

    // Parse voucher to get TBA address
    const voucherData = JSON.parse(voucher);

    const txHash = await tbaService.executeWithdrawal(
      voucherData.tbaAddress,
      voucher,
      signature
    );

    res.json({
      success: true,
      transactionHash: txHash
    });

  } catch (error: any) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync property status
router.post('/sync/:propertyId', requireAdmin, async (req, res) => {
  try {
    const { propertyId } = req.params;
    await propertySyncService.syncPropertyStatus(propertyId);

    res.json({
      success: true,
      message: 'Property status synced successfully'
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get distribution history for property
router.get('/distributions/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const distributions = await query(
      'SELECT * FROM distributions WHERE property_id = ? ORDER BY created_at DESC',
      [propertyId]
    );

    res.json(distributions);
  } catch (error: any) {
    console.error('Error getting distributions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get shareholders for property
router.get('/shareholders/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const shareholders = await distributionService.getShareholders(propertyId);
    res.json(shareholders);
  } catch (error: any) {
    console.error('Error getting shareholders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual event sync (admin only)
router.post('/sync-events', requireAdmin, async (req, res) => {
  try {
    await propertySyncService.syncEvents();

    res.json({
      success: true,
      message: 'Events synced successfully'
    });

  } catch (error: any) {
    console.error('Event sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Override metadata (admin only)
router.put('/metadata/:propertyId', requireAdmin, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const metadata = req.body;

    // Upload new metadata to IPFS
    const metadataURI = await metadataService.uploadMetadataToIPFS(metadata);

    // Update property
    await query(
      'UPDATE properties SET metadata_hash = ? WHERE id = ?',
      [metadataURI.replace('ipfs://', ''), propertyId]
    );

    res.json({
      success: true,
      metadataURI
    });

  } catch (error: any) {
    console.error('Metadata override error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;