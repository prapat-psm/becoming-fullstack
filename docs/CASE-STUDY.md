# Roombook case study

Roombook is a full-stack training project for booking shared meeting rooms. It models a common scheduling problem: two users can both see a room as available and try to reserve it at the same time. The app uses React for scheduling and account views, NestJS for HTTP and permissions, and PostgreSQL for the booking invariant. The evidence below comes from a local demo with synthetic data.

## Decisions

- **Enforce availability at write time.** PostgreSQL rejects overlapping active reservations for the same room. The API turns the constraint violation into `409 Conflict`, and the browser refreshes availability after a conflict. The half-open interval `[start, end)` allows adjacent bookings and a cancelled reservation frees its slot.
- **Check permissions on the server.** The browser uses an HTTP-only session cookie backed by a hashed token in PostgreSQL. Room writes require the admin role. The cancellation query checks booking ID and owner in one database statement.
- **Keep the release small.** A single service serves the React build and API. Migrations run under a database advisory lock and record a checksum. A health route and request IDs support troubleshooting.

## Verification on November 20, 2026

- The build and six checks reported by Node's test runner passed against PostgreSQL 17. The integration suite sent two concurrent requests for the same slot and observed `201` and `409`. Adjacent slots and cancellation ownership were also verified.
- The browser flow confirmed sign-in, availability search, booking Atlas, and cancellation through **My bookings**.
- In a simulated schema mismatch, the health check reported `503`, room listing returned `500`, and logs identified the undefined column error `42703`. Both endpoints returned `200` after the fixture restored the column.
- The Docker image built and served the seeded rooms. In a local rollback rehearsal, a release with a wrong database port failed startup with `ECONNREFUSED`. Restoring the previous Compose configuration returned the service to healthy and preserved all three rooms.
- `EXPLAIN (ANALYZE, BUFFERS)` used the partial GiST index backing the booking constraint for the overlap lookup. One local run took about 0.8 ms with three rooms and zero matching active bookings. That records the query shape on the demo fixture.

## Demo outline for a 3–5 minute recording

1. **Show the user flow.** Sign in as a member, check availability, reserve a room, and cancel it. Open the admin account separately if you want to show room management.
2. **Show where correctness lives.** Open the SQL exclusion constraint and run the integration test. Explain why two fresh availability screens can still show the same slot and when the UI handles a conflict.
3. **Show how you debug.** Follow the request ID to the simulated schema error and show the recovery checks. End with a tradeoff you personally made or a follow-up improvement you implemented.

Before using this as application material, add your own contribution and decision evidence. See the [learning roadmap](ROADMAP.md) for exercises to make the project yours.
