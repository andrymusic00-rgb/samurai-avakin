-- Migration 005: Public Content System (Anonymous + Authenticated)
-- Tabella unificata per foto, video, eventi caricati dagli utenti

CREATE TABLE IF NOT EXISTS public_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('photo', 'video', 'event')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration VARCHAR(20),           -- '12:34' solo per video
    category VARCHAR(50) NOT NULL,  -- 'raid', 'guida', 'evento', 'clan-life', 'creativo'
    tags TEXT[] DEFAULT '{}',
    author_name VARCHAR(100) NOT NULL DEFAULT 'Anonimo',
    author_ip_hash VARCHAR(64) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    likes_count INT DEFAULT 0,
    views_count INT DEFAULT 0,
    event_date TIMESTAMPTZ,         -- Solo per type='event'
    event_location VARCHAR(200),    -- Solo per type='event'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_pc_type_status_created 
    ON public_content(type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pc_user_id 
    ON public_content(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pc_ip_hash 
    ON public_content(author_ip_hash);
CREATE INDEX IF NOT EXISTS idx_pc_category 
    ON public_content(category) WHERE status = 'approved';

-- Tabella media aggiuntivi (per post misti/gallery multiple)
CREATE TABLE IF NOT EXISTS public_content_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public_content(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('photo', 'video')),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pcm_content ON public_content_media(content_id);

-- Tabella like (per utenti autenticati)
CREATE TABLE IF NOT EXISTS public_content_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public_content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pcl_content ON public_content_likes(content_id);
CREATE INDEX IF NOT EXISTS idx_pcl_user ON public_content_likes(user_id);

-- Tabella commenti
CREATE TABLE IF NOT EXISTS public_content_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public_content(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    author_name VARCHAR(100),       -- Per commenti anonimi
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pcc_content ON public_content_comments(content_id);

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_public_content_updated_at ON public_content;
CREATE TRIGGER update_public_content_updated_at
    BEFORE UPDATE ON public_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View per statistiche dashboard
CREATE OR REPLACE VIEW public_content_stats AS
SELECT 
    type,
    status,
    COUNT(*) as count,
    SUM(views_count) as total_views,
    SUM(likes_count) as total_likes
FROM public_content
GROUP BY type, status;