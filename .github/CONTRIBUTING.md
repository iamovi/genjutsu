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

### database setup

the quickest way to set up your database is using the consolidated `init.sql` script.

**option 1: consolidated setup (recommended for fresh projects)**

1. go to your supabase project dashboard.
2. navigate to the **sql editor**.
3. copy the entire content of `supabase/init.sql` and run it.
4. this handles all tables, extensions, rpcs, and security policies in one go.

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

open http://localhost:5173

### important: never commit credentials

make sure your `.gitignore` includes:
```
.env
.env.local
.env.*.local
```

the supabase migrations in `supabase/migrations/` should be committed (they're public sql), but never commit files with actual credentials.

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
- better mobile experience
- tests (we need more tests)

### medium priority
- trending tags algorithm
- notification system
- user mentions
- search functionality

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
