import { ethers } from 'ethers';
import { query } from '../utils/database';
import { metadataService } from './metadataService';
import { tbaService } from './tbaService';
import { marketplaceRegistrationService } from './marketplaceRegistrationService';
import { distributionService } from './distributionService';
import { getProvider } from '../utils/ethersProvider';

export interface SyncEvent {
  eventName: string;
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
  args: any;
  timestamp: Date;
}

export class PropertySyncService {
  private provider: ethers.JsonRpcProvider;
  private lastSyncedBlock: number = 0;

  constructor() {
    if (!process.env.BASE_RPC_URL) {
      throw new Error('BASE_RPC_URL environment variable is required');
    }
    if (!process.env.TITLE_REGISTRAR_ADDRESS) {
      throw new Error('TITLE_REGISTRAR_ADDRESS environment variable is required');
    }
    if (!process.env.ERC6551_REGISTRY_ADDRESS) {
      throw new Error('ERC6551_REGISTRY_ADDRESS environment variable is required');
    }
    if (!process.env.MARKETPLACE_GUARD_ADDRESS) {
      throw new Error('MARKETPLACE_GUARD_ADDRESS environment variable is required');
    }
    if (!process.env.PROPERTY_REGISTRY_ADDRESS) {
      throw new Error('PROPERTY_REGISTRY_ADDRESS environment variable is required');
    }

    this.provider = getProvider();
    this.initializeSyncState();
  }

  private async initializeSyncState(): Promise<void> {
    try {
      // Get the last synced block from database
      const result = await query(
        'SELECT value FROM system_settings WHERE key = ?',
        ['last_synced_block']
      );

      if (result && result.length > 0) {
        this.lastSyncedBlock = parseInt(result[0].value);
      } else {
        // Start from current block minus some buffer
        this.lastSyncedBlock = await this.provider.getBlockNumber() - 1000;
      }
    } catch (error) {
      console.error('Failed to initialize sync state:', error);
      this.lastSyncedBlock = await this.provider.getBlockNumber() - 1000;
    }
  }

  async syncEvents(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = this.lastSyncedBlock + 1;
      const toBlock = Math.min(currentBlock, fromBlock + 999); // Limit range to avoid timeouts

      if (fromBlock > toBlock) {
        return; // Nothing to sync
      }

      console.log(`Syncing events from block ${fromBlock} to ${toBlock}`);

      // Sync events from different contracts
      await Promise.all([
        this.syncTitleRegistrarEvents(fromBlock, toBlock),
        this.syncTBAEvents(fromBlock, toBlock),
        this.syncMarketplaceEvents(fromBlock, toBlock),
        this.syncPropertyRegistryEvents(fromBlock, toBlock),
      ]);

      // Update last synced block
      this.lastSyncedBlock = toBlock;
      await this.updateLastSyncedBlock(toBlock);

    } catch (error) {
      console.error('Event sync failed:', error);
      throw error;
    }
  }

  private async syncTitleRegistrarEvents(fromBlock: number, toBlock: number): Promise<void> {
    const titleRegistrarAddress = process.env.TITLE_REGISTRAR_ADDRESS!;

    const filter = {
      address: titleRegistrarAddress,
      fromBlock,
      toBlock,
    };

    const logs = await this.provider.getLogs(filter);

    for (const log of logs) {
      try {
        const parsed = this.parseTitleRegistrarLog(log);
        if (parsed) {
          await this.processTitleRegistrarEvent(parsed);
        }
      } catch (error) {
        console.error('Failed to process TitleRegistrar event:', error);
      }
    }
  }

  private async syncTBAEvents(fromBlock: number, toBlock: number): Promise<void> {
    const registryAddress = process.env.ERC6551_REGISTRY_ADDRESS!;

    const filter = {
      address: registryAddress,
      fromBlock,
      toBlock,
    };

    const logs = await this.provider.getLogs(filter);

    for (const log of logs) {
      try {
        const parsed = this.parseTBALog(log);
        if (parsed) {
          await this.processTBAEvent(parsed);
        }
      } catch (error) {
        console.error('Failed to process TBA event:', error);
      }
    }
  }

  private async syncMarketplaceEvents(fromBlock: number, toBlock: number): Promise<void> {
    const marketplaceGuardAddress = process.env.MARKETPLACE_GUARD_ADDRESS!;

    const filter = {
      address: marketplaceGuardAddress,
      fromBlock,
      toBlock,
    };

    const logs = await this.provider.getLogs(filter);

    for (const log of logs) {
      try {
        const parsed = this.parseMarketplaceLog(log);
        if (parsed) {
          await this.processMarketplaceEvent(parsed);
        }
      } catch (error) {
        console.error('Failed to process marketplace event:', error);
      }
    }
  }

  private async syncPropertyRegistryEvents(fromBlock: number, toBlock: number): Promise<void> {
    const propertyRegistryAddress = process.env.PROPERTY_REGISTRY_ADDRESS!;

    const filter = {
      address: propertyRegistryAddress,
      fromBlock,
      toBlock,
    };

    const logs = await this.provider.getLogs(filter);

    for (const log of logs) {
      try {
        const parsed = this.parsePropertyRegistryLog(log);
        if (parsed) {
          await this.processPropertyRegistryEvent(parsed);
        }
      } catch (error) {
        console.error('Failed to process PropertyRegistry event:', error);
      }
    }
  }

  private parseTitleRegistrarLog(log: ethers.Log): SyncEvent | null {
    const iface = new ethers.Interface([
      "event PropertyMinted(uint256 indexed tokenId, address indexed owner, string metadataURI, bool fractional, uint256 supply)"
    ]);

    try {
      const parsed = iface.parseLog(log);
      if (!parsed) return null;
      return {
        eventName: parsed.name,
        contractAddress: log.address,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        args: parsed.args,
        timestamp: new Date(),
      };
    } catch {
      return null;
    }
  }

  private parseTBALog(log: ethers.Log): SyncEvent | null {
    const iface = new ethers.Interface([
      "event AccountCreated(address account, address implementation, uint256 chainId, address tokenContract, uint256 tokenId, uint256 salt)"
    ]);

    try {
      const parsed = iface.parseLog(log);
      if (!parsed) return null;
      return {
        eventName: parsed.name,
        contractAddress: log.address,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        args: parsed.args,
        timestamp: new Date(),
      };
    } catch {
      return null;
    }
  }

  private parseMarketplaceLog(log: ethers.Log): SyncEvent | null {
    const iface = new ethers.Interface([
      "event TokenRegistered(uint256 indexed tokenId, string projectId, address indexed registrar)",
      "event PaymentTokenRegistered(uint256 indexed tokenId, address indexed paymentToken)",
      "event PolicyFlagsSet(uint256 indexed tokenId, uint256 flags)"
    ]);

    try {
      const parsed = iface.parseLog(log);
      if (!parsed) return null;
      return {
        eventName: parsed.name,
        contractAddress: log.address,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        args: parsed.args,
        timestamp: new Date(),
      };
    } catch {
      return null;
    }
  }

  private parsePropertyRegistryLog(log: ethers.Log): SyncEvent | null {
    const iface = new ethers.Interface([
      "event PropertyApproved(uint256 indexed propertyId, address indexed approver)",
      "event PropertyMinted(uint256 indexed propertyId, uint256 indexed tokenId)"
    ]);

    try {
      const parsed = iface.parseLog(log);
      if (!parsed) return null;
      return {
        eventName: parsed.name,
        contractAddress: log.address,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        args: parsed.args,
        timestamp: new Date(),
      };
    } catch {
      return null;
    }
  }

  private async processTitleRegistrarEvent(event: SyncEvent): Promise<void> {
    if (event.eventName === 'PropertyMinted') {
      const { tokenId, owner, metadataURI, fractional, supply } = event.args;

      console.log(`Processing PropertyMinted event for token ${tokenId}`);

      // Update property status and token ID (idempotent operation)
      await query(
        'UPDATE properties SET token_id = ?, status = "MINTED", minted_at = CURRENT_TIMESTAMP WHERE metadata_hash = ? AND (token_id IS NULL OR token_id = ?)',
        [Number(tokenId), metadataURI.replace('https://gateway.pinata.cloud/ipfs/', 'ipfs://'), Number(tokenId)]
      );

      // Trigger next steps in the flow
      await this.triggerPostMintSteps(Number(tokenId));
    }
  }

  private async processTBAEvent(event: SyncEvent): Promise<void> {
    if (event.eventName === 'AccountCreated') {
      const { account, tokenContract, tokenId } = event.args;

      console.log(`Processing AccountCreated event for TBA ${account}`);

      // Update property with TBA address (idempotent operation)
      await query(
        'UPDATE properties SET tba_address = ? WHERE token_id = ? AND (tba_address IS NULL OR tba_address = ?)',
        [account, Number(tokenId), account]
      );
    }
  }

  private async processMarketplaceEvent(event: SyncEvent): Promise<void> {
    if (event.eventName === 'TokenRegistered') {
      const { tokenId } = event.args;

      console.log(`Processing TokenRegistered event for token ${tokenId}`);

      // Update marketplace registration status (idempotent operation)
      await query(
        'UPDATE properties SET marketplace_registered = TRUE WHERE token_id = ? AND marketplace_registered = FALSE',
        [Number(tokenId)]
      );
    }
  }

  private async processPropertyRegistryEvent(event: SyncEvent): Promise<void> {
    if (event.eventName === 'PropertyApproved') {
      const { propertyId } = event.args;

      console.log(`Processing PropertyApproved event for property ${propertyId}`);

      // Update property status (idempotent operation)
      await query(
        'UPDATE properties SET status = "APPROVED", approved_at = CURRENT_TIMESTAMP WHERE property_registry_id = ? AND status = "PENDING"',
        [Number(propertyId)]
      );

      // Trigger minting process
      await this.triggerMintingProcess(Number(propertyId));
    }
  }

  private async triggerMintingProcess(propertyRegistryId: number): Promise<void> {
    try {
      // Find the property by registry ID
      const property = await query(
        'SELECT id FROM properties WHERE property_registry_id = ? AND status = "APPROVED"',
        [propertyRegistryId]
      );

      if (property && property.length > 0) {
        const propertyId = property[0].id;

        // Emit notification for minting
        await this.emitUserNotification(propertyId, 'MINTING_STARTED', 'Your property has been approved and minting will begin shortly.');

        // The actual minting would be triggered by a cron job or manual admin action
        console.log(`Minting triggered for property ${propertyId}`);
      }
    } catch (error) {
      console.error('Failed to trigger minting process:', error);
    }
  }

  private async triggerPostMintSteps(tokenId: number): Promise<void> {
    try {
      // Get property details
      const property = await query(
        'SELECT id, project_id FROM properties WHERE token_id = ?',
        [tokenId]
      );

      if (!property || property.length === 0) return;

      const propertyId = property[0].id;
      const projectId = property[0].project_id;

      // Step 1: Create TBA
      console.log(`Creating TBA for token ${tokenId}`);
      const user = await query('SELECT wallet_address FROM users WHERE id = (SELECT user_id FROM properties WHERE id = ?)', [propertyId]);
      if (user && user.length > 0) {
        await tbaService.createTBA(tokenId, user[0].wallet_address);
      }

      // Step 2: Register with marketplace
      console.log(`Registering token ${tokenId} with marketplace`);
      if (projectId) {
        await marketplaceRegistrationService.setupMarketplaceReadiness(tokenId, projectId);
      }

      // Step 3: Distribute initial shares
      console.log(`Distributing initial shares for token ${tokenId}`);
      await distributionService.distributeInitialShares(propertyId, tokenId);

      // Step 4: Mark as active (idempotent operation)
      await query(
        'UPDATE properties SET status = "ACTIVE", activated_at = CURRENT_TIMESTAMP, trade_ready = TRUE WHERE id = ? AND status = "MINTED"',
        [propertyId]
      );

      // Step 5: Notify user
      await this.emitUserNotification(propertyId, 'MINTING_COMPLETED', 'Your property has been successfully minted and is now active on the marketplace.');

    } catch (error) {
      console.error('Post-mint steps failed:', error);
      // Don't throw - we want to continue processing other events
    }
  }

  private async emitUserNotification(propertyId: string, type: string, message: string): Promise<void> {
    try {
      // Get user ID from property
      const property = await query('SELECT user_id FROM properties WHERE id = ?', [propertyId]);
      if (!property || property.length === 0) return;

      const userId = property[0].user_id;

      // Insert notification (assuming notifications table exists)
      await query(
        'INSERT INTO notifications (user_id, type, message, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [userId, type, message]
      );

      console.log(`Notification sent to user ${userId}: ${message}`);
    } catch (error) {
      console.error('Failed to emit notification:', error);
    }
  }

  private async updateLastSyncedBlock(blockNumber: number): Promise<void> {
    await query(
      'INSERT INTO system_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
      ['last_synced_block', blockNumber.toString(), blockNumber.toString()]
    );
  }

  // Manual sync trigger for specific property
  async syncPropertyStatus(propertyId: string): Promise<void> {
    try {
      const property = await query('SELECT * FROM properties WHERE id = ?', [propertyId]);
      if (!property || property.length === 0) return;

      const prop = property[0];

      // Check various statuses and update if needed
      if (prop.token_id && !prop.tba_address) {
        // TBA might not have been created
        console.log(`Checking TBA status for property ${propertyId}`);
        // Implementation to check TBA creation status
      }

      if (prop.token_id && !prop.marketplace_registered) {
        // Marketplace registration might be missing
        console.log(`Checking marketplace registration for property ${propertyId}`);
        // Implementation to check registration status
      }

    } catch (error) {
      console.error('Property status sync failed:', error);
      throw error;
    }
  }
}

export const propertySyncService = new PropertySyncService();