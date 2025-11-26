"use strict";
/**
 * Property Subscription & Distribution Channel - Usage Examples
 *
 * This script demonstrates how to use the complete subscription and
 * distribution channel system for property management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../utils/database");
const subscriptionService_1 = require("../services/subscriptionService");
const subscriptionDistributionChannelService_1 = require("../services/subscriptionDistributionChannelService");
async function main() {
    try {
        // Initialize database connection
        await (0, database_1.connectDB)();
        const db = (0, database_1.getPool)();
        const subscriptionService = new subscriptionService_1.SubscriptionService(db);
        const channelService = new subscriptionDistributionChannelService_1.SubscriptionDistributionChannelService(db);
        // Example Property ID (replace with actual)
        const propertyId = 'prop-001';
        const distributionId = 'dist-001';
        const tokenAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
        console.log('\n========== SUBSCRIPTION CHANNEL EXAMPLES ==========\n');
        // ===== EXAMPLE 1: CREATE A SUBSCRIPTION =====
        console.log('EXAMPLE 1: Create a new subscription\n');
        const subscription = await subscriptionService.createSubscription({
            propertyId,
            subscriberUserId: 'user-001',
            subscriberWalletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f42b1',
            subscriptionAmount: '10000',
            currency: 'USDC',
            transactionHash: '0x1234567890abcdef',
        });
        console.log('Created subscription:', {
            id: subscription.id,
            propertyId: subscription.property_id,
            subscriberWalletAddress: subscription.subscriber_wallet_address,
            subscriptionAmount: subscription.subscription_amount,
            sharePercentage: subscription.share_percentage,
            status: subscription.status,
        });
        // ===== EXAMPLE 2: GET SUBSCRIBERS FOR A PROPERTY =====
        console.log('\n\nEXAMPLE 2: Get all active subscribers for property\n');
        const activeSubscribers = await subscriptionService.getActiveSubscriptionsByProperty(propertyId);
        console.log(`Found ${activeSubscribers.length} active subscribers:`);
        activeSubscribers.forEach((sub, index) => {
            console.log(`  ${index + 1}. Wallet: ${sub.subscriber_wallet_address}`);
            console.log(`     Amount: ${sub.subscription_amount} ${sub.currency}`);
            console.log(`     Share: ${sub.share_percentage.toFixed(2)}%\n`);
        });
        // ===== EXAMPLE 3: GET CHANNEL STATISTICS =====
        console.log('\nEXAMPLE 3: Get channel statistics\n');
        const stats = await channelService.getChannelStatistics(propertyId);
        console.log('Property Channel Statistics:');
        console.log(`  Total Subscribers: ${stats.totalSubscribers}`);
        console.log(`  Active Subscribers: ${stats.activeSubscribers}`);
        console.log(`  Total Subscription Amount: ${stats.totalSubscriptionAmount} USDC`);
        console.log(`  Total Disbursed: ${stats.totalDisbursed} USDC`);
        console.log(`  Pending Disbursements: ${stats.pendingDisbursements}`);
        // ===== EXAMPLE 4: CREATE DISBURSEMENTS =====
        console.log('\n\nEXAMPLE 4: Create disbursements for yield distribution\n');
        const totalYield = '5000'; // 5000 USDC total
        const result = await channelService.createAndProcessDisbursements(propertyId, distributionId, totalYield, 'USDC', 'YIELD', tokenAddress, false // Don't auto-execute yet
        );
        console.log(`Created ${result.disbursements.length} disbursements:`);
        result.disbursements.slice(0, 3).forEach((disburse, index) => {
            console.log(`  ${index + 1}. Amount: ${disburse.disbursement_amount} USDC`);
            console.log(`     Status: ${disburse.status}\n`);
        });
        if (result.disbursements.length > 3) {
            console.log(`  ... and ${result.disbursements.length - 3} more`);
        }
        // ===== EXAMPLE 5: GET PENDING DISBURSEMENTS =====
        console.log('\n\nEXAMPLE 5: Get all pending disbursements\n');
        const pending = await subscriptionService.getPendingDisbursementsByProperty(propertyId);
        console.log(`Found ${pending.length} pending disbursements`);
        pending.slice(0, 3).forEach((disburse, index) => {
            console.log(`  ${index + 1}. ID: ${disburse.id}`);
            console.log(`     Amount: ${disburse.disbursement_amount} USDC`);
            console.log(`     Type: ${disburse.type}\n`);
        });
        // ===== EXAMPLE 6: EXECUTE BATCH DISBURSEMENTS =====
        console.log('\n\nEXAMPLE 6: Execute batch disbursements\n');
        const disbursementIds = result.disbursements.map((d) => d.id);
        console.log(`Executing ${disbursementIds.length} disbursements...`);
        const executionResults = await subscriptionService.executeBatchDisbursements(disbursementIds, tokenAddress);
        let successCount = 0;
        let failureCount = 0;
        executionResults.forEach((txHash, disbursementId) => {
            if (txHash === 'FAILED') {
                console.log(`  ✗ Disbursement ${disbursementId.substring(0, 8)}... FAILED`);
                failureCount++;
            }
            else {
                console.log(`  ✓ Disbursement ${disbursementId.substring(0, 8)}... executed`);
                console.log(`    TX: ${txHash.substring(0, 20)}...`);
                successCount++;
            }
        });
        console.log(`\nResults: ${successCount} succeeded, ${failureCount} failed`);
        // ===== EXAMPLE 7: GET SUBSCRIBER DETAILS =====
        console.log('\n\nEXAMPLE 7: Get detailed subscriber information\n');
        const subscriberDetails = await channelService.getSubscriberDetails(subscription.id);
        console.log('Subscriber Details:');
        console.log(`  User ID: ${subscriberDetails.subscription.subscriber_user_id}`);
        console.log(`  Wallet: ${subscriberDetails.subscription.subscriber_wallet_address}`);
        console.log(`  Subscription Amount: ${subscriberDetails.subscription.subscription_amount} USDC`);
        console.log(`  Share Percentage: ${subscriberDetails.subscription.share_percentage.toFixed(2)}%`);
        console.log(`  Disbursements Received: ${subscriberDetails.disbursementCount}`);
        console.log(`  Total Disbursed: ${subscriberDetails.totalDisbursed} USDC`);
        if (subscriberDetails.disbursements.length > 0) {
            console.log('\n  Recent Disbursements:');
            subscriberDetails.disbursements.slice(0, 3).forEach((disburse, index) => {
                console.log(`    ${index + 1}. ${disburse.disbursement_amount} USDC (${disburse.type})`);
                console.log(`       Status: ${disburse.status}`);
            });
        }
        // ===== EXAMPLE 8: GET PROPERTY OVERVIEW =====
        console.log('\n\nEXAMPLE 8: Get complete property overview\n');
        const overview = await channelService.getPropertyOverview(propertyId);
        console.log('Property Overview:');
        console.log(`  Property: ${overview.property.title}`);
        console.log(`  Address: ${overview.property.address}`);
        console.log(`  Total Subscribers: ${overview.subscribers.length}`);
        console.log(`  Total Disbursements: ${overview.disbursements.length}`);
        console.log(`  Total Subscription Value: ${overview.statistics.totalSubscriptionAmount} USDC`);
        // ===== EXAMPLE 9: VERIFY SUBSCRIBER KYC =====
        console.log('\n\nEXAMPLE 9: Verify KYC for subscription\n');
        await subscriptionService.verifySubscriptionKYC(subscription.id, true);
        console.log(`KYC verified for subscription ${subscription.id}`);
        // ===== EXAMPLE 10: GENERATE PROPERTY REPORT =====
        console.log('\n\nEXAMPLE 10: Generate comprehensive property report\n');
        const report = await channelService.generatePropertyReport(propertyId);
        console.log('Property Report:');
        console.log(`  Report Date: ${report.report_date}`);
        console.log(`  Property: ${report.property_name}`);
        console.log(`  Total Subscribers: ${report.statistics.totalSubscribers}`);
        console.log(`  Active Subscribers: ${report.statistics.activeSubscribers}`);
        console.log(`  Total Subscription: ${report.statistics.totalSubscriptionAmount} USDC`);
        console.log(`  Total Disbursed: ${report.statistics.totalDisbursed} USDC`);
        console.log(`  Pending Disbursements: ${report.statistics.pendingDisbursements}`);
        console.log('\n  Subscription by Currency:');
        Object.entries(report.subscription_breakdown.by_currency).forEach(([currency, data]) => {
            console.log(`    ${currency}: ${data.count} subscribers, ${data.total_amount} total`);
        });
        console.log('\n  Disbursements by Type:');
        Object.entries(report.disbursement_breakdown.by_type).forEach(([type, data]) => {
            console.log(`    ${type}: ${data.count} disbursements, ${data.total_amount} total`);
        });
        console.log('\n  Disbursements by Status:');
        Object.entries(report.disbursement_breakdown.by_status).forEach(([status, count]) => {
            console.log(`    ${status}: ${count}`);
        });
        // ===== EXAMPLE 11: GET DISBURSEMENT HISTORY =====
        console.log('\n\nEXAMPLE 11: Get disbursement history by date range\n');
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // Last 30 days
        const endDate = new Date();
        const historyDisbursements = await subscriptionService.getDisbursementsByDateRange(propertyId, startDate, endDate);
        console.log(`Found ${historyDisbursements.length} disbursements in last 30 days:`);
        historyDisbursements.slice(0, 3).forEach((disburse, index) => {
            console.log(`  ${index + 1}. ${disburse.disbursement_amount} ${disburse.currency}`);
            console.log(`     Type: ${disburse.type} | Status: ${disburse.status}`);
            console.log(`     Date: ${new Date(disburse.disbursement_date).toLocaleDateString()}\n`);
        });
        // ===== EXAMPLE 12: CANCEL SUBSCRIPTION =====
        console.log('\n\nEXAMPLE 12: Cancel a subscription\n');
        // Create another subscription to cancel
        const subscriptionToCancel = await subscriptionService.createSubscription({
            propertyId,
            subscriberUserId: 'user-002',
            subscriberWalletAddress: '0x842d35Cc6634C0532925a3b844Bc9e7595f42b2',
            subscriptionAmount: '5000',
            currency: 'USDC',
        });
        await subscriptionService.cancelSubscription(subscriptionToCancel.id);
        console.log(`Cancelled subscription ${subscriptionToCancel.id}`);
        // Verify cancellation
        const verifyCancel = await subscriptionService.getSubscriptionsBySubscriber(subscriptionToCancel.subscriber_user_id);
        const cancelled = verifyCancel.find((s) => s.id === subscriptionToCancel.id);
        console.log(`Status is now: ${cancelled?.status}`);
        console.log('\n\n========== EXAMPLES COMPLETED ==========\n');
    }
    catch (error) {
        console.error('Error running examples:', error);
        process.exit(1);
    }
}
// Run examples
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=subscriptionExample.js.map