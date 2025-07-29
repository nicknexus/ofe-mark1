# OFE (Opportunity of Evidence Tool) - Complete Setup Guide

## Overview
A comprehensive charity impact tracking system with React frontend, Express backend, and Supabase database.

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (free tier available)

## 🏗️ Architecture
- **Frontend**: React 18 + TypeScript + Tailwind CSS (Port 3000)
- **Backend**: Express.js + TypeScript (Port 3001)
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth

---

## 🚀 Complete Setup Instructions

### 1. Supabase Setup

1. **Create Supabase Project**:
   - Go to [https://supabase.com](https://supabase.com)
   - Create a new project
   - Wait for database initialization (2-3 minutes)

2. **Get Environment Variables**:
   - Go to Project Settings > API
   - Copy `Project URL` and `anon/public key`

3. **Set up Database Schema**:
   - Go to SQL Editor in Supabase Dashboard
   - Copy and run the entire contents of `database/schema.sql`
   - This creates all tables, indexes, RLS policies, and triggers

### 2. Environment Configuration

1. **Root Environment**:
```bash
cp .env.example .env
```
Edit `.env` with your Supabase credentials:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key  
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3001
NODE_ENV=development
```

2. **Frontend Environment**:
```bash
cd frontend
cp .env.example .env
```
Edit `frontend/.env`:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3001
```

### 3. Install Dependencies

From the root directory:
```bash
npm run install:all
```

Or manually:
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run the Application

**Option 1 - Both servers concurrently (recommended):**
```bash
npm run dev
```

**Option 2 - Separate terminals:**
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend  
npm run dev:frontend
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

---

## 🎯 First Steps After Setup

### 1. Create Account
- Open http://localhost:3000
- Click "Sign Up" 
- Enter your details
- Check email for verification link

### 2. Create Your First Initiative
- Click "New Initiative"
- Fill in title and description
- Optionally add region/location

### 3. Add KPIs
- Navigate to your initiative
- Click "Add KPI"
- Set up metrics with categories (Input/Output/Impact)

### 4. Track Progress
- Add data updates to KPIs
- Upload evidence (photos, documents, testimonials)
- View dashboard analytics

---

## 🛠️ Development Workflow

### Backend Development
```bash
cd backend
npm run dev    # Start with nodemon
npm run build  # Compile TypeScript
npm start      # Run production build
```

### Frontend Development
```bash
cd frontend
npm run dev     # Start Vite dev server
npm run build   # Build for production
npm run preview # Preview production build
```

### Database Changes
1. Update `database/schema.sql`
2. Run SQL in Supabase SQL Editor
3. Update TypeScript types in both frontend and backend

---

## 📊 Key Features Implemented

### ✅ Core System
- [x] User authentication (Supabase Auth)
- [x] Initiative management
- [x] KPI tracking with categories
- [x] Evidence linking to KPIs
- [x] Real-time dashboard analytics
- [x] Row-level security (RLS)
- [x] Audit trails for transparency

### ✅ Dashboard Features
- [x] Initiative overview cards
- [x] KPI progress tracking
- [x] Evidence coverage percentages
- [x] Color-coded proof indicators
- [x] Evidence type breakdown
- [x] Responsive design

### ✅ Data Management
- [x] CRUD operations for all entities
- [x] Date-based evidence matching
- [x] Coordinate support for locations
- [x] File upload capabilities (structure ready)
- [x] Search and filtering (backend ready)

---

## 🔒 Security Features

- Row Level Security (RLS) on all tables
- JWT-based authentication
- API request rate limiting
- Input validation and sanitization
- CORS protection
- Environment variable security

---

## 📁 Project Structure

```
ofe-mark1/
├── backend/
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Auth, validation
│   │   ├── types/           # TypeScript definitions
│   │   └── utils/           # Helpers
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Main pages
│   │   ├── services/        # API calls
│   │   ├── types/           # TypeScript definitions
│   │   └── utils/           # Helper functions
│   ├── package.json
│   └── tailwind.config.js
├── database/
│   └── schema.sql           # Complete database schema
├── package.json             # Root workspace config
└── README.md
```

---

## 🎨 Design System

### Colors
- **Primary Green**: #22c55e (main brand color)
- **Evidence Status**: 
  - 🟢 80-100% proven (green)
  - 🟡 30-79% proven (yellow)  
  - 🔴 0-29% proven (red)

### Icons
- 🎯 Initiatives
- 📊 KPIs  
- 📄 Evidence/Documentation
- 📷 Visual Proof
- 🗣️ Testimonials
- 💰 Financials

---

## 🔧 Troubleshooting

### Common Issues

1. **"Missing Supabase environment variables"**
   - Check `.env` files are created and populated
   - Verify environment variable names match exactly

2. **"Failed to connect to database"**
   - Confirm Supabase project is active
   - Check if RLS policies are enabled
   - Verify service role key has proper permissions

3. **"Network error" on API calls**
   - Ensure backend is running on port 3001
   - Check CORS configuration
   - Verify API URL in frontend environment

4. **Build errors**
   - Clear node_modules and reinstall
   - Check TypeScript version compatibility
   - Verify all imports are correct

### Reset Instructions

**Reset Database**:
```sql
-- Run in Supabase SQL Editor
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS evidence_kpis CASCADE;
DROP TABLE IF EXISTS evidence CASCADE;
DROP TABLE IF EXISTS kpi_updates CASCADE;
DROP TABLE IF EXISTS kpis CASCADE;
DROP TABLE IF EXISTS umbrella_kpis CASCADE;
DROP TABLE IF EXISTS initiatives CASCADE;
```
Then re-run `database/schema.sql`

**Reset Local Environment**:
```bash
rm -rf node_modules backend/node_modules frontend/node_modules
npm run install:all
```

---

## 🚢 Production Deployment

### Frontend (Vercel/Netlify)
```bash
cd frontend
npm run build
# Deploy dist/ folder
```

### Backend (Railway/Heroku)
```bash
cd backend  
npm run build
# Deploy with start script: "node dist/index.js"
```

### Environment Variables for Production
- Set all environment variables in deployment platform
- Update CORS origins for production domain
- Use production Supabase URLs

---

## 💡 Next Steps & Enhancements

### Immediate Additions
- [ ] File upload for evidence (images/PDFs)
- [ ] Data visualization charts (recharts integration)
- [ ] Export functionality (CSV/PDF reports)
- [ ] Bulk KPI operations
- [ ] Search and filtering UI

### Advanced Features
- [ ] Collaborative editing (multiple users per org)
- [ ] Impact prediction models
- [ ] Integration with external APIs
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard

---

## 📝 License & Support

This is a private project for charity impact tracking. 

For support:
1. Check this setup guide
2. Review error logs in browser/terminal
3. Verify Supabase configuration
4. Ensure all dependencies are installed

**Happy Impact Tracking! 🎯** 