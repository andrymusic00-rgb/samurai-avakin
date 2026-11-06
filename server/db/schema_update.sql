-- Samurai di Avakin — AGGIORNAMENTO SCHEMA per nuove funzionalità
-- Eseguire DOPO schema.sql principale
-- Idempotente: controlla esistenza prima di creare

-- ============================================
-- TABELLE CMS
-- ============================================

-- Pagine CMS (Hero, Notizie, Gallery, Video, FAQ)
CREATE TABLE IF NOT EXISTS cms_pages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text        NOT NULL UNIQUE,  -- 'hero', 'news', 'gallery', 'videos', 'faq'
  title      text        NOT NULL DEFAULT '',
  subtitle   text        NOT NULL DEFAULT '',
  content    jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- contenuto flessibile
  is_active  boolean     NOT NULL DEFAULT true,
  order_idx  integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS cms_pages_key_idx ON cms_pages (key);
CREATE INDEX IF NOT EXISTS cms_pages_active_idx ON cms_pages (is_active, order_idx);

-- Articoli / Notizie
CREATE TABLE IF NOT EXISTS cms_articles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL,
  slug       text        NOT NULL UNIQUE,
  summary    text        NOT NULL DEFAULT '',
  content    text        NOT NULL DEFAULT '',
  thumbnail  text        NOT NULL DEFAULT '',  -- URL immagine
  category   text        NOT NULL DEFAULT 'news',
  tags       text[]      NOT NULL DEFAULT '{}',
  is_published boolean  NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS cms_articles_slug_idx ON cms_articles (slug);
CREATE INDEX IF NOT EXISTS cms_articles_published_idx ON cms_articles (is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS cms_articles_category_idx ON cms_articles (category, published_at DESC);
CREATE INDEX IF NOT EXISTS cms_articles_tags_idx ON cms_articles USING GIN(tags);

-- Galleria immagini
CREATE TABLE IF NOT EXISTS cms_gallery (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL DEFAULT '',
  description text        NOT NULL DEFAULT '',
  image_url  text        NOT NULL,
  thumbnail_url text     NOT NULL DEFAULT '',
  category   text        NOT NULL DEFAULT 'general',
  is_active  boolean     NOT NULL DEFAULT true,
  order_idx  integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS cms_gallery_category_idx ON cms_gallery (category, order_idx);
CREATE INDEX IF NOT EXISTS cms_gallery_active_idx ON cms_gallery (is_active, order_idx);

-- Video
CREATE TABLE IF NOT EXISTS cms_videos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  video_url  text        NOT NULL,
  thumbnail_url text     NOT NULL DEFAULT '',
  duration   integer     NOT NULL DEFAULT 0,  -- secondi
  category   text        NOT NULL DEFAULT 'general',
  is_active  boolean     NOT NULL DEFAULT true,
  order_idx  integer     NOT NULL DEFAULT 0,
  views      integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS cms_videos_category_idx ON cms_videos (category, order_idx);

-- FAQ
CREATE TABLE IF NOT EXISTS cms_faq (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text        NOT NULL,
  answer     text        NOT NULL,
  category   text        NOT NULL DEFAULT 'general',
  is_active  boolean     NOT NULL DEFAULT true,
  order_idx  integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS cms_faq_category_idx ON cms_faq (category, order_idx);

-- ============================================
-- TABELLE CHAT
-- ============================================

-- Canali chat (generale, eventi, raid, ecc.)
CREATE TABLE IF NOT EXISTS chat_channels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  description text        NOT NULL DEFAULT '',
  is_public  boolean     NOT NULL DEFAULT true,
  is_archived boolean    NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Messaggi chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid        NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       text        NOT NULL,
  attachments jsonb      NOT NULL DEFAULT '{}'::jsonb,  -- array di URL immagini/file
  is_edited  boolean     NOT NULL DEFAULT false,
  edited_at  timestamptz,
  is_pinned  boolean     NOT NULL DEFAULT false,
  pinned_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  pinned_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_channel_idx ON chat_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON chat_messages (user_id, created_at DESC);

-- Mute/Ban utenti nei canali
CREATE TABLE IF NOT EXISTS chat_moderation (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid        NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     text        NOT NULL CHECK (action IN ('mute', 'ban', 'warn')),
  reason     text        NOT NULL DEFAULT '',
  moderator_id uuid      NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_moderation_active_idx ON chat_moderation (channel_id, user_id, action) 
  WHERE (expires_at IS NULL OR expires_at > now());

-- ============================================
-- TABELLE NOTIFICHE PUSH
-- ============================================

-- Subscription Push API (Web Push)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL UNIQUE,
  auth       text        NOT NULL,
  p256dh     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions (endpoint);

-- Notifiche push inviate
CREATE TABLE IF NOT EXISTS push_notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES users(id) ON DELETE SET NULL,
  title      text        NOT NULL,
  body       text        NOT NULL,
  data       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  url        text        NOT NULL DEFAULT '',
  sent_at    timestamptz NOT NULL DEFAULT now(),
  delivered  boolean     NOT NULL DEFAULT false,
  error      text        NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS push_notifications_user_idx ON push_notifications (user_id, sent_at DESC);

-- ============================================
-- TABELLE MULTILINGUA
-- ============================================

-- Traduzioni
CREATE TABLE IF NOT EXISTS translations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text        NOT NULL,  -- chiave di traduzione (es: 'welcome.title')
  lang       text        NOT NULL,  -- 'it', 'en', 'es'
  value      text        NOT NULL,
  UNIQUE (key, lang)
);

CREATE INDEX IF NOT EXISTS translations_key_idx ON translations (key);
CREATE INDEX IF NOT EXISTS translations_lang_idx ON translations (lang);

-- Preferenze lingua utenti
ALTER TABLE user_prefs ADD COLUMN IF NOT EXISTS language text DEFAULT 'it';

-- ============================================
-- TABELLE TESTING
-- ============================================

-- Test eseguiti
CREATE TABLE IF NOT EXISTS test_runs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite      text        NOT NULL,  -- 'unit', 'integration', 'e2e'
  name       text        NOT NULL,
  status     text        NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'pending')),
  duration_ms integer    NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text     NOT NULL DEFAULT '',
  error_stack text       NOT NULL DEFAULT '',
  metadata jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS test_runs_suite_idx ON test_runs (suite, status, completed_at DESC);
CREATE INDEX IF NOT EXISTS test_runs_name_idx ON test_runs (name, completed_at DESC);

-- Test API (per test automatici delle route)
CREATE TABLE IF NOT EXISTS test_api_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid REFERENCES test_runs(id) ON DELETE CASCADE,
  method     text        NOT NULL,
  endpoint   text        NOT NULL,
  status     integer     NOT NULL,
  request_body jsonb     NOT NULL DEFAULT '{}'::jsonb,
  response_body jsonb    NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer    NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- TRIGGER AGGIORNAMENTO updated_at (gestito a livello applicativo)
-- ============================================

-- Nessun trigger PL/pgSQL per compatibilità PGlite.

-- ============================================
-- DATI INIZIALI CMS
-- ============================================

-- Inserisci pagine CMS di default
INSERT INTO cms_pages (key, title, subtitle, content, is_active, order_idx)
VALUES 
  ('hero', 'Benvenuti nel Clan Samurai', 'Il clan più potenti di Avakin Life', '{"hero_image": "/assets/images/hero-bg.jpg", "cta_text": "Unisciti a noi", "cta_link": "/#/join"}', true, 0),
  ('news', 'Ultime Notizie', 'Rimani aggiornato con le novità del clan', '{}', true, 1),
  ('gallery', 'Galleria', 'Le nostre avventure in immagini', '{}', true, 2),
  ('videos', 'Video', 'I momenti più emozionanti del clan', '{}', true, 3),
  ('faq', 'Domande Frequenti', 'Risposte alle domande più comuni', '{}', true, 4)
ON CONFLICT (key) DO NOTHING;

-- Inserisci canali chat di default
INSERT INTO chat_channels (name, description, is_public, is_archived)
VALUES 
  ('generale', 'Canale principale per tutte le discussioni', true, false),
  ('eventi', 'Discussioni su eventi e raid', true, false),
  ('raid', 'Organizzazione raid in tempo reale', true, false),
  ('off-topic', 'Chiacchiere generali', true, false)
ON CONFLICT (name) DO NOTHING;

-- Inserisci traduzioni base
INSERT INTO translations (key, lang, value)
VALUES 
  -- Italiano
  ('site.title', 'it', 'Samurai di Avakin'),
  ('site.description', 'it', 'Il clan Samurai di Avakin Life'),
  ('welcome.title', 'it', 'Benvenuto'),
  ('welcome.subtitle', 'it', 'Unisciti alla nostra famiglia'),
  ('nav.home', 'it', 'Home'),
  ('nav.events', 'it', 'Eventi'),
  ('nav.ranking', 'it', 'Classifica'),
  ('nav.account', 'it', 'Account'),
  -- Inglese
  ('site.title', 'en', 'Samurai of Avakin'),
  ('site.description', 'en', 'The Samurai clan of Avakin Life'),
  ('welcome.title', 'en', 'Welcome'),
  ('welcome.subtitle', 'en', 'Join our family'),
  ('nav.home', 'en', 'Home'),
  ('nav.events', 'en', 'Events'),
  ('nav.ranking', 'en', 'Ranking'),
  ('nav.account', 'en', 'Account'),
  -- Spagnolo
  ('site.title', 'es', 'Samurai de Avakin'),
  ('site.description', 'es', 'El clan Samurai de Avakin Life'),
  ('welcome.title', 'es', 'Bienvenido'),
  ('welcome.subtitle', 'es', 'Unete a nuestra familia'),
  ('nav.home', 'es', 'Inicio'),
  ('nav.events', 'es', 'Eventos'),
  ('nav.ranking', 'es', 'Clasificacion'),
  ('nav.account', 'es', 'Cuenta')
ON CONFLICT (key, lang) DO NOTHING;

-- ============================================
-- BLOG CREATIVO SAMURAI: post, media e interazioni
-- ============================================

-- Post creativi (foto, video, audio, testo, misto)
CREATE TABLE IF NOT EXISTS creative_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titolo      text        NOT NULL DEFAULT '',
  corpo       text        NOT NULL DEFAULT '',
  tipo        text        NOT NULL DEFAULT 'misto' CHECK (tipo IN ('foto','video','audio','testo','misto')),
  media_url   text        NOT NULL DEFAULT '',   -- file principale (prima immagine/video di copertina)
  tags        text[]      NOT NULL DEFAULT '{}',
  pubblico    boolean     NOT NULL DEFAULT true,
  likes_count integer     NOT NULL DEFAULT 0,
  commenti_count integer  NOT NULL DEFAULT 0,
  creato_il   timestamptz NOT NULL DEFAULT now(),
  aggiornato_il timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creative_posts_user_idx ON creative_posts (user_id, creato_il DESC);
CREATE INDEX IF NOT EXISTS creative_posts_tipo_idx ON creative_posts (tipo, creato_il DESC);
CREATE INDEX IF NOT EXISTS creative_posts_pubblico_idx ON creative_posts (pubblico, creato_il DESC);
CREATE INDEX IF NOT EXISTS creative_posts_tags_idx ON creative_posts USING GIN(tags);

-- Media multipli per post (foto/video/audio aggiuntivi)
CREATE TABLE IF NOT EXISTS creative_post_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid        NOT NULL REFERENCES creative_posts(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url         text        NOT NULL,
  tipo        text        NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto','video','audio')),
  titolo      text        NOT NULL DEFAULT '',
  creato_il   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creative_post_media_post_idx ON creative_post_media (post_id, creato_il);

-- Like ai post creativi
CREATE TABLE IF NOT EXISTS creative_post_likes (
  post_id   uuid        NOT NULL REFERENCES creative_posts(id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creato_il timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS creative_post_likes_user_idx ON creative_post_likes (user_id);

-- Commenti ai post creativi
CREATE TABLE IF NOT EXISTS creative_post_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid        NOT NULL REFERENCES creative_posts(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  corpo       text        NOT NULL,
  creato_il   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creative_post_comments_post_idx ON creative_post_comments (post_id, creato_il DESC);

-- Trigger updated_at su creative_posts
DROP TRIGGER IF EXISTS creative_posts_touch ON creative_posts;
CREATE TRIGGER creative_posts_touch BEFORE UPDATE ON creative_posts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Inserisci alcuni post di esempio per il blog del clan
INSERT INTO creative_posts (user_id, titolo, corpo, tipo, media_url, tags, pubblico, likes_count, commenti_count)
SELECT id, 'Il mio primo kata', 'Inizio a condividere il mio percorso da samurai digitale. Onore e disciplina.', 'foto', '/assets/images/placeholder.jpg', ARRAY['inizio','kata'], true, 0, 0 FROM users LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================
-- PROGRESSIONE MEMBRO: skill per attitudine e log XP
-- ============================================

CREATE TABLE IF NOT EXISTS user_skills (
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chiave      text        NOT NULL CHECK (chiave IN ('difesa','attacco','risorse','arena','squadra')),
  livello     integer     NOT NULL DEFAULT 1 CHECK (livello BETWEEN 1 AND 100),
  xp          integer     NOT NULL DEFAULT 0 CHECK (xp >= 0),
  aggiornato  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chiave)
);

CREATE INDEX IF NOT EXISTS user_skills_user_idx ON user_skills (user_id);

CREATE TABLE IF NOT EXISTS user_xp_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  azione         text        NOT NULL,
  xp_guadagnato  integer     NOT NULL DEFAULT 0 CHECK (xp_guadagnato >= 0),
  creato_il      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_xp_log_user_idx ON user_xp_log (user_id, creato_il DESC);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_xp_check;
ALTER TABLE users ADD CONSTRAINT users_xp_check CHECK (xp >= 0);

-- Campi profilo completo (idempotente)
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_nascita date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sesso text CHECK (sesso IN ('maschio','femmina','altro','preferisco_non_dire'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS pronome text DEFAULT 'lui/lei';
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Rome';
ALTER TABLE users ADD COLUMN IF NOT EXISTS livello_attitudine text DEFAULT 'equilibrato' CHECK (livello_attitudine IN ('equilibrato','difensivo','aggressivo','tattico','sociale'));

-- Risposte questionario attitudine in fase di registrazione
CREATE TABLE IF NOT EXISTS user_attitude (
  user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  difesa       integer NOT NULL DEFAULT 1 CHECK (difesa BETWEEN 1 AND 10),
  attacco      integer NOT NULL DEFAULT 1 CHECK (attacco BETWEEN 1 AND 10),
  risorse      integer NOT NULL DEFAULT 1 CHECK (risorse BETWEEN 1 AND 10),
  arena        integer NOT NULL DEFAULT 1 CHECK (arena BETWEEN 1 AND 10),
  squadra      integer NOT NULL DEFAULT 1 CHECK (squadra BETWEEN 1 AND 10),
  creato_il    timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- FUNZIONI UTILI
-- ============================================
CREATE OR REPLACE FUNCTION get_unread_count(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  count integer DEFAULT 0;
BEGIN
  SELECT COUNT(*) INTO count
  FROM notifications
  WHERE user_id = p_user_id AND read_at IS NULL;
  RETURN count;
END;
$$ LANGUAGE plpgsql;

-- Funzione per ottenere le statistiche del clan
CREATE OR REPLACE FUNCTION get_clan_stats()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_members', COUNT(DISTINCT u.id),
    'active_members', COUNT(DISTINCT CASE WHEN u.status = 'attivo' THEN u.id END),
    'bushi_count', COUNT(DISTINCT CASE WHEN u.role = 'bushi' THEN u.id END),
    'shogun_count', COUNT(DISTINCT CASE WHEN u.role = 'shogun' THEN u.id END),
    'admin_count', COUNT(DISTINCT CASE WHEN u.role = 'admin' THEN u.id END),
    'total_raid', COUNT(DISTINCT r.id),
    'total_events', COUNT(DISTINCT e.id),
    'total_avakin_linked', COUNT(DISTINCT CASE WHEN u.avakin_id IS NOT NULL THEN u.id END)
  ) INTO result
  FROM users u
  LEFT JOIN clan_raid_log r ON true
  LEFT JOIN events e ON true;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- EVENTI CUSTOM SAMURAI (creati dagli utenti)
-- ============================================

-- Eventi personalizzati creati dai membri del clan
CREATE TABLE IF NOT EXISTS clan_events_custom (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titolo        text        NOT NULL DEFAULT '',
  descrizione   text        NOT NULL DEFAULT '',
  categoria     text        NOT NULL DEFAULT 'evento' CHECK (categoria IN ('evento', 'raid', 'guida', 'riunione')),
  immagine_url  text        NOT NULL DEFAULT '',
  inizio        timestamptz NOT NULL DEFAULT now(),
  fine          timestamptz,
  posti         integer     NOT NULL DEFAULT 0 CHECK (posti >= 0),  -- 0 = illimitato
  luogo         text        NOT NULL DEFAULT '',
  pubblico      boolean     NOT NULL DEFAULT true,
  creato_il     timestamptz NOT NULL DEFAULT now(),
  aggiornato_il timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clan_events_custom_user_idx ON clan_events_custom (user_id, creato_il DESC);
CREATE INDEX IF NOT EXISTS clan_events_custom_inizio_idx ON clan_events_custom (inizio DESC);
CREATE INDEX IF NOT EXISTS clan_events_custom_pubblico_idx ON clan_events_custom (pubblico, inizio DESC);
CREATE INDEX IF NOT EXISTS clan_events_custom_categoria_idx ON clan_events_custom (categoria, inizio DESC);

-- Iscrizioni agli eventi custom
CREATE TABLE IF NOT EXISTS clan_event_custom_rsvps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES clan_events_custom(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creato_il     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS clan_event_custom_rsvps_event_idx ON clan_event_custom_rsvps (event_id);
CREATE INDEX IF NOT EXISTS clan_event_custom_rsvps_user_idx ON clan_event_custom_rsvps (user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS clan_events_custom_touch ON clan_events_custom;
CREATE TRIGGER clan_events_custom_touch BEFORE UPDATE ON clan_events_custom
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Eventi di esempio per il clan
INSERT INTO clan_events_custom (user_id, titolo, descrizione, categoria, immagine_url, inizio, fine, posti, luogo, pubblico)
SELECT id, 'Torneo di Kendo del Clan', 'Gara amichevole di kendo tra i membri del clan. Tutti i livelli sono benvenuti.', 'evento', '/assets/images/events/kendo.jpg', now() + interval '7 days', now() + interval '7 days' + interval '3 hours', 20, 'Dojo Centrale', true FROM users LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO clan_events_custom (user_id, titolo, descrizione, categoria, immagine_url, inizio, fine, posti, luogo, pubblico)
SELECT id, 'Meditazione all\'alba', 'Sessione di meditazione e respirazione per iniziare la giornata con la mente chiara.', 'guida', '/assets/images/events/meditazione.jpg', now() + interval '3 days', now() + interval '3 days' + interval '1 hour', 0, 'Giardino del Tempio', true FROM users LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================
-- ============================================
-- EMAIL VERIFICATION (registrazione con verifica email)
-- ============================================

CREATE TABLE IF NOT EXISTS email_verifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text        NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);
CREATE INDEX IF NOT EXISTS email_verifications_user_idx ON email_verifications (user_id);
CREATE INDEX IF NOT EXISTS email_verifications_token_idx ON email_verifications (token_hash);

-- Login sociale (Google, Microsoft, Apple)
CREATE TABLE IF NOT EXISTS user_social (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       text        NOT NULL CHECK (provider IN ('google','microsoft','apple')),
  provider_user_id text      NOT NULL,
  email          text,
  name           text,
  avatar_url     text,
  creato_il      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS user_social_user_idx ON user_social (user_id);
CREATE INDEX IF NOT EXISTS user_social_provider_idx ON user_social (provider, provider_user_id);

-- Campo email verificato per social (già presente in users, assicuriamoci esista)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

-- ============================================
-- PUBLIC CONTENT SYSTEM (Anonymous + Authenticated uploads)
-- Foto, Video, Eventi caricati da chiunque
-- ============================================

CREATE TABLE IF NOT EXISTS public_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('photo', 'video', 'event')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration VARCHAR(20),
    category VARCHAR(50) NOT NULL DEFAULT 'creativo',
    tags TEXT[] DEFAULT '{}',
    author_name VARCHAR(100) NOT NULL DEFAULT 'Anonimo',
    author_ip_hash VARCHAR(64) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    likes_count INT DEFAULT 0,
    views_count INT DEFAULT 0,
    event_date TIMESTAMPTZ,
    event_location VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pc_type_status_created 
    ON public_content(type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pc_user_id 
    ON public_content(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pc_ip_hash 
    ON public_content(author_ip_hash);
CREATE INDEX IF NOT EXISTS idx_pc_category 
    ON public_content(category) WHERE status = 'approved';

CREATE TABLE IF NOT EXISTS public_content_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public_content(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('photo', 'video')),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pcm_content ON public_content_media(content_id);

CREATE TABLE IF NOT EXISTS public_content_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public_content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pcl_content ON public_content_likes(content_id);
CREATE INDEX IF NOT EXISTS idx_pcl_user ON public_content_likes(user_id);

CREATE TABLE IF NOT EXISTS public_content_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public_content(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    author_name VARCHAR(100),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pcc_content ON public_content_comments(content_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS public_content_touch ON public_content;
CREATE TRIGGER public_content_touch BEFORE UPDATE ON public_content
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
