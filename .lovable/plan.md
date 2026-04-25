# Privacy Policy & Terms of Service

Add proper legal pages modeled after major social apps (Instagram, TikTok, Letterboxd) and link them from Settings.

## What you'll get

**Two new pages** — clean, readable, dark-themed, with back chevron matching the rest of Settings:

### Privacy Policy (`/privacy`)
1. Information We Collect (account, profile, content, usage, device, location, cookies, third-party sign-in, contacts)
2. How We Use Your Information
3. How Information Is Shared (other users, service providers, legal/safety, business transfers — explicit "we do not sell your data")
4. Cookies and Tracking
5. Data Retention (30-day deletion window)
6. Security
7. Children (13+, 16+ in EEA)
8. International Transfers
9. Your Rights (GDPR/CCPA-aligned: access, correct, delete, export, withdraw consent)
10. Changes to This Policy
11. Contact — `privacy@stampaway.app`

### Terms of Service (`/terms`)
1. Who Can Use Stampaway (age, account responsibility)
2. Your Account
3. Your Content (you own it; you grant Stampaway a license to host/display it)
4. Acceptable Use (no harassment, spam, scraping, ML training, impersonation, etc.)
5. Reporting and Moderation
6. Intellectual Property
7. Third-Party Content
8. Changes to the Service
9. Termination
10. Disclaimers ("as is")
11. Limitation of Liability
12. Indemnification
13. Governing Law
14. Changes to These Terms
15. Contact — `legal@stampaway.app`

Both pages reference real Stampaway features (logged places, reviews, lists, follows, AI-generated facts/posters, friend-from-contacts, Mapbox map) so they're not generic boilerplate.

## Where to find them in the app

Add a new **"About & Legal"** group to the bottom of Settings (above Sign Out), with two new rows:

```text
🛡️  Privacy Policy            >
📄  Terms of Service          >
```

Both use the same row pattern as the rest of Settings (icon + label + chevron).

## Auth page link

Below the sign-up button on `/auth`, add a tiny line of text:

> By signing up, you agree to our Terms of Service and Privacy Policy.

with both phrases linking to the new pages. This is what every social app does and is required by Apple App Store + Google Play review.

## Files

**New**
- `src/components/LegalDocument.tsx` — shared layout (back chevron, max-width, prose typography for long-form text)
- `src/pages/PrivacyPolicyPage.tsx`
- `src/pages/TermsOfServicePage.tsx`

**Edited**
- `src/App.tsx` — add `/privacy` and `/terms` routes (public, no auth required so they're reachable from the auth page)
- `src/pages/SettingsPage.tsx` — add Privacy Policy and Terms of Service rows
- `src/pages/AuthPage.tsx` — add the legal-consent footnote under the sign-up button
- `src/i18n/translations.ts` — add new keys `settings.privacyPolicy`, `settings.termsOfService`, `auth.legalConsent` for all 6 supported languages

## Design notes

- Dark theme, semantic tokens only (no hardcoded colors)
- Uses `@tailwindcss/typography` (already installed) for clean reading
- Mobile-first; comfortable line-height and spacing for long text
- Headings sticky-friendly, scrollable, max-width 2xl
- Clear "Last updated" date at the top
- Email links use `mailto:` so users can contact you in one tap

## Not included (let me know if you want them)

- Cookie banner / consent modal (only legally required if you target EEA users heavily — can add later)
- Multi-language translation of the full legal text (the page chrome is translated; the legal body stays in English for now since legally binding translations need a lawyer's review)
- Public website versions at `stampaway.app/privacy` (the in-app pages are sufficient for App Store / Play Store compliance)
