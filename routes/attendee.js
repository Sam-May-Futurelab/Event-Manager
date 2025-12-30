/**
 * attendee.js
 * Routes for attendee-facing pages and actions.
 */

// by Sam May for CM2040 Databases, Networks and the Web Midterm Coursework -

const express = require("express");
const router = express.Router();

function buildTicketMap(tickets) {
    const ticketData = { full: { price_cents: 0, capacity: 0 }, concession: { price_cents: 0, capacity: 0 } };
    tickets.forEach(function (t) {
        ticketData[t.ticket_type] = { price_cents: t.price_cents, capacity: t.capacity };
    });
    return ticketData;
}

/**
 * @desc Display attendee home page with published events
 * @output Renders attendee home page
 */
router.get("/", function (req, res, next) {
    // DB: grab site settings for the header settings_id=1
    const settingsQuery = "SELECT site_name, site_description FROM site_settings WHERE settings_id = 1";
    global.db.get(settingsQuery, function (err, settings) {
        if (err) {
            next(err);
            return;
        }

        // DB: published events ordered by date (event_id, title and event_date)
        const eventsQuery = `
            SELECT event_id, title, event_date
            FROM events
            WHERE status = 'published'
            ORDER BY event_date ASC
        `;
        global.db.all(eventsQuery, function (err2, events) {
            if (err2) {
                next(err2);
                return;
            }
            res.render("attendee-home.ejs", {
                settings: settings || { site_name: "Event Manager", site_description: "" },
                events: events
            });
        });
    });
});

/**
 * @desc Displays the attendee event page
 * @input event_id
 * @output Renders event details and booking form
 */
router.get("/events/:id", function (req, res, next) {
    const eventId = req.params.id;
    const success = req.query.success === "1";
    const errorFlag = req.query.error === "1";

    // DB: fetch published event by id
    const eventQuery = "SELECT * FROM events WHERE event_id = ? AND status = 'published'";
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

            const ticketData = buildTicketMap(tickets);

            // DB: totals used to calculate availability
            const bookingQuery = `
                SELECT
                    COALESCE(SUM(full_qty), 0) AS full_booked,
                    COALESCE(SUM(concession_qty), 0) AS concession_booked
                FROM bookings
                WHERE event_id = ?
            `;
            global.db.get(bookingQuery, [eventId], function (err3, totals) {
                if (err3) {
                    next(err3);
                    return;
                }

                const availability = {
                    full: Math.max(ticketData.full.capacity - totals.full_booked, 0),
                    concession: Math.max(ticketData.concession.capacity - totals.concession_booked, 0)
                };

                res.render("attendee-event.ejs", {
                    event: event,
                    tickets: ticketData,
                    availability: availability,
                    error: errorFlag ? "Add your name and a valid ticket quantity." : null,
                    success: success
                });
            });
        });
    });
});

/**
 * @desc Book tickets for a published event
 * @input attendee_name, full_qty, concession_qty
 * @output Redirects back to event page on success or re-renders with errors
 */
router.post("/events/:id/book", function (req, res, next) {
    const eventId = req.params.id;
    const attendeeName = (req.body.attendee_name || "").trim();
    const fullQty = parseInt(req.body.full_qty, 10) || 0;
    const concessionQty = parseInt(req.body.concession_qty, 10) || 0;

    if (!attendeeName) {
        res.redirect(`/attendee/events/${eventId}?error=1`);
        return;
    }

    // DB: fetch event + tickets + totals so we can validate availability
    const eventQuery = "SELECT * FROM events WHERE event_id = ? AND status = 'published'";
    global.db.get(eventQuery, [eventId], function (err, event) {
        if (err) {
            next(err);
            return;
        }
        if (!event) {
            res.status(404).send("Event not found");
            return;
        }

        const ticketQuery = "SELECT ticket_type, price_cents, capacity FROM tickets WHERE event_id = ?";
        global.db.all(ticketQuery, [eventId], function (err2, tickets) {
            if (err2) {
                next(err2);
                return;
            }

            const ticketData = buildTicketMap(tickets);
            const bookingQuery = `
                SELECT
                    COALESCE(SUM(full_qty), 0) AS full_booked,
                    COALESCE(SUM(concession_qty), 0) AS concession_booked
                FROM bookings
                WHERE event_id = ?
            `;
            global.db.get(bookingQuery, [eventId], function (err3, totals) {
                if (err3) {
                    next(err3);
                    return;
                }

                const availability = {
                    full: Math.max(ticketData.full.capacity - totals.full_booked, 0),
                    concession: Math.max(ticketData.concession.capacity - totals.concession_booked, 0)
                };

                const hasInvalidQty = fullQty < 0 || concessionQty < 0 || Number.isNaN(fullQty) || Number.isNaN(concessionQty);
                const wantsNoTickets = fullQty + concessionQty === 0;
                const exceedsAvailability = fullQty > availability.full || concessionQty > availability.concession;

                if (hasInvalidQty || wantsNoTickets || exceedsAvailability || !attendeeName) {
                    res.render("attendee-event.ejs", {
                        event: event,
                        tickets: ticketData,
                        availability: availability,
                        error: "Add your name and a valid ticket quantity.",
                        success: false
                    });
                    return;
                }

                // DB: create booking record for this attendee
                const insertQuery = `
                    INSERT INTO bookings (event_id, attendee_name, full_qty, concession_qty, created_at)
                    VALUES (?, ?, ?, ?, datetime('now'))
                `;
                global.db.run(insertQuery, [eventId, attendeeName, fullQty, concessionQty], function (err4) {
                    if (err4) {
                        next(err4);
                        return;
                    }
                    res.redirect(`/attendee/events/${eventId}?success=1`);
                });
            });
        });
    });
});

module.exports = router;
// === END MY CODE (attendee routes) ===
