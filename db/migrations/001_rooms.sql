CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

CREATE TABLE users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('member', 'admin'))
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE rooms (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 80),
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 100),
  location text NOT NULL CHECK (length(location) BETWEEN 1 AND 80)
);

CREATE TABLE bookings (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id integer NOT NULL REFERENCES rooms(id),
  user_id integer NOT NULL REFERENCES users(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  cancelled_at timestamptz,
  CHECK (ends_at > starts_at AND ends_at - starts_at <= interval '8 hours'),
  CONSTRAINT room_booking_no_overlap EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (cancelled_at IS NULL)
);
CREATE INDEX bookings_user_start_idx ON bookings (user_id, starts_at DESC);
