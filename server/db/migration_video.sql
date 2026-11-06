-- Video tables migration
-- Run this on the database to add video support

-- Tabella principale video
CREATE TABLE IF NOT EXISTS videos (
    id VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titolo VARCHAR(200) NOT NULL,
    descrizione TEXT,
    categoria VARCHAR(50) DEFAULT 'video',
    tags TEXT[] DEFAULT '{}',
    visibilita VARCHAR(20) DEFAULT 'public' CHECK (visibilita IN ('public', 'private', 'unlisted')),
    media_url VARCHAR(500),
    file_name VARCHAR(255),
    file_size BIGINT DEFAULT 0,
    mime_type VARCHAR(100),
    durata INTEGER DEFAULT 0,
    thumbnail_url VARCHAR(500),
    synced BOOLEAN DEFAULT false,
    server_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_categoria ON videos(categoria);
CREATE INDEX IF NOT EXISTS idx_videos_visibilita ON videos(visibilita);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_synced ON videos(synced);

-- Chunk per upload chunked
CREATE TABLE IF NOT EXISTS video_chunks (
    id BIGSERIAL PRIMARY KEY,
    video_id VARCHAR(64) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    size BIGINT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (video_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_video_chunks_video ON video_chunks(video_id);

-- Reazioni video
CREATE TABLE IF NOT EXISTS video_reactions (
    video_id VARCHAR(64) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (video_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_video_reactions_video ON video_reactions(video_id);
CREATE INDEX IF NOT EXISTS idx_video_reactions_user ON video_reactions(user_id);

-- Commenti video
CREATE TABLE IF NOT EXISTS video_comments (
    id BIGSERIAL PRIMARY KEY,
    video_id VARCHAR(64) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    corpo TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_comments_video ON video_comments(video_id);
CREATE INDEX IF NOT EXISTS idx_video_comments_user ON video_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_video_comments_created ON video_comments(created_at ASC);

-- Aggiungi colonna commenti_count a videos se non esiste
ALTER TABLE videos ADD COLUMN IF NOT EXISTS commenti_count INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS upload_progress INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS upload_error TEXT;