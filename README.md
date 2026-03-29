# RecoverPay — Failed Payment Recovery Service

RecoverPay is a high-performance, developer-first solution for automated failed payment recovery targeting **Razorpay** ecosystems. It listens for `payment.failed` events, generates secure payment links, and automates customer outreach to recover lost revenue.

![RecoverPay Dashboard Screenshot](https://raw.githubusercontent.com/placeholder-images/recover-pay-dashboard.png)

## 💸 Why RecoverPay?

- **Revenue Recovery**: Automatically converts failed transactions into successful ones.
- **Razorpay Native**: Seamless Webhook integration and Payment Link generation.
- **Automated Dunning**: Smart retry sequence (Day 0, Day 2, Day 5) via email reminders.
- **Developer First**: Built with Bun + Express for low latency and high reliability.
- **Modern UI**: Next-gen dark-mode dashboard with real-time recovery metrics.

## 🚀 Features

- **Webhook Processor**: Idempotent handling of Razorpay events (Failed, Captured).
- **Background Worker**: Dedicated process for tracking expirations and scheduling reminders.
- **Audit Logs**: Full transparency on every recovery attempt and customer outreach.
- **Security Hardened**: 
  - Razorpay HMAC-SHA256 signature verification.
  - Double-submit CSRF protection for dashboard operations.
  - Secure, cookie-based merchant authentication.

## 🛠️ Tech Stack

- **Backend**: [Bun](https://bun.sh/), [Express](https://expressjs.com/), [Prisma](https://www.prisma.io/).
- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS 4](https://tailwindcss.com/).
- **Database**: SQLite (default) or PostgreSQL (Ready for production).

## 📦 Getting Started

### 1. Installation
Clone the repository and install dependencies in both folders:

```bash
# Backend setup
cd backend && bun install

# Frontend setup
cd frontend && npm install
```

### 2. Setup Environment
Create a `.env` file in the `backend` directory (see [.env.example](file:///d:/claude%20test/api%20monitoring/backend/.env.example)):

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-key"
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="your-key-secret"
RAZORPAY_WEBHOOK_SECRET="your-webhook-secret"
```

### 3. Database Initialization
```bash
cd backend
bunx prisma db push
```

### 4. Running the Application
To run the full recovery system, you must start both the API and the Worker:

**Start the Backend API:**
```bash
cd backend
bun run src/index.ts
```

**Start the Recovery Worker:**
```bash
cd backend
bun run src/worker.ts
```

**Start the Dashboard:**
```bash
cd frontend
npm run dev
```

The dashboard will be available at `http://localhost:5173`.

## 📜 License
MIT
