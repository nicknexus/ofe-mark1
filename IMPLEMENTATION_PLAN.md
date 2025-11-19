# AI-Powered Initiative Report Generator - Implementation Plan

## Architecture Overview

The report generator will be integrated into the Initiative view as a new sidebar tab called "AI Report". The workflow follows these steps:

1. User selects filters (date range, KPIs/metrics, locations, beneficiary groups)
2. App shows preview: totals, matching stories, locations, and map
3. User selects one story to anchor the narrative
4. Frontend sends filtered data to backend
5. Backend calls GPT-4o-mini with structured prompt
6. Backend returns generated report text
7. Frontend injects report into PDF template
8. User downloads final PDF

## Database Structure Analysis

### Current Schema Mapping:
- **Metrics** = `kpi_updates` table (actual metric values/data points)
- **KPIs** = `kpis` table (metric definitions)
- **Locations** = `locations` table
- **Beneficiary Groups** = `beneficiary_groups` table (linked to locations)
- **Stories** = `stories` table (linked to locations)

### Relationships:
- `kpi_updates` → `kpis` (via kpi_id)
- `kpi_updates` → `locations` (via location_id, optional)
- `beneficiary_groups` → `locations` (via location_id)
- `stories` → `locations` (via location_id)

## Step-by-Step Implementation

### Step 1: Create SQL Views in Supabase

**File**: `database/migrations/add_report_views.sql`

Create two helper views to simplify backend queries:

1. **`metrics_with_context`** - Joins kpi_updates with kpis, locations, and beneficiary_groups
   - Maps to: kpi_updates + kpis + locations + beneficiary_groups (via location)
   - Fields: id, kpi_id, kpi_title, kpi_description, value, unit_of_measurement, date_represented, location_id, location_name, beneficiary_group_id, beneficiary_group_name, initiative_id

2. **`stories_with_context`** - Joins stories with locations
   - Maps to: stories + locations
   - Fields: id, title, description, date_represented, location_id, location_name, initiative_id

**Note**: Since beneficiary_groups link to locations (not directly to kpi_updates), we'll need to join through locations in the view.

### Step 2: Create Backend API Routes

**Files**: 
- `backend/src/routes/reports.ts` (new file)
- `backend/src/index.ts` (add route import)

#### Route 1: `/api/report-data` (POST)
**Purpose**: Aggregate filtered data for preview

**Request Body**:
```typescript
{
  initiativeId: string
  dateStart?: string  // ISO date string
  dateEnd?: string    // ISO date string
  kpiIds?: string[]   // Filter by specific KPIs
  locationIds?: string[]
  beneficiaryGroupIds?: string[]
}
```

**Response**:
```typescript
{
  metrics: Array<{
    id: string
    kpi_id: string
    kpi_title: string
    kpi_description: string
    value: number
    unit_of_measurement: string
    date_represented: string
    location_id?: string
    location_name?: string
  }>
  totals: Array<{
    kpi_id: string
    kpi_title: string
    kpi_description: string
    unit_of_measurement: string
    total_value: number
    count: number
  }>
  locations: Array<{
    id: string
    name: string
    description?: string
    latitude: number
    longitude: number
  }>
  stories: Array<{
    id: string
    title: string
    description?: string
    date_represented: string
    location_id?: string
    location_name?: string
  }>
  mapPoints: Array<{
    lat: number
    lng: number
    name: string
    type: 'location' | 'story'
  }>
}
```

**Implementation Logic**:
1. Validate filters and initiativeId
2. Query `metrics_with_context` view with filters
3. Filter by date range (date_represented)
4. Filter by kpiIds, locationIds
5. Filter by beneficiaryGroupIds (via location_id)
6. Sum totals grouped by KPI
7. Query `stories_with_context` with same filters
8. Get distinct locations from filtered metrics
9. Build map points array from locations and stories
10. Return aggregated bundle

#### Route 2: `/api/generate-report` (POST)
**Purpose**: Generate AI report using OpenAI

**Request Body**:
```typescript
{
  initiativeId: string
  initiativeTitle: string
  dateRange: {
    start: string
    end: string
  }
  totals: Array<{
    kpi_id: string
    kpi_title: string
    kpi_description: string
    unit_of_measurement: string
    total_value: number
  }>
  rawMetrics: Array<{
    kpi_title: string
    value: number
    unit_of_measurement: string
    date_represented: string
    location_name?: string
  }>
  selectedStory: {
    id: string
    title: string
    description?: string
    date_represented: string
    location_name?: string
  }
  locations: Array<{
    id: string
    name: string
    description?: string
  }>
  beneficiaryGroups: Array<{
    id: string
    name: string
    description?: string
  }>
  deepLink?: string  // Optional URL to recreate filters
}
```

**Response**:
```typescript
{
  reportText: string
}
```

**Implementation Logic**:
1. Build structured prompt for GPT-4o-mini
2. System prompt: Expert humanitarian report writer
3. User prompt: Include all data sections (overview, story, metrics, locations, beneficiaries, map description, footer)
4. Call OpenAI API (use `OPENAI_API_KEY` env var)
5. Return generated text

**OpenAI Integration**:
- Install: `npm install openai` in backend
- Use model: `gpt-4o-mini`
- Temperature: 0.7 (creative but factual)
- Max tokens: 2000

### Step 3: Build Frontend Page Structure

**File**: `frontend/src/components/InitiativeTabs/ReportTab.tsx` (new)

**Layout Sections**:
1. **Filters Panel** (top)
   - Date Range Picker (reuse DateRangePicker component)
   - KPI Multi-Select (dropdown with checkboxes)
   - Location Multi-Select
   - Beneficiary Group Multi-Select
   - "Apply Filters" button

2. **Results Preview Panel** (middle, shown after filters applied)
   - Totals section (cards showing summed metrics)
   - Stories list (clickable cards)
   - Locations list
   - Map preview (using react-leaflet, similar to LocationTab)

3. **Story Selection Panel** (shown after results)
   - Radio buttons or cards for story selection
   - "Generate Report" button (disabled until story selected)

4. **Preview Panel** (shown after generation)
   - Display AI-generated report text
   - "Download PDF" button

### Step 4: Implement Filters

**Components Needed**:
- DateRangePicker (already exists, reuse)
- MultiSelectDropdown component (create new or reuse pattern from StoriesTab)

**State Management**:
```typescript
const [filters, setFilters] = useState({
  dateStart: '',
  dateEnd: '',
  kpiIds: [],
  locationIds: [],
  beneficiaryGroupIds: []
})
const [reportData, setReportData] = useState(null)
const [selectedStory, setSelectedStory] = useState(null)
const [reportText, setReportText] = useState(null)
```

**Data Fetching**:
- Load KPIs: `apiService.getKPIs(initiativeId)`
- Load Locations: `apiService.getLocations(initiativeId)`
- Load Beneficiary Groups: `apiService.getBeneficiaryGroups(initiativeId)`

### Step 5: Add API Service Methods

**File**: `frontend/src/services/api.ts`

Add two new methods:

```typescript
async getReportData(filters: {
  initiativeId: string
  dateStart?: string
  dateEnd?: string
  kpiIds?: string[]
  locationIds?: string[]
  beneficiaryGroupIds?: string[]
}): Promise<ReportData>

async generateReport(data: {
  initiativeId: string
  initiativeTitle: string
  dateRange: { start: string, end: string }
  totals: any[]
  rawMetrics: any[]
  selectedStory: any
  locations: any[]
  beneficiaryGroups: any[]
  deepLink?: string
}): Promise<{ reportText: string }>
```

### Step 6: Add Results Preview

**Components**:
- Totals cards (similar to MetricsDashboard)
- Story cards (reuse StoryCard component)
- Location list (simple list with map pins)
- Map component (reuse from LocationTab or create simple version)

### Step 7: Add Story Selection

**UI**: Radio buttons or clickable cards
**State**: `selectedStory` state variable
**Validation**: Disable "Generate Report" until story selected

### Step 8: Add Generate Report API Call

**Flow**:
1. User clicks "Generate Report"
2. Show loading state
3. Call `apiService.generateReport()` with all data
4. Store `reportText` in state
5. Show preview panel

**Error Handling**: Show toast notifications for errors

### Step 9: Add PDF Builder

**Library**: Install `jspdf` and `jspdf-autotable` (optional, for tables)

**File**: `frontend/src/utils/pdfGenerator.ts` (new)

**Function**: `generatePDF(reportText, initiativeTitle, dateRange, ...)`

**PDF Structure**:
1. Header: Initiative name, date range
2. Overview section (from reportText)
3. Story section
4. Metrics table
5. Totals summary
6. Locations list
7. Map image (optional: static map or screenshot)
8. Footer: "Nexus Impacts | Know Your Mark On The World"

**Implementation**:
- Use jsPDF to create PDF
- Split reportText into sections
- Add tables for metrics
- Add formatted text sections
- Export as blob
- Trigger download

### Step 10: Add Sidebar Tab

**File**: `frontend/src/components/InitiativeSidebar.tsx`

Add new tab:
```typescript
{
  id: 'report',
  label: 'AI Report',
  icon: FileText,  // or Sparkles for AI
  description: 'Generate Impact Report'
}
```

**File**: `frontend/src/pages/InitiativePage.tsx`

Add case in `renderActiveTab()`:
```typescript
case 'report':
  return <ReportTab initiativeId={id!} dashboard={dashboard} />
```

### Step 11: Polish UI and Error States

**Add**:
- Loading states for all async operations
- Error messages with retry options
- Empty states (no data, no stories, etc.)
- Validation messages
- Success toasts

## Environment Variables

**Backend `.env`**:
```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
```

**Frontend `.env`**:
```
VITE_API_URL=http://localhost:3001
```

## Dependencies to Install

**Backend**:
```bash
cd backend
npm install openai
```

**Frontend**:
```bash
cd frontend
npm install jspdf
npm install --save-dev @types/jspdf
```

## File Structure

```
backend/
  src/
    routes/
      reports.ts          # NEW
    services/
      reportService.ts    # NEW (optional, for business logic)
    types/
      index.ts            # Add ReportData, GenerateReportRequest types

frontend/
  src/
    components/
      InitiativeTabs/
        ReportTab.tsx     # NEW
    services/
      api.ts              # Add report methods
    utils/
      pdfGenerator.ts     # NEW
    types/
      index.ts            # Add report-related types
```

## Testing Checklist

- [ ] SQL views return correct data
- [ ] `/api/report-data` filters correctly
- [ ] `/api/generate-report` calls OpenAI successfully
- [ ] Frontend filters work
- [ ] Story selection works
- [ ] PDF generation works
- [ ] Error handling works
- [ ] Loading states work
- [ ] Deep link generation works (optional)

## Future Enhancements

- Saved report templates
- Report version history
- Auto-attach images to reports
- Configurable report length (short/medium/long)
- Multi-story reports
- Custom branding in PDFs
- Email report functionality

