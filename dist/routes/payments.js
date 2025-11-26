"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../utils/database");
const router = express_1.default.Router();
// Public endpoint to get active payment options
router.get('/options', async (req, res) => {
    try {
        const options = await (0, database_1.query)('SELECT * FROM payment_options WHERE is_active = TRUE ORDER BY type, name');
        res.json({ paymentOptions: options });
    }
    catch (error) {
        console.error('Failed to fetch payment options:', error);
        res.status(500).json({ error: 'Failed to fetch payment options' });
    }
});
exports.default = router;
//# sourceMappingURL=payments.js.map