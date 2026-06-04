# Roost auth email templates

Branded HTML for the Supabase Auth emails (Postcard style — clean, warm, on the
Roost palette). These live in the repo for version control; Supabase serves them
from the **dashboard**, so they must be pasted in after any change here.

## Where they go

Supabase Dashboard → **Authentication → Email Templates**

| File | Dashboard template | Fires when |
|---|---|---|
| `magic-link.html` | **Magic Link** | An **existing** user requests a sign-in (login form). |
| `confirm-signup.html` | **Confirm signup** | A **new** user/guest is created — first-time join (`signInWithOtp` with `shouldCreateUser` default true). |

Both are needed: `signInWithOtp` routes existing users to *Magic Link* and brand-new
users to *Confirm signup*, so the OTP flow touches **both** depending on the account.

## The two required variables

- `{{ .Token }}` — the 6-digit code. **This is the line that makes the code show up.**
  Without it the email is link-only (the bug we hit).
- `{{ .ConfirmationURL }}` — the magic-link fallback (still works on the same device).

Both are case-sensitive and need the leading dot.

## Notes / constraints

- **Image-free by design** — no logo PNG to host or get blocked; the wordmark is type.
- Custom brand fonts can't load in email, so the display font falls back to a heavy
  wide stack (`'Arial Black', Impact`) and the body to `Georgia` serif — closest
  web-safe match to Söhne Breit / Roslindale.
- Table layout + inline CSS for Outlook; rounded corners degrade to square there.
- Light-mode locked (`color-scheme` meta) so dark-mode clients don't invert the palette.

## After editing

Re-paste the changed file into its dashboard template and send yourself a test
(login with an existing account → Magic Link; join as a new email → Confirm signup).
