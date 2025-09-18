# NFT Marketplace Backend

A complete backend API for the NFT marketplace built with Node.js, Express, and TypeScript.

## Features

- User authentication and session management
- Property and NFT management
- Marketplace listings and bidding system
- Payment processing with escrow
- KYC verification
- Admin dashboard with analytics
- Real-time notifications
- Blockchain event handling

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MySQL
- **Authentication**: JWT
- **Security**: Helmet, CORS

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MySQL database
- npm or yarn

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Copy `.env` and update the values:
   ```bash
   cp .env .env.local
   ```

4. Set up the database:
   - Create a MySQL database named `nft_marketplace`
   - Run the SQL script to create tables:
     ```sql
     -- Run the contents of scripts/01-create-tables.sql
     ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/session` - Get user session
- `POST /api/auth/logout` - User logout

### Marketplace
- `GET /api/marketplace/listings` - Get all listings
- `POST /api/marketplace/listings` - Create listing
- `GET /api/marketplace/listings/:id` - Get listing by ID
- `PUT /api/marketplace/listings/:id` - Update listing
- `DELETE /api/marketplace/listings/:id` - Delete listing
- `GET /api/marketplace/bids` - Get bids
- `POST /api/marketplace/bids` - Place bid

### Properties
- `GET /api/properties` - Get all properties
- `POST /api/properties` - Create property
- `GET /api/properties/:id` - Get property by ID
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property

### Payments
- `GET /api/payments` - Get payments
- `POST /api/payments` - Create payment
- `GET /api/payments/:id` - Get payment by ID
- `POST /api/payments/process` - Process payment

### Admin (Requires admin role)
- `GET /api/admin/analytics` - Get analytics
- `GET /api/admin/distributions` - Get distributions
- `POST /api/admin/distributions/process` - Process distributions

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm start` - Start production server
- `npm test` - Run tests

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `DB_HOST` | Database host | localhost |
| `DB_USER` | Database user | root |
| `DB_PASSWORD` | Database password | (empty) |
| `DB_NAME` | Database name | nft_marketplace |
| `JWT_SECRET` | JWT secret key | (required) |

## Project Structure

```
backend/
├── src/
│   ├── middleware/
│   │   └── auth.ts
│   ├── routes/
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   ├── admin.ts
│   │   ├── marketplace.ts
│   │   ├── properties.ts
│   │   ├── payments.ts
│   │   ├── escrow.ts
│   │   ├── kyc.ts
│   │   └── ...
│   ├── utils/
│   │   └── database.ts
│   └── server.ts
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.