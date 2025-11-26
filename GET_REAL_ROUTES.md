# How to Get REAL Strava Routes

Your route recommendation system needs real GPS data. Here are your options:

---

## 🚨 Current Issue

Your Strava API token has expired. You need to get fresh data using one of these methods:

---

## ✅ Option 1: Re-Authenticate with Strava (FASTEST)

**Time:** 2 minutes
**Routes:** All your Strava activities (up to 100)

### Steps:

1. **Start the auth server:**
   ```bash
   python auth_server.py
   ```

2. **Authorize in browser:**
   - Visit `http://localhost:8888`
   - Click "Authorize Strava"
   - Log in and approve permissions

3. **Fetch real routes:**
   ```bash
   python fetch_real_strava_routes.py
   ```

4. **Done!** Your `routes.csv` now has real GPS data

---

## ✅ Option 2: Import GPX Files

**Time:** 5-10 minutes
**Routes:** Any GPX files you have

### Steps:

1. **Export activities from Strava:**
   - Go to any Strava activity
   - Click "..." menu → "Export GPX"
   - Repeat for activities you want

2. **Create gpx_files directory:**
   ```bash
   mkdir gpx_files
   ```

3. **Move GPX files there:**
   ```bash
   mv ~/Downloads/*.gpx gpx_files/
   ```

4. **Import:**
   ```bash
   python import_gpx_files.py
   ```

5. **Done!** Real GPS routes loaded

---

## ✅ Option 3: Strava Bulk Export

**Time:** 24-48 hours (Strava processing time)
**Routes:** ALL your Strava data ever

### Steps:

1. **Request data export:**
   - Go to https://www.strava.com/settings/my_data
   - Scroll to "Download or Delete Your Account"
   - Click "Request Your Archive"

2. **Wait for email** (up to 24 hours)

3. **Download and extract ZIP**

4. **Import (script coming soon):**
   ```bash
   python import_strava_export.py /path/to/export
   ```

---

## 📊 What You'll Get

After using any option, `routes.csv` will contain:

- **Real GPS polylines** from actual Strava activities
- **Precise distances** (measured, not estimated)
- **Actual elevation** data
- **Start/end coordinates**
- **Activity metadata** (name, type, date)

### Example Output:
```
✓ Imported 47 real routes from Strava
  Distance range: 2.1 - 42.2 km
  Average distance: 12.4 km
  Loop routes: 23
  Out-and-back: 18
```

---

## 🗺️ Then What?

Once you have real routes:

```bash
streamlit run streamlit_app.py
```

Your app will now show:
- **Real GPS paths** on the map
- **Actual routes** you or others have run
- **Precise recommendations** based on real data

---

## 🔧 Troubleshooting

### "Token refresh failed"
→ Use Option 1 (re-authenticate)

### "No GPX files found"
→ Make sure files are in `gpx_files/` directory

### "No activities found"
→ Check that your Strava account has recorded activities

### "GPS data unavailable"
→ Some activities don't have GPS (manual entries, privacy zones)

---

## 💡 Recommended Approach

**For best results:**

1. **Start with Option 1** (re-auth) to get your own routes quickly
2. **Add Option 2** (GPX import) for specific routes you want to include
3. **Mix your data** with synthetic routes for variety

**Why?** Real routes give you:
- Accurate GPS paths users can actually follow
- True distance measurements
- Realistic elevation profiles
- Proven route quality

---

## 📝 Files Created

After import, you'll have:

- `routes.csv` - Real route database
- `tokens.json` - Fresh Strava credentials (Option 1)
- `gpx_files/` - Imported GPX files (Option 2)

All ready for your recommendation engine!

---

**Next:** Run `streamlit run streamlit_app.py` to see your real routes! 🏃‍♀️🗺️
