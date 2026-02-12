# Surf Report 🏄‍♂️

Open source surf conditions aggregator for Israeli beaches (Herzliya & Netanya).

Scrapes multiple surf/weather sources using Bright Data MCP and calculates a surf quality score (0-100) with an actionable rating (EPIC/GOOD/FAIR/POOR/FLAT).

## Features

- **Smart Scoring**: Aggregates data from 6+ sources and calculates a weighted score based on:
  - Wave height (35%)
  - Wave period (20%)
  - Wind speed (20%)
  - Wind direction (15%)
  - Wave direction (10%)

- **Real-time Data**: Scrapes current conditions from:
  - BeachCam.co.il
  - Surf-forecast.com
  - Israeli Meteorological Service
  - Surfline
  - And more...

- **Spot-specific Optimization**: Different ideal conditions for Herzliya Marina vs Netanya Kontiki

- **Clean Dashboard**: React UI showing score, detailed conditions, and source status

## Tech Stack

- **Frontend**: React 18 + React Query + Axios
- **Backend**: Node.js + Express + Node-cache
- **Scraping**: Bright Data MCP (handles anti-bot, JavaScript rendering, CAPTCHA)
- **Hosting**: Free tier (Vercel + Railway/Render)

## Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- Bright Data MCP account ([get free tier](https://brightdata.com))
- Claude CLI with MCP configured

### Installation

```bash
# Clone repo
git clone https://github.com/YOUR_USERNAME/surf_report.git
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
# Backend environment variables
cd backend
cp .env.example .env

# Edit .env and add your Bright Data API key
# BRIGHT_DATA_API_KEY=your_key_here
```

### Running Locally

```bash
# Terminal 1: Start backend (port 5000)
cd backend
npm start

# Terminal 2: Start frontend (port 3000)
cd frontend
npm start

# Open http://localhost:3000
```

## API Endpoints

- `GET /api/spots` - List available surf spots
- `GET /api/conditions/:spotId` - Get current conditions and score
- `GET /api/conditions/all` - Get all spots with best recommendation
- `GET /api/health` - Check data source status

## Example Response

```json
{
  "spotId": "herzliya_marina",
  "score": {
    "overall": 78,
    "rating": "GOOD"
  },
  "conditions": {
    "waves": {
      "height": { "min": 1.0, "max": 1.5 },
      "period": 10,
      "direction": "W"
    },
    "wind": {
      "speed": 12,
      "direction": "E"
    }
  }
}
```

## Development

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed development guide.

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

Built with ❤️ for the Israeli surf community
