# Uteo — Admin Dashboard

**Your Dream Job Finds You.**

Uteo Admin is the internal operations and moderation dashboard for the Uteo recruitment platform. Built on Next.js 14, it gives the Uteo team full visibility and control over users, companies, jobs, applications, and platform analytics.

## What the Admin Panel Does

- **Platform Dashboard** — KPI cards (users, jobs, applications, companies), bar charts, activity tables
- **User Management** — Search, filter, view profiles, suspend/activate accounts, inspect recruitment activity
- **Company Management** — Verify/unverify employers, view company details and active job listings
- **Job Moderation** — Approve, reject, or deactivate job postings; review flagged content
- **Application Overview** — Read-only view of the full application pipeline across the platform
- **Reports & Moderation** — Handle user-reported content, issue warnings, resolve disputes
- **Analytics** — Recruitment funnel metrics, skills demand trends, job type breakdowns, user growth
- **Notifications** — Broadcast announcements to users or segments
- **Role Management** — Assign and revoke admin roles (SUPER_ADMIN, ADMIN, MODERATOR)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Auth | JWT-protected (admin roles only) |

## Project Structure

```
src/
├── app/
│   └── (dashboard)/
│       └── dashboard/
│           ├── page.tsx           # Main dashboard + KPIs
│           ├── users/             # User list + detail
│           ├── companies/         # Company list + detail
│           ├── jobs/              # Job moderation
│           ├── applications/      # Applications overview
│           ├── reports/           # Moderation queue
│           ├── analytics/         # Platform + job analytics
│           ├── notifications/     # Push notifications
│           └── settings/          # System settings
├── components/
│   └── layout/
│       └── Sidebar.tsx            # Full navigation sidebar
└── lib/
    ├── api.ts                     # Axios + interceptors
    ├── rbac.ts                    # Route-level RBAC definitions
    └── services/                  # Admin API service modules
```

## Access Control

| Role | Access |
|---|---|
| `SUPER_ADMIN` | Full access — all sections including roles and settings |
| `ADMIN` | Users, companies, jobs, applications, analytics |
| `MODERATOR` | Reports and moderation queue only |

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL to your backend URL

# Start development server
npm run dev
```

## License

Private — © 2026 Uteo
