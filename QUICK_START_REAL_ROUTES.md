# Quick Start: Get Real Strava Routes

## Current Status

Your Strava token expired on **November 25, 2025** (37 days ago).
To fetch real routes from your Strava account, you need fresh authentication tokens.

## Option 1: Re-Authenticate with Strava (Recommended)

###  Step 1: Start the Auth Server

```bash
python auth_server.py
```

The server will start on `http://localhost:8888`

### Step 2: Authorize in Browser

1. Open http://localhost:8888 in your web browser
2. Click the **"Authorize Strava"** button
3. Log in to Strava if needed
4. Click **"Authorize"** to grant permissions
5. You'll be redirected back and see "Authentication successful!"

### Step 3: Verify New Tokens

```bash
# Check that tokens.json was updated
python -c "import json; t=json.load(open('tokens.json')); print(f'Expires: {t[\"expires_at\"]}, Valid for: {(t[\"expires_at\"] - __import__(\"time\").time())/3600:.1f} hours')"
```

### Step 4: Fetch Real Routes

```bash
python fetch_real_strava_routes.py
```

This will:
- ✓ Automatically refresh token if needed
- ✓ Fetch up to 100 of your activities
- ✓ Download GPS polylines for each activity
- ✓ Create `routes_real.csv` with actual Strava data
- ✓ Backup existing `routes.csv` to `routes_synthetic_backup.csv`

---

## Option 2: Import from GPX Files

If you have GPX files exported from Strava:

### Export from Strava Website

1. Go to https://www.strava.com/athlete/training
2. Select activities to export
3. Click **"Export GPX"** for each activity
4. Save files to a folder (e.g., `gpx_exports/`)

### Import GPX Files

```bash
# Import all GPX files from a folder
python import_gpx_files.py gpx_exports/

# Or import a single GPX file
python import_gpx_files.py my_route.gpx
```

---

## Option 3: Use Strava Bulk Export

### Request Bulk Export

1. Go to https://www.strava.com/settings/profile
2. Scroll to "Download or Delete Your Account"
3. Click **"Get Started"** under "Download Request"
4. Wait for Strava to email you (usually within 24 hours)
5. Download the ZIP file

### Extract and Import

```bash
# Extract the ZIP file
unzip strava_export.zip -d strava_data/

# Import activities from the export
python import_gpx_files.py strava_data/activities/
```

---

## Troubleshooting

### Token Refresh Fails

**Error:** `403 Forbidden` or `Max retries exceeded`

**Solution:** Re-authenticate using Option 1 above. Refresh tokens expire after 90 days.

### No Activities Found

**Error:** `Fetched 0 activities`

**Possible causes:**
- No activities recorded on your Strava account
- Activities are set to private
- App permissions don't include `activity:read_all`

**Solution:** Check your Strava privacy settings and re-authorize with full permissions.

### GPS Polylines Missing

**Error:** `Activity X has no GPS data`

**Causes:**
- Indoor activities (treadmill, indoor cycling)
- Manual entries
- Privacy zones enabled

**Solution:** Only outdoor activities with GPS tracking will have polylines.

---

## What Happens Next

Once you've fetched real routes, the app will use them automatically:

```bash
# Test with original app
streamlit run streamlit_app.py

# Or test with interactive app
streamlit run streamlit_app_interactive.py
```

Your map visualization will now show:
- **Real GPS routes** you've actually run/biked
- **Accurate distances** matching your Strava activities
- **Precise start/end locations** from your recordings
- **Authentic elevation profiles**

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `python auth_server.py` | Re-authenticate with Strava |
| `python fetch_real_strava_routes.py` | Fetch routes from Strava API |
| `python import_gpx_files.py <path>` | Import from GPX files |
| `streamlit run streamlit_app_interactive.py` | Run the interactive app |

---

## Need Help?

- **Strava API Docs:** https://developers.strava.com/docs/reference/
- **Authentication Guide:** See `STRAVA_AUTH_GUIDE.md`
- **Full Setup Guide:** See `GET_REAL_ROUTES.md`

Your authenticated user:
- **Name:** Mrudula Lakshmi (@mrudula_lakshmi)
- **Location:** New York, New York
- **Strava ID:** 188299995
