"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../utils/database");
async function addFeaturedColumn() {
    try {
        await (0, database_1.connectDB)();
        await (0, database_1.query)('ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE');
        console.log('Successfully added is_featured column to properties table.');
    }
    catch (error) {
        console.error('Failed to add is_featured column:', error);
    }
}
addFeaturedColumn();
//# sourceMappingURL=add-featured-column.js.map