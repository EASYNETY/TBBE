import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { SubscriptionModel } from '../models/subscription';
import { Pool } from 'mysql2/promise';

export class SubscriptionController {
    private subscriptionModel: SubscriptionModel;
    private provider: ethers.JsonRpcProvider;
    private subscriptionContract: ethers.Contract;

    constructor(db: Pool) {
        this.subscriptionModel = new SubscriptionModel(db);
        this.provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        console.log('SUBSCRIPTION_CONTRACT_ADDRESS:', process.env.SUBSCRIPTION_CONTRACT_ADDRESS);
        this.subscriptionContract = new ethers.Contract(
            process.env.SUBSCRIPTION_CONTRACT_ADDRESS!,
            [
                'function subscribe(uint256 propertyId, uint256 amount) external',
                'function distributeReturns(uint256 propertyId, address[] calldata subscribers, uint256[] calldata payouts) external',
            ],
            new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider)
        );
    }

    async subscribe(req: Request, res: Response) {
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
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async payout(req: Request, res: Response) {
        const { id } = req.params;
        const { payouts } = req.body; // payouts: { subscriber: string, amount: number }[]

        try {
            const subscriptions = await this.subscriptionModel.findByPropertyId(parseInt(id));

            const subscribers = payouts.map((p: any) => p.subscriber);
            const amounts = payouts.map((p: any) => ethers.parseUnits(p.amount.toString(), 18)); // Assuming 18 decimals

            const tx = await this.subscriptionContract.distributeReturns(parseInt(id), subscribers, amounts);
            await tx.wait();

            res.status(200).json({ message: 'Payout successful', transactionHash: tx.hash });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}
