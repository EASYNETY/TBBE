import { Pool } from 'mysql2/promise';
/**
 * Create comprehensive wallet flow database tables
 * Including account linking, transactions, and disbursements
 */
export declare function createWalletFlowTables(pool: Pool): Promise<void>;
export declare function seedWalletFlowData(pool: Pool): Promise<void>;
//# sourceMappingURL=create-wallet-flow-tables.d.ts.map