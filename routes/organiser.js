/**
 * organiser.js
 * Routes for organiser-facing pages and actions.
 */
// by Sam May for CM2040 Databases, Networks and the Web Midterm Coursework -->
// === START MY CODE (organiser routes + extension) ===

const express = require("express");
const router = express.Router();

/**
 * @desc Display the organiser home page with published and draft events
 * @output Renders organiser home page with site settings and event lists
 */
router.get("/", function (req, res, next) {
    // DB: grab site settings (settings_id=1) -> site_name, site_description
    const settingsQuery = "SELECT site_name, site_description FROM site_settings WHERE settings_id = 1";
    global.db.get(settingsQuery, function (err, settings) {
        if (err) {
            next(err);
            return;
        }

        // DB: published events + ticket/booking totals (status='published')
        const publishedQuery = `
            SELECT e.event_id, e.title, e.description, e.event_date, e.created_at, e.updated_at, e.published_at,
                   MAX(CASE WHEN t.ticket_type = 'full' THEN t.capacity END) AS full_capacity,
                   MAX(CASE WHEN t.ticket_type = 'concession' THEN t.capacity END) AS concession_capacity,
                   MAX(CASE WHEN t.ticket_type = 'full' THEN t.price_cents END) AS full_price_cents,
                   MAX(CASE WHEN t.ticket_type = 'concession' THEN t.price_cents END) AS concession_price_cents,
                   COALESCE(SUM(b.full_qty), 0) AS full_booked,
                   COALESCE(SUM(b.concession_qty), 0) AS concession_booked
            FROM events e
            LEFT JOIN tickets t ON e.event_id = t.event_id
            LEFT JOIN bookings b ON e.event_id = b.event_id
            WHERE e.status = 'published'
            GROUP BY e.event_id
            ORDER BY e.event_date ASC
        `;
        global.db.all(publishedQuery, function (err2, publishedEvents) {
            if (err2) {
                next(err2);
                return;
            }

            // DB: draft events + ticket totals (status='draft')
            const draftQuery = `
                SELECT e.event_id, e.title, e.description, e.event_date, e.created_at, e.updated_at, e.published_at,
                       MAX(CASE WHEN t.ticket_type = 'full' THEN t.capacity END) AS full_capacity,
                       MAX(CASE WHEN t.ticket_type = 'concession' THEN t.capacity END) AS concession_capacity,
                       MAX(CASE WHEN t.ticket_type = 'full' THEN t.price_cents END) AS full_price_cents,
                       MAX(CASE WHEN t.ticket_type = 'concession' THEN t.price_cents END) AS concession_price_cents
                FROM events e
                LEFT JOIN tickets t ON e.event_id = t.event_id
                WHERE e.status = 'draft'
                GROUP BY e.event_id
                ORDER BY e.event_date ASC
            `;
            global.db.all(draftQuery, function (err3, draftEvents) {
                if (err3) {
                    next(err3);
                    return;
                }

                res.render("organiser-home.ejs", {
                    settings: settings || { site_name: "Event Manager", site_description: "" },
                publishedEvents: publishedEvents,
                draftEvents: draftEvents
                });
            });
        });
    });
});

/**
 * @desc Create a new draft event and redirect to its edit page
 * @output Redirects to organiser edit event page
 */
router.post("/events/new", function (req, res, next) {
    // DB: create a draft event (title/description) -> new event_id
    const insertEventQuery = `
        INSERT INTO events (title, description, event_date, status, created_at, updated_at)
        VALUES (?, ?, date('now'), 'draft', datetime('now'), datetime('now'))
    `;
    const insertEventParams = ["Untitled event", "Add details here."];
    global.db.run(insertEventQuery, insertEventParams, function (err) {
        if (err) {
            next(err);
            return;
        }

        const newEventId = this.lastID;

        // DB: add default ticket rows for the new event (full + concession)
        const insertTicketsQuery = `
            INSERT INTO tickets (event_id, ticket_type, price_cents, capacity)
            VALUES (?, 'full', 0, 0), (?, 'concession', 0, 0)
        `;
        global.db.run(insertTicketsQuery, [newEventId, newEventId], function (err2) {
            if (err2) {
                next(err2);
                return;
            }
            res.redirect(`/organiser/events/${newEventId}/edit`);
        });
    });
});

/**
 * @desc Display site settings page
 * @output Renders site settings form
 */
router.get("/settings", function (req, res, next) {
    // DB: load site settings to prefill the form (settings_id=1)
    const query = "SELECT site_name, site_description FROM site_settings WHERE settings_id = 1";
    global.db.get(query, function (err, settings) {
        if (err) {
            next(err);
            return;
        }
        res.render("organiser-settings.ejs", {
            settings: settings || { site_name: "", site_description: "" },
            error: null
        });
    });
});

/**
 * @desc Update site settings
 * @input site_name, site_description
 * @output Redirects to organiser home page
 */
router.post("/settings", function (req, res, next) {
    const siteName = (req.body.site_name || "").trim();
    const siteDescription = (req.body.site_description || "").trim();

    if (!siteName || !siteDescription) {
        res.render("organiser-settings.ejs", {
            settings: { site_name: siteName, site_description: siteDescription },
            error: "Fill in both fields."
        });
        return;
    }

    // DB: save site settings (site_name, site_description)
    const updateQuery = `
        UPDATE site_settings
        SET site_name = ?, site_description = ?
        WHERE settings_id = 1
    `;
    global.db.run(updateQuery, [siteName, siteDescription], function (err) {
        if (err) {
            next(err);
            return;
        }
        res.redirect("/organiser");
    });
});

/**
 * @desc Display organiser edit event page
 * @input event_id
 * @output Renders edit form with event data
 */
router.get("/events/:id/edit", function (req, res, next) {
    const eventId = req.params.id;

    // DB: fetch the event by id -> event row
    const eventQuery = "SELECT * FROM events WHERE event_id = ?";
    global.db.get(eventQuery, [eventId], function (err, event) {
        if (err) {
            next(err);
            return;
        }
        if (!event) {
            res.status(404).send("Event not found");
            return;
        }

        // DB: load ticket rows for this event
        const ticketQuery = "SELECT ticket_type, price_cents, capacity FROM tickets WHERE event_id = ?";
        global.db.all(ticketQuery, [eventId], function (err2, tickets) {
            if (err2) {
                next(err2);
                return;
            }

            const ticketData = { full: { price_cents: 0, capacity: 0 }, concession: { price_cents: 0, capacity: 0 } };
            tickets.forEach(function (t) {
                ticketData[t.ticket_type] = { price_cents: t.price_cents, capacity: t.capacity };
            });

            res.render("organiser-edit-event.ejs", {
                event: event,
                tickets: ticketData,
                error: null
            });
        });
    });
});

/**
 * @desc Update an existing event
 * @input event_id, title, description, event_date, ticket details
 * @output Redirects to organiser home page
 */
router.post("/events/:id", function (req, res, next) {
    const eventId = req.params.id;
    const title = (req.body.title || "").trim();
    const description = (req.body.description || "").trim();
    const eventDate = (req.body.event_date || "").trim();
    const fullCapacity = parseInt(req.body.full_capacity, 10);
    const fullPrice = parseInt(req.body.full_price, 10);
    const concessionCapacity = parseInt(req.body.concession_capacity, 10);
    const concessionPrice = parseInt(req.body.concession_price, 10);

    const hasInvalidNumbers = [fullCapacity, fullPrice, concessionCapacity, concessionPrice].some(function (v) {
        return Number.isNaN(v) || v < 0;
    });

    if (!title || !description || !eventDate || hasInvalidNumbers) {
        // DB: re-fetch event + tickets so the form can re-render with errors
        const eventQuery = "SELECT * FROM events WHERE event_id = ?";
        global.db.get(eventQuery, [eventId], function (err, event) {
            if (err) {
                next(err);
                return;
            }
            const ticketQuery = "SELECT ticket_type, price_cents, capacity FROM tickets WHERE event_id = ?";
            global.db.all(ticketQuery, [eventId], function (err2, tickets) {
                if (err2) {
                    next(err2);
                    return;
                }

                const ticketData = { full: { price_cents: 0, capacity: 0 }, concession: { price_cents: 0, capacity: 0 } };
                tickets.forEach(function (t) {
                    ticketData[t.ticket_type] = { price_cents: t.price_cents, capacity: t.capacity };
                });

                res.render("organiser-edit-event.ejs", {
                    event: event,
                    tickets: ticketData,
                    error: "Fill all fields with non-negative numbers."
                });
            });
        });
        return;
    }

    // DB: update event fields + bump updated_at
    const updateEventQuery = `
        UPDATE events
        SET title = ?, description = ?, event_date = ?, updated_at = datetime('now')
        WHERE event_id = ?
    `;
    global.db.run(updateEventQuery, [title, description, eventDate, eventId], function (err) {
        if (err) {
            next(err);
            return;
        }

        // DB: update ticket rows (price/capacity) by type
        const updateTicketQuery = `
            UPDATE tickets
            SET price_cents = ?, capacity = ?
            WHERE event_id = ? AND ticket_type = ?
        `;
        global.db.run(updateTicketQuery, [fullPrice, fullCapacity, eventId, "full"], function (err2) {
            if (err2) {
                next(err2);
                return;
            }
            global.db.run(updateTicketQuery, [concessionPrice, concessionCapacity, eventId, "concession"], function (err3) {
                if (err3) {
                    next(err3);
                    return;
                }
                res.redirect("/organiser");
            });
        });
    });
});

/**
 * @desc Publish a draft event
 * @input event_id
 * @output Redirects to organiser home page
 */
router.post("/events/:id/publish", function (req, res, next) {
    const eventId = req.params.id;

    // DB: publish event (status + published_at + updated_at)
    const publishQuery = `
        UPDATE events
        SET status = 'published', published_at = datetime('now'), updated_at = datetime('now')
        WHERE event_id = ?
    `;
    global.db.run(publishQuery, [eventId], function (err) {
        if (err) {
            next(err);
            return;
        }
        res.redirect("/organiser");
    });
});

/**
 * @desc Delete an event
 * @input event_id
 * @output Redirects to organiser home page
 */
router.post("/events/:id/delete", function (req, res, next) {
    const eventId = req.params.id;

    // DB: delete event by id (cascades to tickets/bookings)
    const deleteQuery = "DELETE FROM events WHERE event_id = ?";
    global.db.run(deleteQuery, [eventId], function (err) {
        if (err) {
            next(err);
            return;
        }
        res.redirect("/organiser");
    });
});

/**
 * @desc Display bookings for a specific event
 * @input event_id
 * @output Renders bookings list for the organiser
 */
router.get("/events/:id/bookings", function (req, res, next) {
    const eventId = req.params.id;

    // DB: fetch event by id for bookings view
    const eventQuery = "SELECT * FROM events WHERE event_id = ?";
    global.db.get(eventQuery, [eventId], function (err, event) {
        if (err) {
            next(err);
            return;
        }
        if (!event) {
            res.status(404).send("Event not found");
            return;
        }

        // DB: get all bookings for this event (latest first)
        const bookingsQuery = `
            SELECT booking_id, attendee_name, full_qty, concession_qty, created_at
            FROM bookings
            WHERE event_id = ?
            ORDER BY created_at DESC
        `;
        global.db.all(bookingsQuery, [eventId], function (err2, bookings) {
            if (err2) {
                next(err2);
                return;
            }

            // DB: totals for quick summary (full_booked, concession_booked)
            const totalsQuery = `
                SELECT
                    COALESCE(SUM(full_qty), 0) AS full_booked,
                    COALESCE(SUM(concession_qty), 0) AS concession_booked
                FROM bookings
                WHERE event_id = ?
            `;
            global.db.get(totalsQuery, [eventId], function (err3, totals) {
                if (err3) {
                    next(err3);
                    return;
                }
                res.render("organiser-bookings.ejs", {
                    event: event,
                    bookings: bookings,
                    totals: totals
                });
            });
        });
    });
});

/**
 * @desc Cancel a booking for an event
 * @input event_id, booking_id
 * @output Redirects back to bookings page
 */
router.post("/events/:id/bookings/:bookingId/delete", function (req, res, next) {
    const eventId = req.params.id;
    const bookingId = req.params.bookingId;

    // DB: delete a booking by id for this event
    const deleteQuery = "DELETE FROM bookings WHERE booking_id = ? AND event_id = ?";
    global.db.run(deleteQuery, [bookingId, eventId], function (err) {
        if (err) {
            next(err);
            return;
        }
        res.redirect(`/organiser/events/${eventId}/bookings`);
    });
});

module.exports = router;
// === END MY CODE (organiser routes + extension) ===
