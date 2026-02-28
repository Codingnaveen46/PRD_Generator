-- 1. Create 'prds' table
CREATE TABLE public.prds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  filename text NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prds ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own PRDs
CREATE POLICY "Users can view their own prds" ON public.prds
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own PRDs
CREATE POLICY "Users can insert their own prds" ON public.prds
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 2. Create 'analysis_results' table
CREATE TABLE public.analysis_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prd_id uuid REFERENCES public.prds(id) ON DELETE CASCADE NOT NULL,
  standardized_prd text,
  quality_score integer,
  missing_requirements jsonb,
  qa_risk_insights jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own analysis results through the PRDs table
CREATE POLICY "Users can view their own analysis results" ON public.analysis_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.prds
      WHERE prds.id = analysis_results.prd_id
      AND prds.user_id = auth.uid()
    )
  );

-- Create Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('prd_documents', 'prd_documents', false);

-- Enable Storage RLS
-- Allow users to upload and view their own documents
CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'prd_documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read their own documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'prd_documents' AND auth.uid()::text = (storage.foldername(name))[1]);
