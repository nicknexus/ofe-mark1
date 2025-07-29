# Opportunity of Evidence Tool (OFE) - Mark 1

Expert-level system for charities to track, categorize, and showcase their impact through an intuitive interface and powerful visual dashboard.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone and install dependencies:
```bash
npm run install:all
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

3. Start development servers:
```bash
npm run dev
```

This starts both frontend (http://localhost:3000) and backend (http://localhost:3001) concurrently.

## 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Express.js + TypeScript  
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## 📋 Core Concepts

### Initiatives
Overarching projects or programs (e.g., "Youth Training - 2025")

### KPIs (Key Performance Indicators)
Specific metrics tracked over time with categories:
- **Input**: Resources going in
- **Output**: Direct results  
- **Impact**: Long-term effects

### Evidence
Files, images, or notes that validate what happened

## 🎨 Design System

- **Primary Colors**: Green and White theme
- **Framework**: Tailwind CSS with custom green palette
- **Icons**: Lucide React icons
- **Typography**: Clean, accessible fonts

## 🔧 Development

### Backend Structure
```
backend/
├── src/
│   ├── routes/          # API endpoints
│   ├── middleware/      # Auth, validation
│   ├── services/        # Business logic
│   ├── types/           # TypeScript definitions
│   └── utils/           # Helper functions
```

### Frontend Structure  
```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Main application pages
│   ├── hooks/           # Custom React hooks
│   ├── services/        # API calls
│   ├── types/           # TypeScript definitions
│   └── utils/           # Helper functions
```

## 📊 Database Schema

See `database/schema.sql` for complete Supabase schema including:
- initiatives
- kpis  
- kpi_updates
- evidence
- umbrella_kpis

## 🚢 Deployment

### Frontend
```bash
cd frontend && npm run build
```

### Backend
```bash
cd backend && npm run build && npm start
```

## 🔐 Environment Variables

Copy `.env.example` to `.env` and configure:
- Supabase URL and keys
- Port configuration
- Environment settings

## 📝 License

Private project for charity impact tracking. # Deploy trigger
