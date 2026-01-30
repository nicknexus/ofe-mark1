import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Import routes
import initiativeRoutes from './routes/initiatives';
import kpiRoutes from './routes/kpis';
import evidenceRoutes from './routes/evidence';
import beneficiaryRoutes from './routes/beneficiaries';
import locationRoutes from './routes/locations';
import storyRoutes from './routes/stories';
import uploadRoutes from './routes/upload';
import organizationRoutes from './routes/organizations';
import authRoutes from './routes/auth';
import reportRoutes from './routes/reports';
import donorRoutes from './routes/donors';
import donorCreditRoutes from './routes/donorCredits';
import storageRoutes from './routes/storage';
import subscriptionRoutes from './routes/subscription';
import teamRoutes from './routes/team';
import publicRoutes from './routes/public';
import { processStorageCleanupQueue } from './services/storageCleanupService';
import { authenticateUser, AuthenticatedRequest } from './middleware/auth';

// Load environment variables
dotenv.config();

const app = express();

// CORS - must be before other middleware
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://app.nexusimpacts.com',
    'https://nexusimpacts.com',
    'https://nexusimpacts.ai',
    'https://www.nexusimpacts.ai'
];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'production')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (process.env.NODE_ENV === 'production') {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, X-Organization-Id, Cache-Control, Pragma');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        console.log('[CORS] Preflight request for:', req.path);
        res.status(200).end();
        return;
    }
    next();
});

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // Allow serving uploaded files
}));

// Also use cors middleware as backup
app.use(cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Organization-Id', 'Cache-Control', 'Pragma']
}));

// Rate limiting - disabled in development to avoid hitting limits during hot reloading
if (process.env.NODE_ENV === 'production') {
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    });
    app.use(limiter);
}

// Body parsing middleware
app.use(compression());

// Stripe webhook needs raw body - must come BEFORE json parsing
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }));

// JSON parsing for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory (disabled for serverless)
// app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Request logging for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
    next();
});

// Environment check endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'OFE API is running!',
        status: 'OK',
        available_endpoints: ['/test', '/health', '/api/initiatives', '/api/kpis', '/api/evidence', '/api/locations', '/api/storage'],
        timestamp: new Date().toISOString()
    });
});

app.get('/test', (req, res) => {
    res.json({ message: 'Hello from serverless!' });
});

app.get('/health', (req, res) => {
    // Simplified health check for serverless
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        supabase: {
            url: !!process.env.SUPABASE_URL,
            anon_key: !!process.env.SUPABASE_ANON_KEY,
            service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        },
        stripe: {
            configured: !!process.env.STRIPE_SECRET_KEY,
            webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET
        }
    });
});

// Storage cleanup endpoint (can be called by cron job)
app.post('/api/admin/cleanup-storage', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        // TODO: Add admin check here if needed
        const result = await processStorageCleanupQueue();
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Storage cleanup error:', error);
        res.status(500).json({
            error: 'Storage cleanup failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Routes - Enable one by one to find the problem
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes); // Public routes (no auth required)
app.use('/api/organizations', organizationRoutes);
app.use('/api/initiatives', initiativeRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/upload', uploadRoutes); // Now using Supabase Storage
app.use('/api/reports', reportRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/donor-credits', donorCreditRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/team', teamRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Debug: catch all routes
app.use('*', (req, res) => {
    res.json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        available_routes: ['/test', '/health', '/api/organizations', '/api/initiatives', '/api/kpis', '/api/evidence', '/api/locations']
    });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log('🚀 OFE Backend server running on port', PORT);
        console.log('📊 Health check: http://localhost:' + PORT + '/health');
    });
}

// Export for Vercel serverless
export default app; 
