# Deployment Guide for Strava AI Recommender

This guide will help you deploy the Strava AI-Powered Activity Recommender application.

## Prerequisites

1. Python 3.8 or higher
2. Required CSV data files (`processed_activities.csv` and `routes.csv`)
3. (Optional) Strava API credentials in `tokens.json` for user integration

## Local Deployment

### Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 2: Generate Data Files (if not already done)

```bash
python generate_csv_exports.py
```

This will create:
- `processed_activities.csv` - User activities with features
- `routes.csv` - Route metadata

### Step 3: Run the Streamlit App

```bash
streamlit run streamlit_app.py
```

The app will open in your browser at `http://localhost:8501`

### Step 4: (Optional) Connect Strava Authentication

If you want to display authenticated user information:

1. Run the auth server to get your Strava token:
   ```bash
   python auth_server.py
   ```

2. Visit `http://localhost:8888` and authorize with Strava

3. The `tokens.json` file will be created automatically

4. Restart the Streamlit app to see your Strava profile displayed

## Cloud Deployment (Streamlit Cloud)

### Option 1: Deploy to Streamlit Cloud

1. **Push to GitHub:**
   ```bash
   git add streamlit_app.py requirements.txt processed_activities.csv routes.csv .streamlit/
   git commit -m "Prepare for Streamlit Cloud deployment"
   git push origin main
   ```

2. **Deploy on Streamlit Cloud:**
   - Go to https://share.streamlit.io/
   - Click "New app"
   - Connect your GitHub repository
   - Set the main file to `streamlit_app.py`
   - Click "Deploy"

3. **Environment Variables (if using auth):**
   - Do NOT commit `tokens.json` or `env` file
   - Instead, use Streamlit Cloud secrets:
     - Go to App settings → Secrets
     - Add your Strava credentials (if needed)

### Option 2: Deploy with Docker

1. **Create Dockerfile:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY streamlit_app.py .
COPY processed_activities.csv .
COPY routes.csv .
COPY .streamlit/ .streamlit/

EXPOSE 8501

CMD ["streamlit", "run", "streamlit_app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

2. **Build and Run:**

```bash
docker build -t strava-recommender .
docker run -p 8501:8501 strava-recommender
```

### Option 3: Deploy to Heroku

1. **Create `Procfile`:**
   ```
   web: streamlit run streamlit_app.py --server.port=$PORT --server.address=0.0.0.0
   ```

2. **Create `setup.sh`:**
   ```bash
   mkdir -p ~/.streamlit/
   echo "[server]
   headless = true
   port = $PORT
   enableCORS = false
   " > ~/.streamlit/config.toml
   ```

3. **Deploy:**
   ```bash
   heroku create your-app-name
   git push heroku main
   ```

## Important Security Notes

### Files to NEVER commit:
- `tokens.json` - Contains Strava access tokens
- `env` or `.env` - Contains API credentials
- Any file with sensitive user data

### Files Required for Deployment:
- ✅ `streamlit_app.py` - Main application
- ✅ `requirements.txt` - Python dependencies
- ✅ `processed_activities.csv` - Activity data
- ✅ `routes.csv` - Route metadata
- ✅ `.streamlit/config.toml` - Streamlit configuration

### Optional Files:
- `auth_server.py` - Only for local Strava authentication
- `generate_csv_exports.py` - Only for regenerating data
- `tokens.json` - Only for local development with Strava auth

## Troubleshooting

### Error: "Data files not found"
**Solution:** Run `python generate_csv_exports.py` to create the CSV files.

### Error: "Module not found"
**Solution:** Install dependencies with `pip install -r requirements.txt`

### App runs but shows no users
**Solution:** Check that `processed_activities.csv` has data with a `user_id` column.

### Strava user not showing
**Solution:** This is optional. The app works without Strava authentication using synthetic data.

### Deployment on Streamlit Cloud fails
**Solution:**
- Ensure `processed_activities.csv` and `routes.csv` are committed to Git
- Check that file sizes are under GitHub limits (100 MB per file)
- Verify all imports in `requirements.txt` are correct

## Performance Optimization

For production deployment:

1. **Data Caching:** Already implemented with `@st.cache_data` and `@st.cache_resource`

2. **Model Pre-computation:** The similarity matrix is computed once and cached

3. **CSV Compression:** If files are large, consider using compressed CSV:
   ```python
   df.to_csv('data.csv.gz', compression='gzip')
   df = pd.read_csv('data.csv.gz', compression='gzip')
   ```

## Integration with Auth Server

To run both the Streamlit app and auth server together:

### Terminal 1 (Auth Server):
```bash
python auth_server.py
```

### Terminal 2 (Streamlit App):
```bash
streamlit run streamlit_app.py
```

The auth server runs on port 8888, Streamlit runs on port 8501.

## Next Steps

After successful deployment:

1. ✅ Test all user profiles
2. ✅ Verify recommendations are generated
3. ✅ Check distance and time filters work
4. ✅ Monitor performance and load times
5. ⬜ Add real GPS polyline data for map visualization
6. ⬜ Integrate real Strava API data fetching
7. ⬜ Implement collaborative filtering
8. ⬜ Add user feedback mechanism

## Support

For issues or questions:
- Check `CLAUDE.md` for codebase documentation
- Review `STREAMLIT_DATA_GUIDE.md` for data generation details
- Open an issue on GitHub

---

**Built with ❤️ by Anais Lacreuse & Mrudula Dama**
