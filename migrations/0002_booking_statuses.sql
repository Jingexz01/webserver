ALTER TABLE bookings RENAME TO bookings_old;
DROP INDEX bookings_start_at_idx;
DROP INDEX bookings_user_id_idx;

CREATE TABLE bookings (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    zone TEXT NOT NULL CHECK (zone IN ('Standard', 'VIP')),
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'queued', 'assigned', 'cancelled', 'completed')),
    created_at TEXT NOT NULL
);

INSERT INTO bookings (id, user_id, zone, start_at, end_at, status, created_at)
SELECT id, user_id, zone, start_at, end_at, status, created_at
FROM bookings_old;

DROP TABLE bookings_old;

CREATE INDEX bookings_start_at_idx ON bookings(start_at);
CREATE INDEX bookings_user_id_idx ON bookings(user_id);
