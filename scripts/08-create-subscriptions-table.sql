CREATE TABLE subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    propertyId INT NOT NULL,
    walletAddress VARCHAR(255) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    transactionHash VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);