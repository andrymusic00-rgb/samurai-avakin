-- Samurai di Avakin — schema Postgres
-- Idempotente: eseguibile più volte senza effetti collaterali.

CREATE TABLE IF NOT EXISTS users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text        NOT NULL,
  password_hash     text        NOT NULL,
  display_name      text        NOT NULL,
  handle            text        NOT NULL,
  role              text        NOT NULL DEFAULT 'membro'
                    CHECK (role IN ('membro', 'bushi', 'shogun', 'admin')),
  status            text        NOT NULL DEFAULT 'attivo'
                    CHECK (status IN ('attivo', 'sospeso', 'espulso')),
  level             integer     NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 50),
  xp                integer     NOT NULL DEFAULT 0 CHECK (xp BETWEEN 0 AND 100),
  bio               text        NOT NULL DEFAULT '',
  region            text        NOT NULL DEFAULT 'Europa',
  main_char         text        NOT NULL DEFAULT 'Troppa ⋆ ⋆ ⋆ ⋆ ⋆',
  device            text        NOT NULL DEFAULT 'iOS',
  avatar_url        text,
  avakin_id         text,
  avakin_name       text,
  avakin_server     text,
  avakin_alliance   text,
  avakin_linked_at  timestamptz,
  email_verified_at timestamptz,
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key  ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_handle_lower_key ON users (lower(handle));
CREATE UNIQUE INDEX IF NOT EXISTS users_avakin_id_key    ON users (avakin_id) WHERE avakin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_role_idx              ON users (role);
CREATE INDEX IF NOT EXISTS users_created_idx            ON users (created_at DESC);

CREATE TABLE IF NOT EXISTS user_prefs (
  user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  motion       boolean NOT NULL DEFAULT true,
  petals       boolean NOT NULL DEFAULT true,
  grain        boolean NOT NULL DEFAULT true,
  sound        boolean NOT NULL DEFAULT false,
  notifications boolean NOT NULL DEFAULT true,
  compact      boolean NOT NULL DEFAULT false,
  accent       text    NOT NULL DEFAULT '#5aa8ff',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_prefs_accent_hex CHECK (accent ~ '^#[0-9a-fA-F]{6}$')
);

CREATE TABLE IF NOT EXISTS sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_hash  text        NOT NULL,
  user_agent    text        NOT NULL DEFAULT '',
  ip            text        NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz
);

CREATE INDEX IF NOT EXISTS sessions_user_idx   ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_active_idx ON sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS password_resets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);

CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id);

CREATE TABLE IF NOT EXISTS uploads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url        text        NOT NULL,
  filename   text        NOT NULL,
  bytes      integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uploads_user_idx ON uploads (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action     text        NOT NULL,
  meta       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ip         text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action, created_at DESC);

CREATE TABLE IF NOT EXISTS content (
  key        text PRIMARY KEY,
  payload    jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Invia email di benvenuto/newsletter
CREATE TABLE IF NOT EXISTS subscribers (
  email      text PRIMARY KEY,
  source     text        NOT NULL DEFAULT 'newsletter',
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed  boolean     NOT NULL DEFAULT false
);

-- Orari raid e eventi del clan
CREATE TABLE IF NOT EXISTS events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text        NOT NULL UNIQUE,
  title      text        NOT NULL,
  summary    text        NOT NULL DEFAULT '',
  category   text        NOT NULL DEFAULT 'raid',
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz,
  capacity   integer     NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  rsvp_count integer     NOT NULL DEFAULT 0 CHECK (rsvp_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Correzione 1: la PK era solo event_id, quindi un membro poteva iscriversi
-- a un solo evento. La tabella viene ricreata con PK composta.
DROP TABLE IF EXISTS event_rsvp;

CREATE TABLE IF NOT EXISTS event_rsvp (
  event_id   uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Funzione helper per il trigger updated_at (senza plpgsql per compatibilità PGlite)
-- updated_at viene gestito a livello applicativo nelle query di update.

-- Numeri di gioco per membro
CREATE TABLE IF NOT EXISTS user_stats (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vittorie    integer NOT NULL DEFAULT 0,
  sconfitte   integer NOT NULL DEFAULT 0,
  raid        integer NOT NULL DEFAULT 0,
  ore         integer NOT NULL DEFAULT 0,
  kill_streak integer NOT NULL DEFAULT 0,
  aggiornato  timestamptz NOT NULL DEFAULT now()
);

-- Candidature al clan: inviate da chiunque, approvate da bushi/shogun/admin.
CREATE TABLE IF NOT EXISTS applications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname   text        NOT NULL,
  avakin_id  text        NOT NULL,
  region     text        NOT NULL DEFAULT 'Europa',
  main_char  text        NOT NULL DEFAULT '',
  device     text        NOT NULL DEFAULT '',
  message    text        NOT NULL DEFAULT '',
  status     text        NOT NULL DEFAULT 'in_bozza'
                      CHECK (status IN ('in_bozza', 'approvata', 'rifiutata')),
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  note       text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS applications_avakin_pending_key
  ON applications (avakin_id) WHERE status = 'in_bozza';
CREATE INDEX IF NOT EXISTS applications_status_idx ON applications (status, created_at DESC);

-- Traccia le candidature già approvate per un ID Avakin, così il modulo
-- non ripropone lo stesso giocatore più volte anche dopo il rifiuto.
CREATE TABLE IF NOT EXISTS application_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avakin_id    text NOT NULL,
  nickname     text NOT NULL,
  status       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_history_avakin_idx ON application_history (avakin_id, created_at DESC);

-- Traguardi sbloccati: calcolati dal server, mai scritti dal client.
CREATE TABLE IF NOT EXISTS achievements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       text        NOT NULL,
  earned_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS achievements_user_idx ON achievements (user_id, earned_at DESC);

-- Notifiche in-app per eventi, raid e approvazioni.
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES users(id) ON DELETE CASCADE,
  scope      text        NOT NULL DEFAULT 'clan'
                      CHECK (scope IN ('clan', 'personale')),
  title      text        NOT NULL,
  body       text        NOT NULL DEFAULT '',
  link       text        NOT NULL DEFAULT '',
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

-- Reazioni e commenti su galleria e video.
CREATE TABLE IF NOT EXISTS content_reactions (
  content_key text        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       text        NOT NULL DEFAULT '⚔',
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_key, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS content_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key text        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_comments_key_idx ON content_comments (content_key, created_at DESC);

-- Registro dei raid: alimentato dal comando, letto dalla classifica live.
CREATE TABLE IF NOT EXISTS clan_raid_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  category    text        NOT NULL DEFAULT 'raid',
  result      text        NOT NULL DEFAULT 'vittoria'
                        CHECK (result IN ('vittoria', 'sconfitta', 'pareggio')),
  score       integer     NOT NULL DEFAULT 0,
  opponent    text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clan_raid_log_created_idx ON clan_raid_log (created_at DESC);

-- ============================================
-- PROGRESSIONE MEMBRO: skill per attitudine e log XP
-- ============================================

-- Abilità che migliorano con l'uso (attitudine), indipendenti dal livello
CREATE TABLE IF NOT EXISTS user_skills (
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chiave      text        NOT NULL CHECK (chiave IN ('difesa','attacco','risorse','arena','squadra')),
  livello     integer     NOT NULL DEFAULT 1 CHECK (livello BETWEEN 1 AND 100),
  xp          integer     NOT NULL DEFAULT 0 CHECK (xp >= 0),
  aggiornato  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chiave)
);

CREATE INDEX IF NOT EXISTS user_skills_user_idx ON user_skills (user_id);

-- Log trasparente di ogni XP guadagnato
CREATE TABLE IF NOT EXISTS user_xp_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  azione         text        NOT NULL,
  xp_guadagnato  integer     NOT NULL DEFAULT 0 CHECK (xp_guadagnato >= 0),
  creato_il      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_xp_log_user_idx ON user_xp_log (user_id, creato_il DESC);

-- xp diventa XP totale cumulativo (non più percentuale 0-100 di un singolo livello)
ALTER TABLE users ALTER COLUMN xp TYPE integer USING xp::integer;
ALTER TABLE users ALTER COLUMN xp SET DEFAULT 0;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_xp_check;
ALTER TABLE users ADD CONSTRAINT users_xp_check CHECK (xp >= 0);
