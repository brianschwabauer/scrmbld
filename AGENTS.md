# AGENTS.md — SCRMBLD Codebase Guide

## Project Overview

SCRMBLD is a daily word puzzle game (live at https://scrmbld.app). Players find a 7-letter word from 8 scrambled letters. Features include authentication, friend system, user profiles, game statistics, and share functionality.

## Tech Stack

- **Framework:** SvelteKit 2 with Svelte 5 (runes-based reactivity)
- **Language:** TypeScript (strict mode)
- **Styling:** SCSS, inline `<style lang="scss">` blocks
- **Font:** Roboto Mono (monospace)
- **Database:** Cloudflare D1 (SQLite on the edge)
- **ORM:** Drizzle ORM with SQLite dialect
- **Auth:** Better Auth (email/password, magic link, Google OAuth)
- **Email:** Resend (`no-reply@updates.scrmbld.app`)
- **Hosting:** Cloudflare Workers + Pages
- **Package Manager:** pnpm (v10.28)
- **Build Tool:** Vite 6

## Commands

| Command        | Purpose                            |
| -------------- | ---------------------------------- |
| `pnpm dev`     | Start local dev server (port 5173) |
| `pnpm build`   | Production build                   |
| `pnpm preview` | Preview production build locally   |
| `pnpm check`   | TypeScript + Svelte type checking  |
| `pnpm lint`    | Run Prettier check + ESLint        |
| `pnpm format`  | Auto-format with Prettier          |

There is no test suite configured. Validate changes with `pnpm check` and `pnpm lint`.

## Project Structure

```
src/
├── app.d.ts                    # Global types (App.Platform, CloudflareEnvVariables)
├── app.html                    # HTML shell
├── hooks.server.ts             # Server hooks (auth handler, error handler)
├── lib/
│   ├── server/                 # SERVER-ONLY modules (never import from client)
│   │   ├── auth.ts             # Better Auth init (initAuth(d1))
│   │   ├── db.ts               # Drizzle DB init (createDb(d1))
│   │   ├── schema.ts           # All Drizzle table definitions
│   │   └── daily-word.server.ts # Daily word selection logic
│   ├── auth-client.ts          # Better Auth client (signIn, signUp, signOut, etc.)
│   ├── audio.ts                # Web Audio API sound effects
│   ├── math.ts                 # Seeded RNG for deterministic shuffling
│   ├── ripple.ts               # Material Design ripple Svelte action
│   ├── tootltip.ts             # Tooltip Svelte action (note: filename typo is intentional)
│   ├── components/
│   │   ├── FlipText.svelte     # Split-flap letter animation (core game UI)
│   │   ├── Keyboard.svelte     # Virtual QWERTY keyboard
│   │   ├── Popover.svelte      # Floating UI popover
│   │   ├── BottomNav.svelte    # Bottom navigation bar
│   │   └── Expand.svelte       # Collapsible content
│   └── index.ts                # Barrel exports
├── routes/
│   ├── +layout.svelte          # Root layout (meta tags, audio init, global styles)
│   ├── +layout.server.ts       # Root server load (session + today's game check)
│   ├── +page.svelte            # Home/landing page
│   ├── play/
│   │   ├── +page.svelte        # Main 7-letter game
│   │   ├── +page.server.ts     # Loads daily words
│   │   └── 5/                  # 5-letter game variant
│   ├── results/[gameplay_id]/  # Post-game results + share
│   ├── account/                # Profile editing, password, linked accounts
│   │   └── setup/              # First-time account setup wizard
│   ├── friends/                # Friend list, requests, management
│   ├── user/[username]/        # Public user profiles + stats
│   ├── (auth)/                 # Auth pages (grouped, no URL prefix)
│   │   ├── signin/             # Sign in (+ magic-link sub-route)
│   │   ├── signup/             # Registration
│   │   ├── verify-email/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── (misc)/                 # Help, stats, legal pages
│   └── api/                    # REST API endpoints
│       ├── gameplay/           # POST create, POST finish
│       ├── generate/           # GET word generation (dev tool)
│       └── newsletter/signup/  # POST newsletter signup
static/
├── wordlist.json               # Word list (source of truth for daily words)
├── *.txt                       # Additional word lists for validation
├── sounds/                     # Audio assets
└── logos/                      # App logos and images
migrations/                     # Drizzle SQL migration files
```

## Database Schema (`src/lib/server/schema.ts`)

### Auth tables (managed by Better Auth)

- **user** — `id`, `email` (unique), `name`, `username` (unique, optional), `emailVerified`, `profileVisibility` ('public'|'friends'), `image`, `createdAt`, `updatedAt`
- **session** — `id`, `token`, `expiresAt`, `userId` (FK→user), `ipAddress`, `userAgent`
- **account** — `id`, `accountId`, `providerId` ('google', 'credential'), `userId` (FK→user), OAuth tokens, `password`
- **verification** — `id`, `identifier`, `value`, `expiresAt`

### Application tables

- **gameplay** — `id` (auto-increment), `uuid`, `userUuid` (anonymous cookie ID), `userId` (FK→user, nullable), `day` (UTC epoch of day start), `startedAt`, `endedAt`, `time`, `won`
- **friendship** — `id`, `userId1` (FK→user), `userId2` (FK→user), `status` ('pending'|'accepted'), `createdAt`

### Migrations

Run with Drizzle Kit. Config in `drizzle.config.ts`. Output to `migrations/`. The D1 database binding is `D1`.

## Authentication Flow

Server-side auth is initialized per-request in `hooks.server.ts` via `initAuth(platform.env.D1)`. The `svelteKitHandler` from Better Auth intercepts auth API routes automatically.

Client-side auth uses `$lib/auth-client.ts` which exports `signIn`, `signUp`, `signOut`, `useSession`, `sendVerificationEmail`.

Session data is loaded in the root `+layout.server.ts` and available to all pages via `data.session`.

Cookie prefix: `scrmbld-auth`. Anonymous users get a `scrmbld_user_uuid` cookie for tracking gameplay before sign-up.

## API Endpoints

| Method | Path                                 | Purpose                                      |
| ------ | ------------------------------------ | -------------------------------------------- |
| POST   | `/api/gameplay`                      | Create gameplay session → returns `{ uuid }` |
| POST   | `/api/gameplay/[gameplay_id]/finish` | Complete gameplay with timing data           |
| GET    | `/api/generate`                      | Generate 7-letter puzzle (dev tool)          |
| GET    | `/api/generate/5`                    | Generate 5-letter puzzle (dev tool)          |
| POST   | `/api/newsletter/signup`             | Newsletter subscription                      |

## Key Patterns

### Svelte 5 Runes

This project uses Svelte 5 with runes. Do NOT use Svelte 4 syntax (`$:`, `export let`, stores).

- `$state()` for reactive state
- `$derived` / `$derived.by()` for computed values
- `$effect()` for side effects
- `$props()` for component props
- `$bindable()` for two-way binding
- `{@render children()}` for slot content (not `<slot>`)

### Accessing Platform/DB

The D1 database is accessed through `event.platform.env.D1` in server code. Always guard with `if (!platform?.env?.D1)` for local dev without Wrangler.

```ts
const db = createDb(platform.env.D1);
const auth = initAuth(platform.env.D1);
```

### Route Groups

Parenthesized directories like `(auth)` and `(misc)` group routes without adding URL segments. Routes inside `(auth)/signin/` map to `/signin`.

### SvelteKit File Conventions

- `+page.svelte` — Page component
- `+page.server.ts` — Server-side load function (runs on server only)
- `+layout.svelte` — Layout wrapper
- `+layout.server.ts` — Layout server load
- `+server.ts` — API endpoint (GET, POST, etc.)

### Styling

SCSS is used inside `<style lang="scss">` blocks. Global styles are in `+layout.svelte`. The app uses a dark theme (background `#444`, text `#eee`).

### Error Handling

- `throw error(status, message)` for HTTP errors in load functions
- `throw redirect(status, path)` for redirects
- `handleError` in `hooks.server.ts` catches unhandled errors

## Environment Variables

Set in `.env` locally, configured as Cloudflare Worker secrets in production:

| Variable               | Purpose                    |
| ---------------------- | -------------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID     |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `RESEND_API_KEY`       | Resend email API key       |
| `BETTER_AUTH_SECRET`   | Session signing secret     |

These are accessed via `$env/dynamic/private` or `platform.env`.

## Code Style

- **Prettier:** Tabs, single quotes, trailing commas, 100-char print width
- **Formatter:** `pnpm format` before committing
- **Svelte files:** Parsed with `prettier-plugin-svelte`
- **Naming:** PascalCase for components, camelCase for utilities, kebab-case for routes

## Deployment

- Deploys to Cloudflare Workers via Wrangler
- Production domain: `scrmbld.app`
- Production DB: `scrmbld` (D1)
- Staging DB: `scrmbld-staging` (D1, via `wrangler.jsonc` `env.preview`)
- Build outputs to `.svelte-kit/cloudflare/_worker.js`

## Common Tasks

### Adding a new page

1. Create `src/routes/your-page/+page.svelte`
2. If server data is needed, add `+page.server.ts` with a `load` function
3. Access session via `data.session` (provided by root layout)

### Adding a new API endpoint

1. Create `src/routes/api/your-endpoint/+server.ts`
2. Export named functions: `GET`, `POST`, `PUT`, `DELETE`
3. Access D1 via `event.platform.env.D1`

### Modifying the database schema

1. Edit `src/lib/server/schema.ts`
2. Run `npx drizzle-kit generate` to create a migration in `migrations/`
3. Apply with `npx wrangler d1 migrations apply scrmbld` (or `--local` for dev)

### Adding a new component

1. Create in `src/lib/` (top-level for small utils, in a subdirectory for larger components)
2. Use Svelte 5 runes syntax
3. Export from `src/lib/index.ts` if it's a shared utility
