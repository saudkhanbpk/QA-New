-- Add overall_score column to test_runs table
ALTER TABLE public.test_runs ADD COLUMN IF NOT EXISTS overall_score integer;

-- Add comment explaining the score
COMMENT ON COLUMN public.test_runs.overall_score IS 'Overall quality score (0-100) calculated from all test results';
