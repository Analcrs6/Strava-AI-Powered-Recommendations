# New Features Guide

## 🗺️ Feature 1: GPS Map Visualization

### Overview
Routes are now displayed with **real GPS polylines** on interactive maps showing the exact path of each recommended route.

### What's New
- **100 routes** with realistic GPS coordinates around NYC
- **Loop, out-and-back, and point-to-point** route types
- **Start and end markers** on the map
- **Route metrics** displayed below the map (distance, elevation, surface)
- **Strava orange** polyline color for brand consistency

### How to Use

1. **Run the Streamlit app:**
   ```bash
   streamlit run streamlit_app.py
   ```

2. **Select a user and adjust filters** in the sidebar

3. **View the map** - The top recommended route will be displayed with:
   - Full GPS polyline showing the exact route
   - Green start marker
   - Red end marker
   - Hover tooltips with distance and elevation
   - Zoom and pan controls

### Technical Details

**Generated Data:**
- `routes.csv` now includes:
  - `gps_polyline` - Encoded polyline string following real street patterns
  - `start_lat/lon` - Starting coordinates
  - `end_lat/lon` - Ending coordinates
  - `actual_distance_km` - Precisely measured route distance
  - `area_name` - NYC neighborhood

**Route Generation (PRECISE VERSION):**
- **Manhattan grid routes**: Follow NYC street grid (80m NS blocks, 260m EW blocks)
- **Park loop routes**: Smooth oval paths (Central Park, Prospect Park)
- **Greenway routes**: Linear paths along rivers (Hudson, East River)
- **Accuracy**: 72% of routes within ±10% of target distance, median error 3.4%

**To regenerate GPS data:**
```bash
python generate_precise_routes.py
```

This generates mathematically precise routes that:
- Follow realistic street grid patterns
- Have measurable, accurate distances
- Provide clear navigation points
- Are actually followable by runners/cyclists

---

## 🔔 Feature 2: Proximity Alerts

### Overview
Real-time notifications when friends complete activities near your location, powered by a webhook server with geopy distance calculations.

### What's New
- **Flask webhook server** handling Strava activity events
- **Real-time distance calculations** using geopy
- **5km proximity threshold** - alerts when friends are within 5km
- **Activity logging** with timestamps
- **REST API** for fetching alerts
- **Live integration** with Streamlit app

### Architecture

```
Strava Activity Created
    ↓
Webhook → proximity_alert_server.py
    ↓
Calculate distance with geopy
    ↓
Save alert if within 5km
    ↓
Streamlit app fetches alerts via API
    ↓
Display in user interface
```

### How to Use

#### Step 1: Start the Proximity Alert Server

```bash
python proximity_alert_server.py
```

Server will run on `http://localhost:5000`

You should see:
```
============================================================
🔔 PROXIMITY ALERT SERVER
============================================================
Proximity threshold: 5.0 km
API Endpoints:
  - http://localhost:5000 (Dashboard)
  - http://localhost:5000/api/alerts (Get alerts)
  - http://localhost:5000/api/simulate (Simulate activity)
============================================================
```

#### Step 2: Start the Streamlit App (in a new terminal)

```bash
streamlit run streamlit_app.py
```

#### Step 3: Test the System

**Option A: Simulate an activity**
```bash
curl -X POST http://localhost:5000/api/simulate
```

**Option B: Use the Streamlit UI**
- Click the "🧪 Simulate Activity" button in the Proximity Alerts section
- Refresh the page to see new alerts

**Option C: View the dashboard**
- Go to `http://localhost:5000` in your browser
- See alert statistics and recent activity

### API Endpoints

**Get Alerts:**
```bash
GET http://localhost:5000/api/alerts?limit=10
```

**Simulate Activity:**
```bash
POST http://localhost:5000/api/simulate
Content-Type: application/json

{
  "user": "user_runner",
  "type": "a run",
  "action": "finished",
  "lat_offset": 0.01,
  "lon_offset": 0.01
}
```

**Clear All Alerts:**
```bash
POST http://localhost:5000/api/alerts/clear
```

**Get/Update User Locations:**
```bash
GET http://localhost:5000/api/users
POST http://localhost:5000/api/users
```

### User Locations

Default monitored users (NYC area):
- **anaisl** - Times Square area
- **mrudulad** - Midtown East
- **user_runner** - Brooklyn Bridge area
- **user_biker** - Prospect Park area

**To update user locations:**
```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "anaisl": {"lat": 40.7580, "lon": -73.9855, "name": "Anais"},
    "mrudulad": {"lat": 40.7489, "lon": -73.9680, "name": "Mrudula"}
  }'
```

### Strava Webhook Integration

To connect with real Strava webhooks:

1. **Create a webhook subscription** at https://www.strava.com/settings/api

2. **Configure the webhook:**
   - Callback URL: `https://your-domain.com/webhook`
   - Verify Token: Set in `.env` as `WEBHOOK_VERIFY_TOKEN`

3. **Expose local server** (for development):
   ```bash
   # Using ngrok
   ngrok http 5000

   # Use the ngrok URL as your webhook callback
   ```

4. **Webhook challenge** is handled automatically by the server

5. **Activity events** will trigger proximity checks

### Alert Types

**Proximity Alert:**
```
[10:15 AM] ALERT: User 'Jake' finished a run 1.2 km from your location.
```

**Webhook Log:**
```
[08:45 AM] LOG: Webhook received. Activity created by user_runner.
```

### Customization

**Change proximity threshold:**

Edit `proximity_alert_server.py`:
```python
PROXIMITY_THRESHOLD_KM = 10.0  # Change from 5.0 to 10.0 km
```

**Add more users:**

Edit `user_locations.json`:
```json
{
  "new_user": {
    "lat": 40.7128,
    "lon": -74.0060,
    "name": "Display Name"
  }
}
```

---

## 📋 Complete Setup Guide

### Terminal 1: Proximity Alert Server
```bash
cd Strava-AI-Powered-Recommendations
python proximity_alert_server.py
```

### Terminal 2: Streamlit App
```bash
cd Strava-AI-Powered-Recommendations
streamlit run streamlit_app.py
```

### Terminal 3: Testing
```bash
# Simulate activities
curl -X POST http://localhost:5000/api/simulate

# View alerts
curl http://localhost:5000/api/alerts

# View server dashboard
open http://localhost:5000
```

---

## 🎬 Demo Workflow

1. **Open Streamlit app** at `http://localhost:8501`

2. **Select a user** (e.g., "anaisl") and adjust filters

3. **View the map** - See the GPS polyline route with markers

4. **Scroll to Proximity Alerts** section

5. **Click "🧪 Simulate Activity"** or run `curl -X POST http://localhost:5000/api/simulate`

6. **Refresh the page** to see new proximity alert

7. **View multiple routes** - Change filters to see different GPS routes

8. **Check server dashboard** at `http://localhost:5000` for statistics

---

## 🐛 Troubleshooting

### Map not showing GPS route
- Check that `routes.csv` has `gps_polyline` column
- Run `python add_gps_polylines.py` to regenerate GPS data
- Check browser console for errors

### Proximity alerts not appearing
- Ensure proximity server is running on port 5000
- Check `http://localhost:5000/api/alerts` returns JSON
- Verify Streamlit can connect (no firewall blocking)
- Try simulating an activity manually

### "Server Offline" message
- Start the proximity server: `python proximity_alert_server.py`
- Check port 5000 is not in use: `lsof -i :5000`
- Verify server is accessible: `curl http://localhost:5000`

### Distance calculations incorrect
- Check user locations in `user_locations.json`
- Verify coordinates are valid (lat, lon format)
- Test with `http://localhost:5000/api/users`

---

## 📊 Files Modified/Created

**New Files:**
- `add_gps_polylines.py` - GPS data generation script
- `proximity_alert_server.py` - Flask webhook server
- `proximity_alerts.json` - Alert storage (auto-generated)
- `user_locations.json` - User home locations (auto-generated)
- `FEATURES_GUIDE.md` - This file

**Modified Files:**
- `streamlit_app.py` - GPS map display + live proximity alerts
- `routes.csv` - Added GPS polyline columns
- `requirements.txt` - Added polyline and geopy

---

## 🚀 Production Deployment

### For GPS Maps:
- Maps work automatically in Streamlit Cloud
- Ensure `routes.csv` with GPS data is committed

### For Proximity Alerts:
- Deploy Flask server separately (Heroku, AWS, GCP)
- Set environment variables for Strava API
- Configure Strava webhook with production URL
- Update Streamlit app to point to production API URL

---

## 📚 Dependencies

All dependencies are in `requirements.txt`:
- `polyline>=2.0.0` - GPS polyline encoding/decoding
- `geopy>=2.4.0` - Distance calculations
- `flask>=3.0.0` - Webhook server
- `folium>=0.14.0` - Interactive maps
- `streamlit-folium>=0.15.0` - Streamlit-Folium integration

Install all:
```bash
pip install -r requirements.txt
```

---

**Enjoy your enhanced Strava AI Recommender!** 🏃‍♀️🚴🗺️
