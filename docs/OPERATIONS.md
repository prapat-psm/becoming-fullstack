# Roombook operations

## Deploy a demo on Render

Use a dedicated demo database in the same region as the web service. Create a Render PostgreSQL instance and a Docker web service from this repository. Set `DATABASE_URL` to the internal database connection URL, `COOKIE_SECURE=true`, and the HTTP health-check path to `/api/health`. The image uses `PORT` when the platform sets it and defaults to `3000`. Its startup command applies SQL migrations before opening the HTTP listener. [Deploying on Render](https://render.com/docs/deploys)

Seed manually using `npm run db:seed` with the demo database connection and distinct, randomly generated values for `DEMO_PASSWORD` and `DEMO_ADMIN_PASSWORD`. Use the Render shell if your plan supports it. Otherwise, temporarily use a restricted external database connection from a trusted machine. Keep database credentials and the admin demo password out of source control and recordings. Share the member demo password with reviewers privately. Render's free PostgreSQL instance expires after 30 days, so retain the local run instructions and a recording. [Render free service limits](https://render.com/docs/free)

## Release and rollback rehearsal

1. Run CI and note the release commit. Confirm `/api/health` returns `200`, then check room listing, sign-in, a future reservation, and cancellation.
2. Deploy a second, backwards-compatible release. Verify the same smoke checks and record the deploy IDs, timestamps, and evidence.
3. Roll back to the previous release in the provider dashboard and repeat the smoke checks. An app rollback leaves applied schema changes in place. Use additive changes, deploy code that tolerates both schemas, and remove old columns in a later release. On the free tier, preserve a reproducible local run as a fallback. [Render rollbacks](https://render.com/docs/rollbacks)

## Triage failed requests

1. Check `/api/health`, then capture the failing request's `X-Request-Id`. Filter JSON logs on `requestId` and inspect `status`, `route`, `durationMs`, and the failure `code` in the `request_failed` or `database_unavailable` event.
2. Check the last release, database reachability, and applied migrations. `42P01` indicates a missing relation and `42703` indicates an undefined column. Both point to the migration state or the database selected by `DATABASE_URL`. Connection errors call for checking database health and connection settings.
3. Restore the expected schema or roll back the app when the schema is compatible. Confirm health, room listing, and a complete booking and cancellation. Capture the failure interval, change made, and the checks that confirmed recovery.

### Local incident exercise

The PostgreSQL integration suite includes a simulated schema mismatch in its own disposable schema. It renames the `rooms.name` column temporarily, expects `503` from health and `500` from room listing, restores the column, and verifies both routes are healthy again. The simulated failure uses PostgreSQL code `42703`. Save your test run's request IDs and timeline as evidence, and use a disposable database for any further exercises.

## Inspect the availability query

Run `npm run db:explain` against a local database. Look for the partial GiST index backing `room_booking_no_overlap` in the overlap lookup. On a tiny fixture, PostgreSQL can favor a sequential scan for the room list. Record the dataset size, planner choices, actual rows, buffers, and execution time before drawing any conclusions about scale.
