# Dream Events

Dream Events is a static website with Vercel Functions for event inquiries, package reservations, public content, and the private site manager.

## Local preview

Use Node.js 18 or newer:

```powershell
npm start
```

Open `http://127.0.0.1:3000`. Public content and form submissions need the Supabase and Resend environment variables below; without them the website reports that those services are not configured.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql).
3. In Authentication, create or invite the authorized admin account `jayawardana.seniru@gmail.com` and set a password for it. Disable public sign-ups.
4. Configure the Supabase site URL and redirect allow list to include your deployed domain and its `/admin.html` path.
5. Copy the project URL, anon key, and service-role key from the Supabase API settings.

The service-role key is server-only. Never add it to frontend files or commit it to source control.

## Resend setup

Verify a sender domain or address in Resend, create an API key, and use that verified sender as `RESEND_FROM_EMAIL`. Reservation, event, and sponsor inquiries are saved to Supabase first; Resend then sends a notification to Dream Events and a confirmation to the customer.

If email delivery is unavailable after a submission is saved, the form explicitly tells the customer that their request was recorded and provides the Dream Events contact email. The request remains available in the admin inbox.

## Vercel environment variables

Add these variables to the Vercel project (and redeploy after changing them). `.env.example` lists the variable names and placeholder values for local setup; keep real values in your local environment or Vercel settings.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key; used only for validating admin sessions and authentication |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key; server-side only |
| `ADMIN_EMAIL` | `jayawardana.seniru@gmail.com` |
| `PUBLIC_SITE_URL` | `https://dream-events-eta.vercel.app` (update if you attach a custom domain) |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Verified sender, for example `Dream Events <notifications@your-verified-domain>` |
| `RESERVATION_EMAIL_TO` | Optional notification destination; defaults to `dreammakerofc@gmail.com` |

`PUBLIC_SITE_URL` powers the admin magic-link redirect. Add the deployed URL to Supabase's allowed redirect URLs as well. If the admin account does not have a password yet, use Supabase Authentication to set one; the admin page also keeps email-link sign-in available. If you attach a custom domain, also update the canonical/social URLs in the public page heads and the domain in `frontend/robots.txt` and `frontend/sitemap.xml`.

## Site manager

Visit `/admin.html` and sign in with the authorized admin email and password, or request a one-time email sign-in link. The server accepts only the email in `ADMIN_EMAIL`, and verifies each dashboard request against Supabase Auth. The manager supports:

- Publishing or editing upcoming event calendar entries.
- Publishing approved client testimonials and partner logos.
- Viewing reservations, event inquiries, and sponsor leads; tracking each as new, contacted, or closed.

New content remains unpublished until explicitly approved in the manager. Add events, approved testimonials, and partner logos there; the public site does not use invented sample content.

## Forms and APIs

- `POST /api/reservation` saves package reservations and emails the team and customer.
- `POST /api/inquiry` handles event and sponsor inquiries.
- `GET /api/content?type=events|testimonials|sponsors` returns published website content.
- `/api/admin-auth` authenticates the authorized admin by password or sends a Supabase magic link.
- `/api/admin?resource=events|testimonials|sponsors|inquiries` provides authenticated dashboard operations.
- `/api/health` is the deployment health check.

The public event calendar and partner/testimonial sections are empty until content is published. The existing past-event gallery can be filtered by category without adding any unverified material.

## Search and sharing

Each indexable page has a page-specific title, description, canonical URL, and social-sharing metadata. The home page includes Organization and WebSite structured data. The static `/robots.txt` and `/sitemap.xml` are configured for the current Vercel domain; verify both after deployment and submit the sitemap in your search console.
