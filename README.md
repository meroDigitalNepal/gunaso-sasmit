# Gunaso — Civic Feedback Platform

Gunaso is a civic feedback platform where citizens can submit questions and complaints to their local MPs, and MPs' teams can process and respond to them.

## Stack

- **Frontend:** React + Vite (deployed on Vercel)
- **UI:** [`@mero-nepal/ui`](https://www.npmjs.com/package/@mero-nepal/ui) — the shared Mero Digital Nepal design system. The client uses its components and the `mdn-light` theme so it stays visually consistent with the rest of the suite.
- **Backend:** Node.js + Express (deployed as Vercel Serverless or standalone)
- **Storage:** JSON file (MVP) — easily swappable to Postgres

## Getting Started

### Install dependencies
```bash
npm run install:all
```

### Run development servers
```bash
# In separate terminals:
npm run dev:server   # http://localhost:3001
npm run dev:client   # http://localhost:5173
```

### Run tests
```bash
npm test
```

Server tests can also be run directly:
```bash
cd server
npm test
```

## API

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/submissions | Create new submission |
| GET | /api/submissions | List all submissions |
| GET | /api/submissions/:id | Get single submission |
| PATCH | /api/submissions/:id | Update status / add response |
| GET | /api/submissions/track/:trackingId | Citizen tracking lookup |
