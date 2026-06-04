# Auth: 6-Digit OTP Code Entry — Design Spec

**Date:** 2026-06-03
**Status:** Approved, pending implementation (next session)

## Goal

Let users sign in (and guests convert) by typing a **6-digit code** emailed to them, as an alternative to clicking the magic link. Keep the magic link working as a fallback.

## Why

Two pains, both fixed by a typed code (decided with Matt):
1. **The email round-trip** — clicking a link means leaving the app, finding the email, returning. Typing a code keeps you in the flow.
2. **Wrong-device / link failures** — the magic link is PKCE-bound and must open on the *same* device/browser that requested it, or `exchangeCodeForSession` fails. `verifyOtp({ type: "email" })` is **not** device-bound, so a code typed anywhere works.

Stays password-free and on-ethos (§3.2 "no registration form"). No new vendor.

## How it works

Today (`login-form.tsx`, `join-form.tsx`) both call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo, data } })`, which emails a magic link, then show a "check your email" screen. The session completes server-side at `/auth/callback` via `exchangeCodeForSession`.

`signInWithOtp` already emails a **6-digit token** too — it's just not shown because the Supabase email template only renders `{{ .ConfirmationURL }}`. Add `{{ .Token }}` to the template (dashboard) and the same email carries both a clickable link **and** a code.

New flow:
1. User submits email → `signInWithOtp(...)` (unchanged call).
2. Instead of a dead-end "check your email" screen, show a **code-entry step**: "Enter the 6-digit code we sent to {email}" with a numeric input, plus secondary text "…or just click the link in the email."
3. On submit, call `supabase.auth.verifyOtp({ email, token, type: "email" })` client-side. On success the `@supabase/ssr` browser client writes the session cookie; navigate to the destination (server components then see the session).
4. The magic link still works in parallel (→ `/auth/callback` → `exchangeCodeForSession`), unchanged.

## Decisions

- **Both entry points get it:** the login form (`app/(auth)/login/login-form.tsx`, → `/dashboard`) and the join form (`app/trip/[token]/join/join-form.tsx`, → `/trip/[token]/join/complete`). The join form must keep passing `options.data.display_name` and `shouldCreateUser` default (true) so guest accounts are still created and the name reaches `handle_new_user`.
- **One shared component:** a new `components/auth/otp-code-step.tsx` renders the code-entry UI + runs `verifyOtp` + calls an `onVerified()` callback, so both forms reuse it (and the "check your email" screens converge on it).
- **Magic link stays** as a fallback — no change to `/auth/callback/route.ts`.
- **Resend / "use a different email":** the code step offers "Resend code" (re-calls `signInWithOtp`) and "← change email" (back to the email step).
- **Destination after verify:** login → `router.push("/dashboard")` then `router.refresh()`; join → `router.push("/trip/{token}/join/complete")` (which runs the existing `consumeInviteAndJoin` server action against the now-authenticated session).

## Dashboard prerequisite (Matt, one-time)

Supabase Dashboard → Authentication → Email Templates → **Magic Link**: add the token to the template body, e.g.

```
<p>Your code is <strong>{{ .Token }}</strong> (valid for 1 hour), or click the link below:</p>
<p><a href="{{ .ConfirmationURL }}">Sign in to Roost</a></p>
```

Without this the link still works but no code is shown. (Also: Supabase Auth's default email rate limit is ~30/hr; custom SMTP via Resend is already on the radar for production — unrelated to this change but relevant at volume.)

## UI

- Code input: single `<input inputMode="numeric" autoComplete="one-time-code" maxLength={6}>` (mobile shows the numeric keypad and offers OS autofill of the SMS/email code), brand-styled, large tracking. (A 6-box split input is a nice-to-have, not required — one field is simpler and autofill-friendly.)
- States: idle → verifying (spinner, disabled) → error ("That code didn't match — check the email or resend"). 44px targets, `transition-colors` only, Lucide icons.
- Reuses `Input`/`Button`/`Label` and the existing card/confirmation visual structure.

## Out of scope

Google/Apple OAuth (separate, optional later), SMS OTP, password auth, changing the magic-link callback, rate-limit/SMTP config (dashboard).

## Acceptance

- From login and from a trip invite, a user can enter their email, receive an email with a 6-digit code, type the code, and land authenticated (dashboard / join-complete) — on the same or a different device, without clicking the link.
- The magic link still works. Guest conversion still creates the member + grant (name preserved). tsc/lint/build pass.
