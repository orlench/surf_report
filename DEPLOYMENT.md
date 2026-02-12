# Deployment Guide for shouldigo.surf

## Overview
This guide will help you deploy your Surf Report app to **shouldigo.surf**.

### Recommended Hosting Setup:
- **Frontend**: Vercel (free tier)
- **Backend API**: Railway or Render (free tier)
- **Domain**: shouldigo.surf → Vercel, api.shouldigo.surf → Railway/Render

---

## Step 1: Deploy Backend API

### Option A: Railway (Recommended)

1. **Sign up** at [railway.app](https://railway.app)

2. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

3. **Deploy from backend directory**:
   ```bash
   cd backend
   railway init
   railway up
   ```

4. **Set environment variables in Railway dashboard**:
   - `PORT=5000`
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://shouldigo.surf`

5. **Get your Railway URL** (e.g., `https://your-app.railway.app`)

6. **Add custom domain** in Railway dashboard: `api.shouldigo.surf`

### Option B: Render

1. **Sign up** at [render.com](https://render.com)

2. **Create New Web Service** → Connect your GitHub repo

3. **Configure**:
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && node src/server.js`
   - Environment Variables:
     - `PORT=5000`
     - `NODE_ENV=production`
     - `FRONTEND_URL=https://shouldigo.surf`

4. **Add custom domain**: `api.shouldigo.surf`

---

## Step 2: Deploy Frontend to Vercel

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy from project root**:
   ```bash
   vercel login
   cd surf_report
   vercel --prod
   ```

3. **During setup**:
   - Set root directory to: `frontend`
   - Build command: `npm run build`
   - Output directory: `build`

4. **Set environment variable in Vercel dashboard**:
   - `REACT_APP_API_URL=https://api.shouldigo.surf/api`

5. **Add custom domain** in Vercel dashboard:
   - Domain: `shouldigo.surf`
   - Also add: `www.shouldigo.surf` (optional)

---

## Step 3: Configure DNS for shouldigo.surf

In your domain registrar (where you bought shouldigo.surf):

### For main domain (shouldigo.surf):
**Type**: A or CNAME  
**Name**: `@` or leave blank  
**Value**: (Vercel will provide this - usually `76.76.21.21` for A record or `cname.vercel-dns.com` for CNAME)

### For API subdomain (api.shouldigo.surf):
**Type**: CNAME  
**Name**: `api`  
**Value**: (Railway/Render will provide this - e.g., `your-app.railway.app`)

### For www subdomain (optional):
**Type**: CNAME  
**Name**: `www`  
**Value**: `cname.vercel-dns.com`

---

## Step 4: Test Deployment

1. **Check backend**: Visit `https://api.shouldigo.surf/api/health`
   - Should return: `{"status": "ok", ...}`

2. **Check frontend**: Visit `https://shouldigo.surf`
   - Should load the app with real data

3. **Test spot switching**: Select different spots (Herzliya/Netanya)

4. **Test refresh**: Click refresh button to fetch new data

---

## Quick Commands

### Build frontend locally:
```bash
cd frontend
npm run build
```

### Test production build locally:
```bash
cd frontend
npx serve -s build
```

### Update backend:
```bash
cd backend
railway up  # or git push (if connected to Render/Railway via GitHub)
```

### Update frontend:
```bash
vercel --prod
```

---

## Troubleshooting

### CORS Errors:
- Make sure `FRONTEND_URL` is set correctly in backend environment variables
- Verify backend is running: `https://api.shouldigo.surf/api/health`

### "Failed to fetch" errors:
- Check `REACT_APP_API_URL` in Vercel environment variables
- Make sure it points to: `https://api.shouldigo.surf/api`
- Redeploy frontend after changing environment variables

### Domain not working:
- DNS propagation can take up to 24-48 hours (usually 10-30 minutes)
- Check DNS settings with: `nslookup shouldigo.surf`
- Verify SSL certificates are active in Vercel/Railway dashboards

---

## Cost Estimate

**Total: $0/month** (using free tiers)

- ✅ Vercel: Free (100GB bandwidth, unlimited builds)
- ✅ Railway: Free tier ($5 credit/month, ~500 hours)
- ✅ Domain: You already own shouldigo.surf

Both services auto-sleep when inactive on free tier, but wake up quickly when accessed.

---

## Next Steps After Deployment

1. **Set up monitoring**: Add uptime monitoring (e.g., UptimeRobot - free)
2. **Add analytics**: Google Analytics or Plausible (optional)
3. **GitHub Actions**: Auto-deploy on push to main branch
4. **Custom domain email**: Set up email@shouldigo.surf (optional)

---

## Support

- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs
