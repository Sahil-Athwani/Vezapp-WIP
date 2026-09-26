# Vezapp-WIP

Voice-driven data entry for three apps: **Pattern Master**, **Mould Reporting** and **WIP**.
Tap the mic, say field names followed by values ("pattern name PT 102, good moulds 110"), and only
the fields you say are filled. Next.js 16 + MySQL, ready for Vercel.

It plugs into the existing Vezapp database:

| Table | How it's used |
|---|---|
| `Users`, `Companies` | Login and tenancy (read-only). Users must be `Status = 'Active'` in an active company. |
| `Subscriptions` | Optional per-app access by `AppCode` (read-only). |
| `CompanyUIDCounters` | Generates per-company UIDs with new prefixes `PTN`, `MRP`, `WIP`. |
| `PatternMaster`, `MouldReporting`, `WIPReporting` | **New** tables, created by `npm run db:migrate`. |

## Setup

1. Fill in `.env` (`VOICE_DB_HOST`, `VOICE_DB_USER`, `VOICE_DB_PASSWORD`, `VOICE_DB_NAME`, …).
   `AUTH_SECRET` is already generated.
2. Create the tables (safe to re-run; only `CREATE TABLE IF NOT EXISTS`, and it checks columns):
   ```bash
   npm run db:migrate
   ```
3. Run locally at http://localhost:5173 and log in with an existing Vezapp user:
   ```bash
   npm run dev
   ```

## Deploying to Vercel (later)

Import the `voice-foundry-entry` folder as a project and add every variable from `.env` under
Project → Settings → Environment Variables. The RDS security group must allow connections from
Vercel (Vercel doesn't have fixed IPs on most plans).

## Notes

- Voice input: **Wispr Flow** when `WISPR_API_KEY` is set in `.env` (works in any modern browser;
  audio is recorded as 16 kHz WAV and sent through `/api/transcribe`, so the key never reaches the
  browser; the company's pattern and part names are sent as dictionary words). Otherwise, or if the
  user switches engines, the browser's built-in recognition (Chrome / Edge). Recordings are capped at 90 s.
- Read-back uses the browser's Google voices (Wispr Flow has no text-to-speech).
  The mic only works on `https://` or `localhost`.
- Mould Reporting only auto-selects an **exact** pattern match (ignoring case, spaces and symbols).
  Near matches are shown as "Did you mean…" choices so moulds are never reported against the wrong pattern.
- Pattern details are copied into each Mould Reporting row, so old reports keep their values if the
  pattern is later edited.
- Only company Admins can delete entries. Patterns with mould reports can't be deleted.
- Logins accept bcrypt password hashes (`$2a$`/`$2b$`/`$2y$`).
