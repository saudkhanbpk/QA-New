# 🚀 Quick Deploy Guide (5 Minutes)

## Option 1: Railway (RECOMMENDED - Best Free Option)

### Step 1: Prepare Supabase (2 minutes)

1. Go to https://supabase.com and sign up
2. Create a new project
3. Go to **SQL Editor** and run these migrations in order:
   ```sql
   -- Copy and paste from: supabase/schema.sql
   -- Then: supabase/migration_add_categories.sql
   -- Then: supabase/migration_add_score.sql
   ```
4. Go to **Settings → API** and copy:
   - Project URL
   - `anon` `public` key
   - `service_role` `secret` key

### Step 2: Deploy to Railway (3 minutes)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Go to Railway:**
   - Visit: https://railway.app
   - Click "Start a New Project"
   - Click "Deploy from GitHub repo"
   - Select your repository
   - Click "Deploy Now"

3. **Add Environment Variables:**
   - Click on your service
   - Go to "Variables" tab
   - Add these variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL = your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY = your_anon_key
     SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
     NODE_ENV = production
     ```

4. **Wait for deployment** (~5 minutes)

5. **Get your URL:**
   - Click "Settings" → "Generate Domain"
   - Your app is live! 🎉

### Step 3: Test Your Deployment

1. Visit your Railway URL
2. Register a new account
3. Create a test with URL: `https://example.com`
4. Wait 2-3 minutes for results
5. Check all tabs work correctly

---

## Option 2: Render (100% Free with Cold Starts)

### Step 1: Same Supabase setup as above

### Step 2: Deploy to Render

1. **Push to GitHub** (if not already done)

2. **Go to Render:**
   - Visit: https://render.com
   - Click "New +"
   - Select "Blueprint"
   - Connect your GitHub repository
   - Render will detect `render.yaml`

3. **Add Environment Variables:**
   - During setup, add:
     ```
     NEXT_PUBLIC_SUPABASE_URL = your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY = your_anon_key
     SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
     ```

4. **Deploy** (first deploy takes ~10 minutes)

5. **Your app is live!** 🎉

### Note about Render Free Tier:
- ⚠️ App sleeps after 15 minutes of inactivity
- ⚠️ First request after sleep takes 30-60 seconds
- ✅ Completely free forever
- ✅ 750 hours/month (enough for moderate usage)

---

## 🔍 Troubleshooting

### Deployment fails with "Out of memory"
**Solution:** Use Railway instead of Render, or disable cross-browser testing:
```typescript
// In .env
ENABLE_CROSS_BROWSER=false
```

### "Playwright browsers not found"
**Solution:** Make sure Dockerfile includes:
```dockerfile
RUN npx playwright install chromium firefox webkit
```

### Tests timeout or fail
**Solution:** Check environment variables are set correctly in Railway/Render dashboard

### Can't login/register
**Solution:** 
1. Check Supabase URL and keys are correct
2. Verify RLS policies are enabled in Supabase
3. Check Supabase logs for errors

---

## 📊 What You Get

### Railway Free Tier:
- **$5 credit/month**
- **~10-50 tests/day** (depending on complexity)
- **No cold starts**
- **2GB RAM**
- **Fast performance**

### Render Free Tier:
- **Unlimited tests**
- **750 hours/month**
- **Cold starts** (30-60s after idle)
- **512MB RAM**
- **Slower performance**

### Supabase Free Tier:
- **500MB database**
- **2GB bandwidth/month**
- **1GB file storage**
- **Unlimited API requests**

---

## 💡 Pro Tips

### 1. Monitor Railway Usage
- Dashboard: https://railway.app/dashboard
- Check usage daily
- $5 credit = ~500 hours of uptime

### 2. Optimize for Free Tier
```typescript
// Disable heavy checks on free tier
if (process.env.RAILWAY_ENVIRONMENT === 'production') {
  // Run all checks
} else {
  // Skip Lighthouse on Render free tier
}
```

### 3. Keep Render Awake
Use a free uptime monitor:
- https://uptimerobot.com (free)
- Ping your app every 5 minutes
- Prevents cold starts

### 4. Backup Your Data
```bash
# Export Supabase data regularly
# Dashboard → Database → Backups
```

---

## 🎯 Success Checklist

After deployment, verify:

- [ ] App loads at your Railway/Render URL
- [ ] Can register a new account
- [ ] Can login successfully
- [ ] Can create a new test
- [ ] Test completes in 2-3 minutes
- [ ] All 8 tabs show results:
  - [ ] Responsive
  - [ ] Functional
  - [ ] Accessibility
  - [ ] Performance
  - [ ] Security
  - [ ] SEO
  - [ ] Cross-Browser
  - [ ] Visual
- [ ] Overall score is displayed
- [ ] PDF export works
- [ ] Dashboard shows test history

---

## 🆘 Need Help?

### Railway Issues:
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway
- Status: https://status.railway.app

### Render Issues:
- Docs: https://render.com/docs
- Community: https://community.render.com
- Status: https://status.render.com

### Supabase Issues:
- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com
- Status: https://status.supabase.com

---

## 🎉 You're Done!

Your QA Testing System is now live and ready to use!

**Share your deployment:**
- Tweet about it
- Add to your portfolio
- Share with your team

**Next steps:**
- Test with real websites
- Monitor usage and costs
- Optimize based on feedback
- Scale up if needed

Congratulations! 🚀
