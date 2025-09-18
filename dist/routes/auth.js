"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const uuid_1 = require("uuid");
const router = express_1.default.Router();
// Login route
router.post('/login', async (req, res) => {
    try {
        const { walletAddress, signature, role } = req.body;
        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address is required' });
        }
        // Find user by wallet address
        let users = await (0, database_1.query)('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
        let user;
        if (users.length === 0) {
            // Create new user if doesn't exist
            const userId = (0, uuid_1.v4)();
            const defaultRole = role || 'user';
            await (0, database_1.query)('INSERT INTO users (id, wallet_address, role, permissions, is_active) VALUES (?, ?, ?, ?, ?)', [userId, walletAddress, defaultRole, JSON.stringify([]), true]);
            users = await (0, database_1.query)('SELECT * FROM users WHERE id = ?', [userId]);
            user = users[0];
        }
        else {
            user = users[0];
        }
        // Check if user is active
        if (user.is_active === false) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        // Update last login
        await (0, database_1.query)('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            userId: user.id,
            address: user.wallet_address,
            email: user.email,
            name: user.username,
            avatar: user.avatar_url,
            provider: 'wallet',
            socialProvider: null,
            isKYCVerified: user.kyc_status === 'approved',
            isWhitelisted: user.is_whitelisted || false,
            smartAccountAddress: user.smart_account_address,
            role: user.role || 'user',
            permissions: user.permissions ? JSON.parse(user.permissions) : [],
            department: user.department,
            isActive: user.is_active !== false,
            lastLogin: new Date().toISOString(),
        }, jwtSecret, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                address: user.wallet_address,
                email: user.email,
                name: user.username,
                role: user.role || 'user',
                redirectUrl: getRoleBasedRedirectUrl(user.role || 'user')
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});
// Helper function to get role-based redirect URL
function getRoleBasedRedirectUrl(role) {
    switch (role) {
        case 'super-admin':
            return '/super-admin';
        case 'admin':
            return '/admin';
        case 'account_manager':
            return '/account-manager';
        case 'property_lawyer':
            return '/property-lawyer';
        case 'auditor':
            return '/auditor';
        case 'compliance_officer':
            return '/compliance';
        case 'front_office':
            return '/front-office';
        default:
            return '/user';
    }
}
// Register route
router.post('/register', async (req, res) => {
    try {
        const { walletAddress, email, username } = req.body;
        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address is required' });
        }
        // Check if user already exists
        const existingUsers = await (0, database_1.query)('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'User already exists' });
        }
        // Create new user
        const userId = (0, uuid_1.v4)();
        await (0, database_1.query)('INSERT INTO users (id, wallet_address, email, username, role, permissions, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, walletAddress, email, username, 'user', JSON.stringify([]), true]);
        res.status(201).json({ message: 'User registered successfully' });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});
// Session route
router.get('/session', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const users = await (0, database_1.query)('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = users[0];
        res.json({
            id: user.id,
            address: user.wallet_address,
            email: user.email,
            name: user.username,
            avatar: user.avatar_url,
            provider: 'wallet',
            socialProvider: null,
            isKYCVerified: user.kyc_status === 'approved',
            isWhitelisted: user.is_whitelisted || false,
            smartAccountAddress: user.smart_account_address,
            role: user.role || 'user',
            permissions: user.permissions ? JSON.parse(user.permissions) : [],
            department: user.department,
            isActive: user.is_active !== false,
            lastLogin: user.last_login,
            redirectUrl: getRoleBasedRedirectUrl(user.role || 'user')
        });
    }
    catch (error) {
        console.error('Session error:', error);
        res.status(500).json({ error: 'Failed to get session' });
    }
});
// Logout route
router.post('/logout', (req, res) => {
    // In a stateless JWT system, logout is handled client-side
    res.json({ message: 'Logged out successfully' });
});
// Google OAuth routes
router.get('/google', (req, res) => {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/auth/google/callback`;
    if (!googleClientId) {
        return res.status(500).json({ error: 'Google OAuth not configured' });
    }
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        new URLSearchParams({
            client_id: googleClientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            access_type: 'offline',
            prompt: 'consent'
        }).toString();
    res.json({ authUrl });
});
router.post('/google/callback', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code required' });
        }
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/auth/google/callback`;
        if (!googleClientId || !googleClientSecret) {
            return res.status(500).json({ error: 'Google OAuth not configured' });
        }
        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: googleClientId,
                client_secret: googleClientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            }).toString(),
        });
        const tokens = await tokenResponse.json();
        if (!tokenResponse.ok) {
            return res.status(400).json({ error: 'Failed to exchange code for tokens' });
        }
        // Get user info from Google
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        });
        const googleUser = await userResponse.json();
        if (!userResponse.ok) {
            return res.status(400).json({ error: 'Failed to get user info from Google' });
        }
        // Find or create user
        let users = await (0, database_1.query)('SELECT * FROM users WHERE social_logins LIKE ?', [`%${googleUser.id}%`]);
        let user;
        if (users.length === 0) {
            // Create new user
            const userId = (0, uuid_1.v4)();
            const socialLogins = JSON.stringify({
                google: {
                    id: googleUser.id,
                    email: googleUser.email,
                    name: googleUser.name,
                    picture: googleUser.picture,
                }
            });
            await (0, database_1.query)('INSERT INTO users (id, email, username, avatar_url, social_logins, role, permissions, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [userId, googleUser.email, googleUser.name, googleUser.picture, socialLogins, 'user', JSON.stringify([]), true]);
            users = await (0, database_1.query)('SELECT * FROM users WHERE id = ?', [userId]);
            user = users[0];
        }
        else {
            user = users[0];
        }
        // Update last login
        await (0, database_1.query)('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            userId: user.id,
            address: user.wallet_address || '',
            email: user.email,
            name: user.username,
            avatar: user.avatar_url,
            provider: 'google',
            socialProvider: 'google',
            isKYCVerified: user.kyc_status === 'approved',
            isWhitelisted: user.is_whitelisted || false,
            smartAccountAddress: user.smart_account_address,
            role: user.role || 'user',
            permissions: user.permissions ? JSON.parse(user.permissions) : [],
            department: user.department,
            isActive: user.is_active !== false,
            lastLogin: new Date().toISOString(),
        }, jwtSecret, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                address: user.wallet_address || '',
                email: user.email,
                name: user.username,
                avatar: user.avatar_url,
                role: user.role || 'user'
            }
        });
    }
    catch (error) {
        console.error('Google OAuth callback error:', error);
        res.status(500).json({ error: 'Google OAuth failed' });
    }
});
// Smart account routes
router.post('/smart-account', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { smartAccountAddress } = req.body;
        if (!smartAccountAddress) {
            return res.status(400).json({ error: 'Smart account address is required' });
        }
        await (0, database_1.query)('UPDATE users SET smart_account_address = ? WHERE id = ?', [smartAccountAddress, req.user.id]);
        res.json({ message: 'Smart account address updated successfully' });
    }
    catch (error) {
        console.error('Smart account error:', error);
        res.status(500).json({ error: 'Failed to update smart account' });
    }
});
// Wallet connection route
router.post('/wallet', async (req, res) => {
    try {
        const { walletAddress, signature } = req.body;
        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address is required' });
        }
        // Find or create user
        let users = await (0, database_1.query)('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
        let user;
        if (users.length === 0) {
            // Create new user
            const userId = (0, uuid_1.v4)();
            await (0, database_1.query)('INSERT INTO users (id, wallet_address, role, permissions, is_active) VALUES (?, ?, ?, ?, ?)', [userId, walletAddress, 'user', JSON.stringify([]), true]);
            users = await (0, database_1.query)('SELECT * FROM users WHERE id = ?', [userId]);
            user = users[0];
        }
        else {
            user = users[0];
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            userId: user.id,
            address: user.wallet_address,
            email: user.email,
            name: user.username,
            avatar: user.avatar_url,
            provider: 'wallet',
            socialProvider: null,
            isKYCVerified: user.kyc_status === 'approved',
            isWhitelisted: user.is_whitelisted || false,
            smartAccountAddress: user.smart_account_address,
            role: user.role || 'user',
            permissions: user.permissions ? JSON.parse(user.permissions) : [],
            department: user.department,
            isActive: user.is_active !== false,
            lastLogin: new Date().toISOString(),
        }, jwtSecret, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                address: user.wallet_address,
                email: user.email,
                name: user.username,
                role: user.role || 'user'
            }
        });
    }
    catch (error) {
        console.error('Wallet connection error:', error);
        res.status(500).json({ error: 'Wallet connection failed' });
    }
});
// Super admin route
router.post('/superadmin', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }
        // Simple password check (in production, use proper authentication)
        if (password !== process.env.SUPER_ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        const token = jsonwebtoken_1.default.sign({
            id: 'super-admin',
            userId: 'super-admin',
            address: '0x0000000000000000000000000000000000000000',
            email: 'admin@platform.com',
            name: 'Super Admin',
            role: 'super-admin',
            permissions: ['all'],
            isActive: true,
        }, jwtSecret, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: 'super-admin',
                address: '0x0000000000000000000000000000000000000000',
                email: 'admin@platform.com',
                name: 'Super Admin',
                role: 'super-admin'
            }
        });
    }
    catch (error) {
        console.error('Super admin login error:', error);
        res.status(500).json({ error: 'Super admin login failed' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map