<div align="center">

<br/>

```
██████╗ ██████╗ ███████╗████████╗██████╗  █████╗  ██████╗██╗  ██╗
██╔══██╗██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██║ ██╔╝
██████╔╝██████╔╝█████╗     ██║   ██████╔╝███████║██║     █████╔╝ 
██╔═══╝ ██╔══██╗██╔══╝     ██║   ██╔══██╗██╔══██║██║     ██╔═██╗ 
██║     ██║  ██║███████╗   ██║   ██║  ██║██║  ██║╚██████╗██║  ██╗
╚═╝     ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
                    P E G A S U S  ·  v 4 . 1
```

### *Track every preorder. Own every detail.*

The complete toolkit for serious diecast collectors — monitor orders,  
track payments, and analyse your collection in one beautifully designed dashboard.

<br/>

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Visit_App-gold?style=for-the-badge)](https://dakshkohli23.github.io/Diecast-Tracking/login.html)
&nbsp;
[![Firebase](https://img.shields.io/badge/Firebase-Powered-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
&nbsp;
[![Version](https://img.shields.io/badge/Version-4.1-silver?style=for-the-badge)](#)

<br/>

![JavaScript](https://img.shields.io/badge/JavaScript-39.1%25-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![CSS](https://img.shields.io/badge/CSS-38.5%25-1572B6?style=flat-square&logo=css3&logoColor=white)
![HTML](https://img.shields.io/badge/HTML-22.4%25-E34F26?style=flat-square&logo=html5&logoColor=white)

<br/>

</div>

---

## 🏎️ What is PreTrack?

**PreTrack Pegasus** is a purpose-built web application for diecast collectors who are serious about their hobby. Whether you're tracking ten preorders or hundreds, managing multiple brands, or trying to understand where your money is going each month — PreTrack gives you a single, beautiful dashboard to handle it all.

No spreadsheets. No sticky notes. Just your collection, perfectly organized.

---

## ✨ Core Features

<table>
<tr>
<td width="50%">

### 📦 Smart Order Tracking
Never lose track of a preorder again. Add orders with expected arrival dates and get notified when ETAs are approaching. See your entire pipeline at a glance — what's incoming, what's delayed, what's arrived.

</td>
<td width="50%">

### 💳 Per-Piece Payment Tracking
Know exactly what you've paid and what's still outstanding. Track payments per individual piece with full visibility into your financial commitments across every order.

</td>
</tr>
<tr>
<td width="50%">

### 📊 Brand Analytics & Spend Insights
Break down your collection by brand and see your monthly spend trends. Understand which brands you collect most, how your budget evolves, and get a bird's-eye view of your entire hobby spend.

</td>
<td width="50%">

### 🔄 Live Firebase Sync
Powered by Google Firebase — your data syncs in real time across every device you own. Start on desktop, continue on mobile. Everything is always up to date.

</td>
</tr>
<tr>
<td width="50%">

### 🔐 Admin-Controlled Access
Secure sign-in with an admin-gated access request system. Request access with your name and email; the admin reviews and approves. Your collection data stays private and protected.

</td>
<td width="50%">

### 🎨 Beautifully Designed UI
Built with meticulous attention to design — a clean, modern interface that makes managing a collection feel like a pleasure, not a chore.

</td>
</tr>
</table>

---

## 🛠️ Tech Stack

```
┌─────────────────────────────────────────────────────┐
│                   PRETRACK PEGASUS                  │
├─────────────┬───────────────────┬───────────────────┤
│   Frontend  │   Styling         │   Backend/Sync    │
│─────────────│───────────────────│───────────────────│
│ HTML5       │ CSS3              │ Firebase Auth     │
│ Vanilla JS  │ Custom Properties │ Firebase Firestore│
│             │ Responsive Layout │ Firebase Hosting  │
└─────────────┴───────────────────┴───────────────────┘
```

| Layer | Technology | Purpose |
|---|---|---|
| **Markup** | HTML5 | Semantic structure & pages |
| **Styling** | CSS3 + Custom Properties | Responsive, polished UI |
| **Logic** | Vanilla JavaScript (ES6+) | App logic, state management |
| **Auth** | Firebase Authentication | Secure user sign-in |
| **Database** | Cloud Firestore | Real-time data sync |
| **Hosting** | GitHub Pages | Live deployment |

---

## 🚀 Getting Started

### Prerequisites

- A modern web browser
- A Firebase project (for your own deployment)
- A GitHub account (for forking/hosting)

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/dakshkohli23/Diecast-Tracking.git

# 2. Navigate into the project
cd Diecast-Tracking

# 3. Open in your browser
# Simply open index.html or use a local server:
npx serve .
# Then visit http://localhost:3000
```

### Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password)
3. Enable **Cloud Firestore**
4. Copy your Firebase config into `app.js`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

5. Set up Firestore security rules to protect user data
6. Deploy to GitHub Pages or Firebase Hosting

---

## 📁 Project Structure

```
Diecast-Tracking/
│
├── index.html        ← Main dashboard (protected)
├── login.html        ← Authentication & access request page
├── app.js            ← Firebase config, auth logic, app state
├── style.css         ← All styling — responsive & custom properties
└── README.md         ← You are here
```

---

## 🖥️ Live App

The app is live and deployed on GitHub Pages:

> **🔗 [dakshkohli23.github.io/Diecast-Tracking/login.html](https://dakshkohli23.github.io/Diecast-Tracking/login.html)**

To get access:
1. Visit the link above
2. Click **"Request Access from Admin"**
3. Fill in your name, email, and reason
4. The admin will review and approve your account

---

## 🗺️ Roadmap

- [ ] Mobile app (PWA support)
- [ ] Export collection to CSV/PDF
- [ ] Wishlist / want-list tracking
- [ ] Photo uploads per piece
- [ ] Multi-currency support
- [ ] Collection valuation (market price tracking)
- [ ] Push notifications for ETA alerts

---

## 🤝 Contributing

Contributions are welcome! Here's how to get involved:

1. **Fork** the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a **Pull Request**

Please ensure your code follows the existing style and is well-commented.

---

## 📄 License

This project is open source. Feel free to fork and adapt for your own collection management needs.

---

<div align="center">

**Built with ❤️ for diecast enthusiasts**

*If PreTrack has helped you manage your collection, consider giving it a ⭐ on GitHub!*

[![GitHub stars](https://img.shields.io/github/stars/dakshkohli23/Diecast-Tracking?style=social)](https://github.com/dakshkohli23/Diecast-Tracking/stargazers)

</div>
