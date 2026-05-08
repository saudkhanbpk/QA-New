# Setup Checklist for Cross-Browser Testing & Scoring

Follow these steps to enable all features:

## ✅ Step 1: Install Playwright Browsers

```bash
cd qa-testing-system
npx playwright install chromium firefox webkit
```

**Windows users may need:**
```bash
npx playwright install --with-deps chromium firefox webkit
```

---

## ✅ Step 2: Run Database Migrations

Open your **Supabase SQL Editor** and run these migrations:

### Migration 1: Add Compatibility Category

```sql
ALTER TABLE public.test_results DROP CONSTRAINT IF EXISTS test_results_category_check;
ALTER TABLE public.test_results ADD CONSTRAINT test_results_category_check
  CHECK (category IN ('responsive','functional','accessibility','visual','performance','security','seo','compatibility'));
```

### Migration 2: Add Overall Score Column

```sql
ALTER TABLE public.test_runs ADD COLUMN IF NOT EXISTS overall_score integer;
COMMENT ON COLUMN public.test_runs.overall_score IS 'Overall quality score (0-100) calculated from all test results';
```

**Or use the migration files:**
- `supabase/migration_add_categories.sql`
- `supabase/migration_add_score.sql`

---

## ✅ Step 3: Verify Supabase Storage

1. Go to **Supabase Dashboard → Storage**
2. Ensure `screenshots` bucket exists
3. Verify bucket is set to **Public**

If the bucket doesn't exist, run this SQL:

```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('screenshots', 'screenshots', true)
ON CONFLICT DO NOTHING;
```

---

## ✅ Step 4: Test the System

1. Go to `/test/new`
2. Enter a test URL (e.g., `https://example.com`)
3. Ensure all checkboxes are checked (especially "Cross-Browser Testing")
4. Click "Start Test"
5. Wait for completion (may take 2-3 minutes)

---

## ✅ Step 5: Verify Results

After the test completes, check:

### In the Report Page:
- [ ] Overall Quality Score is displayed (0-100)
- [ ] 8 tabs are visible: Responsive, Functional, Accessibility, Performance, Security, SEO, Cross-Browser, Visual
- [ ] Cross-Browser tab shows results for Chrome, Firefox, and Safari
- [ ] PDF export includes the score

### In the Dashboard:
- [ ] Test run shows the score badge
- [ ] Score is color-coded (green/yellow/orange/red)

---

## 🔍 Troubleshooting

If something doesn't work:

1. **Check server console** for error messages
2. **Verify migrations** were run successfully
3. **Check Playwright installation**:
   ```bash
   npx playwright --version
   ```
4. **Review logs** for "Starting cross-browser compatibility testing..."

See `TROUBLESHOOTING.md` for detailed solutions.

---

## 📊 What You Should See

### Cross-Browser Tab Results:
- ✅ Firefox Compatibility
- ✅ Firefox JavaScript Errors
- ✅ Firefox Layout Consistency
- ✅ Safari (WebKit) Compatibility
- ✅ Safari JavaScript Errors
- ✅ Safari Layout Consistency
- ✅ Safari CSS Compatibility
- ✅ Cross-Browser Summary

### Overall Score Breakdown:
- Performance: 20%
- Accessibility: 18%
- Security: 17%
- SEO: 15%
- Functional: 12%
- Responsive: 10%
- Compatibility: 8%

---

## 🎯 Quick Test Command

To verify everything is working:

```bash
# Check Playwright
npx playwright --version

# Check browsers are installed
npx playwright install --dry-run chromium firefox webkit
```

---

## ✨ You're All Set!

Once all steps are complete, you'll have:
- ✅ Cross-browser testing on Chrome, Firefox, and Safari
- ✅ Overall quality score (0-100)
- ✅ Weighted scoring across 7 categories
- ✅ Professional PDF reports with scores
- ✅ Dashboard with score badges
