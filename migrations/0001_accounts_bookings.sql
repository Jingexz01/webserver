CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE bookings (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    zone TEXT NOT NULL CHECK (zone IN ('Standard', 'VIP')),
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
    created_at TEXT NOT NULL
);

CREATE INDEX bookings_start_at_idx ON bookings(start_at);
CREATE INDEX bookings_user_id_idx ON bookings(user_id);