Fetch the daily monitoring report from the shouldigo.surf backend and summarize it.

Run this curl command to get the report (read ADMIN_SECRET from the environment or from Railway):
```
curl -s https://api.shouldigo.surf/api/marketing/daily-report -H "x-admin-secret: $ADMIN_SECRET"
```

If you get a 404 (no report yet), generate one first:
```
curl -s -X POST https://api.shouldigo.surf/api/marketing/daily-report/generate -H "x-admin-secret: $ADMIN_SECRET"
```

If ADMIN_SECRET is not set in the environment, check `railway variables` or ask the user.

Then present the results in this format:

**Alerts** (if any — show these first, prominently)

**GA4 Yesterday vs 7-Day Average**
- Sessions, Users, Pageviews, Bounce Rate — compare yesterday to the daily average

**Traffic Sources** — top sources with session counts

**Meta Ads** — campaign status, spend, impressions, clicks, CPC, CTR, reach

**Errors** — any JS errors detected

Keep it concise. Highlight anything unusual.
