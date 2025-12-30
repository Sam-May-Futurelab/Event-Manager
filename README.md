Event Manager - Setup

1) Install dependencies:

npm install


2) Build the database:

npm run build-db


3) Start the server:

npm run start

Open `http://localhost:3000/` in your browser.

Key Pages

- Main home: `/`
- Organiser home: `/organiser`
- Attendee home: `/attendee`

Libraries

- Express
- EJS
- sqlite3

Extension: Booking Management

What it adds
- An organiser bookings view per event.
- Ability to cancel attendee bookings from the organiser side.

How it works
- A new organiser route loads all bookings for an event and totals ticket counts.
- A cancelroute deletes a booking by `booking_id`, then reloads the bookings page.
- The organiser home page links to the bookings view for each published event.

Key files
- `routes/organiser.js` (bookings list + cancel routes)
- `views/organiser-bookings.ejs` (bookings page)
- `views/organiser-home.ejs` (link to bookings)
