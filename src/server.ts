import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './utils/database';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import marketplaceRoutes from './routes/marketplace';
import propertyRoutes from './routes/properties';
import paymentRoutes from './routes/payments';
import escrowRoutes from './routes/escrow';
import kycRoutes from './routes/kyc';
import { notifications, metadata, vouchers, blockchain, analytics, billing, investments } from './routes/index';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/notifications', notifications);
app.use('/api/metadata', metadata);
app.use('/api/vouchers', vouchers);
app.use('/api/blockchain', blockchain);
app.use('/api/analytics', analytics);
app.use('/api/billing', billing);
app.use('/api/investments', investments);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Connect to database and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch((error) => {
  console.error('Failed to connect to database:', error);
  process.exit(1);
});

export default app;