# Strava Clone Frontend

Modern React UI for the Strava Clone with AI-powered activity recommendations.

## Features

- 🏃 Activity Dashboard with stats
- ➕ Create new activities
- 🤖 AI-powered recommendations using FAISS
- 📊 Beautiful activity cards with metrics
- 🎨 Strava-inspired design
- 📱 Responsive layout

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool & dev server
- **TailwindCSS** - Styling
- **React Router** - Navigation
- **Axios** - API calls
- **Lucide React** - Icons

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

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable components
│   │   └── RecommendationsPanel.jsx
│   ├── pages/           # Page components
│   │   ├── Dashboard.jsx
│   │   ├── CreateActivity.jsx
│   │   └── ActivityDetail.jsx
│   ├── services/        # API integration
│   │   └── api.js
│   ├── utils/           # Utility functions
│   │   └── format.js
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## API Integration

The frontend connects to the FastAPI backend at `http://localhost:8080` through Vite's proxy configuration.

### Available Endpoints

- `GET /health/live` - Health check
- `GET /activities` - List activities
- `POST /activities` - Create activity
- `GET /activities/:id` - Get activity details
- `POST /recommend` - Get recommendations

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

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

