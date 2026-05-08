# Free Deployment Guide for QA Testing System

## ⚠️ Important: Playwright Requirements

Your app uses **Playwright** with **Chromium, Firefox, and WebKit** browsers, which require:
- **2GB+ RAM** (browsers are memory-intensive)
- **System dependencies** (browser binaries)
- **Long-running processes** (tests can take 2-3 minutes)

Most free hosting platforms have limitations that make this challenging. Here are your best options:

---

## 🏆 RECOMMENDED: Railway (Best Free Option)

### Why Railway?
- ✅ **$5 free credit/month** (enough for moderate usage)
- ✅ **Supports Playwright** out of the box
- ✅ **No cold starts** (always warm)
- ✅ **2GB RAM** available
- ✅ **Long request timeouts** (10+ minutes)
- ✅ **Easy deployment** from GitHub
- ✅ **Built-in PostgreSQL** (or use Supabase)

### Deployment Steps:

#### 1. Prepare Your Repository
```bash
# Create .dockerignore
echo "node_modules
.next
.env.local
*.log" > .dockerignore
```

#### 2. Create `Dockerfile`
```dockerfile
FROM node:18-slim

# Install Playwright dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install Playwright browsers
RUN npx playwright install chromium firefox webkit

# Copy app files
COPY . .

# Build Next.js app
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### 3. Create `railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### 4. Deploy to Railway

1. **Sign up:** https://railway.app (use GitHub)
2. **New Project** → **Deploy from GitHub repo**
3. **Select your repository**
4. **Add environment variables:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   NODE_ENV=production
   ```
5. **Deploy!**

#### 5. Monitor Usage
- Railway gives **$5/month free**
- ~500MB RAM usage = ~$0.01/hour
- Monitor at: https://railway.app/dashboard

### Cost Estimate:
- **Light usage** (10 tests/day): ~$2-3/month ✅ FREE
- **Moderate usage** (50 tests/day): ~$5-8/month
- **Heavy usage** (200 tests/day): ~$15-20/month

---

## 🥈 ALTERNATIVE 1: Render (Free Tier with Limitations)

### Why Render?
- ✅ **Completely free** (750 hours/month)
- ✅ **Supports Docker**
- ✅ **Playwright compatible**
- ⚠️ **Cold starts** (spins down after 15 min inactivity)
- ⚠️ **512MB RAM** (may struggle with all 3 browsers)

### Deployment Steps:

#### 1. Create `render.yaml`
```yaml
services:
  - type: web
    name: qa-testing-system
    env: docker
    dockerfilePath: ./Dockerfile
    plan: free
    envVars:
      - key: NEXT_PUBLIC_SUPABASE_URL
        sync: false
      - key: NEXT_PUBLIC_SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: NODE_ENV
        value: production
```

#### 2. Use the same Dockerfile from Railway

#### 3. Deploy to Render

1. **Sign up:** https://render.com
2. **New** → **Blueprint**
3. **Connect GitHub repo**
4. **Add environment variables**
5. **Deploy**

### Limitations:
- ⚠️ **Cold starts** (first request takes 30-60s)
- ⚠️ **512MB RAM** (may need to disable some browsers)
- ⚠️ **Slower performance**

### Optimization for Render:
```typescript
// In app/api/test/run/route.ts
// Only use Chromium on free tier
if (checks.compatibility) {
  // Skip Firefox and WebKit on low-memory environments
  if (process.env.RENDER === 'true') {
    console.log('Skipping Firefox/WebKit on Render free tier');
  } else {
    // Run full cross-browser tests
  }
}
```

---

## 🥉 ALTERNATIVE 2: Fly.io (Good Free Tier)

### Why Fly.io?
- ✅ **Free tier:** 3 shared-cpu VMs, 256MB RAM each
- ✅ **Supports Docker**
- ✅ **No cold starts**
- ⚠️ **256MB RAM per VM** (need to scale up)

### Deployment Steps:

#### 1. Install Fly CLI
```bash
# macOS
brew install flyctl

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Linux
curl -L https://fly.io/install.sh | sh
```

#### 2. Login and Launch
```bash
cd qa-testing-system
fly auth login
fly launch
```

#### 3. Configure `fly.toml`
```toml
app = "qa-testing-system"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 1024  # Upgrade from 256MB
```

#### 4. Set Secrets
```bash
fly secrets set NEXT_PUBLIC_SUPABASE_URL="your_url"
fly secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY="your_key"
fly secrets set SUPABASE_SERVICE_ROLE_KEY="your_service_key"
```

#### 5. Deploy
```bash
fly deploy
```

### Cost:
- **Free tier:** 256MB RAM (not enough)
- **Paid:** 1GB RAM = ~$5-10/month

---

## 🗄️ Database: Supabase (Always Free)

### Why Supabase?
- ✅ **Completely free** (500MB database, 2GB bandwidth)
- ✅ **PostgreSQL** with built-in auth
- ✅ **Storage** for screenshots
- ✅ **No credit card required**

### Setup:

1. **Sign up:** https://supabase.com
2. **Create new project**
3. **Run migrations:**
   - Go to SQL Editor
   - Run `schema.sql`
   - Run `migration_add_categories.sql`
   - Run `migration_add_score.sql`
4. **Get credentials:**
   - Settings → API
   - Copy URL and keys

---

## 💰 Cost Comparison

| Platform | Free Tier | RAM | Cold Starts | Best For |
|----------|-----------|-----|-------------|----------|
| **Railway** | $5 credit/month | 2GB+ | ❌ No | **RECOMMENDED** |
| **Render** | 750 hrs/month | 512MB | ✅ Yes | Light usage |
| **Fly.io** | 3 VMs × 256MB | 256MB | ❌ No | Need upgrade |
| **Vercel** | ❌ Not suitable | N/A | N/A | No Playwright |
| **Netlify** | ❌ Not suitable | N/A | N/A | No Playwright |

---

## 🚀 RECOMMENDED SETUP (100% Free for Light Usage)

### Option A: Railway + Supabase
```
Railway (App): $5 credit/month → ~10-50 tests/day FREE
Supabase (DB): Free forever → 500MB storage
Total: FREE for moderate usage
```

### Option B: Render + Supabase (Truly Free)
```
Render (App): Free tier → Unlimited tests (with cold starts)
Supabase (DB): Free forever → 500MB storage
Total: 100% FREE (with limitations)
```

---

## 📋 Pre-Deployment Checklist

### 1. Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
NODE_ENV=production
```

### 2. Supabase Setup
- ✅ Run all migrations
- ✅ Create screenshots bucket (public)
- ✅ Enable RLS policies
- ✅ Test authentication

### 3. Test Locally with Docker
```bash
# Build Docker image
docker build -t qa-testing-system .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL="your_url" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="your_key" \
  -e SUPABASE_SERVICE_ROLE_KEY="your_service_key" \
  qa-testing-system

# Test at http://localhost:3000
```

### 4. Verify Playwright
```bash
# Inside container
docker exec -it <container_id> bash
npx playwright --version
npx playwright install --dry-run
```

---

## 🎯 My Recommendation

### For You: **Railway + Supabase**

**Why?**
1. ✅ **$5 free credit** covers moderate usage
2. ✅ **No cold starts** - instant tests
3. ✅ **2GB RAM** - runs all browsers smoothly
4. ✅ **Easy deployment** - push to GitHub
5. ✅ **Great DX** - simple dashboard
6. ✅ **Scales easily** if you need more

**Setup Time:** 15 minutes
**Monthly Cost:** $0-5 (depending on usage)
**Performance:** Excellent

---

## 🔧 Optimization Tips

### 1. Reduce Memory Usage
```typescript
// Only run compatibility tests on demand
if (checks.compatibility && process.env.ENABLE_CROSS_BROWSER === 'true') {
  // Run Firefox and WebKit
}
```

### 2. Cache Playwright Browsers
```dockerfile
# In Dockerfile, browsers are cached in image
RUN npx playwright install chromium firefox webkit
```

### 3. Limit Concurrent Tests
```typescript
// Add queue system for multiple users
// Use Redis or database-based queue
```

### 4. Optimize Lighthouse
```typescript
// Run Lighthouse only when needed
if (checks.performance) {
  // Lighthouse is memory-intensive
}
```

---

## 📞 Need Help?

### Railway Support
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway

### Render Support
- Docs: https://render.com/docs
- Community: https://community.render.com

### Supabase Support
- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com

---

## 🎉 Quick Start (Railway)

```bash
# 1. Push to GitHub
git add .
git commit -m "Ready for deployment"
git push origin main

# 2. Go to Railway
# https://railway.app

# 3. New Project → Deploy from GitHub

# 4. Add environment variables

# 5. Deploy!

# Done! Your app is live in ~5 minutes 🚀
```

---

## ⚡ Performance Expectations

### Railway (Recommended):
- First test: ~2-3 minutes
- Subsequent tests: ~2-3 minutes
- Cold start: None
- Concurrent users: 5-10

### Render (Free):
- First test after idle: ~3-4 minutes (cold start)
- Subsequent tests: ~2-3 minutes
- Cold start: 30-60 seconds
- Concurrent users: 2-3

### Fly.io (Upgraded):
- First test: ~2-3 minutes
- Subsequent tests: ~2-3 minutes
- Cold start: None
- Concurrent users: 3-5

---

## 🎯 Final Recommendation

**Start with Railway** - It's the best balance of:
- Free tier ($5 credit)
- Performance (no cold starts)
- Ease of use (GitHub integration)
- Playwright support (full compatibility)

If you exceed the free tier, you'll know your app is successful and the $5-10/month cost is justified! 🚀
