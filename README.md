# StripeFlow 💎
### **Elite Payment Recovery & Invoicing for Modern Businesses**

StripeFlow is a world-class failed payment recovery engine. We transform the tedious task of chasing payments into an automated, high-converting revenue stream. Designed for freelancers and D2C brands who demand premium aesthetics and absolute reliability.

---

## ✨ Core Pillars

*   **🎨 Premium Branded Invoicing**: Generate world-class PDF invoices with glassmorphic designs that elevate your brand perception.
*   **🤖 Intelligent Recovery Flow**: Multi-channel automation (Email via Resend, WhatsApp via Twilio) to win back lost revenue effortlessly.
*   **⚡ Stripe Checkout Integration**: One-click payment sessions built into every invoice for maximum conversion and zero friction.
*   **📊 Executive Dashboard**: Deep-dive into recovery trends, conversion rates, and revenue impact with high-fidelity charts.
*   **🛡️ Enterprise-Grade Core**: Built with Bun for speed, secure JWT authentication, and hardened CSRF protection.
*   **🇮🇳 India-First Architecture**: Native support for INR (₹) and optimized for the unique payment recovery needs of the Indian market.

---

## 🛠️ High-Performance Tech Stack

| Layer | Technology |
| :--- | :--- |
| **API Engine** | Bun, Express, Node.js |
| **Persistence** | Prisma (ORM), SQLite (Edge-ready) |
| **Frontend** | React 19, Vite, Tailwind CSS 4, Framer Motion |
| **Analytics** | Recharts (High-fidelity data viz) |
| **Communications** | Resend (Email), Twilio (WhatsApp/SMS) |
| **Verification** | Live Subagent E2E Walkthroughs |

---

## 🚀 Speed to Market

### **Local Development**
1.  **Clone & Initialize**:
    ```bash
    git clone https://github.com/sidsri14/PayRecover.git
    cd PayRecover
    cd backend && bun install
    cd ../frontend && npm install
    ```
2.  **Environment Sync**:
    Configure `backend/.env` with your Stripe/Razorpay keys, Twilio SID, and Resend API key.
3.  **Launch the Engine**:
    - **Back-end Core**: `cd backend && bun run src/index.ts`
    - **Background Worker**: `cd backend && bun run src/worker.ts`
    - **Executive Dashboard**: `cd frontend && npm run dev`

### **Deployment Architecture**
*   **Frontend**: Professional-grade deployment on **Vercel**.
*   **Core API**: Scalable containerized deployment on **Railway**.

---

## 📈 Roadmap 2026

- [x] Multi-channel Recovery (Email + WA)
- [x] Premium CSS/Motion Overhaul
- [x] Advanced Metric Dashboard
- [ ] AI-Powered Conversion Prediction
- [ ] Deep Integration with Slack/Discord
- [ ] Dedicated SDK for Native App Integration

---

## ⚖️ License
MIT License. Crafted with precision for businesses that refuse to leave money on the table.
