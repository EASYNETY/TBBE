import { Pool } from 'mysql2/promise';
export interface DisbursementRequest {
    subscriptionId: string;
    userId: string;
    amount: number;
    roiPercentage: number;
    period: string;
}
export interface DisbursementRecord {
    id: string;
    subscriptionId: string;
    userId: string;
    amount: number;
    roiPercentage: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    txHash?: string;
    scheduledFor: Date;
    processedAt?: Date;
    failureReason?: string;
}
export interface DisbursementSchedule {
    subscriptionId: string;
    nextDisbursement: Date;
    frequency: string;
    amount: number;
    roiPercentage: number;
    isActive: boolean;
}
export declare class DisbursementService {
    private pool;
    private transactionService;
    private walletModel;
    constructor(pool: Pool);
    createDisbursement(request: DisbursementRequest): Promise<DisbursementRecord>;
    getDisbursement(disbursementId: string): Promise<DisbursementRecord | null>;
    getDisbursementsBySubscription(subscriptionId: string): Promise<DisbursementRecord[]>;
    getDisbursementsByUser(userId: string, limit?: number): Promise<DisbursementRecord[]>;
    getPendingDisbursements(): Promise<DisbursementRecord[]>;
    processDisbursement(disbursementId: string): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }>;
    retryFailedDisbursement(disbursementId: string): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }>;
    createDisbursementSchedule(subscriptionId: string, userId: string, amount: number, roiPercentage: number, frequency: 'monthly' | 'quarterly' | 'annually'): Promise<DisbursementSchedule>;
    getDisbursementSchedule(subscriptionId: string): Promise<DisbursementSchedule | null>;
    processDueSchedules(): Promise<{
        processed: number;
        failed: number;
    }>;
    pauseDisbursementSchedule(subscriptionId: string): Promise<void>;
    resumeDisbursementSchedule(subscriptionId: string): Promise<void>;
    getDisbursementStats(userId: string): Promise<{
        totalDisbursed: number;
        averageAmount: number;
        lastDisbursement?: Date;
        nextScheduled?: Date;
    }>;
    private calculateNextDisbursement;
    private formatDisbursement;
}
//# sourceMappingURL=disbursementService.d.ts.map