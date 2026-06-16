<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f0c1e,50:7c5cfc,100:0f0c1e&height=200&section=header&text=PreTrack&fontSize=72&fontColor=ffffff&fontAlignY=38&desc=Diecast%20Collection%20Manager&descSize=20&descAlignY=58&descColor=c4b5fd&animation=fadeIn"/>

<br/>

<!-- Live Status Badges -->
<img src="https://img.shields.io/badge/STATUS-LIVE-7c5cfc?style=for-the-badge&logo=vercel&logoColor=white"/>
<img src="https://img.shields.io/badge/VERSION-4.1-5b3fd4?style=for-the-badge&logoColor=white"/>
<img src="https://img.shields.io/badge/PWA-ENABLED-6d28d9?style=for-the-badge&logo=pwa&logoColor=white"/>
<img src="https://img.shields.io/badge/FIREBASE-REALTIME-FF6F00?style=for-the-badge&logo=firebase&logoColor=white"/>

<br/><br/>

<!-- Typing SVG -->
<img src="https://readme-typing-svg.demolab.com?font=Outfit&weight=700&size=22&duration=2000&pause=800&color=7C5CFC&center=true&vCenter=true&width=700&lines=Track+Every+Diecast+You+Own+%F0%9F%8F%8E%EF%B8%8F;Monitor+Payments+%26+Pending+Dues+%F0%9F%92%B3;Never+Miss+an+ETA+Again+%F0%9F%93%85;Your+Collection%2C+Under+Control+%E2%9C%85" />

<br/><br/>

<!-- CTA Button -->
<a href="https://dakshkohli23.github.io/Diecast-Tracking/login.html">
<img src="https://img.shields.io/badge/%F0%9F%9A%80%20%20OPEN%20DASHBOARD-%20-7c5cfc?style=for-the-badge&labelColor=0f0c1e&color=7c5cfc"/>
</a>

<br/><br/>

</div>

---

## 🏎️ What is PreTrack?

**PreTrack** is a personal diecast model car collection management dashboard. Built for collectors who want full visibility into their orders, payments, ETAs, and collection value — all in one place.

> *"Collect smarter. Track everything. Miss nothing."*

---

## ✨ Feature Highlights

<table>
<tr>
<td width="50%">

### 📦 Collection Manager
- Full order grid with image cards
- Grid & list view toggle
- Filter by brand, status, scale
- Click-to-view order detail modal
- Edit, duplicate, delete orders

</td>
<td width="50%">

### 💳 Payment Tracking
- Total spend per order & seller
- Paid vs pending breakdown
- Payment progress bar
- Per-seller financial summary
- Running dues across all vendors

</td>
</tr>
<tr>
<td width="50%">

### 📅 ETA Calendar
- Month view with order dots
- Color-coded urgency — overdue 🔴, soon 🟠, upcoming 🟣
- Click any day to inspect orders
- Monthly stats strip — overdue, delivered, value
- Side panel with order details

</td>
<td width="50%">

### 📊 Analytics
- Brand leaderboard & spend chart
- Collection breakdown by status
- Seller reliability overview
- Scale distribution stats
- Month-over-month trends

</td>
</tr>
<tr>
<td width="50%">

### 🏪 Seller Hub
- Seller cards with spend summary
- Click seller → see all their models
- Has dues vs fully paid indicator
- Delivered percentage per seller

</td>
<td width="50%">

### 🔔 Smart Dashboard
- **This Week's Arrivals** widget
- Overdue ETA alerts
- Recent orders feed
- Quick stats — models, value, dues
- Brand distribution chart

</td>
</tr>
</table>

---

## 🖥️ Interface Preview

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0f0c1e,100:1a1535&height=60&text=Dashboard+Preview&fontSize=18&fontColor=c4b5fd"/>

> 📸 *Screenshot coming soon — visit the live dashboard to see it in action*

<br/>

<!-- Feature badges row -->
<img src="https://img.shields.io/badge/Dark%20Glassmorphic-Theme-7c5cfc?style=flat-square&logo=css3&logoColor=white"/>
<img src="https://img.shields.io/badge/Mobile-Responsive-5b3fd4?style=flat-square&logo=responsive&logoColor=white"/>
<img src="https://img.shields.io/badge/Install%20as-PWA-6d28d9?style=flat-square&logo=pwa&logoColor=white"/>
<img src="https://img.shields.io/badge/Real--time-Sync-FF6F00?style=flat-square&logo=firebase&logoColor=white"/>

</div>

---

## ⚡ Tech Stack

<div align="center">

<img src="https://skillicons.dev/icons?i=html,css,js,firebase&theme=dark"/>

<br/><br/>

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (ES Modules) |
| **Auth** | Firebase Authentication |
| **Database** | Cloud Firestore (real-time) |
| **Image Storage** | Supabase Storage |
| **Hosting** | GitHub Pages |
| **CI/CD** | GitHub Actions (secret injection) |
| **PWA** | Service Worker + Web Manifest |

</div>

---

## 🗂️ Sections

```
📊 Dashboard      — Stats overview, arrivals widget, recent orders
📦 Collection     — Full order grid with filters & card view
📚 Catalog        — Browse all models in your catalog
🏷️  Brands         — Per-brand spending, models, delivery rate
🏪 Sellers        — Vendor breakdown with payment tracking
📅 Calendar       — ETA calendar with urgency heatmap
📈 Analytics      — Charts, trends, brand & scale distribution
👥 Users          — Multi-user access management
⚙️  Settings       — App config & data management
👤 Profile        — Avatar, display name, collection stats
```

---

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────┐
│           GitHub Repository                 │
│  app.js has only __PLACEHOLDERS__           │
│  No real keys ever stored in code           │
└────────────────┬────────────────────────────┘
                 │ push triggers
┌────────────────▼────────────────────────────┐
│           GitHub Actions                    │
│  Reads secrets from encrypted vault         │
│  Injects real values at build time          │
│  Deploys to GitHub Pages                    │
└────────────────┬────────────────────────────┘
                 │ live site
┌────────────────▼────────────────────────────┐
│           GitHub Pages                      │
│  Real keys present only in deployed build   │
│  Never visible in source control            │
└─────────────────────────────────────────────┘
```

- 🔒 Firebase API key restricted to domain via Google Cloud Console
- 🛡️ Supabase Row Level Security (RLS) enforced on all buckets
- 🔑 All secrets stored in GitHub Encrypted Secrets — never in code
- 👤 Multi-user access with role-based permissions

---

## 🚀 Deployment

The app deploys automatically via **GitHub Actions** on every push to `main`.

```bash
Push to main
    ↓
GitHub Actions triggered
    ↓
Secrets injected into app.js
    ↓
Deployed to GitHub Pages
    ↓
Live in ~60 seconds
```

**Live URL:**
```
https://dakshkohli23.github.io/Diecast-Tracking/login.html
```

---

## 📱 Install as App (PWA)

PreTrack works as a native-like app on any device:

| Platform | How to Install |
|---|---|
| **Android Chrome** | Tap 3-dot menu → *Install app* |
| **iPhone Safari** | Tap Share → *Add to Home Screen* |
| **Desktop Chrome** | Click install icon in address bar |

Once installed — launches fullscreen, no browser bar, feels native.

---

## 📁 Project Structure

```
Diecast-Tracking/
├── 📄 index.html          — Main dashboard
├── 📄 login.html          — Authentication page
├── 🎨 style.css           — Full stylesheet
├── ⚙️  app.js              — Core application logic
├── 🔧 manifest.json       — PWA manifest
├── 🛠️  sw.js               — Service worker
├── 📋 config.example.js   — Config template (safe to share)
├── 🔒 config.js           — Real credentials (gitignored)
└── 🤖 .github/
    └── workflows/
        └── deploy.yml     — CI/CD pipeline
```

---

## 🧬 Philosophy

<div align="center">

```
COLLECT  →  TRACK  →  UNDERSTAND  →  CONTROL
```

Built for one collector. Designed to scale.

</div>

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f0c1e,50:7c5cfc,100:0f0c1e&height=120&section=footer&text=PreTrack%20v4.1&fontSize=20&fontColor=c4b5fd&fontAlignY=65"/>

<br/>

<img src="https://img.shields.io/badge/Made%20with-JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black"/>
<img src="https://img.shields.io/badge/Powered%20by-Firebase-FF6F00?style=flat-square&logo=firebase&logoColor=white"/>
<img src="https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-7c5cfc?style=flat-square&logo=github&logoColor=white"/>
<img src="https://img.shields.io/badge/Built%20for-Diecast%20Collectors-5b3fd4?style=flat-square"/>

</div>
