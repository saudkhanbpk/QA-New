# Troubleshooting Guide

## Cross-Browser Testing Shows "Skipped"

If the Cross-Browser (Compatibility) tab shows "No cross-browser checks were run", follow these steps:

### 1. Check Database Migration

The `compatibility` category must be added to the database constraint.

**Run this SQL in your Supabase SQL Editor:**

```sql
ALTER TABLE public.test_results DROP CONSTRAINT IF EXISTS test_results_category_check;
ALTER TABLE public.test_results ADD CONSTRAINT test_results_category_check
  CHECK (category IN ('responsive','functional','accessibility','visual','performance','security','seo','compatibility'));
```

Or use the migration file: `supabase/migration_add_categories.sql`

### 2. Verify Checkbox is Enabled

When creating a new test at `/test/new`:
- Ensure "Cross-Browser Testing" checkbox is **checked**
- It should be enabled by default

### 3. Check Server Logs

Look for these console messages in your server logs:

```
Starting cross-browser compatibility testing...
Cross-browser testing complete: X checks, Y fails, Z warnings
```

If you don't see these messages:
- The checkbox might not be checked
- There might be an error in the viewport testing that prevents reaching compatibility tests

### 4. Check for Playwright Installation

Cross-browser testing requires Playwright browsers to be installed:

```bash
cd qa-testing-system
npx playwright install chromium firefox webkit
```

### 5. Verify Test Results

After running a test, check the database:

```sql
SELECT category, check_name, status 
FROM test_results 
WHERE test_run_id = 'YOUR_TEST_RUN_ID'
AND category = 'compatibility';
```

If no rows are returned, the compatibility tests didn't run.

---

## Overall Score Shows Null

If the overall score is not displaying:

### 1. Run Score Migration

```sql
ALTER TABLE public.test_runs ADD COLUMN IF NOT EXISTS overall_score integer;
```

Or use: `supabase/migration_add_score.sql`

### 2. Re-run Tests

The score is only calculated for NEW test runs after the migration. Old test runs will have `overall_score = null`.

---

## Lighthouse Scores Don't Match PageSpeed Insights

### Expected Variance

Scores can differ by 5-10 points due to:
- Network conditions
- Server response time variability
- Cache state
- Geographic location

### Configuration

Our Lighthouse config matches PageSpeed Insights:
- Mobile viewport (412x823px)
- 4G throttling (40ms RTT, 10Mbps, 4x CPU)
- Same scoring thresholds

### Verify Configuration

Check `app/api/test/run/route.ts` around line 180 for:

```typescript
formFactor: "mobile",
throttling: {
  rttMs: 40,
  throughputKbps: 10 * 1024,
  cpuSlowdownMultiplier: 4,
  // ...
},
```

---

## Test Fails with "Browser Launch" Error

### Windows Users

Playwright may need additional setup on Windows:

```bash
# Install browsers with dependencies
npx playwright install --with-deps chromium firefox webkit
```

### Linux/Docker Users

Install system dependencies:

```bash
npx playwright install-deps
npx playwright install
```

### Memory Issues

Cross-browser testing launches multiple browsers. Ensure your server has:
- At least 2GB RAM available
- Sufficient disk space for browser binaries

---

## Accessibility Scan Fails with "could not complete"

If accessibility testing shows "Accessibility scan could not complete":

### Common Causes

1. **Page takes too long to load**
   - Axe-core has a 30-second timeout
   - Check if the page loads within 30 seconds

2. **Page has JavaScript errors**
   - Axe-core requires a stable DOM
   - Check the Functional tab for JavaScript errors

3. **Page requires authentication**
   - Axe-core can't scan pages behind login
   - Test publicly accessible pages

4. **Page uses iframes**
   - Complex iframe structures can cause issues
   - Check server console for specific error messages

### Solutions

**Check server console logs:**
```
axe-core error details: [specific error message]
```

**Verify @axe-core/playwright is installed:**
```bash
npm list @axe-core/playwright
```

**Reinstall if needed:**
```bash
npm install @axe-core/playwright@latest
```

**Test with a simple page first:**
- Try testing `https://example.com`
- If that works, the issue is with your specific page

### Workaround

If accessibility scanning consistently fails:
1. Uncheck "Accessibility (axe-core)" when creating tests
2. Use other checks (Responsive, Functional, Performance, etc.)
3. Run accessibility tests separately using browser extensions like axe DevTools

---

## Database Insert Errors

If you see errors like:

```
Failed to insert results: new row violates check constraint
```

### Solution

Run ALL migrations in order:

1. **Categories migration** (adds compatibility):
   ```sql
   -- From migration_add_categories.sql
   ALTER TABLE public.test_results DROP CONSTRAINT IF EXISTS test_results_category_check;
   ALTER TABLE public.test_results ADD CONSTRAINT test_results_category_check
     CHECK (category IN ('responsive','functional','accessibility','visual','performance','security','seo','compatibility'));
   ```

2. **Score migration** (adds overall_score):
   ```sql
   -- From migration_add_score.sql
   ALTER TABLE public.test_runs ADD COLUMN IF NOT EXISTS overall_score integer;
   ```

---

## Screenshots Not Displaying

### Check Storage Bucket

Ensure the `screenshots` bucket exists in Supabase Storage:

1. Go to Supabase Dashboard → Storage
2. Verify `screenshots` bucket exists
3. Check bucket is set to **Public**

### Check RLS Policies

```sql
-- Allow public read access
CREATE POLICY "Anyone can view screenshots"
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'screenshots');

-- Allow authenticated uploads
CREATE POLICY "Authenticated users can upload screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'screenshots' AND auth.role() = 'authenticated');
```

---

## Performance Tips

### Reduce Test Time

- Test fewer viewports (e.g., only mobile and desktop)
- Disable visual screenshots if not needed
- Run compatibility testing separately from other checks

### Optimize for Production

- Use a dedicated server with sufficient resources
- Consider running tests in a queue system
- Cache Playwright browser binaries

---

## Debug Mode

To enable detailed logging, check your server console for:

```
Starting cross-browser compatibility testing...
Chromium baseline error: ...
Firefox test error: ...
WebKit test error: ...
Cross-browser testing complete: ...
```

These logs will help identify where the process is failing.

---

## Still Having Issues?

1. Check the server console for error messages
2. Verify all migrations have been run
3. Ensure Playwright browsers are installed
4. Check that the URL being tested is publicly accessible
5. Try testing a simple URL like `https://example.com` first
