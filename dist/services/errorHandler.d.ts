export interface ErrorLog {
    id: string;
    service: string;
    operation: string;
    error: string;
    context?: any;
    retry_count: number;
    max_retries: number;
    status: 'FAILED' | 'RETRYING' | 'RESOLVED';
    created_at: Date;
    resolved_at?: Date;
}
export declare class ErrorHandler {
    logError(service: string, operation: string, error: Error | string, context?: any, maxRetries?: number): Promise<string>;
    retryOperation(errorId: string, retryFunction: () => Promise<any>): Promise<boolean>;
    getFailedOperations(service?: string): Promise<ErrorLog[]>;
    getRetryableOperations(): Promise<ErrorLog[]>;
    cleanupOldErrors(daysOld?: number): Promise<number>;
}
export declare const errorHandler: ErrorHandler;
export declare function withRetry<T>(operation: () => Promise<T>, service: string, operationName: string, maxRetries?: number, context?: any): Promise<T>;
export declare class CircuitBreaker {
    private failureThreshold;
    private recoveryTimeout;
    private failures;
    private lastFailureTime;
    private state;
    constructor(failureThreshold?: number, recoveryTimeout?: number);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    getState(): "CLOSED" | "OPEN" | "HALF_OPEN";
}
export declare function createErrorLogsTable(): Promise<void>;
//# sourceMappingURL=errorHandler.d.ts.map