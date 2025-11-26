# Strava Authentication Guide

## Issue: Token Expired

Your Strava access token has expired and cannot be refreshed automatically.

**Current status:**
- Token expired at: 2025-10-25 (expired)
- Refresh failed: 403 Forbidden

## Solution Options

### Option 1: Re-authenticate (RECOMMENDED)

Get fresh Strava tokens with GPS access:

```bash
# Start the auth server
python auth_server.py
```

Then:
1. Visit `http://localhost:8888` in your browser
2. Click "Authorize Strava"
3. Log in to Strava and approve permissions
4. New tokens will be saved to `tokens.json`
5. Run the route fetcher again:
   ```bash
   python fetch_real_strava_routes.py
   ```

### Option 2: Use Strava Bulk Export

If you have many activities, use Strava's bulk export:

1. Go to https://www.strava.com/settings/my_data
2. Click "Request Your Archive"
3. Wait for email (up to 24 hours)
4. Download the ZIP file
5. Extract and run:
   ```bash
   python import_strava_export.py /path/to/export/activities
   ```

### Option 3: Manual GPX Import

If you have specific routes as GPX files:

1. Export activities from Strava (individual exports)
2. Place GPX files in `gpx_files/` directory
3. Run:
   ```bash
   python import_gpx_files.py
   ```

## Checking Your Token Status

```bash
python -c "import json, time; t=json.load(open('tokens.json')); print(f'Expires: {time.ctime(t[\"expires_at\"])}'); print(f'Expired: {time.time() > t[\"expires_at\"]}')"
```

## Why Token Refresh Failed

Possible reasons:
- Strava app credentials were revoked
- Refresh token has expired (typically after 6 months of inactivity)
- Client ID/Secret mismatch
- Strava API permissions changed

##Next Steps

1. **For immediate access to real routes**: Re-authenticate (Option 1)
2. **For bulk import**: Use Strava export (Option 2)
3. **For custom routes**: Import GPX files (Option 3)

After getting fresh routes, your Streamlit app will show real, followable GPS data!
