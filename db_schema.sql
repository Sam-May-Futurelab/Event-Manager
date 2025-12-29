-- === START MY CODE (event manager schema) ===
-- This makes sure that foreign_key constraints are observed and that errors will be thrown for violations
PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

-- Core site settings (single row)
CREATE TABLE IF NOT EXISTS site_settings (
    settings_id INTEGER PRIMARY KEY CHECK (settings_id = 1),
    site_name TEXT NOT NULL,
    site_description TEXT NOT NULL
);

-- Events created by the organiser
CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    event_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_at TEXT
);

-- Ticket types per event
CREATE TABLE IF NOT EXISTS tickets (
    ticket_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    ticket_type TEXT NOT NULL CHECK (ticket_type IN ('full', 'concession')),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    capacity INTEGER NOT NULL CHECK (capacity >= 0),
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

-- Ticket bookings by attendees
CREATE TABLE IF NOT EXISTS bookings (
    booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    attendee_name TEXT NOT NULL,
    full_qty INTEGER NOT NULL CHECK (full_qty >= 0),
    concession_qty INTEGER NOT NULL CHECK (concession_qty >= 0),
    created_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

-- Default site settings
INSERT INTO site_settings (settings_id, site_name, site_description)
VALUES (1, 'Event Manager', 'Simple events for a single organiser');

-- Seed data for quick testing
INSERT INTO events (title, description, event_date, status, created_at, updated_at, published_at)
VALUES
    ('Open Studio Talk', 'A short talk and Q&A with the artist.', '2025-11-15', 'published', datetime('now'), datetime('now'), datetime('now')),
    ('Community Yoga', 'A gentle morning session for all levels.', '2025-12-05', 'draft', datetime('now'), datetime('now'), NULL);

INSERT INTO tickets (event_id, ticket_type, price_cents, capacity) VALUES
    (1, 'full', 1500, 20),
    (1, 'concession', 800, 10),
    (2, 'full', 1200, 15),
    (2, 'concession', 600, 8);

COMMIT;
-- === END MY CODE (event manager schema) ===
