# Surf Report - Setup Guide

## Quick Start

### 1. Push to GitHub

```bash
# Create repo on GitHub (go to github.com/new)
# Name it "surf_report" and make it public

# Then push your code:
cd ~/surf_report
git remote add origin https://github.com/YOUR_USERNAME/surf_report.git
git branch -M main
git push -u origin main
```

### 2. Start the Backend

```bash
cd ~/surf_report/backend
npm start
```

The API will start on http://localhost:5000

### 3. Start the Frontend (in a new terminal)

```bash
cd ~/surf_report/frontend
npm start
```

The React app will open at http://localhost:3000

### 4. Test the App

1. Select a spot (Herzliya Marina or Netanya Kontiki)
2. The app will fetch current surf conditions using Bright Data MCP
3. You'll see:
   - Overall score (0-100) with rating (EPIC/GOOD/FAIR/POOR/FLAT)
   - Wave height, period, and direction
   - Wind speed and direction
   - Weather conditions
   - Score breakdown showing contribution of each factor

## How It Works

1. **Frontend** (React) sends API request to backend
2. **Backend** (Express) orchestrates scraping:
   - Calls Bright Data MCP via Claude CLI
   - Scrapes BeachCam.co.il for surf data
   - Parses markdown to extract wave/wind/weather
3. **Aggregates** data from multiple sources (currently BeachCam, can add more)
4. **Calculates score** using weighted algorithm:
   - Wave height: 35%
   - Wave period: 20%
   - Wind speed: 20%
   - Wind direction: 15%
   - Wave direction: 10%
5. **Caches** result for 10 minutes to save API calls
6. **Returns** JSON response to frontend
7. **Displays** beautiful dashboard with circular score gauge

## API Endpoints

- `GET /api/spots` - List available surf spots
- `GET /api/conditions/:spotId` - Get conditions for a spot
- `GET /api/conditions?refresh=true` - Force fresh data
- `GET /api/health` - Server health check

## Adding More Data Sources

To add more scrapers:

1. Create parser in `backend/src/parsers/`
2. Add scraper function in `backend/src/services/scraper.js`
3. Update `fetchSurfData()` to include new scraper

Example sources to add:
- Surf-forecast.com
- Israeli Meteorological Service API
- GoSurf.co.il
- Surfline (limited to public data)

## Deployment (Optional)

**Frontend** (Vercel - Free):
```bash
cd frontend
npm run build
# Upload to Vercel or Netlify
```

**Backend** (Railway - Free):
```bash
# Connect GitHub repo to Railway
# Set environment variable: FRONTEND_URL=https://your-app.vercel.app
# Deploy automatically
```

## Troubleshooting

**Backend won't start:**
- Make sure Node.js 18+ is installed
- Check Claude CLI is working: `claude --version`
- Verify Bright Data MCP is connected: `claude mcp list`

**No data showing:**
- Check backend logs for scraping errors
- Test Bright Data manually: `claude --allowedTools "mcp__bright-data__scrape_as_markdown" --print -- "Scrape https://beachcam.co.il/en/forcast.html"`
- Verify BeachCam website is accessible

**Frontend not connecting to backend:**
- Check `.env` file has `REACT_APP_API_URL=http://localhost:5000/api`
- Verify backend is running on port 5000
- Check browser console for CORS errors

## License

MIT - See LICENSE file
