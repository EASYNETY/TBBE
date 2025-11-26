import { query } from '../utils/database';

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

export class ErrorHandler {
  async logError(
    service: string,
    operation: string,
    error: Error | string,
    context?: any,
    maxRetries: number = 3
  ): Promise<string> {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const errorMessage = error instanceof Error ? error.message : error;

    const errorLog: Omit<ErrorLog, 'id' | 'created_at'> = {
      service,
      operation,
      error: errorMessage,
      context: JSON.stringify(context || {}),
      retry_count: 0,
      max_retries: maxRetries,
      status: 'FAILED',
    };

    try {
      await query(
        `INSERT INTO error_logs (id, service, operation, error, context, retry_count, max_retries, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          errorId,
          errorLog.service,
          errorLog.operation,
          errorLog.error,
          errorLog.context,
          errorLog.retry_count,
          errorLog.max_retries,
          errorLog.status,
        ]
      );

      console.error(`[${service}] ${operation} failed:`, errorMessage);
      return errorId;
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError);
      return errorId;
    }
  }

  async retryOperation(
    errorId: string,
    retryFunction: () => Promise<any>
  ): Promise<boolean> {
    try {
      // Get current error log
      const errorLogs = await query(
        'SELECT * FROM error_logs WHERE id = ?',
        [errorId]
      );

      if (!errorLogs || errorLogs.length === 0) {
        return false;
      }

      const errorLog = errorLogs[0] as ErrorLog;

      if (errorLog.retry_count >= errorLog.max_retries) {
        console.log(`Max retries reached for error ${errorId}`);
        return false;
      }

      // Update retry count and status
      await query(
        'UPDATE error_logs SET retry_count = retry_count + 1, status = ? WHERE id = ?',
        ['RETRYING', errorId]
      );

      console.log(`Retrying operation for error ${errorId} (attempt ${errorLog.retry_count + 1}/${errorLog.max_retries})`);

      // Execute retry
      await retryFunction();

      // Mark as resolved
      await query(
        'UPDATE error_logs SET status = ?, resolved_at = NOW() WHERE id = ?',
        ['RESOLVED', errorId]
      );

      console.log(`Error ${errorId} resolved successfully`);
      return true;

    } catch (retryError) {
      console.error(`Retry failed for error ${errorId}:`, retryError);

      // Check if we should continue retrying
      const updatedLogs = await query(
        'SELECT retry_count, max_retries FROM error_logs WHERE id = ?',
        [errorId]
      );

      if (updatedLogs && updatedLogs.length > 0) {
        const { retry_count, max_retries } = updatedLogs[0];

        if (retry_count >= max_retries) {
          await query(
            'UPDATE error_logs SET status = ? WHERE id = ?',
            ['FAILED', errorId]
          );
        } else {
          await query(
            'UPDATE error_logs SET status = ? WHERE id = ?',
            ['FAILED', errorId]
          );
        }
      }

      return false;
    }
  }

  async getFailedOperations(service?: string): Promise<ErrorLog[]> {
    let sql = 'SELECT * FROM error_logs WHERE status != ?';
    const params: any[] = ['RESOLVED'];

    if (service) {
      sql += ' AND service = ?';
      params.push(service);
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';

    const results = await query(sql, params);
    return results as ErrorLog[];
  }

  async getRetryableOperations(): Promise<ErrorLog[]> {
    const results = await query(
      'SELECT * FROM error_logs WHERE status = ? AND retry_count < max_retries ORDER BY created_at ASC LIMIT 50',
      ['FAILED']
    );
    return results as ErrorLog[];
  }

  async cleanupOldErrors(daysOld: number = 30): Promise<number> {
    const result = await query(
      'DELETE FROM error_logs WHERE status = ? AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      ['RESOLVED', daysOld]
    );

    return result.affectedRows || 0;
  }
}

export const errorHandler = new ErrorHandler();

// Retry wrapper for operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  service: string,
  operationName: string,
  maxRetries: number = 3,
  context?: any
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        console.warn(`[${service}] ${operationName} failed (attempt ${attempt}/${maxRetries}):`, error);

        // Exponential backoff: wait 1s, 2s, 4s, etc.
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Log the final failure
  await errorHandler.logError(service, operationName, lastError!, context, maxRetries);
  throw lastError!;
}

// Circuit breaker pattern
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
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

// Database table creation
export async function createErrorLogsTable(): Promise<void> {
  await query(`
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