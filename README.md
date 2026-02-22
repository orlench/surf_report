# Should I Go? 🏄‍♂️

**[shouldigo.surf](https://shouldigo.surf)** — Open source surf conditions aggregator for any beach in the world.

Scrapes multiple surf/weather sources using Bright Data MCP and calculates a surf quality score (0-100) with an actionable rating (EPIC/GOOD/FAIR/POOR/FLAT).

## Features

- **Smart Scoring**: Aggregates data from 7+ sources and calculates a weighted score based on wave height, wave period, swell quality, wind speed, wind direction, and wave direction

- **Global Coverage**: Works with any surf spot worldwide — pick from preset spots or discover new ones via the interactive map

- **Board Recommendations**: Suggests the right board type based on current conditions with personalized volume calculation (weight + skill level)

- **Surfer Feedback**: Local knowledge system — describe what matters at a break and the scoring adjusts to match (stored per-user in localStorage)

- **Trend Forecasts**: Shows whether conditions are improving or declining over the next 24 hours

- **Clean Dashboard**: Light, minimal React UI with a single question — *Should I go?*

## Tech Stack

- **Frontend**: React 19 + TanStack React Query + Axios (Vercel)
- **Backend**: Node.js + Express + node-cache (Railway)
- **Scraping**: Bright Data MCP (handles anti-bot, JavaScript rendering, CAPTCHA)
- **LLM**: Groq (Llama 3.1 8B) for interpreting surfer feedback into scoring weights

## Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- Bright Data MCP account ([get free tier](https://brightdata.com))

### Installation

```bash
git clone https://github.com/orlench/surf_report.git
cd surf_report

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Configuration

```bash
cd backend
cp .env.example .env
# Add your BRIGHT_DATA_API_KEY and GROQ_API_KEY
```

### Running Locally

```bash
# Terminal 1: Start backend (port 5001)
cd backend
npm start

# Terminal 2: Start frontend (port 3000)
cd frontend
npm start
```

## API Endpoints

- `GET /api/spots` — List available surf spots
- `GET /api/conditions/:spotId` — Get current conditions and score
- `GET /api/conditions/by-coords?lat=...&lon=...` — Get conditions for any coordinates
- `POST /api/spots/:spotId/feedback` — Submit local knowledge feedback
- `GET /api/spots/:spotId/feedback` — Get feedback for a spot
- `GET /api/health` — Check data source status

## License

MIT License — see [LICENSE](LICENSE) for details.

## Author

Built with ❤️ for surfers everywhere
