"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conventionMiddleware = conventionMiddleware;
exports.apiKeyAuth = apiKeyAuth;
exports.adminOnly = adminOnly;
exports.errorHandler = errorHandler;
// Attaches convention_id from the x-convention-id header to the request object.
function conventionMiddleware(req, res, next) {
    const raw = req.headers['x-convention-id'];
    if (raw) {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed)) {
            req.conventionId = parsed;
        }
    }
    next();
}
// Validates the x-api-key header against the API_KEY environment variable.
function apiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const validKey = process.env.API_KEY;
    if (!validKey) {
        res.status(500).json({ error: 'Server authentication not configured' });
        return;
    }
    if (!apiKey || apiKey !== validKey) {
        res.status(403).json({ error: 'Unauthorized: Invalid API key' });
        return;
    }
    next();
}
// Rejects requests from non-admin callers.
function adminOnly(req, res, next) {
    if (!req.isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
}
// Express error-handling middleware — must have 4 params.
function errorHandler(err, _req, res, _next) {
    console.error('[Error]', err.message);
    res.status(400).json({ error: err.message || 'An unexpected error occurred' });
}
//# sourceMappingURL=auth.js.map