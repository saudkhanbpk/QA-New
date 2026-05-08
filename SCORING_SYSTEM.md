# QA Testing System - Scoring Algorithm

## Overview
The system calculates an **Overall Quality Score (0-100)** based on all test results across 7 categories. This score provides a single metric to assess the overall quality and production-readiness of a webpage.

---

## Category Weights

The score is weighted by category importance:

| Category | Weight | Rationale |
|----------|--------|-----------|
| **Performance** | 20% | Core Web Vitals directly impact user experience and SEO rankings |
| **Accessibility** | 18% | Legal compliance (ADA, WCAG) and inclusive user experience |
| **Security** | 17% | Data protection, user trust, and regulatory compliance |
| **SEO** | 15% | Discoverability and search engine rankings |
| **Functional** | 12% | Basic functionality and user interactions |
| **Responsive** | 10% | Mobile experience and layout adaptability |
| **Compatibility** | 8% | Cross-browser support (Chrome, Firefox, Safari) |
| **Visual** | 0% | Informational only - screenshots don't affect score |

**Total:** 100%

---

## Scoring Logic

### Per-Check Point System

Each test result receives points based on **status** and **severity**:

#### Pass (100 points)
- Full points awarded for passing checks

#### Warning (30-70 points)
- **Low severity:** 70 points
- **Medium severity:** 50 points
- **Critical severity:** 30 points

#### Fail (0-30 points)
- **Low severity:** 30 points
- **Medium severity:** 10 points
- **Critical severity:** 0 points

### Category Score Calculation

1. Sum all points for checks in the category
2. Calculate percentage: `(total_points / max_possible_points) × 100`
3. Apply category weight: `category_percentage × category_weight`

### Overall Score

Sum all weighted category scores and round to nearest integer (0-100).

---

## Score Interpretation

| Score Range | Grade | Meaning |
|-------------|-------|---------|
| **90-100** | Excellent | Production-ready, minimal issues |
| **70-89** | Good | Minor improvements recommended |
| **50-69** | Fair | Several issues need attention |
| **0-49** | Poor | Critical issues require immediate action |

---

## Example Calculation

### Scenario: E-commerce Website Test

**Performance (20% weight):**
- 8 checks total
- 6 pass (600 points), 1 warning-medium (50 points), 1 fail-low (30 points)
- Total: 680/800 = 85%
- Weighted: 85% × 20% = **17 points**

**Accessibility (18% weight):**
- 12 checks total
- 10 pass (1000 points), 2 fail-critical (0 points)
- Total: 1000/1200 = 83.3%
- Weighted: 83.3% × 18% = **15 points**

**Security (17% weight):**
- 7 checks total
- 7 pass (700 points)
- Total: 700/700 = 100%
- Weighted: 100% × 17% = **17 points**

**SEO (15% weight):**
- 9 checks total
- 7 pass (700 points), 2 warning-low (140 points)
- Total: 840/900 = 93.3%
- Weighted: 93.3% × 15% = **14 points**

**Functional (12% weight):**
- 5 checks total
- 5 pass (500 points)
- Total: 500/500 = 100%
- Weighted: 100% × 12% = **12 points**

**Responsive (10% weight):**
- 6 checks total
- 5 pass (500 points), 1 warning-medium (50 points)
- Total: 550/600 = 91.7%
- Weighted: 91.7% × 10% = **9.2 points**

**Compatibility (8% weight):**
- 6 checks total
- 6 pass (600 points)
- Total: 600/600 = 100%
- Weighted: 100% × 8% = **8 points**

### Final Score
17 + 15 + 17 + 14 + 12 + 9.2 + 8 = **92.2 → 92/100** ✅ **Excellent**

---

## Database Migration

Run this SQL in your Supabase SQL Editor to add the score column:

```sql
ALTER TABLE public.test_runs ADD COLUMN IF NOT EXISTS overall_score integer;
COMMENT ON COLUMN public.test_runs.overall_score IS 'Overall quality score (0-100) calculated from all test results';
```

Or use the migration file: `supabase/migration_add_score.sql`

---

## Display Locations

1. **Report Page:** Large score card with color-coded progress bar
2. **Dashboard:** Score badge next to each completed test run
3. **PDF Export:** Score prominently displayed on cover page

---

## Color Coding

- **Green (90-100):** Excellent quality
- **Yellow (70-89):** Good quality
- **Orange (50-69):** Fair quality
- **Red (0-49):** Poor quality

---

## Notes

- Visual checks (screenshots) are informational and don't affect the score
- Score is only calculated for completed test runs
- Failed test runs have no score (null)
- Score updates automatically when test completes
