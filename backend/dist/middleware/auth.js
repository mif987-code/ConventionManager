"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyAuth = apiKeyAuth;
exports.adminOnly = adminOnly;
exports.errorHandler = errorHandler;
// API Key authentication middleware
function apiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const validKey = process.env.API_KEY;
    if (!validKey) {
        console.warn('[Auth] API_KEY not configured in environment');
        return res.status(500).json({ error: 'Server authentication not configured' });
    }
    if (!apiKey || apiKey !== validKey) {
        return res.status(403).json({ error: 'Unauthorized: Invalid API key' });
    }
    next();
}
// Admin-only middleware (checks x-admin-id header against DB)
// For simplicity, this checks a header. In production, use JWT tokens.
function adminOnly(req, res, next) {
    const isAdmin = req.isAdmin;
    if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}
// Error handling middleware
function errorHandler(err, req, res, _next) {
    console.error('[Error]', err.message);
    res.status(400).json({
        error: err.message || 'An unexpected error occurred',
    });
}
//# sourceMappingURL=auth.js.map