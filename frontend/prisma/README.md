# Database (Prisma)

PostgreSQL via [Neon](https://neon.tech), managed with Prisma ORM.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Run `pnpm run db:push` to sync your local DB to `schema.prisma`.

## How schema management works

- The schema is the single source of truth in `prisma/schema.prisma`; there are no migration files.
- Apply schema changes with `prisma db push`, which syncs the database to match the schema.
- The build script only runs `prisma generate` — it does not touch the database.

## Modifying the schema

1. Edit `prisma/schema.prisma`.
2. Apply it to your database:
   ```bash
   pnpm run db:push
   ```
3. Commit the schema change.
4. Run `pnpm run db:push` against the target database when deploying schema updates — the build does not do this for you.

## Available scripts

| Script | Command | Description |
|--------|---------|-------------|
| `db:push` | `prisma db push` | Sync the database to match `schema.prisma` |
| `db:pull` | `prisma db pull` | Pull schema from an existing DB |
| `db:generate` | `prisma generate` | Regenerate Prisma Client |
| `db:studio` | `prisma studio` | Open Prisma Studio GUI |
| `db:validate` | `prisma validate` | Validate schema file |
| `db:reset` | `prisma migrate reset --force --skip-seed && prisma db push` | Drop & recreate DB (destroys all data) |

## Rules

- `db:push` can drop columns/data if the schema removes them — review the diff Prisma prints before confirming on a shared database.
- **Never** use `db:reset` on production — it wipes everything.
