# PayRecover

Recover failed Razorpay payments automatically.

- Detect failed payments the instant they happen
- Retry with smart scheduling (Day 0 → 24h → 72h)
- Send automated email reminders with direct payment links
- Recover lost revenue — no manual follow-up required

## Results

Users recover 10–30% of failed payments automatically.

---

## How It Works

1. Customer's payment fails on Razorpay
2. PayRecover receives the webhook instantly
3. A recovery link is generated and emailed to the customer
4. If no action, two follow-up reminders go out automatically
5. When the customer pays, the payment is marked recovered

---

## Tech Stack

- **Backend**: Bun, Express, Prisma, SQLite
- **Frontend**: React 19, Vite, Tailwind CSS 4
- **Payments**: Razorpay Webhooks + Payment Links API

---

## Getting Started

### 1. Install dependencies

```bash
cd backend && bun install
cd frontend && npm install
```

### 2. Configure environment

Create `backend/.env`:

```env
PORT=3000
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="change-this-before-deploying"
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="your-key-secret"
RAZORPAY_WEBHOOK_SECRET="your-webhook-secret"
```

### 3. Initialize database

```bash
cd backend
bunx prisma migrate deploy
```

### 4. Run

Start the API server:

```bash
cd backend && bun run src/index.ts
```

Start the recovery worker (separate process):

```bash
cd backend && bun run src/worker.ts
```

Start the dashboard:

```bash
cd frontend && npm run dev
```

Dashboard: `http://localhost:5173`

---

## Plans

| Feature | Free | Pro |
|---|---|---|
| Track failed payments | Yes | Yes |
| Dashboard access | Yes | Yes |
| Manual retry | Yes | Yes |
| Auto retry × 3 | No | Yes |
| Email reminders | No | Yes |
| Razorpay recovery links | No | Yes |

---

## Architecture

```
src/
  index.ts       # Server entry (start listening)
  app.ts         # Express setup (middleware, routes)
  worker.ts      # Background recovery worker (runs hourly)
  controllers/   # Route handlers
  services/      # Business logic (payment, razorpay, email, auth)
  routes/        # Route definitions
  middleware/    # Auth, error handling, rate limiting
  validators/    # Zod input validation
```

---

## License

MIT
