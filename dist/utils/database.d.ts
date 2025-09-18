import mysql from 'mysql2/promise';
export declare const connectDB: () => Promise<void>;
export declare const getPool: () => mysql.Pool;
export declare const query: (sql: string, params?: any[]) => Promise<any>;
//# sourceMappingURL=database.d.ts.map