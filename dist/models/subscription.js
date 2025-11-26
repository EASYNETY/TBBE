"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionModel = void 0;
class SubscriptionModel {
    constructor(db) {
        this.db = db;
    }
    async create(subscription) {
        const [result] = await this.db.execute('INSERT INTO subscriptions (propertyId, walletAddress, amount, transactionHash) VALUES (?, ?, ?, ?)', [subscription.propertyId, subscription.walletAddress, subscription.amount, subscription.transactionHash]);
        return result.insertId;
    }
    async findByPropertyId(propertyId) {
        const [rows] = await this.db.query('SELECT * FROM subscriptions WHERE propertyId = ?', [propertyId]);
        return rows;
    }
}
exports.SubscriptionModel = SubscriptionModel;
//# sourceMappingURL=subscription.js.map