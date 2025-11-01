# Strava Clone Frontend

Modern React UI for the Strava Clone with AI-powered activity recommendations and professional GPS tracking.

## ✨ Features

### Core Features
- 🏃 **Activity Dashboard** - Real-time stats and feed
- ➕ **Create Activities** - Manual or GPS-recorded
- 🤖 **AI Recommendations** - FAISS-powered smart suggestions
- 📊 **Analytics** - Beautiful metrics and charts
- 🎨 **Strava Design** - Professional, clean interface
- 📱 **Fully Responsive** - Works on all devices

### GPS & Location Features  
- 📍 **Activity Recording** - Strava-level GPS tracking with Kalman filtering
- 🗺️ **Route Visualization** - Real-time orange route lines like Strava
- 🎬 **Demo Mode** - 5km run simulation with realistic GPS movement
- 👥 **Nearby Friends** - See mutual followers on live map
- 🔔 **Proximity Alerts** - Get notified when friends are within 500m
- 🛰️ **GPS Quality** - Real-time accuracy indicators and signal strength

### Advanced Features
- 🔐 **JWT Authentication** - Secure login with refresh tokens
- 🔔 **Real-time Notifications** - WebSocket updates
- 📤 **Activity Export** - GPX, TCX, JSON formats
- 🎯 **A/B Testing UI** - Compare recommendation strategies
- ⚙️ **User Preferences** - Customizable settings

## 🛠️ Tech Stack

- **React 18** - UI library with hooks
- **Vite** - Lightning-fast build tool & dev server
- **TailwindCSS** - Utility-first styling
- **React Router v6** - Client-side routing
- **Axios** - HTTP client for API calls
- **Lucide React** - Beautiful icon library
- **Mapbox GL JS** - Professional mapping & GPS visualization
- **Leaflet** - Fallback mapping solution
- **Geolocation API** - Native browser GPS with Kalman filtering

## Getting Started

### Install Dependencies

```bash
cd frontend
npm install
```

### Run Development Server

```bash
npm run dev
```

The app will be available at http://localhost:3000

### Build for Production

```bash
npm run build
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/              # Reusable components
│   │   ├── RecommendationsPanel.jsx
│   │   ├── RecommendationEngine.jsx
│   │   ├── EnhancedMapView.jsx          # Mapbox GL integration
│   │   ├── MapProviderFallback.jsx      # Map with fallback
│   │   ├── DemoPanel.jsx
│   │   └── UserProfileDropdown.jsx
│   ├── pages/                   # Page components
│   │   ├── Dashboard.jsx                # Main activity feed
│   │   ├── CreateActivity.jsx           # Manual activity creation
│   │   ├── RecordActivity.jsx           # 🆕 GPS Recording with Demo Mode
│   │   ├── ActivityDetail.jsx           # Activity view
│   │   ├── NearbyFollowers.jsx          # 🆕 Location sharing & nearby friends
│   │   ├── Demo.jsx                     # Demo/testing page
│   │   ├── Login.jsx / Signup.jsx       # Authentication
│   │   ├── Settings.jsx                 # User preferences
│   │   └── Notifications.jsx            # Real-time notifications
│   ├── services/                # API & Services
│   │   ├── api.js                       # API client
│   │   └── PrecisionLocationService.js  # 🆕 GPS tracking with Kalman filter
│   ├── contexts/                # React contexts
│   │   └── AuthContext.jsx              # Auth state management
│   ├── utils/                   # Utility functions
│   │   └── format.js                    # Data formatting
│   ├── App.jsx                  # Main app component
│   ├── main.jsx                 # Entry point
│   └── index.css                # Global styles
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env                         # Environment variables (create this)
```

## 🔌 API Integration

The frontend connects to the FastAPI backend at `http://localhost:8000` through Vite's proxy configuration.

### Key Endpoints Used

**Authentication:**
- `POST /api/users/signup` - Register new user
- `POST /api/users/login` - Login with JWT tokens
- `POST /api/users/refresh` - Refresh access token
- `GET /api/users/me` - Get current user

**Activities:**
- `GET /api/activities` - List activities
- `POST /api/activities` - Create activity (with GPS routes)
- `GET /api/activities/:id` - Get activity details
- `DELETE /api/activities/:id` - Delete activity

**Recommendations:**
- `POST /api/recommend` - Get AI-powered recommendations
- `GET /api/recommend/strategies` - List available strategies

**Location & Social:**
- `POST /api/location/update` - Update user location
- `GET /api/location/mutual-followers` - Get nearby mutual followers  
- `GET /api/location/proximity` - Check proximity alerts
- `POST /api/location/toggle` - Toggle location sharing

**Export:**
- `GET /api/export/activity/:id/gpx` - Export as GPX
- `GET /api/export/activity/:id/tcx` - Export as TCX
- `GET /api/export/activity/:id/json` - Export as JSON

## Design

The UI follows Strava's design language with:
- Primary color: `#FC4C02` (Strava Orange)
- Clean, card-based layout
- Sport-specific icons and colors
- Responsive grid system

## Development Tips

1. **Hot Reload**: Changes automatically reflect in the browser
2. **API Proxy**: All `/api/*` requests are proxied to the backend
3. **Tailwind**: Use utility classes for styling
4. **Icons**: Import from `lucide-react`

## Environment Variables

### Mapbox GL API Key (Required for Enhanced Maps)

For the Record Activity page with professional GPS tracking, you'll need a Mapbox API key:

1. **Get a free Mapbox token**: https://account.mapbox.com/access-tokens/
2. **Create `.env` file** in the `frontend/` directory:
   ```bash
   VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImN...your-token-here
   ```
3. **Restart the dev server** after adding the token

📖 **Full setup guide**: See [MAPBOX_SETUP.md](./MAPBOX_SETUP.md)

**Note**: The app will work without a token (uses basic OpenStreetMap fallback), but you'll get better map features with Mapbox!

## 📍 GPS Activity Recording

### Features
The Record Activity page provides professional-grade GPS tracking:

**Permission Flow:**
- Clear modal explaining why location is needed
- Browser native permission prompt
- Graceful fallback to network positioning
- Visual feedback during permission request

**GPS Tracking:**
- **High Accuracy Mode** - Uses device GPS satellites
- **Kalman Filtering** - Smooths GPS noise for clean routes
- **Accuracy Filtering** - Only accepts quality GPS points
- **Movement Validation** - Filters impossible speeds/jumps
- **Real-time Metrics** - Distance, pace, speed, elevation
- **GPS Quality Indicator** - Shows signal strength 0-100%

**Route Visualization:**
- **Strava Orange Line** - Professional `#FC4C02` color
- **Real-time Drawing** - Route appears as you move
- **Shadow Effect** - Depth for better visibility
- **Auto-Follow** - Map smoothly pans to follow you
- **Start/Current Markers** - Green start, orange current position

### Demo Mode 🎬

Can't test outdoors? Use the built-in 5km Run Simulation:

```javascript
// Click "Try Demo: 5km Run Simulation" button
// Features:
- Generates realistic 5km route with natural turns
- Simulates GPS at 10 points/second
- Updates all metrics in real-time (distance, pace, elevation)
- Completes in ~50 seconds
- Perfect for testing and demonstrations
```

**Demo Controls:**
- Pause/Resume simulation
- Stop and save simulated activity
- View live stats and route drawing
- All features work exactly like real GPS

### GPS Implementation Details

**PrecisionLocationService.js:**
```javascript
- Kalman Filter for coordinate smoothing
- Haversine formula for distance calculations
- Movement validation (max speed checks)
- Accuracy history tracking
- GPS quality scoring (0-100%)
- Automatic network fallback
```

**Accuracy Thresholds:**
- Production: <50m for best quality
- Testing: Accepts up to 50km for indoor/network positioning
- Configurable per environment

## 🗺️ Nearby Friends Feature

### Location Sharing
Real-time location tracking for mutual followers:

**Privacy First:**
- Only mutual followers can see your location
- Easy on/off toggle
- Location updates every 30 seconds
- Stops when app closes

**Demo Data:**
Built-in sample users that persist even when location sharing is enabled:
- Sarah Johnson (250m away, Running - 3.2km)
- Mike Chen (680m away, Cycling - 12.5km)
- Emma Davis (1.2km away, Walking)
- Alex Martinez (320m away, Running - 5.1km)

Shows "Demo Data" badge when using samples.

**Features:**
- Interactive map with all nearby users
- Distance calculations in real-time
- Activity status for each user
- Proximity alerts (<500m)
- Direct messaging
- Profile viewing

## 🎨 Design System

The UI follows Strava's design language with:

**Colors:**
- Primary: `#FC4C02` (Strava Orange)
- GPS Route: `#FC4C02` (Orange line)
- Success: `#10B981` (Green)
- Warning: `#F59E0B` (Amber)
- Error: `#EF4444` (Red)

**Components:**
- Clean, card-based layout
- Sport-specific icons and colors
- Responsive grid system
- Smooth animations and transitions
- Professional typography (Inter font)

## 🐛 Troubleshooting

### GPS Issues

**Location Permission Denied:**
1. Click lock icon in address bar
2. Change Location to "Allow"
3. Refresh page or click "Try Again"

**GPS Stuck on "Acquiring Signal":**
1. Open browser console (F12) to see detailed logs
2. Check device GPS is enabled
3. Move to open area with sky view
4. Wait 30-60 seconds for satellites
5. Or use Demo Mode for testing

**Route Not Showing:**
- Check console for "Route rendered on map"
- Ensure Mapbox token is set (or fallback active)
- Verify route has at least 2 GPS points

### Map Issues

**Map Not Loading:**
1. Add Mapbox token to `.env`:
   ```
   VITE_MAPBOX_TOKEN=pk.eyJ...
   ```
2. App will fallback to OpenStreetMap if no token
3. Check console for errors

**Nearby Friends No Data:**
- Demo data should persist even with location sharing on
- Check "Demo Data" badge
- Console shows "keeping demo data" if API fails

## 🧪 Testing

### Test GPS Recording
```bash
# 1. Indoor Testing (Demo Mode)
- Click "Try Demo: 5km Run Simulation"
- Watch route draw in real-time
- Verify exactly 5.00km distance
- Check all metrics update

# 2. Outdoor Testing (Real GPS)
- Go outdoors with clear sky
- Enable location when prompted  
- Wait for accuracy < 50m
- Start recording and walk/run
- Verify route draws behind you
```

### Test Nearby Friends
```bash
# With Location Sharing Off
- Should see 4 demo users
- "Demo Data" badge visible
- All features interactive

# With Location Sharing On
- Demo data persists
- Map shows your location
- Can still interact with demo users
```

## 🚀 Performance

**Optimizations:**
- Lazy loading for routes
- Mapbox vector tiles for fast rendering
- GPS update throttling (1 point/second)
- Route simplification for storage
- Efficient state management

**Bundle Size:**
- Initial JS: ~250KB (gzipped)
- Mapbox GL: ~200KB (loaded on demand)
- Total initial load: <500KB

## 📱 Browser Support

**Full Support:**
- Chrome/Edge 90+ (Best GPS experience)
- Firefox 88+
- Safari 14+ (iOS 14+)

**GPS Features:**
- Desktop: WiFi/network positioning
- Mobile: Full GPS satellite support
- All: Geolocation API required

**Note:** GPS works best on mobile devices with actual GPS hardware!

