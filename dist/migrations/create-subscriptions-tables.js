"use strict";
// Migration script to create subscriptions and disbursements tables
// Run this after setting up the database connection
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubscriptionsTables = createSubscriptionsTables;
const database_1 = require("../utils/database");
const subscriptionModel_1 = require("../models/subscriptionModel");
async function createSubscriptionsTables() {
    try {
        console.log('Creating subscriptions table...');
        await (0, database_1.query)(subscriptionModel_1.subscriptionQueries.createTable, []);
        console.log('✓ Subscriptions table created');
        console.log('Creating disbursements table...');
        await (0, database_1.query)(subscriptionModel_1.disbursementQueries.createTable, []);
        console.log('✓ Disbursements table created');
        console.log('All subscription tables created successfully!');
    }
    catch (error) {
        console.error('Error creating subscription tables:', error);
        throw error;
    }
}
// Run migration if executed directly
if (require.main === module) {
    createSubscriptionsTables()
        .then(() => {
        console.log('Migration completed successfully');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=create-subscriptions-tables.js.map