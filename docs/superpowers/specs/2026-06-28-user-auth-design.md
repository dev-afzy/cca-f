# User-based Sessions + OAuth Login — Design Spec

**Date:** 2026-06-28
**Status:** Approved direction, pending spec review → writing-plans

## Goal

Convert the CCA-F app from a single hardcoded `Student id="default"` into a real multi-user app: users sign in with GitHub or Google, each gets their own profile/mastery/exam data, and every route is scoped to the logged-in user.

## Decisions (locked in brainstorming)

- **Library:** Auth.js (NextAuth v5) for Next.js App Router.
- **Providers:** GitHub **and** Google (two sign-in buttons), with `allowDangerousEmailAccountLinking: true` so the same verified email links to one account across providers (safe — both providers return verified emails).
- **Account model:** Prisma adapter creates `User` / `Account` / `VerificationToken`. **Session strategy = JWT** (no DB session table) — this is deliberate: it avoids a name collision with the app's existing tutoring `Session` model and keeps the DB lighter.
- **Profile mapping:** `Student` becomes the per-user profile; `Student.id` = `User.id` (drop the `@default("default")`). All existing relations (mastery, sessions, exams, friction, …) become per-user unchanged.
- **Existing data:** on first sign-in, if an unclaimed `Student id="default"` exists, **re-key it to the new user** (claim-once) so the current progress carries over; later users get a fresh `Student`.
- **Access:** open sign-up — anyone with GitHub/Google can log in.
- **Gating:** `/chat`, `/exam/*`, `/ledger`, and all `/api/*` require a logged-in user; `/` (landing) is public (sign-in CTA when logged out, bento when logged in).

## Architecture

### Auth wiring (`src/lib/auth.ts` + route + middleware)

- `src/lib/auth.ts` — `NextAuth({...})` config: `PrismaAdapter(prisma)`, `providers: [GitHub, Google]` (each with `allowDangerousEmailAccountLinking: true`), `session: { strategy: "jwt" }`, callbacks:
  - `jwt`: persist `user.id` (the `User.id`) onto the token on sign-in.
  - `session`: expose `session.user.id` from the token.
  - `events.signIn` (or the `createUser`/`signIn` callback): **ensure a `Student` exists for this user** — claim `default` if unclaimed, else create a fresh `Student` (see Claim logic).
  - Exports `handlers`, `auth`, `signIn`, `signOut`.
- `src/app/api/auth/[...nextauth]/route.ts` — re-exports `handlers` GET/POST.
- `middleware.ts` (project root) — protects `/chat`, `/exam/:path*`, `/ledger`; unauthenticated → redirect to the sign-in page. (API routes do their own `requireUser()` 401 — middleware covers page UX.)

### Data model (Prisma migration)

Add Auth.js models (JWT strategy → **no `Session` model needed for auth**, avoiding the collision):

```
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  student       Student?
}
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}
model VerificationToken {
  identifier String
  token      String
  expires    DateTime
  @@unique([identifier, token])
}
```

`Student` changes: `id String @id` (remove `@default("default")`) and add a relation to `User` (`user User @relation(fields:[id], references:[id], onDelete: Cascade)`) — i.e., `Student.id` IS the `User.id`. The existing tutoring `Session` model is **unchanged**.

### Per-user scoping (the security core)

- `src/lib/current-user.ts` — `requireUserId(): Promise<string>` (calls `auth()`, returns `session.user.id`, throws/redirects if absent) for pages, and `requireUserIdApi(): Promise<string | NextResponse>` (returns 401 JSON if absent) for API routes.
- Replace all **62 `"default"` / `STUDENT_ID` references across 17 files** with the resolved user id. The libs already take `studentId` as a parameter, so the change is at the call sites: resolve the user, pass `user.id`. Files: the 5 `/api/exam/*` + `/api/ledger/*` + `/api/session/end` + `/api/turn/*` routes, the `/chat`, `/exam`, `/exam/[attemptId]`(+result), `/ledger`, `/` pages, `prisma/seed.ts`, `scripts/reset-sprint.ts`.
- `prisma/seed.ts` / `reset-sprint.ts`: these are dev/admin scripts — keep a `--student <id>` arg (default to a clearly-labeled `seed-demo` id or skip the Student upsert), since they run outside an auth context. Seeding concepts/questions stays global (not per-user).

### Claim-default-on-first-login (`src/lib/claim-default.ts`)

On first sign-in for a user with no `Student`:
- If `Student id="default"` exists AND no other Student has claimed it: `await prisma.student.update({ where:{id:"default"}, data:{ id: userId } })` — FKs are `ON UPDATE CASCADE`, so all child rows follow. (Guard with a transaction + existence check so two simultaneous first-logins can't both claim.)
- Else: create a fresh `Student { id: userId, sprintStartDate: now, targetExamDate: now+23d, currentHour: 0, ... }` (mirroring `prisma/seed.ts`'s student defaults).
- Seed `ConceptMastery` rows (0%) for the new student for all concepts (as `seed.ts` does).

### UI

- **Sign-in page** (`/login` or use Auth.js default) — "Continue with GitHub" / "Continue with Google" buttons.
- **Landing `/`** — public; if logged out, show the brand + sign-in CTA; if logged in, the existing bento (now scoped to the user). Add a small **sign-out** + user avatar/name in a header (landing + chat sidebar).
- Build with the existing Tailwind/Inter styling; use `frontend-design` only if the sign-in page needs polish.

## Environment & OAuth app setup

New `.env` keys: `AUTH_SECRET` (generate via `npx auth secret`), `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL` (e.g. `http://localhost:3000`). `.env.example` updated. The plan includes step-by-step for registering both OAuth apps (callbacks: `${AUTH_URL}/api/auth/callback/github` and `/google`). **The user supplies the four provider credentials.**

## Verification

No test framework. Per task: `npm run build` type-clean (Node ≥22) + `npm run validate:content` still green. Auth-specific runtime checks that DON'T need real creds: unauthenticated GET `/chat` → redirect to sign-in; unauthenticated POST `/api/turn` → 401; `auth()` returns null when no cookie. End-to-end OAuth sign-in is verified by the user once they add provider credentials. A claim-default check: simulate a first user, confirm the `default` Student re-keys to their id and child rows follow (DB-level, with a backup).

## Out of scope (YAGNI)

- The `cca-f-tutor` CLI skill + its local file ledger (`~/.cca-f-tutor`) stays single-user/local — unrelated to web auth.
- Hosting/deployment (libsql is a local file today); design stays deploy-agnostic via `AUTH_URL`.
- Roles/admin, email-magic-link, password auth, profile editing — not now.

## Open defaults (vetoable at spec review)

1. Sign-in via a custom `/login` page (two branded buttons) rather than the default Auth.js page.
2. `prisma/seed.ts` no longer creates a `Student` (concepts/questions only); the per-user Student is created at first login. `reset-sprint.ts` takes an explicit student id.
3. Claim is first-come (the first ever sign-in claims `default`); acceptable since it's your app and you'll be first.
