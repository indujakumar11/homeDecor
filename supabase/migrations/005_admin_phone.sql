-- ============================================================================
-- Black Shades Home Decors — admin phone number for OTP delivery
-- Step 3E.2: the future Twilio Verify integration needs a phone number to
-- send the SMS to. The Worker must look this up SERVER-SIDE from
-- admin_users using the authenticated user's own id — it must never accept
-- a phone number from the React request body (that would let a client pick
-- an arbitrary destination for the SMS). admin_users is already locked down
-- to service_role only (see 004_admin_authorization_hardening.sql); adding
-- a column here does not change that — no new GRANT/REVOKE is needed.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Add the column nullable — no backfill, no NOT NULL constraint.
-- --------------------------------------------------------------------------
-- admin_users may legitimately be empty at the time this migration runs
-- (see 004_admin_authorization_hardening.sql — it no longer bootstraps any
-- account), and even once a real admin row exists, this migration has no
-- business inventing a value for its phone column: not a real number (that
-- would hardcode someone's actual PII into a version-controlled migration
-- file) and not a placeholder either (a placeholder value quietly sitting
-- in a "real" column invites exactly the "is this the real number or not"
-- confusion this project has already had to reason about once — safer not
-- to write a value here at all). So the column is added nullable, with no
-- backfill and no `not null` constraint, full stop.
--
-- A null phone is a legitimate, handled state: worker/src/index.ts's
-- getAdminPhone() already treats a missing/empty phone as "not configured"
-- and fails closed (503, no OTP attempted) for both /api/otp/start and
-- /api/otp/verify — see handleOtpStart/handleOtpVerify. No worker code
-- change is required for this migration to be safe.
--
-- Before OTP_PROVIDER=twilio is ever enabled for a given admin, that
-- admin's row MUST be given a real E.164 phone number through a secure,
-- out-of-band, service-role-only action (never committed to this repo, and
-- never accepted from client input — see 003_otp_verified_rls.sql's
-- REVOKE and the Worker's own server-side-only phone lookup), e.g.:
--   update public.admin_users set phone = '<real E.164 phone>'
--   where user_id = '<real auth.users id>';
alter table public.admin_users add column if not exists phone text;

comment on column public.admin_users.phone is
  'E.164 phone number the Worker sends the Twilio Verify SMS to for this admin. Looked up server-side by the Worker using the authenticated user''s own id — never accepted from the client. Nullable: a new admin_users row has no phone until one is set via a secure, out-of-band service-role action. A null value is handled (getAdminPhone() in worker/src/index.ts fails closed, 503) and MUST be populated with a real number before OTP_PROVIDER=twilio is enabled for that admin.';
