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

Also fetch Meta Ads country breakdown to check audience distribution:
```
curl -s "https://graph.facebook.com/v25.0/120242229788240189/insights?fields=spend,impressions,clicks,reach&breakdowns=country&date_preset=last_7d&access_token=$META_ACCESS_TOKEN"
```

Then present the results in this format:

**Alerts** (if any — show these first, prominently)

**GA4 Yesterday vs 7-Day Average**
- Sessions, Users, Pageviews, Bounce Rate — compare yesterday to the daily average

**Traffic Sources** — top sources with session counts

**Meta Ads** — campaign status, spend, impressions, clicks, CPC, CTR, reach

**Meta Ads Country Distribution** — show which countries are getting impressions/clicks. Flag if spend is concentrated in <3 countries (Meta may be optimizing for cheap clicks instead of distributing).

**Spot Distribution** — if page data is available, check which spots users are viewing. Flag if >80% of traffic goes to the homepage without loading a spot (suggests high bounce rate or geo-detection issues). Flag if only 1-2 spots are being viewed (suggests narrow audience or ad targeting issue).

**Errors** — any JS errors detected. Investigate each:
  - If the error is from our code, fix it immediately
  - If it's external (cross-origin "Script error.", browser extensions, WebView bridges), note it as external and skip
  - Flag any error with count > 3 as needing attention regardless of source

**Checklist — things to verify every time:**
- [ ] Is the Meta campaign ACTIVE with effective_status ACTIVE?
- [ ] Is spend distributed across multiple countries, not just cheapest markets?
- [ ] Are sessions trending up, down, or flat vs 7-day average?
- [ ] Are there any new JS errors that weren't in the previous report?
- [ ] Is traffic from paid sources (instagram/paid) actually converting to spot views?
- [ ] Are page titles showing diverse spots, or is traffic stuck on 1-2 spots?

Keep it concise. Highlight anything unusual. If you find issues, fix them proactively — don't wait for the user to ask.
