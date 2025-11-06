# Leaflet Migration Plan

## Overview
Replace `react-simple-maps` (SVG-based TopoJSON maps) with `react-leaflet` (Leaflet.js) while preserving all existing functionality, integrations, and filters.

## Current Implementation Analysis

### Current Map Library
- **Library**: `react-simple-maps` v3.0.0
- **Dependencies**: `topojson-client` v3.1.0
- **Map Source**: TopoJSON world atlas (countries-110m.json)

### Components Using Maps
1. **`LocationMap.tsx`** - Main map component
2. **`LocationTab.tsx`** - Full page map view (2/3 width map + 1/3 sidebar)
3. **`MetricsDashboard.tsx`** - Embedded map with filters

### Current Features to Preserve

#### Core Map Features
- ✅ Click markers to show popup with location details
- ✅ Click map background to create new location
- ✅ Hover effects on markers (visual feedback)
- ✅ Selected location highlighting (different color/size)
- ✅ Zoom controls (custom +/- buttons)
- ✅ Pan and zoom functionality
- ✅ Empty state when no locations
- ✅ Responsive design (100% width/height)

#### Popup Features
- ✅ Location name and description
- ✅ Coordinates display
- ✅ Created date
- ✅ Impact Claims section (fetched via `apiService.getLocationKPIUpdates()`)
- ✅ Evidence section (fetched via `apiService.getLocationEvidence()`)
- ✅ Loading states for async data
- ✅ "See Details" button → opens `LocationDetailsModal`
- ✅ Popup positioning (above marker, clamped to viewport)
- ✅ Close popup on outside click

#### Filter Integration
- ✅ **Location Filters**: Filter locations shown on map based on `selectedLocations` array
- ✅ **Beneficiary Group Filters**: Filter locations based on `selectedBeneficiaryGroups` (via location_id relationships)
- ✅ **Date Filters**: Applied to impact claims/evidence (not map locations themselves)
- ✅ **Refresh Key**: `refreshKey` prop triggers data refresh when updates/evidence change

#### Data Integration
- ✅ Impact Claims linked to locations (`update.location_id`)
- ✅ Evidence linked to locations (`evidence.location_id`)
- ✅ Beneficiaries linked to updates (filtered via `updateBeneficiaryGroupsCache`)
- ✅ Real-time updates when data changes (`refreshKey` prop)

#### Visual Styling
- ✅ Gradient backgrounds (`from-blue-50 via-indigo-50/30 to-cyan-50`)
- ✅ Custom marker styles (circles with pulse animations)
- ✅ Tailwind CSS styling throughout
- ✅ Border and shadow effects

## Migration Steps

### Phase 1: Dependencies

#### 1.1 Install Leaflet Packages
```bash
npm install leaflet react-leaflet
npm install --save-dev @types/leaflet
```

#### 1.2 Add Leaflet CSS
Import Leaflet CSS in `main.tsx` or `App.tsx`:
```typescript
import 'leaflet/dist/leaflet.css'
```

#### 1.3 Remove Old Dependencies (after migration complete)
```bash
npm uninstall react-simple-maps topojson-client
```

### Phase 2: Core Map Component Migration

#### 2.1 Replace `LocationMap.tsx` Implementation

**Key Changes:**
- Replace `ComposableMap` → `MapContainer` from `react-leaflet`
- Replace `Marker` component → `Marker` from `react-leaflet`
- Replace `ZoomableGroup` → Built-in Leaflet zoom controls
- Replace SVG markers → Custom React components or Leaflet `Icon`
- Replace TopoJSON geographies → Leaflet TileLayer (OpenStreetMap or custom tiles)

**Preserve:**
- All props interface (`LocationMapProps`) - NO CHANGES
- State management (position, hoveredLocationId, popupLocation, etc.)
- Event handlers (handleMarkerClick, handleMapClick, etc.)
- Popup component (convert to React component, not Leaflet Popup)
- Zoom controls (convert to Leaflet controls or custom buttons)
- Filter logic (locations filtering) - NO CHANGES

**Implementation Notes:**
- Use `MapContainer` with `center` and `zoom` props
- Use `TileLayer` for base map (OpenStreetMap or Mapbox)
- Use `Marker` with `position={[lat, lng]}` (note: Leaflet uses [lat, lng], not [lng, lat])
- Use `useMap()` hook for map instance access
- Use `useMapEvents()` for click events
- Custom markers using React components with `createPortal` or Leaflet `DivIcon`

#### 2.2 Marker Customization
- Replace SVG circles with custom React components
- Use `DivIcon` or React Portal for custom marker rendering
- Preserve hover/selected states visually
- Preserve pulse animations using CSS

#### 2.3 Popup Implementation
- Keep as React component (not Leaflet Popup) for full control
- Position using absolute positioning relative to marker
- Use `getPopupAnchor()` or manual positioning calculations
- Preserve popup arrow/styling

### Phase 3: Filter Integration Preservation

#### 3.1 Location Filtering
- **No changes needed** - filtering happens in parent components
- `MetricsDashboard.tsx` already filters `locations` array before passing to `LocationMap`
- Preserve: `locations.filter()` logic in `MetricsDashboard.tsx` (lines 901-916)

#### 3.2 Beneficiary Group Filtering
- **No changes needed** - filtering happens in parent
- `MetricsDashboard.tsx` filters locations by beneficiary groups (lines 903-909)
- Preserve existing logic

#### 3.3 Refresh Key System
- **No changes needed** - `refreshKey` prop triggers `useEffect` re-fetch
- Preserve `useEffect` dependency on `refreshKey` (line 62)
- Map markers will automatically update when `locations` prop changes

### Phase 4: Component Integration

#### 4.1 `LocationTab.tsx`
- **No changes needed** - uses `LocationMap` with same props
- Preserve: `onLocationClick`, `onMapClick`, `selectedLocationId` props

#### 4.2 `MetricsDashboard.tsx`
- **No changes needed** - filters locations and passes to `LocationMap`
- Preserve: Location filtering logic (lines 901-916)
- Preserve: `refreshKey` prop (line 923)

### Phase 5: Styling & Visual Preservation

#### 5.1 Map Container Styling
- Preserve Tailwind classes: `rounded-lg overflow-hidden border-2 border-gray-300/60 bg-gradient-to-br`
- Preserve gradient overlay: `absolute inset-0 bg-gradient-to-br from-blue-100/20...`
- Ensure Leaflet map container respects parent styles

#### 5.2 Marker Styling
- Recreate custom markers with same visual effects:
  - Outer pulse ring (animate-ping)
  - Outer glow ring
  - Main marker circle (color changes: selected=blue, hover=green)
  - Inner white dot
  - Pin icon indicator on hover
- Use React components with `createPortal` or Leaflet `DivIcon`

#### 5.3 Popup Styling
- Preserve exact popup styling:
  - `bg-white rounded-xl shadow-2xl border border-gray-200`
  - Same content layout and spacing
  - Same arrow styling
  - Same responsive positioning

### Phase 6: Testing Checklist

#### 6.1 Basic Functionality
- [ ] Map renders with correct initial view
- [ ] Markers display at correct coordinates
- [ ] Click marker → popup appears
- [ ] Click map → `onMapClick` callback fires
- [ ] Hover marker → visual feedback
- [ ] Select location → highlighting works

#### 6.2 Popup Functionality
- [ ] Popup shows location details
- [ ] Impact Claims load and display
- [ ] Evidence loads and displays
- [ ] Loading states appear
- [ ] "See Details" button opens modal
- [ ] Popup closes on outside click
- [ ] Popup positioning is correct

#### 6.3 Filter Integration
- [ ] Location filter hides/shows markers correctly
- [ ] Beneficiary group filter works
- [ ] Date filters still work (via existing code)
- [ ] Refresh key triggers data reload

#### 6.4 Visual Preservation
- [ ] Markers look identical (colors, sizes, animations)
- [ ] Popup styling matches exactly
- [ ] Map container styling matches
- [ ] Empty state displays correctly

#### 6.5 Integration Points
- [ ] `LocationTab.tsx` works without changes
- [ ] `MetricsDashboard.tsx` works without changes
- [ ] `LocationDetailsModal` still works
- [ ] Impact claims link correctly
- [ ] Evidence links correctly

## Implementation Details

### Leaflet Map Setup
```typescript
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

// Default center and zoom
const DEFAULT_CENTER: [number, number] = [20, 0] // [lat, lng]
const DEFAULT_ZOOM = 2

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})
```

### Coordinate Conversion
- **Current**: `react-simple-maps` uses `[longitude, latitude]`
- **Leaflet**: Uses `[latitude, longitude]`
- **Conversion**: Swap coordinates when creating markers:
  ```typescript
  // Current: [location.longitude, location.latitude]
  // Leaflet: [location.latitude, location.longitude]
  <Marker position={[location.latitude, location.longitude]}>
  ```

### Custom Marker Component
Create `CustomMarker.tsx` to preserve visual styling:
- React component with same SVG/CSS styling
- Handle hover/selected states
- Use Leaflet `DivIcon` or React Portal

### Popup Positioning
- Calculate popup position relative to marker
- Use Leaflet `latLngToContainerPoint()` for accurate positioning
- Clamp to viewport bounds
- Preserve arrow pointing to marker

### Zoom Controls
- Option 1: Use Leaflet's built-in `ZoomControl` (customize styling)
- Option 2: Keep custom buttons, use `useMap()` hook to control zoom
- Preserve current +/- button styling and behavior

## Files to Modify

1. **`frontend/src/components/LocationMap.tsx`** - Complete rewrite
2. **`frontend/package.json`** - Add leaflet packages
3. **`frontend/src/main.tsx`** or **`frontend/src/App.tsx`** - Add Leaflet CSS import

## Files That Should NOT Change

- ✅ `LocationTab.tsx` - Uses same props interface
- ✅ `MetricsDashboard.tsx` - Filters locations before passing to map
- ✅ `LocationDetailsModal.tsx` - No direct map dependency
- ✅ All API services - No changes needed
- ✅ Types - No changes needed

## Rollback Plan

If issues arise:
1. Keep old `LocationMap.tsx` as `LocationMap.backup.tsx`
2. Git commit after each successful phase
3. Can revert to `react-simple-maps` by restoring old component

## Benefits of Leaflet

- ✅ More detailed maps (OpenStreetMap tiles)
- ✅ Better performance for many markers
- ✅ Better mobile support
- ✅ More customization options
- ✅ Active community and plugins
- ✅ Better pan/zoom UX

## Timeline Estimate

- Phase 1 (Dependencies): 15 minutes
- Phase 2 (Core Migration): 2-3 hours
- Phase 3 (Filters): Already done (no changes needed)
- Phase 4 (Integration): Testing, 30 minutes
- Phase 5 (Styling): 1-2 hours
- Phase 6 (Testing): 1 hour

**Total**: ~5-7 hours

## Next Steps

1. Review and approve this plan
2. Install dependencies
3. Create backup of current `LocationMap.tsx`
4. Implement new Leaflet-based `LocationMap.tsx`
5. Test thoroughly
6. Remove old dependencies

