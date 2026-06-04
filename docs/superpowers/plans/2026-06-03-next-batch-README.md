# Next Batch — Three Features (2026-06-03)

Planned with Matt after merging member-management (#2) and structured-list-fields (#3) to `main`. Each is independent — execute in any order, **one branch off `main` per feature**, via superpowers:subagent-driven-development (spec + quality review between tasks), same as the last two.

| Feature | Spec | Plan | External prereq (Matt) |
|---|---|---|---|
| **Auth: 6-digit OTP code** | `specs/2026-06-03-auth-otp-design.md` | `plans/2026-06-03-auth-otp.md` | Add `{{ .Token }}` to the Supabase **Magic Link** email template (dashboard) before e2e |
| **Property form: address-first Mapbox** | `specs/2026-06-03-property-address-mapbox-design.md` | `plans/2026-06-03-property-address-mapbox.md` | Set `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local` for the autocomplete (degrades gracefully without it) |
| **Trip weather (Open-Meteo)** | `specs/2026-06-03-trip-weather-design.md` | `plans/2026-06-03-trip-weather.md` | None — keyless API |

## Why these / context
- **Auth OTP** addresses the two friction points Matt called out: the email round-trip and wrong-device/PKCE link failures. A typed code (`verifyOtp`) fixes both, keeps the magic link as fallback, stays password-free.
- **Property Mapbox** completes the address-surfacing started in list-fields — ports the trip-edit form's address-leads pattern into the property form (used by the new-trip flow, `/properties/new`, and property edit).
- **Weather** is a delight add (off the committed roadmap) — a forecast card on the trip guide, constrained to the ~16-day forecast window with graceful states for far-out/TBD/past trips.

## Suggested order
No hard dependencies. If picking: **property-Mapbox** (smallest, one component) → **auth-OTP** (highest user value) → **weather** (most net-new). Each ships as its own PR.

## Roadmap note
After this batch, the committed roadmap items remaining are **v1.3 message board** and **v1.4 availability polling** — and the still-outstanding **real-trip dogfood** (§4 hard rule), which these UX fixes were partly motivated by.
