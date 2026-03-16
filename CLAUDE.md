# CLAUDE.md

## Debugging

When debugging API integrations (email, GSC, etc.), always test the raw API endpoint directly first before debugging application code. Use curl or a minimal script to verify auth and connectivity.

## Tool Setup

Before installing or setting up unfamiliar tools, first confirm with the user: 1) the exact tool name and source, 2) the intended use case, 3) whether they want automatic installation or just instructions.

## Deployment & Security

For deployment and security tasks, verify each step explicitly — don't assume API keys are correctly configured. Print confirmation of env vars (redacted) before proceeding.

## DNS Safety — CRITICAL

**NEVER instruct the user to modify or delete existing production DNS records.** Changing A records or CNAMEs for `shouldigo.surf` or `api.shouldigo.surf` will break production immediately.

Safe approach for DNS migrations:
1. **Add new records first** — use a test subdomain (e.g., `gcp.shouldigo.surf`) to verify the new service works with a custom domain and SSL before touching production records.
2. **Verify SSL is working** on the test subdomain before any production DNS change.
3. **Only after full verification** on the test subdomain, provide instructions to swap production records — and explicitly warn that this is the production cutover moment.
4. **Keep old services running** for 24-48 hours after cutover for rollback.

Never combine "add" and "replace" instructions in the same block — make it crystal clear which records are safe to add and which would affect production.

## Security Checks

After any work involving secrets, credentials, API keys, env vars, deployment config, or .gitignore changes — proactively run a security audit. Check for: hardcoded secrets in source, sensitive files not in .gitignore, secrets in URL params, and npm vulnerabilities. Don't wait for the user to ask.

## Bias to Action

If something can be solved by editing code, do it — don't ask the user to manually configure env vars, infrastructure, or dashboards. Only defer to the user for secrets, credentials, or decisions that require their judgment. Default to doing the work yourself.
