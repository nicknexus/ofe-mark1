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
import uploadRoutes from './routes/upload';

// Load environment variables
dotenv.config();

const app = express();

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // Allow serving uploaded files
}));
const devOrigins = ['http://localhost:3000', 'http://localhost:5173']
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? true // Allow all origins for now (adjust in production as needed)
        : devOrigins,
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory (disabled for serverless)
// app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Environment check endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'OFE API is running!',
        status: 'OK',
        available_endpoints: ['/test', '/health', '/api/initiatives', '/api/kpis', '/api/evidence'],
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
        }
    });
});

// Routes - Enable one by one to find the problem
app.use('/api/initiatives', initiativeRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);
// app.use('/api/upload', uploadRoutes); // Disabled: multer + local filesystem doesn't work in serverless

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
        available_routes: ['/test', '/health', '/api/initiatives', '/api/kpis', '/api/evidence']
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