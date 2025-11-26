"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.errorHandler = exports.ErrorHandler = void 0;
exports.withRetry = withRetry;
exports.createErrorLogsTable = createErrorLogsTable;
const database_1 = require("../utils/database");
class ErrorHandler {
    async logError(service, operation, error, context, maxRetries = 3) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const errorMessage = error instanceof Error ? error.message : error;
        const errorLog = {
            service,
            operation,
            error: errorMessage,
            context: JSON.stringify(context || {}),
            retry_count: 0,
            max_retries: maxRetries,
            status: 'FAILED',
        };
        try {
            await (0, database_1.query)(`INSERT INTO error_logs (id, service, operation, error, context, retry_count, max_retries, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`, [
                errorId,
                errorLog.service,
                errorLog.operation,
                errorLog.error,
                errorLog.context,
                errorLog.retry_count,
                errorLog.max_retries,
                errorLog.status,
            ]);
            console.error(`[${service}] ${operation} failed:`, errorMessage);
            return errorId;
        }
        catch (dbError) {
            console.error('Failed to log error to database:', dbError);
            return errorId;
        }
    }
    async retryOperation(errorId, retryFunction) {
        try {
            // Get current error log
            const errorLogs = await (0, database_1.query)('SELECT * FROM error_logs WHERE id = ?', [errorId]);
            if (!errorLogs || errorLogs.length === 0) {
                return false;
            }
            const errorLog = errorLogs[0];
            if (errorLog.retry_count >= errorLog.max_retries) {
                console.log(`Max retries reached for error ${errorId}`);
                return false;
            }
            // Update retry count and status
            await (0, database_1.query)('UPDATE error_logs SET retry_count = retry_count + 1, status = ? WHERE id = ?', ['RETRYING', errorId]);
            console.log(`Retrying operation for error ${errorId} (attempt ${errorLog.retry_count + 1}/${errorLog.max_retries})`);
            // Execute retry
            await retryFunction();
            // Mark as resolved
            await (0, database_1.query)('UPDATE error_logs SET status = ?, resolved_at = NOW() WHERE id = ?', ['RESOLVED', errorId]);
            console.log(`Error ${errorId} resolved successfully`);
            return true;
        }
        catch (retryError) {
            console.error(`Retry failed for error ${errorId}:`, retryError);
            // Check if we should continue retrying
            const updatedLogs = await (0, database_1.query)('SELECT retry_count, max_retries FROM error_logs WHERE id = ?', [errorId]);
            if (updatedLogs && updatedLogs.length > 0) {
                const { retry_count, max_retries } = updatedLogs[0];
                if (retry_count >= max_retries) {
                    await (0, database_1.query)('UPDATE error_logs SET status = ? WHERE id = ?', ['FAILED', errorId]);
                }
                else {
                    await (0, database_1.query)('UPDATE error_logs SET status = ? WHERE id = ?', ['FAILED', errorId]);
                }
            }
            return false;
        }
    }
    async getFailedOperations(service) {
        let sql = 'SELECT * FROM error_logs WHERE status != ?';
        const params = ['RESOLVED'];
        if (service) {
            sql += ' AND service = ?';
            params.push(service);
        }
        sql += ' ORDER BY created_at DESC LIMIT 100';
        const results = await (0, database_1.query)(sql, params);
        return results;
    }
    async getRetryableOperations() {
        const results = await (0, database_1.query)('SELECT * FROM error_logs WHERE status = ? AND retry_count < max_retries ORDER BY created_at ASC LIMIT 50', ['FAILED']);
        return results;
    }
    async cleanupOldErrors(daysOld = 30) {
        const result = await (0, database_1.query)('DELETE FROM error_logs WHERE status = ? AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)', ['RESOLVED', daysOld]);
        return result.affectedRows || 0;
    }
}
exports.ErrorHandler = ErrorHandler;
exports.errorHandler = new ErrorHandler();
// Retry wrapper for operations
async function withRetry(operation, service, operationName, maxRetries = 3, context) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                console.warn(`[${service}] ${operationName} failed (attempt ${attempt}/${maxRetries}):`, error);
                // Exponential backoff: wait 1s, 2s, 4s, etc.
                const delay = Math.pow(2, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    // Log the final failure
    await exports.errorHandler.logError(service, operationName, lastError, context, maxRetries);
    throw lastError;
}
// Circuit breaker pattern
class CircuitBreaker {
    constructor(failureThreshold = 5, recoveryTimeout = 60000 // 1 minute
    ) {
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
        this.failures = 0;
        this.lastFailureTime = 0;
        this.state = 'CLOSED';
    }
    async execute(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
                this.state = 'HALF_OPEN';
            }
            else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    onSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }
    onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }
    getState() {
        return this.state;
    }
}
exports.CircuitBreaker = CircuitBreaker;
// Database table creation
async function createErrorLogsTable() {
    await (0, database_1.query)(`
    CREATE TABLE IF NOT EXISTS error_logs (
      id VARCHAR(50) PRIMARY KEY,
      service VARCHAR(100) NOT NULL,
      operation VARCHAR(200) NOT NULL,
      error TEXT NOT NULL,
      context JSON,
      retry_count INT DEFAULT 0,
      max_retries INT DEFAULT 3,
      status ENUM('FAILED', 'RETRYING', 'RESOLVED') DEFAULT 'FAILED',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP NULL,
      INDEX idx_service (service),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    );
  `);
}
//# sourceMappingURL=errorHandler.js.map