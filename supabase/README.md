# GreenControl SQL source map

## Executable build path

Only the following ordered path may be used to build a new isolated
GreenControl Supabase environment:

1. `baseline/001_public_schema.sql`
2. `baseline/002_p0_security_target.sql`
3. explicitly approved, timestamped migrations

Use `scripts/database/invoke-baseline-build.ps1`. Do not invoke these files
through inherited `PGHOST` or `PGUSER` environment variables.

## Migration drafts

Files below `migration-drafts/` are review artifacts. They are not part of the
executable build path until they have:

- a confirmed production-schema basis,
- an isolated Staging test,
- a tested rollback or forward-recovery plan,
- an explicit implementation approval,
- a final timestamped migration name.

## Historical references

The following files document earlier evolution and must not be replayed as an
ordered migration chain:

- `phase1_auth_multi_greenhouse.sql`
- `pfaff_greencontrol_v2.sql`
- `notification_settings.sql`
- `security_admin_devices_audit.sql`
- `automatic_alerts.sql`
- `schedule_alert_checker_TEMPLATE.sql`

They overlap in tables, policies and functions. Replaying them after the
canonical baseline could restore obsolete policies or identity-based role
bootstrap behavior.

Historical files remain versioned for traceability. They are not deleted or
rewritten during P1.

## Production boundary

- Baseline creation is isolated-environment-only.
- Production schema changes require a separately approved linear migration.
- Data-quality audits are read-only.
- Firmware and application runtime behavior are outside this build path.
