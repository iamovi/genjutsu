# contributing to genjutsu

thanks for your interest in contributing. this guide will help you get started.

## how to contribute

### reporting bugs

found a bug? open an issue with:
- clear description of the problem
- steps to reproduce
- expected vs actual behavior
- screenshots if relevant
- your browser and os

### suggesting features

have an idea? open an issue with:
- what problem it solves
- how it should work
- any implementation ideas

### code contributions

we welcome pull requests. here's the process:

1. fork the repo
2. create a branch (`git checkout -b feature/your-feature`)
3. make your changes
4. test locally
5. commit with clear messages
6. push and open a pull request

## development setup

### prerequisites

- node.js 18+
- npm or pnpm
- supabase account (free tier works)
- supabase cli (optional but recommended)

### installation

```bash
# fork and clone
git clone https://github.com/yourusername/genjutsu.git
cd genjutsu

# install dependencies
npm install

# copy env file
cp .env.example .env
# add your supabase credentials to .env

# important: never commit your .env file
# it should already be in .gitignore
```

> **Note on Google OAuth:** You do **not** need to add Google Client IDs to the `.env` file for Supabase Google authentication to work. Go to your Supabase Project Dashboard -> Authentication -> Providers -> Google, and enter your credentials there. The Supabase JS Client handles the redirect automatically!

### database setup

the quickest way to set up your database is using the consolidated `init.sql` script.

**option 1: consolidated setup (recommended for fresh projects)**

1. go to your supabase project dashboard.
2. navigate to the **sql editor**.
3. copy the entire content of `supabase/init.sql` and run it.
4. this handles all tables, extensions, rpcs, and security policies in one go.
5. *(required for auto-cleanup tasks)*: genjutsu uses `pg_cron` to delete 24-hour-old data. to allow the cron to clean up storage files automatically, you must add your `service_role` key to the supabase vault. run this snippet in your sql editor:
   ```sql
   select vault.create_secret('supabase_service_role_key', 'your_service_role_key');
   ```

**option 2: local development with supabase cli**

if you prefer working locally:

```bash
# install supabase cli
npm install -g supabase

# login and link
supabase login
supabase link --project-ref your-project-ref

# reset/initialize
supabase db reset
```

**option 3: incremental migrations**

if you are updating an existing setup, run the migration files from `supabase/migrations/` in alphabetical order.

### start development server

```bash
npm run dev
```

open http://localhost:8080

### important: never commit credentials

make sure your `.gitignore` includes:
```
.env
.env.local
.env.*.local
```

the supabase migrations in `supabase/migrations/` should be committed (they're public sql), but never commit files with actual credentials.

### Edge Functions

genjutsu uses **supabase edge functions** for all server-side logic that requires secret API keys. sensitive credentials are stored in supabase vault and are never exposed to the frontend bundle.

**1. api-proxy (AI & stranger chat)**

the `api-proxy` edge function securely handles:
- **groq AI** requests (the `@ai` feature in community chat)
- **ably token auth** (real-time stranger chat connections)

secrets required in supabase vault:
- `GROQ_API_KEY` — your groq api key from https://console.groq.com
- `ABLY_KEY` — your ably api key from https://ably.com

```bash
# deploy the api-proxy function (no jwt verification — allows guest access)
supabase functions deploy api-proxy --no-verify-jwt
```

> **local development note:** when running locally (`localhost`), the app calls groq and ably directly using keys from your `.env` file. in production, all requests are routed through the edge function automatically.

**2. send-push (web push notifications)**

the `send-push` edge function dispatches native web push notifications for social alerts and whispers.

you need a pair of VAPID keys (generate them using `web-push` or online tools):
- add your public vapid key to `VITE_VAPID_PUBLIC_KEY` in your `.env`.
- add both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` as secrets in your supabase project.

```bash
# deploy the push notification function
supabase functions deploy send-push --no-verify-jwt
```

**3. database trigger**

ensure you have run the migrations in `supabase/migrations/` (specifically the one adding `send_whisper_push_notification`). the database trigger handles the automatic call to the edge function on specific table inserts.

## code style

we use:
- typescript for type safety
- eslint for linting
- prettier settings built into the project

before committing:
```bash
npm run lint
```

### naming conventions

- components: PascalCase (`UserProfile.tsx`)
- hooks: camelCase with 'use' prefix (`useAuth.ts`)
- utilities: camelCase (`formatDate.ts`)
- types: PascalCase (`PostWithProfile`)

### file structure

```
src/
  components/     - react components
  hooks/         - custom hooks
  pages/         - route pages
  lib/           - utilities
  integrations/  - supabase client
  types/         - type definitions
```

## commit messages

write clear commit messages:

good:
- "add github oauth login"
- "fix infinite scroll bug on mobile"
- "improve post loading performance"

not so good:
- "update"
- "fix bug"
- "changes"

## pull request guidelines

### before submitting

- test your changes locally
- make sure existing tests pass: `npm test`
- update relevant documentation
- keep changes focused (one feature per pr)

### pr description should include

- what does this pr do?
- why is this change needed?
- any breaking changes?
- screenshots for ui changes

### good first issues

look for issues labeled `good first issue` - these are:
- well-defined scope
- good for learning the codebase
- have clear acceptance criteria

## areas that need help

### high priority
- github oauth integration
- syntax highlighting for code blocks
- post export functionality
- better mobile experience (twa/pwa polish)
- tests (we need more tests)

### medium priority
- trending tags algorithm
- user mentions
- search functionality
- real-time collaborative voids

### nice to have
- browser extension
- api documentation
- mobile app (react native)

## database changes

if you need to modify the database:

1. create a new migration file in `supabase/migrations/`
2. name it with timestamp: `20260101120000_description.sql`
3. test it locally with `supabase db reset`
4. document what it changes
5. commit the migration file (migrations should be in git)

## testing

we use vitest for testing. run tests with:

```bash
npm test           # run once
npm run test:watch # watch mode
```

when adding features, add tests for:
- new components
- new hooks
- utility functions
- critical user flows

## performance considerations

this app needs to stay fast. when contributing:

- use react query for data fetching
- implement pagination for lists
- lazy load images
- minimize bundle size
- use proper indexes in database queries

## questions?

not sure about something? just ask:
- open an issue with your question
- tag it with `question` label
- we'll help you out

## code review process

1. maintainer reviews your pr
2. might request changes
3. you update the pr
4. once approved, we merge

typical review time: 1-3 days

## what we're looking for

- clean, readable code
- proper error handling
- responsive design
- accessibility (a11y) basics
- clear documentation

## what we're not looking for

- major architecture changes without discussion
- features that bloat the app unnecessarily
- breaking changes without migration path
- code that significantly slows down the app

## community guidelines

- be respectful
- help others learn
- give constructive feedback
- assume good intentions
- keep discussions focused

## licensing

by contributing, you agree that your contributions will be licensed under the mit license.

## recognition

all contributors are added to the contributors list. we appreciate every contribution, no matter how small.

---

ready to contribute? pick an issue and get started. if you're stuck, just ask.
