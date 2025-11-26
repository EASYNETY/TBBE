"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionController = void 0;
const ethers_1 = require("ethers");
const subscription_1 = require("../models/subscription");
class SubscriptionController {
    constructor(db) {
        this.subscriptionModel = new subscription_1.SubscriptionModel(db);
        this.provider = new ethers_1.ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        console.log('SUBSCRIPTION_CONTRACT_ADDRESS:', process.env.SUBSCRIPTION_CONTRACT_ADDRESS);
        this.subscriptionContract = new ethers_1.ethers.Contract(process.env.SUBSCRIPTION_CONTRACT_ADDRESS, [
            'function subscribe(uint256 propertyId, uint256 amount) external',
            'function distributeReturns(uint256 propertyId, address[] calldata subscribers, uint256[] calldata payouts) external',
        ], new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.provider));
    }
    async subscribe(req, res) {
        const { id } = req.params;
        const { walletAddress, amount, transactionHash } = req.body;
        try {
            const subscriptionId = await this.subscriptionModel.create({
                propertyId: parseInt(id),
                walletAddress,
                amount,
                transactionHash
            });
            res.status(201).json({ message: 'Subscription successful', subscriptionId });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
    async payout(req, res) {
        const { id } = req.params;
        const { payouts } = req.body; // payouts: { subscriber: string, amount: number }[]
        try {
            const subscriptions = await this.subscriptionModel.findByPropertyId(parseInt(id));
            const subscribers = payouts.map((p) => p.subscriber);
            const amounts = payouts.map((p) => ethers_1.ethers.parseUnits(p.amount.toString(), 18)); // Assuming 18 decimals
            const tx = await this.subscriptionContract.distributeReturns(parseInt(id), subscribers, amounts);
            await tx.wait();
            res.status(200).json({ message: 'Payout successful', transactionHash: tx.hash });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}
exports.SubscriptionController = SubscriptionController;
//# sourceMappingURL=subscription.js.map