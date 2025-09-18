"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.getPool = exports.connectDB = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nft_marketplace',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};
let pool;
const connectDB = async () => {
    try {
        pool = promise_1.default.createPool(dbConfig);
        const connection = await pool.getConnection();
        console.log('Connected to MySQL database');
        connection.release();
    }
    catch (error) {
        console.error('Database connection failed:', error);
        throw error;
    }
};
exports.connectDB = connectDB;
const getPool = () => {
    if (!pool) {
        throw new Error('Database not connected');
    }
    return pool;
};
exports.getPool = getPool;
const query = async (sql, params) => {
    const connection = await (0, exports.getPool)().getConnection();
    try {
        const [rows] = await connection.execute(sql, params);
        return rows;
    }
    finally {
        connection.release();
    }
};
exports.query = query;
//# sourceMappingURL=database.js.map