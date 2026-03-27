import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { doubleCsrf } from 'csrf-csrf';
import authRoutes from './routes/auth.routes';
import monitorRoutes from './routes/monitor.routes';
import incidentRoutes from './routes/incident.routes';
import { errorHandler } from './middleware/error.middleware';
import { rateLimit } from 'express-rate-limit'; // Changed to named import
import { ZodError } from 'zod'; // Added
import { prisma } from './utils/prisma.js';
import { successResponse, errorResponse } from './utils/apiResponse.js'; // Added

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Phase 2: Security Hardening (OWASP Headers)
app.use(helmet());

// Phase 2: Cookie-based Sessions
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET));

// Phase 2: Payload Hardening (Prevent large body DOS)
app.use(express.json({ limit: '10kb' }));

// Phase 5: CORS Hardening (Expanded for dev)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174'];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl) 
    // or if the origin is in our allowed list
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token']
}));

// Phase 5: Auth Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per window for auth actions
  message: { error: 'Too many auth attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Phase 2: CSRF Protection (double-submit signed cookie)
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.JWT_SECRET!,
  getSessionIdentifier: (req) => req.ip ?? '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
});

// Public endpoint: frontend fetches this before any mutation
app.get('/api/csrf-token', (req, res) => {
  const token = generateCsrfToken(req, res);
  res.json({ token });
});

// Apply CSRF protection to all mutating API routes
app.use('/api', doubleCsrfProtection);

app.use('/api/auth', authRoutes);
app.use('/api/monitors', monitorRoutes);
app.use('/api/incidents', incidentRoutes);

// Phase 5: Public Status API
app.get('/api/public/status', async (req, res) => {
  try {
    const monitors: any[] = await prisma.$queryRaw`
      SELECT id, name, url, status, "lastCheckedAt" FROM "Monitor"
    `;
    const formatted = monitors.map(m => ({
      id: m.id,
      name: m.name || m.url,
      url: m.url,
      status: m.status,
      lastCheckedAt: m.lastCheckedAt
    }));
    successResponse(res, formatted, 200);
  } catch (error) {
    errorResponse(res, 'Failed to fetch status', 500);
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.send('API Monitoring SaaS Backend is running.');
});

// Serve frontend static files in production
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));

// Fallback all unknown routes to the React index.html for CSR
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Error handling middleware
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
