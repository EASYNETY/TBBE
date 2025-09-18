"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Apply authentication and admin role check to all routes
router.use(auth_1.authenticateToken);
router.use((0, auth_1.requireRole)(['admin', 'super-admin']));
// Analytics routes
router.get('/analytics', (req, res) => {
    res.json({ message: 'Admin analytics endpoint' });
});
router.get('/analytics/revenue-management', (req, res) => {
    res.json({ message: 'Revenue management endpoint' });
});
// Distribution routes
router.get('/distributions', (req, res) => {
    res.json({ message: 'Distributions endpoint' });
});
router.post('/distributions/process', (req, res) => {
    res.json({ message: 'Process distributions endpoint' });
});
router.get('/distributions/export', (req, res) => {
    res.json({ message: 'Export distributions endpoint' });
});
exports.default = router;
//# sourceMappingURL=admin.js.map