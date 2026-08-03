-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  mobile TEXT,
  dob DATE,
  gender TEXT,
  city TEXT,
  state TEXT,
  education_level TEXT,
  
  -- Step 2
  tenth_marks TEXT,
  twelfth_marks TEXT,
  twelfth_stream TEXT,
  undergrad_college TEXT,
  undergrad_degree TEXT,
  undergrad_specialization TEXT,
  undergrad_cgpa TEXT,
  undergrad_grad_year TEXT,
  backlogs TEXT,
  research_papers TEXT,
  internships TEXT,
  extracurriculars TEXT,
  
  -- Step 3
  is_working_professional TEXT,
  company_name TEXT,
  industry TEXT,
  job_role TEXT,
  years_experience TEXT,
  current_ctc TEXT,
  career_gap TEXT,
  
  -- Step 4
  study_goal TEXT,
  target_countries JSONB,
  target_degree TEXT,
  target_field TEXT,
  intake_target TEXT,
  application_stage TEXT,
  
  -- Step 5
  gre_status TEXT,
  gre_score TEXT,
  gmat_status TEXT,
  gmat_score TEXT,
  ielts_status TEXT,
  ielts_score TEXT,
  toefl_status TEXT,
  toefl_score TEXT,
  gate_status TEXT,
  gate_score TEXT,
  cat_status TEXT,
  cat_score TEXT,
  neet_status TEXT,
  exam_next_date DATE,
  
  -- Step 6
  dream_universities JSONB,
  target_universities JSONB,
  safe_universities JSONB,
  preference_factors JSONB,
  university_research_stage TEXT,
  
  -- Step 7
  funding_source TEXT,
  expected_budget TEXT,
  loan_estimate TEXT,
  collateral_available TEXT,
  family_income TEXT,
  co_applicant TEXT,
  credit_score TEXT,
  
  -- Step 8
  doc_passport TEXT,
  doc_transcripts TEXT,
  doc_lors TEXT,
  doc_sop TEXT,
  doc_resume TEXT,
  doc_bank_statements TEXT,
  doc_visa TEXT,
  
  -- Step 9
  preferred_language TEXT,
  notification_preference TEXT,
  content_interest JSONB,
  hear_about_us TEXT,
  referral_code TEXT,
  
  -- Internal state
  is_onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Turn on RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
