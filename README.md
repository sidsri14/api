# PayRecover 🚀
### **Automatic Revenue Recovery for Modern Businesses**

PayRecover is a professional-grade failed payment recovery platform. We monitor your payment gateways in real-time and use multi-channel automation (Email, SMS, WhatsApp) to win back lost revenue while you sleep.

---

## ✨ Core Features

*   **⚡ Real-time Ingestion**: Instant detection of failed payments via secure Webhook integration.
*   **🤖 Multi-channel Recovery**: Automated sequences across Email, SMS, and WhatsApp (via Twilio).
*   **🎨 Custom Branding**: Personalized recovery links with your logo, colors, and signature.
*   **📊 Advanced Analytics**: deep-dive into recovery trends, conversion rates, and platform attribution (Mobile vs. Desktop).
*   **🛡️ Enterprise Security**: Built-in CSRF protection, secure JWT auth, and encrypted source connections.
*   **🤝 Team Management**: Invite teammates and manage permissions for a unified recovery operation.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Bun, Express, Node.js |
| **Database** | Prisma (ORM), SQLite (Production-ready on Railway) |
| **Frontend** | React 19, Vite, Tailwind CSS 4 |
| **Communications** | Resend (Email), Twilio (SMS/WhatsApp) |
| **Monitoring** | Integrated Health Checks & Live Logs |

---

## 🚀 Deployment

### **Production Environment**
*   **Frontend**: Deployed on **Vercel** ([pay-recover.vercel.app](https://pay-recover.vercel.app)).
*   **Backend & Worker**: Deployed on **Railway** with horizontal scaling support.

### **Local Setup**
1.  **Clone & Install**:
    ```bash
    git clone https://github.com/sidsri14/PayRecover.git
    cd PayRecover
    cd backend && bun install
    cd ../frontend && npm install
    ```
2.  **Environment Setup**:
    Configure `backend/.env` with your Razorpay/Stripe keys, Twilio SID, and SMTP settings.
3.  **Run Services**:
    - **API**: `cd backend && bun run src/index.ts`
    - **Worker**: `cd backend && bun run src/worker.ts`
    - **Dashboard**: `cd frontend && npm run dev`

---

## 📈 Roadmap

- [x] Multi-channel Recovery (Email, SMS, WA)
- [x] Custom Recovery Branding
- [x] Advanced Analytics Dashboard
- [ ] Post-Payment Feedback Surveys
- [ ] AI-Powered Subject Line Optimization
- [ ] Native Mobile App for Notifications

---

## ⚖️ License

MIT License. Designed with ❤️ for businesses that hate losing money.
