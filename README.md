# Smart Crop Advisory API

Production-oriented Express/MongoDB backend for PS-02, including passwordless OTP login, weather and mandi intelligence, multilingual advisories, risk scoring, and agricultural-officer escalation workflows.

## Run

1. Copy `.env.example` to `.env` and set at least `MONGODB_URI`, `JWT_SECRET`, and `ADMIN_API_KEY`.
2. Run `npm install` with Node.js 18 or later.
3. Run `npm run dev` (or `npm start`).

Redis is optional: if it cannot connect, the service uses an expiring in-memory cache. Set `FAST2SMS_ENABLED=true` and `FAST2SMS_API_KEY` for real SMS; development mode logs a sandbox OTP instead.

## API surface

- `POST /api/v1/auth/send-otp`, `POST /api/v1/auth/verify-otp`
- `POST /api/v1/farmer/onboard`, `GET /api/v1/farmer/profile`, `GET /api/v1/farmer/dashboard`, `POST /api/v1/farmer/trigger-risk-eval`
- `GET /api/v1/admin/distress-map`, `GET /api/v1/admin/alerts`, `PATCH /api/v1/admin/alerts/:id/status`

Farmer routes require `Authorization: Bearer <JWT>`. Admin routes require `X-Admin-API-Key`; put this behind your organization’s identity gateway in production.
