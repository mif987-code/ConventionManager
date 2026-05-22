"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db");
const auth_1 = require("./middleware/auth");
const backupService_1 = require("./services/backupService");
const users_1 = __importDefault(require("./routes/users"));
const vouchers_1 = __importDefault(require("./routes/vouchers"));
const events_1 = __importDefault(require("./routes/events"));
const scan_1 = __importDefault(require("./routes/scan"));
const tix_1 = __importDefault(require("./routes/tix"));
const prizeTemplates_1 = __importDefault(require("./routes/prizeTemplates"));
const publicRegistration_1 = __importDefault(require("./routes/publicRegistration"));
const store_1 = __importDefault(require("./routes/store"));
const stats_1 = __importDefault(require("./routes/stats"));
const permissions_1 = __importDefault(require("./routes/permissions"));
const player_1 = __importDefault(require("./routes/player"));
const conventions_1 = __importDefault(require("./routes/conventions"));
const sets_1 = __importDefault(require("./routes/sets"));
const cards_1 = __importDefault(require("./routes/cards"));
const adminSettings_1 = __importDefault(require("./routes/adminSettings"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const specialVouchers_1 = __importDefault(require("./routes/specialVouchers"));
const packages_1 = __importDefault(require("./routes/packages"));
const payments_1 = __importDefault(require("./routes/payments"));
const floorPlan_1 = __importDefault(require("./routes/floorPlan"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000');
// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : [];
app.use((0, cors_1.default)({
    origin: allowedOrigins.length > 0
        ? allowedOrigins
        : (process.env.NODE_ENV === 'development' ? true : false),
    credentials: false,
}));
app.use(express_1.default.json({ limit: '1mb' }));
// Public routes (no API key required)
app.use('/public', publicRegistration_1.default);
app.use('/player', player_1.default);
app.use('/api/sets', sets_1.default); // Sets lookup (public, no auth needed)
app.use('/api/cards', cards_1.default); // Cards lookup (public, no auth needed)
// API Key auth on all /api routes
app.use('/api', auth_1.apiKeyAuth);
app.use('/api', auth_1.conventionMiddleware);
// Routes
app.use('/api/users', users_1.default);
app.use('/api/vouchers', vouchers_1.default);
app.use('/api/events', events_1.default);
app.use('/api/scan', scan_1.default);
app.use('/api/tix', tix_1.default);
app.use('/api/prize-templates', prizeTemplates_1.default);
app.use('/api/store', store_1.default);
app.use('/api/stats', stats_1.default);
app.use('/api/permissions', permissions_1.default);
app.use('/api/conventions', conventions_1.default);
app.use('/api/admin/settings', adminSettings_1.default);
app.use('/api/attendance', attendance_1.default);
app.use('/api/special-vouchers', specialVouchers_1.default);
app.use('/api/packages', packages_1.default);
app.use('/api/payments', payments_1.default);
app.use('/api/floor-plan', floorPlan_1.default);
// Serve registration site static files
app.use('/register', express_1.default.static(path_1.default.join(__dirname, '../../registration-site')));
// Serve NFC registration PWA
app.use('/nfc', express_1.default.static(path_1.default.join(__dirname, '../../nfc-app')));
// Serve Player Store PWA (staff-facing)
app.use('/store', express_1.default.static(path_1.default.join(__dirname, '../../store-app')));
// Serve Player App PWA (player-facing)
app.use('/app', express_1.default.static(path_1.default.join(__dirname, '../../player-app')));
// Redirect root to NFC admin app
app.get('/', (_req, res) => {
    res.redirect('/nfc/');
});
// Health check (no auth required)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Error handler
app.use(auth_1.errorHandler);
// Start server
async function start() {
    const dbConnected = await (0, db_1.testConnection)();
    if (!dbConnected) {
        console.error('[Server] Cannot start without database connection');
        process.exit(1);
    }
    (0, backupService_1.startBackupSchedule)();
    app.listen(PORT, () => {
        console.log(`[Server] Convention Manager API running on port ${PORT}`);
    });
}
start();
//# sourceMappingURL=server.js.map