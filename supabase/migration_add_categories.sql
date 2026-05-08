-- Run this in your Supabase SQL Editor
ALTER TABLE public.test_results DROP CONSTRAINT IF EXISTS test_results_category_check;
ALTER TABLE public.test_results ADD CONSTRAINT test_results_category_check
  CHECK (category IN ('responsive','functional','accessibility','visual','performance','security','seo','compatibility'));
