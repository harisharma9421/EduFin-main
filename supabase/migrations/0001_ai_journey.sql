-- Create journey_progress table
CREATE TABLE IF NOT EXISTS public.journey_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1,
  selected_country TEXT,
  selected_university TEXT,
  journey_data JSONB DEFAULT '{}'::jsonb,
  completed_steps INTEGER[] DEFAULT '{}',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id)
);

-- Create universities table for Step 3 dataset
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  ranking INTEGER,
  tuition_fee NUMERIC,
  living_cost NUMERIC,
  roi_score NUMERIC,
  job_market_score NUMERIC,
  acceptance_rate NUMERIC,
  courses JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Turn on RLS
ALTER TABLE public.journey_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own journey progress
CREATE POLICY "Users can view own journey progress" 
ON public.journey_progress FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to update their own journey progress
CREATE POLICY "Users can update own journey progress" 
ON public.journey_progress FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow users to insert their own journey progress
CREATE POLICY "Users can insert own journey progress" 
ON public.journey_progress FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow anyone to view universities (read-only dataset)
CREATE POLICY "Anyone can view universities" 
ON public.universities FOR SELECT 
USING (true);
