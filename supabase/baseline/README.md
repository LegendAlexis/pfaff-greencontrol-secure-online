# GreenControl database baseline

This directory is the canonical structural build source for isolated
GreenControl Supabase environments.

## Order

1. `001_public_schema.sql`
2. `002_p0_security_target.sql`
3. later, explicitly approved linear migrations

`001_public_schema.sql` is derived from the verified PostgreSQL 17.6
schema-only production export with SHA-256
`E1BD8BD9207A3F19FDDE3C772F33C4047348F2A2A89CE4B698963E0904546073`.
It contains no table data. The two personal bootstrap email literals were
replaced with deterministic `example.invalid` identities; no other structural
change was made.

The export predates the P0 hardening and intentionally contains no grants.
`002_p0_security_target.sql` records the confirmed P0 RLS state and the
read-only measured `service_role` table and sequence ACLs.

## Boundaries

- These files require a Supabase environment because the schema references
  `auth.users` and Supabase roles.
- Never run them directly against production.
- Always use a harness that binds host, project ref, database user and database
  name in the same command.
- Historical SQL files in the parent `supabase/` directory remain evidence of
  earlier evolution; they are not an ordered rebuild path.
- The public-only export cannot prove triggers on `auth.users`, role
  memberships, schema privileges or unmeasured grants. Those remain explicit
  gates and must not be guessed.
- No organization, site, tenant, firmware or feature migration belongs in this
  baseline.
