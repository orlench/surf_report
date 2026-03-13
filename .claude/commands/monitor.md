Fetch the daily monitoring report from the shouldigo.surf backend and summarize it.

Run this curl command to get the report:
```
curl -s https://shouldigo-surf-production.up.railway.app/api/marketing/daily-report -H "x-admin-secret: 68f7a67c5ac64a6c7341ba4433cb9cdd"
```

If you get a 404 (no report yet), generate one first:
```
curl -s -X POST https://shouldigo-surf-production.up.railway.app/api/marketing/daily-report/generate -H "x-admin-secret: 68f7a67c5ac64a6c7341ba4433cb9cdd"
```

Then present the results in this format:

**Alerts** (if any — show these first, prominently)

**GA4 Yesterday vs 7-Day Average**
- Sessions, Users, Pageviews, Bounce Rate — compare yesterday to the daily average

**Traffic Sources** — top sources with session counts

**Meta Ads** — campaign status, spend, impressions, clicks, CPC, CTR, reach

**Errors** — any JS errors detected

Keep it concise. Highlight anything unusual.
