# CLAUDE.md

## Debugging

When debugging API integrations (email, GSC, etc.), always test the raw API endpoint directly first before debugging application code. Use curl or a minimal script to verify auth and connectivity.

## Tool Setup

Before installing or setting up unfamiliar tools, first confirm with the user: 1) the exact tool name and source, 2) the intended use case, 3) whether they want automatic installation or just instructions.

## Deployment & Security

For deployment and security tasks, verify each step explicitly — don't assume API keys are correctly configured. Print confirmation of env vars (redacted) before proceeding.
