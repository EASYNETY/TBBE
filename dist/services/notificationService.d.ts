export interface NotificationPayload {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
}
export declare class NotificationService {
    /**
     * Create a new notification
     */
    static createNotification(payload: NotificationPayload): Promise<string>;
    /**
     * Get unread count for a user
     */
    static getUnreadCount(userId: string): Promise<number>;
    /**
     * Create multiple notifications (batch)
     */
    static createBatchNotifications(payloads: NotificationPayload[]): Promise<string[]>;
    /**
     * Notify user about bid received
     */
    static notifyBidReceived(userId: string, bidderUsername: string, propertyTitle: string, bidAmount: string, listingId: string): Promise<string>;
    /**
     * Notify user about dividend payment
     */
    static notifyDividendPaid(userId: string, amount: string, currency: string, propertyTitle: string): Promise<string>;
    /**
     * Notify user about KYC submission
     */
    static notifyKYCSubmission(userId: string, username: string): Promise<string>;
    /**
     * Notify user about KYC approval
     */
    static notifyKYCApproved(userId: string): Promise<string>;
    /**
     * Notify user about KYC rejection
     */
    static notifyKYCRejected(userId: string, reason: string): Promise<string>;
    /**
     * Notify user about escrow dispute
     */
    static notifyEscrowDispute(userId: string, escrowId: string, propertyTitle: string): Promise<string>;
    /**
     * Notify user about escrow release
     */
    static notifyEscrowReleased(userId: string, amount: string, currency: string, propertyTitle: string): Promise<string>;
    /**
     * Notify user about property listing
     */
    static notifyPropertyListed(userId: string, propertyTitle: string, propertyId: string): Promise<string>;
    /**
     * Notify user about auction ended
     */
    static notifyAuctionEnded(userId: string, propertyTitle: string, winnerUsername: string, finalAmount: string): Promise<string>;
    /**
     * Notify user about subscription update
     */
    static notifySubscriptionUpdate(userId: string, subscriptionType: string, status: string): Promise<string>;
    /**
     * Notify multiple users
     */
    static notifyMultipleUsers(userIds: string[], type: string, title: string, message: string, data?: Record<string, any>): Promise<string[]>;
}
export default NotificationService;
//# sourceMappingURL=notificationService.d.ts.map