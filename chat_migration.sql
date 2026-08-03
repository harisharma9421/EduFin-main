-- 1. Create chat_sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    expert_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    -- Ensure a student can only have one active/pending session with an expert at a time
    UNIQUE(student_id, expert_id)
);

-- 2. Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    document_url TEXT,
    document_name TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create chat_attachments bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat_attachments', 'chat_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for chat_sessions
-- Users can view their own sessions
CREATE POLICY "Users can view their own chat sessions"
ON public.chat_sessions FOR SELECT
USING (auth.uid() = student_id OR auth.uid() = expert_id);

-- Students can insert new pending sessions
CREATE POLICY "Students can create chat sessions"
ON public.chat_sessions FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- Experts can update session status (accept/reject)
CREATE POLICY "Participants can update chat sessions"
ON public.chat_sessions FOR UPDATE
USING (auth.uid() = expert_id OR auth.uid() = student_id);

-- 6. RLS Policies for chat_messages
-- Participants can view messages in their sessions
CREATE POLICY "Participants can view messages"
ON public.chat_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.chat_sessions s 
        WHERE s.id = session_id 
        AND (s.student_id = auth.uid() OR s.expert_id = auth.uid())
    )
);

-- Participants can insert messages into their sessions
CREATE POLICY "Participants can insert messages"
ON public.chat_messages FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_sessions s 
        WHERE s.id = session_id 
        AND (s.student_id = auth.uid() OR s.expert_id = auth.uid())
        AND s.status = 'active'
    )
    AND auth.uid() = sender_id
);

-- Allow updates (e.g. marking as read)
CREATE POLICY "Participants can update messages"
ON public.chat_messages FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.chat_sessions s 
        WHERE s.id = session_id 
        AND (s.student_id = auth.uid() OR s.expert_id = auth.uid())
    )
);

-- 7. Storage Policies for chat_attachments
-- Allow authenticated users to upload to chat_attachments
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'chat_attachments' 
    AND auth.role() = 'authenticated'
);

-- Allow public read access to chat attachments (since it's a public bucket)
CREATE POLICY "Public can view chat attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat_attachments');
