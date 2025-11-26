import { query } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export class NotificationService {
  /**
   * Create a new notification
   */
  static async createNotification(payload: NotificationPayload): Promise<string> {
    try {
      const id = uuidv4();
      const dataJson = payload.data ? JSON.stringify(payload.data) : null;

      await query(
        `INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [id, payload.userId, payload.type, payload.title, payload.message, dataJson]
      );

      console.log(`Notification created: ${payload.type} for user ${payload.userId}`);
      return id;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get unread count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL',
        [userId]
      );
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Create multiple notifications (batch)
   */
  static async createBatchNotifications(payloads: NotificationPayload[]): Promise<string[]> {
    try {
      const ids: string[] = [];
      for (const payload of payloads) {
        const id = await this.createNotification(payload);
        ids.push(id);
      }
      return ids;
    } catch (error) {
      console.error('Error creating batch notifications:', error);
      throw error;
    }
  }

  /**
   * Notify user about bid received
   */
  static async notifyBidReceived(
    userId: string,
    bidderUsername: string,
    propertyTitle: string,
    bidAmount: string,
    listingId: string
  ): Promise<string> {
    return this.createNotification({
      userId,
      type: 'bid_received',
      title: 'New Bid Received',
      message: `${bidderUsername} placed a bid of ${bidAmount} ETH on ${propertyTitle}`,
      data: {
        bidderUsername,
        propertyTitle,
        bidAmount,
        listingId,
        actionUrl: `/marketplace/${listingId}`,
      },
    });
  }

  /**
   * Notify user about dividend payment
   */
  static async notifyDividendPaid(
    userId: string,
    amount: string,
    currency: string,
    propertyTitle: string
  ): Promise<string> {
    return this.createNotification({
      userId,
      type: 'dividend_paid',
      title: 'Dividend Payment Received',
      message: `You received ${amount} ${currency} dividend from ${propertyTitle}`,
      data: {
        amount,
        currency,
        propertyTitle,
        actionUrl: '/wallet/transactions',
      },
    });
  }

  /**
   * Notify user about KYC submission
   */
  static async notifyKYCSubmission(
    userId: string,
    username: string
  ): Promise<string> {
    return this.createNotification({
      userId,
      type: 'kyc_submission',
      title: 'KYC Submission Received',
      message: `KYC submission from ${username} has been received and is under review`,
      data: {
        username,
        actionUrl: '/admin/kyc',
      },
    });
  }

  /**
   * Notify user about KYC approval
   */
  static async notifyKYCApproved(userId: string): Promise<string> {
    return this.createNotification({
      userId,
      type: 'kyc_approved',
      title: 'KYC Verification Approved',
      message: 'Your KYC verification has been approved. You can now access full platform features.',
      data: {
        actionUrl: '/dashboard',
      },
    });
  }

  /**
   * Notify user about KYC rejection
   */
  static async notifyKYCRejected(
    userId: string,
    reason: string
  ): Promise<string> {
    return this.createNotification({
      userId,
      type: 'kyc_rejected',
      title: 'KYC Verification Rejected',
      message: `Your KYC verification has been rejected. Reason: ${reason}`,
      data: {
        reason,
        actionUrl: '/kyc/retry',
      },
    });
  }

  /**
   * Notify user about escrow dispute
   */
  static async notifyEscrowDispute(
    userId: string,
    escrowId: string,
    propertyTitle: string
  ): Promise<string> {
    return this.createNotification({
      userId,
      type: 'escrow_dispute',
      title: 'Escrow Dispute Filed',
      message: `A dispute has been filed for ${propertyTitle}. Please review the details.`,
      data: {
        propertyTitle,
        escrowId,
        actionUrl: `/escrow/${escrowId}`,
      },
    });
  }

  /**
   * Notify user about escrow release
   */
  static async notifyEscrowReleased(
    userId: string,
    amount: string,
    currency: string,
    propertyTitle: string
  ): Promise<string> {
    return this.createNotification({
      userId,
      type: 'escrow_released',
      title: 'Escrow Funds Released',
      message: `${amount} ${currency} has been released for ${propertyTitle}`,
      data: {
        amount,
        currency,
        propertyTitle,
        actionUrl: '/wallet/transactions',
      },
    });
  }

  /**
   * Notify user about property listing
   */
  static async notifyPropertyListed(
    userId: string,
    propertyTitle: string,
    propertyId: string
  ): Promise<string> {
    return this.createNotification({
      userId,
      type: 'property_listed',
      title: 'Property Listed Successfully',
      message: `Your property "${propertyTitle}" has been listed on the marketplace`,
      data: {
        propertyTitle,
        propertyId,
        actionUrl: `/property/${propertyId}`,
      },
    });
  }

  /**
   * Notify user about auction ended
   */
  static async notifyAuctionEnded(
    userId: string,
    propertyTitle: string,
    winnerUsername: string,
    finalAmount: string
  ): Promise<string> {
    return this.createNotification({
      userId,
      type: 'auction_ended',
      title: 'Auction Ended',
      message: `Auction for ${propertyTitle} has ended. Won by ${winnerUsername} at ${finalAmount} ETH`,
      data: {
        propertyTitle,
        winnerUsername,
        finalAmount,
        actionUrl: '/marketplace',
      },
    });
  }

  /**
   * Notify user about subscription update
   */
  static async notifySubscriptionUpdate(
    userId: string,
    subscriptionType: string,
    status: string
  ): Promise<string> {
    return this.createNotification({
      userId,
      type: 'subscription_update',
      title: 'Subscription Updated',
      message: `Your ${subscriptionType} subscription is now ${status}`,
      data: {
        subscriptionType,
        status,
        actionUrl: '/profile/subscriptions',
      },
    });
  }

  /**
   * Notify multiple users
   */
  static async notifyMultipleUsers(
    userIds: string[],
    type: string,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<string[]> {
    const payloads = userIds.map(userId => ({
      userId,
      type,
      title,
      message,
      data,
    }));
    return this.createBatchNotifications(payloads);
  }
}

export default NotificationService;
