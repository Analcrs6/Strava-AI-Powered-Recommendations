# Analysis Index: Strave_recommender_ver4.ipynb Data Structure

**Generated:** 2025-11-21

This directory contains comprehensive analysis and tools for understanding and deploying the Strava AI-Powered Recommendations system.

---

## Quick Start

### Goal: Deploy Streamlit App with Data Files

1. **Generate CSV Files (30 seconds):**
   ```bash
   python generate_csv_exports.py
   ```

2. **Verify Files Created:**
   ```bash
   ls -lh processed_activities.csv routes.csv
   ```

3. **Continue with Streamlit Deployment**

---

## Documentation Files

### 1. STREAMLIT_DATA_GUIDE.md (START HERE)
**Best For:** Streamlit app deployment

**Contents:**
- Quick start instructions
- Data pipeline overview
- Input/output data schemas
- Three methods to generate CSV files
- Troubleshooting guide
- Next steps for deployment

**Key Sections:**
- Data generation (method 1, 2, 3)
- Schema definitions for processed_activities.csv and routes.csv
- Feature engineering formulas
- Deployment checklist

**Read Time:** 15 minutes

---

### 2. DATA_SCHEMA_ANALYSIS.md (COMPREHENSIVE REFERENCE)
**Best For:** Understanding complete data structures and transformations

**Contents:**
- Detailed data generation process
- Initial data schema (synthetic_strava_data.csv)
- Feature engineering details (all 20+ features)
- Route aggregation process
- Feature matrix construction
- User interaction tracking
- Data split and clustering approaches

**Key Sections:**
- Sections 1-11 covering entire pipeline
- Appendix with data generation code pattern
- Complete feature definitions with formulas

**Read Time:** 30 minutes (or reference specific sections)

---

### 3. CODE_SNIPPETS_REFERENCE.md (DEVELOPER GUIDE)
**Best For:** Copy-paste code and implementation

**Contents:**
- Extracted code from all relevant notebook cells
- Data loading (Cell 4)
- Data cleaning (Cell 10)
- Feature engineering (Cell 12)
- Route aggregation (Cell 14)
- Feature standardization (Cell 15)
- User tracking (Cell 24)
- CSV export code

**Key Sections:**
- 7 complete, runnable code snippets
- Data transformation summary diagram
- Complete column inventory

**Read Time:** 10 minutes (or reference specific snippets)

---

## Tool Files

### generate_csv_exports.py (EXECUTABLE SCRIPT)
**Purpose:** Generate CSV files needed for Streamlit deployment

**Usage:**
```bash
cd /home/user/Strava-AI-Powered-Recommendations
python generate_csv_exports.py
```

**Output:**
- processed_activities.csv (activities with engineered features)
- routes.csv (route metadata)

**Implementation:**
- Includes engineer_rich_features() function
- Handles data loading, cleaning, feature engineering
- Performs route aggregation
- Complete error handling

**No Dependencies Issues:** Uses only pandas, numpy, scikit-learn (standard ML stack)

---

## Original Sources

### Strave_recommender_ver4.ipynb
**7,602 lines** - Main model development notebook

**Key Cells Referenced:**
- **Cell 1:** Setup and configuration
- **Cell 4:** Data loading from CSV
- **Cell 10:** Data cleaning and deduplication
- **Cell 12:** Feature engineering (engineer_rich_features function)
- **Cell 14:** Route aggregation
- **Cell 15:** Feature standardization and one-hot encoding
- **Cell 24:** User interaction tracking
- **Cells 20-70:** Model development and evaluation

**What to Know:**
- Notebook is for ML model development
- Does NOT generate the CSV files needed for deployment
- Focus is on training and evaluating recommendation models
- ~7,600 lines of comprehensive ML code

### synthetic_strava_data.csv
**Source data file** - 12 columns, 1000+ rows

**Location:** `/home/user/Strava-AI-Powered-Recommendations/synthetic_strava_data.csv`

**Schema:** 12 columns covering users, routes, activities, ratings, timestamps

---

## Data Flow Diagram

```
synthetic_strava_data.csv (source)
    ↓ [Generate_csv_exports.py + Cell 4]
    ↓ Load data
df (12 columns)
    ↓ [Cell 10]
    ↓ Clean, deduplicate
df_clean (12 columns)
    ↓ [Cell 12: engineer_rich_features()]
    ↓ Add 20+ features
df_enriched (32+ columns)
    ↓ [Split into two paths]
    ├→ [Export]
    │  └→ processed_activities.csv
    │
    └→ [Cell 14: groupby("route_id").agg()]
       ↓ Aggregate to route level
       route_meta (26+ columns)
       ↓ [Cell 15: encode + standardize]
       ↓ One-hot encode, scale
       → routes.csv
```

---

## Feature Summary

### Original Features (12)
From synthetic_strava_data.csv:
- User/route IDs, distances, elevations, surface types
- Ratings, timestamps, pace metrics, difficulty scores

### Engineered Features (20+)

**Terrain (5):** grade_percent, grade_flat, grade_rolling, grade_hilly, grade_steep

**Route Type (2):** is_likely_loop, is_likely_out_back

**Environment (1):** traffic_stress

**Geographic (1):** geo_cluster

**Temporal (8):** hour_of_day, is_morning, is_afternoon, is_evening, is_night, day_of_week, is_weekend, is_weekday

**One-Hot (at export):** surface_*, geo_* (automatic during aggregation)

### Total Output
- **processed_activities.csv:** 32+ columns, M rows (activities)
- **routes.csv:** 26+ columns, K rows (unique routes)

---

## Common Tasks and Where to Find Them

### Task: Generate CSV files for Streamlit
**Quick Answer:** Run `python generate_csv_exports.py`
**Details:** STREAMLIT_DATA_GUIDE.md → "How to Generate the CSV Files"

### Task: Understand feature engineering
**Quick Answer:** See CODE_SNIPPETS_REFERENCE.md → Section 3 (Feature Engineering)
**Details:** DATA_SCHEMA_ANALYSIS.md → Section 3 (Feature Engineering)

### Task: See data schemas
**Quick Answer:** STREAMLIT_DATA_GUIDE.md → "Data Schemas"
**Details:** DATA_SCHEMA_ANALYSIS.md → Sections 1-2

### Task: Route aggregation details
**Quick Answer:** CODE_SNIPPETS_REFERENCE.md → Section 4 (Route Aggregation)
**Details:** DATA_SCHEMA_ANALYSIS.md → Section 4 (Route Aggregation)

### Task: Troubleshoot data issues
**Quick Answer:** STREAMLIT_DATA_GUIDE.md → "Troubleshooting"
**Details:** All three docs contain error scenarios

### Task: Copy code for implementation
**Quick Answer:** CODE_SNIPPETS_REFERENCE.md → Sections 1-7
**Details:** Extract from notebook (Strave_recommender_ver4.ipynb)

---

## File Manifest

### Documentation (3 files, 35 KB)
- **STREAMLIT_DATA_GUIDE.md** (12 KB) - Deployment guide
- **DATA_SCHEMA_ANALYSIS.md** (13 KB) - Complete reference
- **CODE_SNIPPETS_REFERENCE.md** (10 KB) - Implementation code
- **ANALYSIS_INDEX.md** (this file)

### Tools (1 file, 7.6 KB)
- **generate_csv_exports.py** (7.6 KB) - CSV generation script

### Original Sources (2 files)
- **Strave_recommender_ver4.ipynb** (~7,600 lines) - Main notebook
- **synthetic_strava_data.csv** (~1000+ rows) - Source data

---

## Feature Coverage

### Terrain Analysis
- Grade percentage calculation
- Categorization (flat, rolling, hilly, steep)
- Loop vs out-and-back detection

### Environmental Factors
- Surface type (Road, Trail, Mixed, Track)
- Traffic stress proxy (urban vs. natural)
- Geographic clustering by distance-elevation

### Temporal Patterns
- Hour of day extraction
- Time-of-day preferences (morning, afternoon, evening, night)
- Weekday/weekend preferences

### User Preferences
- Rating-based feedback
- Activity history aggregation
- Cold-start handling (via popularity)

---

## Integration Points

### With Streamlit App (streamlit_app.py)
- Expects: processed_activities.csv, routes.csv
- Uses: User selection, distance slider, time preference filters
- Displays: Route recommendations with metadata

### With ML Models (in notebook)
- Trains: Content-based recommender, matrix factorization, BPR
- Evaluates: Hit rate, precision, recall, diversity metrics
- Tests: Temporal holdout splits, cold-start scenarios

### With Strava API (auth_server.py)
- Fetches: Real user activities (optional)
- Combines: With synthetic data or replaces it
- Stores: Tokens in tokens.json

---

## Maintenance and Updates

### To Update Feature Engineering
1. Edit the engineer_rich_features() function in generate_csv_exports.py
2. Add new feature columns following the pattern
3. Re-run: `python generate_csv_exports.py`
4. Verify: Check processed_activities.csv for new columns

### To Update Aggregation Logic
1. Modify the route_meta aggregation in generate_csv_exports.py
2. Change agg() operations as needed
3. Re-run: `python generate_csv_exports.py`
4. Verify: Check routes.csv for changes

### To Change Source Data
1. Update DATA_PATH in generate_csv_exports.py
2. Or modify synthetic_strava_data.csv with new data
3. Re-run: `python generate_csv_exports.py`

---

## Questions and Answers

**Q: Why are two CSV files needed?**
A: processed_activities.csv stores individual activity data for user profiling. routes.csv stores aggregated route metadata for efficient lookups and similarity computation.

**Q: Can I use the notebook directly?**
A: The notebook is designed for model development. For deployment, use the CSV files to avoid running the entire notebook each time.

**Q: What if I modify the features?**
A: Update generate_csv_exports.py and re-run it. The new columns will automatically appear in both CSV files.

**Q: Do I need the notebook after generating CSVs?**
A: No - the CSV files are self-contained. The notebook is useful for experimentation and model development.

**Q: How often should I regenerate?**
A: Regenerate when: (1) Source data changes, (2) Features are added/modified, (3) Aggregation logic changes.

---

## Next Steps

1. **Read:** STREAMLIT_DATA_GUIDE.md (10-15 minutes)
2. **Generate:** `python generate_csv_exports.py` (30 seconds)
3. **Verify:** Check that processed_activities.csv and routes.csv exist
4. **Deploy:** Update streamlit_app.py to use these CSV files
5. **Test:** `streamlit run streamlit_app.py`

---

## Support Information

**For Data Questions:**
- See DATA_SCHEMA_ANALYSIS.md for complete data reference
- See CODE_SNIPPETS_REFERENCE.md for code examples

**For Deployment Questions:**
- See STREAMLIT_DATA_GUIDE.md for step-by-step instructions
- See Troubleshooting section for common issues

**For Feature Questions:**
- See DATA_SCHEMA_ANALYSIS.md Section 3 for feature details
- See CODE_SNIPPETS_REFERENCE.md Section 3 for feature engineering code

**For Implementation Questions:**
- Extract code from CODE_SNIPPETS_REFERENCE.md
- Or run generate_csv_exports.py as a reference implementation

---

**Version:** 1.0
**Last Updated:** 2025-11-21
**Status:** Ready for Streamlit Deployment
