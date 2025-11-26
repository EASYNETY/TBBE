import { Pool } from 'mysql2/promise';
import { Subscription, DisbursementRecord } from '../models/subscriptionModel';
export interface CreateSubscriptionRequest {
    propertyId: string;
    subscriberUserId: string;
    subscriberWalletAddress: string;
    subscriptionAmount: string;
    currency: string;
    transactionHash?: string;
}
export interface CreateDisbursementRequest {
    propertyId: string;
    distributionId: string;
    subscriberId: string;
    disbursementAmount: string;
    currency: string;
    type: 'YIELD' | 'RETURN' | 'REVENUE' | 'DIVIDEND';
}
export interface DisbursementPayload {
    subscriberWalletAddress: string;
    amount: string;
}
export declare class SubscriptionService {
    private db;
    private provider;
    private signer;
    private walletService;
    constructor(db: Pool);
    /**
     * Create a new property subscription
     */
    createSubscription(request: CreateSubscriptionRequest): Promise<Subscription>;
    /**
     * Get all subscriptions for a property
     */
    getSubscriptionsByProperty(propertyId: string): Promise<Subscription[]>;
    /**
     * Get active subscriptions for a property
     */
    getActiveSubscriptionsByProperty(propertyId: string): Promise<Subscription[]>;
    /**
     * Get subscriptions for a subscriber user
     */
    getSubscriptionsBySubscriber(subscriberUserId: string): Promise<Subscription[]>;
    /**
     * Get subscriptions by wallet address
     */
    getSubscriptionsByWallet(walletAddress: string): Promise<Subscription[]>;
    /**
     * Cancel a subscription
     */
    cancelSubscription(subscriptionId: string): Promise<void>;
    /**
     * Verify KYC for a subscription
     */
    verifySubscriptionKYC(subscriptionId: string, verified: boolean): Promise<void>;
    /**
     * Get total number of subscribers for a property
     */
    getTotalSubscriberCount(propertyId: string): Promise<number>;
    /**
     * Get total subscription amount for a property
     */
    getTotalSubscriptionAmount(propertyId: string): Promise<string>;
    /**
     * Create a disbursement record for subscribers
     */
    createDisbursement(request: CreateDisbursementRequest): Promise<DisbursementRecord>;
    /**
     * Create multiple disbursements for all subscribers of a property
     */
    createDisbursementsForAllSubscribers(propertyId: string, distributionId: string, disbursementAmountPerSubscriber: string, currency: string, type: 'YIELD' | 'RETURN' | 'REVENUE' | 'DIVIDEND'): Promise<DisbursementRecord[]>;
    /**
     * Get all disbursements for a property
     */
    getDisbursementsByProperty(propertyId: string): Promise<DisbursementRecord[]>;
    /**
     * Get disbursements by distribution
     */
    getDisbursementsByDistribution(distributionId: string): Promise<DisbursementRecord[]>;
    /**
     * Get disbursements for a subscriber
     */
    getDisbursementsBySubscriber(subscriberId: string): Promise<DisbursementRecord[]>;
    /**
     * Get disbursements by wallet address
     */
    getDisbursementsByWallet(walletAddress: string): Promise<DisbursementRecord[]>;
    /**
     * Get pending disbursements
     */
    getPendingDisbursements(): Promise<DisbursementRecord[]>;
    /**
     * Get pending disbursements for a property
     */
    getPendingDisbursementsByProperty(propertyId: string): Promise<DisbursementRecord[]>;
    /**
     * Execute a disbursement on blockchain and credit in-app wallet
     */
    executeDisbursement(disbursementId: string, tokenAddress: string, senderAddress: string): Promise<string>;
    /**
     * Execute multiple disbursements in batch
     */
    executeBatchDisbursements(disbursementIds: string[], tokenAddress: string): Promise<Map<string, string>>;
    /**
     * Get total disbursed amount for a subscriber
     */
    getTotalDisbursedBySubscriber(subscriberId: string): Promise<string>;
    /**
     * Get total disbursed amount for a property
     */
    getTotalDisbursedByProperty(propertyId: string): Promise<string>;
    /**
     * Get disbursements within a date range
     */
    getDisbursementsByDateRange(propertyId: string, startDate: Date, endDate: Date): Promise<DisbursementRecord[]>;
}
//# sourceMappingURL=subscriptionService.d.ts.map