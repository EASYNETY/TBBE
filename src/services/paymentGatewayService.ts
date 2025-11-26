// Payment Gateway Service
// Integrates multiple payment processors: Stripe, Eway, POLi, and NZD

import { Pool } from 'mysql2/promise';
// Stripe is optional - can be installed later with: npm install stripe
let Stripe: any;
try {
    Stripe = require('stripe');
} catch (e) {
    console.warn('Stripe package not installed. Run: npm install stripe');
}

export interface StripePaymentRequest {
    propertyId: string;
    subscriberUserId: string;
    amount: number;
    currency: string;
    paymentIntentId?: string;
}

export interface EwayPaymentRequest {
    propertyId: string;
    subscriberUserId: string;
    amount: number;
    currency: string;
    tokenCustomerID?: string;
}

export interface POLiPaymentRequest {
    propertyId: string;
    subscriberUserId: string;
    amount: number;
    currency: string;
    transactionToken?: string;
}

export interface PaymentResult {
    transactionId: string;
    status: string;
    amount: number;
    currency: string;
    timestamp: Date;
}

export class PaymentGatewayService {
    private db: Pool;
    private stripe: any;
    private ewayApiKey: string;
    private poliPartnerCode: string;
    private poliMerchantCode: string;

    constructor(db: Pool) {
        this.db = db;
        
        // Initialize Stripe
        if (Stripe) {
            this.stripe = Stripe(process.env.STRIPE_SECRET_KEY || '', {
                apiVersion: '2023-10-16',
            });
        }

        // Initialize Eway
        this.ewayApiKey = process.env.EWAY_API_KEY || '';

        // Initialize POLi
        this.poliPartnerCode = process.env.POLI_PARTNER_CODE || '';
        this.poliMerchantCode = process.env.POLI_MERCHANT_CODE || '';
    }

    /**
     * Process Stripe payment
     */
    async processStripePayment(request: StripePaymentRequest): Promise<PaymentResult> {
        try {
            if (!request.paymentIntentId) {
                throw new Error('Payment Intent ID is required for Stripe payments');
            }

            // Confirm the payment intent
            const paymentIntent = await this.stripe.paymentIntents.confirm(request.paymentIntentId);

            if (paymentIntent.status !== 'succeeded') {
                throw new Error(`Payment failed: ${paymentIntent.status}`);
            }

            // Log transaction in database
            const connection = await this.db.getConnection();
            try {
                await connection.query(
                    `INSERT INTO payment_transactions 
                    (property_id, subscriber_user_id, amount, currency, gateway, gateway_transaction_id, status, created_at)
                    VALUES (?, ?, ?, ?, 'STRIPE', ?, 'COMPLETED', NOW())`,
                    [
                        request.propertyId,
                        request.subscriberUserId,
                        request.amount,
                        request.currency,
                        paymentIntent.id
                    ]
                );
            } finally {
                connection.release();
            }

            return {
                transactionId: paymentIntent.id,
                status: 'COMPLETED',
                amount: request.amount,
                currency: request.currency,
                timestamp: new Date(),
            };
        } catch (error) {
            console.error('Stripe payment processing error:', error);
            throw new Error(`Stripe payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Create Stripe Payment Intent for frontend
     */
    async createStripePaymentIntent(amount: number, currency: string, metadata?: any): Promise<any> {
        try {
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Stripe requires amount in cents
                currency: currency.toLowerCase(),
                metadata: metadata || {},
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            return {
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
            };
        } catch (error) {
            console.error('Stripe payment intent creation error:', error);
            throw new Error(`Failed to create payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Process Eway payment
     * Eway is an Australian payment processor
     */
    async processEwayPayment(request: EwayPaymentRequest): Promise<PaymentResult> {
        try {
            if (!request.tokenCustomerID) {
                throw new Error('Eway Token Customer ID is required');
            }

            // Eway API call
            const ewayUrl = process.env.EWAY_API_URL || 'https://api.ewaypayments.com/v3';
            const response = await fetch(`${ewayUrl}/Transaction`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${Buffer.from(`:${this.ewayApiKey}`).toString('base64')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    Customer: {
                        TokenCustomerID: request.tokenCustomerID,
                    },
                    Payment: {
                        TotalAmount: Math.round(request.amount * 100), // Eway requires amount in cents
                        CurrencyCode: request.currency === 'NZD' ? '554' : '036', // Currency codes
                    },
                    Method: 'ProcessPayment',
                    RedirectUrl: `${process.env.APP_URL}/payment/eway/callback`,
                }),
            });

            if (!response.ok) {
                throw new Error(`Eway API error: ${response.statusText}`);
            }

            const result = await response.json() as any;

            if (!result.TransactionStatus) {
                throw new Error(`Payment failed: ${result.Messages?.join(', ') || 'Unknown error'}`);
            }

            // Log transaction
            const connection = await this.db.getConnection();
            try {
                await connection.query(
                    `INSERT INTO payment_transactions 
                    (property_id, subscriber_user_id, amount, currency, gateway, gateway_transaction_id, status, created_at)
                    VALUES (?, ?, ?, ?, 'EWAY', ?, 'COMPLETED', NOW())`,
                    [
                        request.propertyId,
                        request.subscriberUserId,
                        request.amount,
                        request.currency,
                        result.TransactionID
                    ]
                );
            } finally {
                connection.release();
            }

            return {
                transactionId: result.TransactionID,
                status: 'COMPLETED',
                amount: request.amount,
                currency: request.currency,
                timestamp: new Date(),
            };
        } catch (error) {
            console.error('Eway payment processing error:', error);
            throw new Error(`Eway payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Create Eway Payment Token for recurring/stored payments
     */
    async createEwayPaymentToken(customerName: string, cardNumber: string, expiryMonth: string, expiryYear: string): Promise<string> {
        try {
            const ewayUrl = process.env.EWAY_API_URL || 'https://api.ewaypayments.com/v3';
            const response = await fetch(`${ewayUrl}/Customer`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${Buffer.from(`:${this.ewayApiKey}`).toString('base64')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    Title: 'Mr',
                    FirstName: customerName.split(' ')[0],
                    LastName: customerName.split(' ').slice(1).join(' '),
                    CardDetails: {
                        Name: customerName,
                        Number: cardNumber,
                        ExpiryMonth: expiryMonth,
                        ExpiryYear: expiryYear,
                    },
                }),
            });

            const result = await response.json() as any;
            return result.TokenCustomerID;
        } catch (error) {
            console.error('Eway token creation error:', error);
            throw new Error(`Failed to create Eway token: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Process POLi payment
     * POLi is an Australian online payment service (bank transfer via POLi)
     */
    async processPOLiPayment(request: POLiPaymentRequest): Promise<PaymentResult> {
        try {
            if (!request.transactionToken) {
                throw new Error('POLi transaction token is required');
            }

            // POLi API call to get transaction details
            const poliUrl = process.env.POLI_API_URL || 'https://poliapi.polipayments.com/api/v2';
            const response = await fetch(`${poliUrl}/GetTransaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `${this.poliMerchantCode}:${this.poliPartnerCode}`,
                },
                body: JSON.stringify({
                    Token: request.transactionToken,
                }),
            });

            if (!response.ok) {
                throw new Error(`POLi API error: ${response.statusText}`);
            }

            const result = await response.json() as any;

            if (result.TransactionStatus !== 'Completed') {
                throw new Error(`Payment incomplete: ${result.TransactionStatus}`);
            }

            // Verify amount matches
            if (result.Amount !== Math.round(request.amount * 100)) {
                throw new Error('Amount mismatch in POLi response');
            }

            // Log transaction
            const connection = await this.db.getConnection();
            try {
                await connection.query(
                    `INSERT INTO payment_transactions 
                    (property_id, subscriber_user_id, amount, currency, gateway, gateway_transaction_id, status, created_at)
                    VALUES (?, ?, ?, ?, 'POLI', ?, 'COMPLETED', NOW())`,
                    [
                        request.propertyId,
                        request.subscriberUserId,
                        request.amount,
                        request.currency,
                        result.TransactionRefNumber
                    ]
                );
            } finally {
                connection.release();
            }

            return {
                transactionId: result.TransactionRefNumber,
                status: 'COMPLETED',
                amount: request.amount,
                currency: request.currency,
                timestamp: new Date(),
            };
        } catch (error) {
            console.error('POLi payment processing error:', error);
            throw new Error(`POLi payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Initiate POLi Payment (get redirect URL for user)
     */
    async initiatePOLiPayment(amount: number, currency: string, merchantReference: string): Promise<string> {
        try {
            const poliUrl = process.env.POLI_API_URL || 'https://poliapi.polipayments.com/api/v2';
            const response = await fetch(`${poliUrl}/InitiateTransaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `${this.poliMerchantCode}:${this.poliPartnerCode}`,
                },
                body: JSON.stringify({
                    Amount: Math.round(amount * 100), // POLi requires amount in cents
                    CurrencyCode: currency === 'NZD' ? '554' : '036',
                    MerchantReference: merchantReference,
                    NotificationURL: `${process.env.APP_URL}/api/payments/poli/notification`,
                    SuccessURL: `${process.env.APP_URL}/subscription/success`,
                    FailureURL: `${process.env.APP_URL}/subscription/failed`,
                    CancellationURL: `${process.env.APP_URL}/subscription/cancelled`,
                }),
            });

            if (!response.ok) {
                throw new Error(`POLi API error: ${response.statusText}`);
            }

            const result = await response.json() as any;
            return result.NavigateURL;
        } catch (error) {
            console.error('POLi payment initiation error:', error);
            throw new Error(`Failed to initiate POLi payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Process NZD payment
     * NZD payments can be processed through:
     * 1. Stripe (if merchant account supports NZD)
     * 2. POLi (for bank transfers in NZ)
     * 3. 2Checkout (Verifone) - alternative processor
     */
    async processNZDPayment(request: any): Promise<PaymentResult> {
        try {
            const { subscriberUserId, amount, paymentMethodId } = request;

            // Use Stripe for NZD if available
            if (process.env.STRIPE_SECRET_KEY) {
                const paymentIntent = await this.stripe.paymentIntents.create({
                    amount: Math.round(amount * 100),
                    currency: 'nzd',
                    payment_method: paymentMethodId,
                    confirm: true,
                    automatic_payment_methods: {
                        enabled: true,
                    },
                });

                if (paymentIntent.status !== 'succeeded') {
                    throw new Error(`NZD payment failed: ${paymentIntent.status}`);
                }

                // Log transaction
                const connection = await this.db.getConnection();
                try {
                    await connection.query(
                        `INSERT INTO payment_transactions 
                        (subscriber_user_id, amount, currency, gateway, gateway_transaction_id, status, created_at)
                        VALUES (?, ?, 'NZD', 'STRIPE_NZD', ?, 'COMPLETED', NOW())`,
                        [subscriberUserId, amount, paymentIntent.id]
                    );
                } finally {
                    connection.release();
                }

                return {
                    transactionId: paymentIntent.id,
                    status: 'COMPLETED',
                    amount,
                    currency: 'NZD',
                    timestamp: new Date(),
                };
            }

            // Fallback to POLi for NZD bank transfers
            const poliRedirectUrl = await this.initiatePOLiPayment(amount, 'NZD', `NZD-${subscriberUserId}-${Date.now()}`);
            
            return {
                transactionId: 'POLI_INITIATED',
                status: 'PENDING',
                amount,
                currency: 'NZD',
                timestamp: new Date(),
            };
        } catch (error) {
            console.error('NZD payment processing error:', error);
            throw new Error(`NZD payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Log pending bank transfer for manual reconciliation
     */
    async logPendingTransfer(transferData: any): Promise<void> {
        try {
            const connection = await this.db.getConnection();
            try {
                await connection.query(
                    `INSERT INTO pending_transfers 
                    (subscription_id, amount, currency, account_holder, account_number, bank_name, reference, subscriber_user_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        transferData.subscriptionId,
                        transferData.amount,
                        transferData.currency,
                        transferData.accountDetails.accountHolder,
                        transferData.accountDetails.accountNumber,
                        transferData.accountDetails.bankName,
                        transferData.accountDetails.reference,
                        transferData.subscriber.userId,
                    ]
                );
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error logging pending transfer:', error);
            // Don't throw - this is non-critical logging
        }
    }

    /**
     * Verify payment status
     */
    async verifyPaymentStatus(transactionId: string, gateway: string): Promise<boolean> {
        try {
            const connection = await this.db.getConnection();
            try {
                const [rows] = await connection.query(
                    `SELECT status FROM payment_transactions 
                    WHERE gateway_transaction_id = ? AND gateway = ?`,
                    [transactionId, gateway]
                );

                return (rows as any[]).length > 0 && (rows as any[])[0].status === 'COMPLETED';
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error verifying payment status:', error);
            return false;
        }
    }

    /**
     * Refund payment
     */
    async refundPayment(transactionId: string, gateway: string, amount: number): Promise<boolean> {
        try {
            if (gateway === 'STRIPE') {
                const refund = await this.stripe.refunds.create({
                    payment_intent: transactionId,
                    amount: Math.round(amount * 100),
                });

                return refund.status === 'succeeded';
            }

            // Implement Eway and POLi refunds as needed
            console.warn(`Refund not implemented for gateway: ${gateway}`);
            return false;
        } catch (error) {
            console.error('Refund error:', error);
            return false;
        }
    }
}
