'use strict';

/* ═══════════════════════════════════════════════
   PRETRACK — FIREBASE AUTH + FIRESTORE VERSION
   Firestore-only version (no Firebase Storage for now)
   ═══════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

/* ══════════════════════════════════════
   FIREBASE CONFIG
══════════════════════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyA2-6u8rETOIn9xUJQW0ZODFupZQ56orJg",
  authDomain: "diecast-tracking-471f7.firebaseapp.com",
  projectId: "diecast-tracking-471f7",
  storageBucket: "diecast-tracking-471f7.firebasestorage.app",
  messagingSenderId: "1042711268055",
  appId: "1:1042711268055:web:9b09ded970a85532767e92"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ══════════════════════════════════════
   GLOBAL DB STATE
══════════════════════════════════════ */
let DB = { orders: [], activity: [] };
let _currentImageB64 = ''; // preview only (not uploaded to Firebase Storage)
let _authReady = false;

/* ══════════════════════════════════════
   LOGIN PAGE LOGIC
══════════════════════════════════════ */
if (document.getElementById('loginForm')) {
  initLoginPage();
}

function initLoginPage() {
  const loginForm = document.getElementById('loginForm');
  const loginBtn  = document.getElementById('loginBtn');
  const loginErr  = document.getElementById('loginError');
  const errMsg    = document.getElementById('errorMsg');
  const togglePw  = document.getElementById('togglePw');
  const pwInput   = document.getElementById('password');

  togglePw?.addEventListener('click', () => {
    const isText = pwInput.type === 'text';
    pwInput.type = isText ? 'password' : 'text';
    togglePw.querySelector('i').className = `fa-solid fa-eye${isText ? '' : '-slash'}`;
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = 'index.html';
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
    loginBtn.disabled = true;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = 'index.html';
    } catch (error) {
      console.error(error);
      loginErr.classList.remove('hidden');
      errMsg.textContent = 'Invalid email or password';
      loginBtn.innerHTML = '<span>Sign In</span><i class="fa-solid fa-arrow-right"></i>';
      loginBtn.disabled = false;
      setTimeout(() => loginErr.classList.add('hidden'), 4000);
    }
  });
}

/* ══════════════════════════════════════
   DASHBOARD INIT (index.html)
══════════════════════════════════════ */
if (document.getElementById('pageContent')) {
  onAuthStateChanged(auth, async (user) => {
    _authReady = true;

    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    // Set username
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl) {
      profileNameEl.textContent = user.email || 'Admin';
    }

    // Load data then init dashboard
    await fetchData();
    initDashboard();
  });
}

function initDashboard() {
  /* ── SIDEBAR TOGGLE ── */
  const sidebar = document.getElementById('sidebar');
  const mainWrap = document.getElementById('mainWrap');
  const sidebarToggle = document.getElementById('sidebarToggle');

  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const isMobile = () => window.innerWidth <= 900;

  sidebarToggle?.addEventListener('click', () => {
    if (isMobile()) {
      sidebar.classList.toggle('mobile-open');
      sidebarOverlay?.classList.toggle('show');
    } else {
      sidebar.classList.toggle('collapsed');
      mainWrap.classList.toggle('expanded');
    }
  });
	
	initGreeting();
	
  sidebarOverlay?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('show');
  });

  // Close sidebar on nav click (mobile)
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      if (isMobile()) {
        sidebar.classList.remove('mobile-open');
        sidebarOverlay?.classList.remove('show');
      }
    });
  });

  /* ── NAV ROUTING ── */
   document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.dataset.section;
      navigateTo(target);
      if (isMobile()) {
        sidebar.classList.remove('mobile-open');
        sidebarOverlay?.classList.remove('show');
      }
    });
  });

  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.goto);
    });
  });

  function navigateTo(section) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add('active');
    document.getElementById(`section-${section}`)?.classList.add('active');
  }


  /* ── LOGOUT ── */
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = 'login.html';
    } catch (e) {
      console.error(e);
      showToast('Logout failed', 'warning');
    }
  });

  /* ── GLOBAL SEARCH ── */
  document.getElementById('globalSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (q.length > 0) {
      navigateTo('orders');
      const orderSearch = document.getElementById('orderSearch');
      if (orderSearch) {
        orderSearch.value = q;
        applyFilters();
      }
    }
  });

  /* ── ORDER SEARCH + FILTERS ── */
  document.getElementById('orderSearch')?.addEventListener('input', applyFilters);
  document.getElementById('filterStatus')?.addEventListener('change', applyFilters);
  document.getElementById('filterVendor')?.addEventListener('change', applyFilters);
  document.getElementById('filterDateFrom')?.addEventListener('change', applyFilters);
  document.getElementById('filterDateTo')?.addEventListener('change', applyFilters);

  document.getElementById('clearFilters')?.addEventListener('click', () => {
    document.getElementById('orderSearch').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterVendor').value = '';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    renderTable(DB.orders);
  });

  function applyFilters() {
    const q       = (document.getElementById('orderSearch')?.value || '').toLowerCase();
    const status  = document.getElementById('filterStatus')?.value || '';
    const vendor  = document.getElementById('filterVendor')?.value || '';
    const from    = document.getElementById('filterDateFrom')?.value;
    const to      = document.getElementById('filterDateTo')?.value;

    const filtered = DB.orders.filter(o => {
      const matchQ      = !q || (o.product_name || '').toLowerCase().includes(q) || (o.order_number || '').toLowerCase().includes(q);
      const matchStatus = !status || o.status === status;
      const matchVendor = !vendor || o.vendor === vendor;
      const matchFrom   = !from || new Date(o.order_date) >= new Date(from);
      const matchTo     = !to   || new Date(o.order_date) <= new Date(to);
      return matchQ && matchStatus && matchVendor && matchFrom && matchTo;
    });

    renderTable(filtered);
  }

  /* ── MODAL OPEN/CLOSE ── */
  const orderModal = document.getElementById('orderModal');
  const viewModal  = document.getElementById('viewModal');

  function openModal() {
    orderModal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    orderModal?.classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('orderForm')?.reset();
    if (document.getElementById('editOrderId')) document.getElementById('editOrderId').value = '';
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
      imagePreview.innerHTML = '<i class="fa-solid fa-image"></i><p>Image preview only (upload disabled)</p>';
    }
    const fImage = document.getElementById('fImage');
    if (fImage) fImage.value = '';
    _currentImageB64 = '';

    document.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector('.form-tab[data-tab="basic"]')?.classList.add('active');
    document.getElementById('tab-basic')?.classList.add('active');
    calcTotals();
  }

  document.getElementById('addOrderBtn')?.addEventListener('click', () => {
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Add New Order';
    openModal();
  });

  document.getElementById('quickAddBtn')?.addEventListener('click', () => {
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Add New Order';
    openModal();
  });

  document.getElementById('qaAddOrder')?.addEventListener('click', () => {
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Add New Order';
    openModal();
  });

  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeModal);

  orderModal?.addEventListener('click', e => {
    if (e.target === orderModal) closeModal();
  });

  document.getElementById('viewModalClose')?.addEventListener('click', () => {
    viewModal?.classList.add('hidden');
    document.body.style.overflow = '';
  });

  viewModal?.addEventListener('click', e => {
    if (e.target === viewModal) {
      viewModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  });

  /* ── FORM TABS ── */
  document.querySelectorAll('.form-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
    });
  });

  /* ── PAYMENT AUTO CALC ── */
  ['fPreorderPrice','fActualPrice','fShipping','fPaid','fQty'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcTotals);
  });

  function calcTotals() {
    const price = parseFloat(document.getElementById('fActualPrice')?.value) || 0;
    const qty   = parseInt(document.getElementById('fQty')?.value) || 1;
    const ship  = parseFloat(document.getElementById('fShipping')?.value) || 0;
    const paid  = parseFloat(document.getElementById('fPaid')?.value) || 0;
    const total   = (price * qty) + ship;
    const pending = Math.max(0, total - paid);

    if (document.getElementById('fTotal')) {
      document.getElementById('fTotal').value = `₹${total.toLocaleString('en-IN')}`;
    }
    if (document.getElementById('fPending')) {
      document.getElementById('fPending').value = `₹${pending.toLocaleString('en-IN')}`;
    }
  }

  /* ── IMAGE PREVIEW ONLY (NO STORAGE) ── */
  document.getElementById('imageUploadArea')?.addEventListener('click', () => {
    document.getElementById('fImage')?.click();
  });

  document.getElementById('fImage')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image too large (max 2MB)', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
  _currentImageB64 = await compressImage(ev.target.result);
  const preview = document.getElementById('imagePreview');
  if (preview) preview.innerHTML = `<img src="${_currentImageB64}" alt="preview" />`;
};
    reader.readAsDataURL(file);
  });

  /* ── SAVE ORDER ── */
  document.getElementById('orderForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const editId = document.getElementById('editOrderId')?.value || '';

    const price = parseFloat(document.getElementById('fActualPrice')?.value) || 0;
    const qty   = parseInt(document.getElementById('fQty')?.value) || 1;
    const ship  = parseFloat(document.getElementById('fShipping')?.value) || 0;
    const paid  = parseFloat(document.getElementById('fPaid')?.value) || 0;
    const total = (price * qty) + ship;
    const pending = Math.max(0, total - paid);

    const existing = DB.orders.find(o => o.id === editId);

    const order = {
      product_name:   document.getElementById('fProductName')?.value.trim() || '',
      order_number:   document.getElementById('fOrderNumber')?.value.trim() || '',
      vendor:         document.getElementById('fVendor')?.value.trim() || '',
      variant:        document.getElementById('fVariant')?.value || '',
      quantity:       qty,
      order_date:     document.getElementById('fOrderDate')?.value || '',
      eta:            document.getElementById('fEta')?.value || '',
      status:         document.getElementById('fStatus')?.value || 'Ordered',
      preorder_price: parseFloat(document.getElementById('fPreorderPrice')?.value) || 0,
      actual_price:   price,
      shipping:       ship,
      paid:           paid,
      pending:        pending,
      total:          total,
      image:          existing?.image || '', // keep existing image if any
      updatedAt:      serverTimestamp()
    };

    try {
      if (editId) {
        await updateDoc(doc(db, 'orders', editId), order);
        await addActivity('info', `Order updated — ${order.product_name}`);
        showToast('Order updated successfully!', 'success');
      } else {
        await addDoc(collection(db, 'orders'), {
          ...order,
          createdAt: serverTimestamp()
        });
        await addActivity('success', `New order added — ${order.product_name}`);
        showToast('Order added successfully!', 'success');
      }

      await fetchData();
      closeModal();
    } catch (error) {
      console.error(error);
      showToast('Failed to save order', 'warning');
    }
  });

  /* ── QUICK ACTIONS ── */
  document.getElementById('qaExport')?.addEventListener('click', exportCSV);
  document.getElementById('qaAnalytics')?.addEventListener('click', () => navigateTo('analytics'));

  document.getElementById('qaDelayed')?.addEventListener('click', () => {
    navigateTo('orders');
    const today = new Date();
    const delayed = DB.orders.filter(o => o.eta && new Date(o.eta) < today && o.status !== 'Delivered');

    if (delayed.length === 0) {
      showToast('No delayed orders!', 'info');
    } else {
      renderTable(delayed);
      showToast(`${delayed.length} delayed order(s) shown`, 'warning');
    }
  });

  document.getElementById('exportCsvBtn')?.addEventListener('click', exportCSV);

  function exportCSV() {
    if (DB.orders.length === 0) {
      showToast('No orders to export', 'warning');
      return;
    }

    const headers = ['ID','Product','Order#','Vendor','Variant','Qty','Preorder Price','Actual Price','Shipping','Paid','Pending','Total','Status','ETA','Order Date'];
    const rows = DB.orders.map(o => [
      o.id, o.product_name, o.order_number, o.vendor, o.variant, o.quantity,
      o.preorder_price, o.actual_price, o.shipping, o.paid, o.pending, o.total,
      o.status, o.eta, o.order_date
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `pretrack_orders_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('CSV exported successfully!', 'success');
  }

  /* ── CLEAR DATA ── */
  document.getElementById('clearDataBtn')?.addEventListener('click', async () => {
    if (!confirm('Are you sure? This will delete ALL orders permanently.')) return;

    try {
      const deletes = DB.orders.map(o => deleteDoc(doc(db, 'orders', o.id)));
      await Promise.all(deletes);

      await addActivity('warning', 'All orders cleared');
      await fetchData();
      showToast('All data cleared', 'info');
    } catch (e) {
      console.error(e);
      showToast('Failed to clear data', 'warning');
    }
  });
}

/* ══════════════════════════════════════
   FIRESTORE DATA
══════════════════════════════════════ */
async function fetchData() {
  try {
    const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    DB.orders = ordersSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    const activitySnap = await getDocs(query(collection(db, 'activity'), orderBy('createdAt', 'desc')));
    DB.activity = activitySnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    renderAll();
  } catch (error) {
    console.error('Error loading data:', error);
    DB = { orders: [], activity: [] };
    renderAll();
  }
}

async function addActivity(type, msg) {
  try {
    await addDoc(collection(db, 'activity'), {
      type,
      msg,
      time: new Date().toLocaleString(),
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.error('Activity log failed:', e);
  }
}
function compressImage(base64, maxWidth = 300, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = base64;
  });
}

/* Wishing Function */
function initGreeting() {
  const greetingText = document.getElementById('greetingText');
  const greetingDate = document.getElementById('greetingDate');
  const systemStatus = document.getElementById('systemStatus');

  function updateGreeting() {
    const now = new Date();
    const hour = now.getHours();

    const emoji = hour < 12 ? '<i class="fa-solid fa-cloud-sun"></i>' : hour < 17 ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    const word  = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

    if (greetingText) greetingText.innerHTML = `Good ${word}, Daksh! ${emoji}`;

    if (greetingDate) {
      greetingDate.textContent = now.toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    }
  }

  function checkSystems() {
    if (!systemStatus) return;
    systemStatus.innerHTML = `<span class="status-dot"></span> Checking systems...`;
    systemStatus.className = 'system-status';

    setTimeout(() => {
      const ok = DB.orders !== undefined;
      if (ok) {
        systemStatus.innerHTML = `<span class="status-dot"></span> All systems live`;
        systemStatus.className = 'system-status live';
      } else {
        systemStatus.innerHTML = `<span class="status-dot"></span> Connection issue`;
        systemStatus.className = 'system-status error';
      }
    }, 1200);
  }

  updateGreeting();
  checkSystems();
  setInterval(updateGreeting, 60000); // update every minute
}

function renderAll() {
  renderStats();
  renderTable(DB.orders);
  renderRecentOrders();
  renderEtaWidget();
  renderActivityFeed();
  renderAlerts();
  renderPayments();
  renderAnalytics();
  renderVendorFilter();
  renderBrandLeaderboard();


  // Refresh system status after data loads
  const systemStatus = document.getElementById('systemStatus');
  if (systemStatus) {
    const ok = DB.orders !== undefined;
    systemStatus.innerHTML = ok
      ? `<span class="status-dot"></span> All systems live`
      : `<span class="status-dot"></span> Connection issue`;
    systemStatus.className = ok ? 'system-status live' : 'system-status error';
  }
}

/* ══════════════════════════════════════
   STATS
══════════════════════════════════════ */
function renderStats() {
  const orders = DB.orders;
  const total  = orders.length;

  const totalQty     = orders.reduce((s, o) => s + (o.quantity || 1), 0);
  const marketValue  = orders.reduce((s, o) => s + ((o.preorder_price || 0) * (o.quantity || 1)), 0);
  const investment   = orders.reduce((s, o) => s + (o.total || 0), 0);
  const pendingAmt   = orders.reduce((s, o) => s + (o.pending || 0), 0);
  const pendingPO    = orders.filter(o => o.status === 'Ordered' || o.status === 'Processing').length;
  const delivered    = orders.filter(o => o.status === 'Delivered').length;
  const transit      = orders.filter(o => o.status === 'Shipped').length;
  const overdue      = orders.filter(o => o.eta && new Date(o.eta) < new Date() && o.status !== 'Delivered').length;

  // Duplicates: product names appearing more than once
  const nameCount = {};
  orders.forEach(o => { const k = (o.product_name || '').toLowerCase().trim(); nameCount[k] = (nameCount[k] || 0) + 1; });
  const duplicates = Object.values(nameCount).filter(v => v > 1).length;

  setText('statTotal',       total);
  setText('statQty',         totalQty);
  setText('statMarketValue', '₹' + marketValue.toLocaleString('en-IN'));
  setText('statInvestment',  '₹' + investment.toLocaleString('en-IN'));
  setText('statPending',     '₹' + pendingAmt.toLocaleString('en-IN'));
  setText('statPendingPO',   pendingPO);
  setText('statDelivered',   delivered);
  setText('statTransit',     transit);
  setText('statOverdue',     overdue);
  setText('statDuplicates',  duplicates);

  // Progress bars (% of total orders)
  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;
  const setBar = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.style.width = val + '%';
  };

  setBar('statDeliveredBar',  pct(delivered));
  setBar('statTransitBar',    pct(transit));
  setBar('statPendingPOBar',  pct(pendingPO));
  setBar('statOverdueBar',    pct(overdue));
  setBar('statDuplicatesBar', pct(duplicates));
  setBar('statPendingBar',    investment > 0 ? Math.round((pendingAmt / investment) * 100) : 0);

  const dot = document.getElementById('notifDot');
  if (dot) dot.classList.toggle('show', pendingAmt > 0 || overdue > 0);
}

/* ══════════════════════════════════════
   TABLE RENDER
══════════════════════════════════════ */
function renderTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-row"><i class="fa-solid fa-inbox"></i> No orders found</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const payPct  = o.total ? Math.min(100, Math.round((o.paid / o.total) * 100)) : 0;
    const statusClass = (o.status || '').toLowerCase().replace(/\s+/g, '-');
    const fillClass   = `fill-${statusClass}`;
    const payBadge    = o.pending <= 0 ? 'badge-paid' : (o.paid > 0 ? 'badge-partial' : 'badge-pending-b');
    const payLabel    = o.pending <= 0 ? 'Paid' : (o.paid > 0 ? 'Partial' : 'Pending');
    const thumb       = o.image
      ? `<img src="${o.image}" alt="${escHtml(o.product_name)}" />`
      : `<i class="fa-solid fa-cube"></i>`;
    const etaStr = o.eta ? formatDate(o.eta) : '—';

    return `<tr>
      <td>
        <div class="order-product-cell">
          <div class="order-thumb">${thumb}</div>
          <div>
            <div class="order-product-name">${escHtml(o.product_name)}</div>
            <div class="order-variant">${escHtml(o.variant || '')}</div>
          </div>
        </div>
      </td>
      <td><code style="font-size:0.75rem;opacity:0.8">${escHtml(o.order_number || o.id)}</code></td>
      <td>${escHtml(o.vendor || '—')}</td>
      <td>${o.quantity || 1}</td>
      <td><strong>₹${(o.total || 0).toLocaleString('en-IN')}</strong></td>
      <td style="color:var(--green)">₹${(o.paid || 0).toLocaleString('en-IN')}</td>
      <td>
        <div class="pay-bar-wrap">
          <span class="badge ${payBadge}">${payLabel}</span>
          <div class="pay-bar"><div class="pay-fill" style="width:${payPct}%"></div></div>
        </div>
      </td>
      <td>
        <span class="badge badge-${statusClass}">${escHtml(o.status || 'Ordered')}</span>
        <div class="status-bar"><div class="status-fill ${fillClass}"></div></div>
      </td>
      <td style="font-size:0.78rem;color:var(--text-muted)">${etaStr}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-icon" onclick="viewOrder('${o.id}')" title="View">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="btn btn-ghost btn-icon" onclick="editOrder('${o.id}')" title="Edit">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-danger btn-icon" onclick="deleteOrder('${o.id}')" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════
   GLOBAL ACTIONS (for inline onclick)
══════════════════════════════════════ */
window.editOrder = function(id) {
  const o = DB.orders.find(x => x.id === id);
  if (!o) return;

  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = 'Edit Order';

  setVal('editOrderId', id);
  setVal('fProductName', o.product_name);
  setVal('fOrderNumber', o.order_number);
  setVal('fVendor', o.vendor);
  setVal('fVariant', o.variant);
  setVal('fQty', o.quantity);
  setVal('fOrderDate', o.order_date);
  setVal('fEta', o.eta);
  setVal('fStatus', o.status);
  setVal('fPreorderPrice', o.preorder_price);
  setVal('fActualPrice', o.actual_price);
  setVal('fShipping', o.shipping);
  setVal('fPaid', o.paid);

  const imagePreview = document.getElementById('imagePreview');
  if (imagePreview) {
    if (o.image) {
      imagePreview.innerHTML = `<img src="${o.image}" alt="preview" />`;
    } else {
      imagePreview.innerHTML = '<i class="fa-solid fa-image"></i><p>Image preview only (upload disabled)</p>';
    }
  }

  document.getElementById('orderModal')?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  document.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector('.form-tab[data-tab="basic"]')?.classList.add('active');
  document.getElementById('tab-basic')?.classList.add('active');

  const price = parseFloat(o.actual_price) || 0;
  const qty   = parseInt(o.quantity) || 1;
  const ship  = parseFloat(o.shipping) || 0;
  const paid  = parseFloat(o.paid) || 0;
  const total = (price * qty) + ship;
  const pending = Math.max(0, total - paid);

  if (document.getElementById('fTotal')) {
    document.getElementById('fTotal').value = `₹${total.toLocaleString('en-IN')}`;
  }
  if (document.getElementById('fPending')) {
    document.getElementById('fPending').value = `₹${pending.toLocaleString('en-IN')}`;
  }
};

window.deleteOrder = async function(id) {
  if (!confirm('Delete this order?')) return;

  try {
    const order = DB.orders.find(o => o.id === id);
    await deleteDoc(doc(db, 'orders', id));
    await addActivity('warning', `Order deleted — ${order?.product_name || id}`);
    showToast('Order deleted', 'success');
    await fetchData();
  } catch (error) {
    console.error(error);
    showToast('Failed to delete order', 'warning');
  }
};

window.viewOrder = function(id) {
  const o = DB.orders.find(x => x.id === id);
  if (!o) return;

  const body = document.getElementById('viewModalBody');
  const modal = document.getElementById('viewModal');
  if (!body || !modal) return;

  body.innerHTML = `
    <div class="view-grid">
      <div><strong>Product:</strong> ${escHtml(o.product_name || '—')}</div>
      <div><strong>Order #:</strong> ${escHtml(o.order_number || o.id)}</div>
      <div><strong>Vendor:</strong> ${escHtml(o.vendor || '—')}</div>
      <div><strong>Variant:</strong> ${escHtml(o.variant || '—')}</div>
      <div><strong>Qty:</strong> ${o.quantity || 1}</div>
      <div><strong>Status:</strong> ${escHtml(o.status || 'Ordered')}</div>
      <div><strong>Order Date:</strong> ${formatDate(o.order_date)}</div>
      <div><strong>ETA:</strong> ${formatDate(o.eta)}</div>
      <div><strong>Preorder Price:</strong> ₹${(o.preorder_price || 0).toLocaleString('en-IN')}</div>
      <div><strong>Actual Price:</strong> ₹${(o.actual_price || 0).toLocaleString('en-IN')}</div>
      <div><strong>Shipping:</strong> ₹${(o.shipping || 0).toLocaleString('en-IN')}</div>
      <div><strong>Paid:</strong> ₹${(o.paid || 0).toLocaleString('en-IN')}</div>
      <div><strong>Pending:</strong> ₹${(o.pending || 0).toLocaleString('en-IN')}</div>
      <div><strong>Total:</strong> ₹${(o.total || 0).toLocaleString('en-IN')}</div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

/* ══════════════════════════════════════
   WIDGETS / FEEDS / ANALYTICS
══════════════════════════════════════ */
function renderRecentOrders() {
  const container = document.getElementById('recentOrdersList');
  if (!container) return;

  const items = DB.orders.slice(0, 5);
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">No orders yet</div>`;
    return;
  }

  container.innerHTML = items.map(o => `
    <div class="recent-order-item">
      <div class="roi-thumb">
        ${o.image ? `<img src="${o.image}" alt="${escHtml(o.product_name)}" />` : `<i class="fa-solid fa-cube"></i>`}
      </div>
      <div class="roi-info">
        <div class="roi-name">${escHtml(o.product_name)}</div>
        <div class="roi-meta">${escHtml(o.order_number || o.id)} • ${escHtml(o.vendor || '—')}</div>
      </div>
      <div class="roi-status">
        <span class="badge badge-${(o.status || '').toLowerCase().replace(/\s+/g, '-')}">${escHtml(o.status || 'Ordered')}</span>
      </div>
    </div>
  `).join('');
}

/* renderEtaWidget() */
function renderEtaWidget() {
  const container = document.getElementById('etaList');
  if (!container) return;

  const upcoming = DB.orders
    .filter(o => o.eta && o.status !== 'Delivered')
    .sort((a, b) => new Date(a.eta) - new Date(b.eta))
    .slice(0, 6);

  if (!upcoming.length) {
    container.innerHTML = `<div class="empty-state">No upcoming deliveries</div>`;
    return;
  }

  const today = new Date();

  container.innerHTML = upcoming.map(o => {
    const etaDate = new Date(o.eta);
    const diffDays = Math.ceil((etaDate - today) / (1000 * 60 * 60 * 24));

    let dayClass = 'eta-chip-ok';
    let dayLabel = `${diffDays}d`;

    if (diffDays < 0) {
      dayClass = 'eta-chip-overdue';
      dayLabel = `${Math.abs(diffDays)}d overdue`;
    } else if (diffDays <= 7) {
      dayClass = 'eta-chip-soon';
    }

    return `
      <div class="delivery-item">
        <div class="delivery-icon"><i class="fa-solid fa-truck"></i></div>
        <div class="delivery-info">
          <div class="delivery-name">${escHtml(o.product_name)}</div>
          <div class="delivery-meta">${escHtml(o.vendor || '—')} • ETA ${escHtml(o.eta)}</div>
          <div class="delivery-chips">
            <span class="delivery-chip eta-chip ${dayClass}">
              <i class="fa-solid fa-calendar-days"></i> ${dayLabel}
            </span>
            <span class="delivery-chip vendor-chip">
              <i class="fa-solid fa-store"></i> ${escHtml(o.vendor || '—')}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderActivityFeed() {
  const container = document.getElementById('activityList');
  if (!container) return;

  const items = DB.activity.slice(0, 8);

  if (!items.length) {
    container.innerHTML = `<div class="empty-state">No recent activity</div>`;
    return;
  }

  container.innerHTML = items.map(a => `
    <div class="activity-item">
      <span class="activity-dot ${escHtml(a.type || 'info')}"></span>
      <span>${escHtml(a.msg || '')}</span>
      <span class="activity-time">${escHtml(a.time || '')}</span>
    </div>
  `).join('');
}

function renderBrandLeaderboard() {
  const container = document.getElementById('leaderboardList');
  if (!container) return;

  if (!DB.orders.length) {
    container.innerHTML = `<div class="empty-state">No data yet</div>`;
    return;
  }

  const brandMap = {};
  DB.orders.forEach(o => {
    const key = (o.vendor || 'Unknown').trim();
    brandMap[key] = (brandMap[key] || 0) + (o.quantity || 1);
  });

  const sorted = Object.entries(brandMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const rankIcon = (i) => {
    if (i === 0) return `<div class="lb-rank-icon gold"><i class="fa-solid fa-crown"></i></div>`;
    if (i === 1) return `<div class="lb-rank-icon silver"><i class="fa-solid fa-medal"></i></div>`;
    if (i === 2) return `<div class="lb-rank-icon bronze"><i class="fa-solid fa-award"></i></div>`;
    return `<div class="lb-rank-icon"><i class="fa-solid fa-hashtag"></i></div>`;
  };

  container.innerHTML = sorted.map(([brand, qty], i) => `
    <div class="lb-item">
      ${rankIcon(i)}
      <div class="lb-info">
        <div class="lb-name">#${i + 1} ${escHtml(brand)}</div>
        <div class="lb-sub">${qty} unit${qty !== 1 ? 's' : ''} tracked</div>
      </div>
      <span class="lb-count">${qty}</span>
    </div>
  `).join('');
}

function renderAlerts() {
  const container = document.getElementById('alertsPanel');
  if (!container) return;

  const alerts = [];

  const delayed = DB.orders.filter(o => o.eta && new Date(o.eta) < new Date() && o.status !== 'Delivered');
  if (delayed.length > 0) {
    alerts.push({
      type: 'warning',
      msg: `${delayed.length} delayed order(s)`
    });
  }

  const unpaid = DB.orders.filter(o => (o.pending || 0) > 0);
  if (unpaid.length > 0) {
    alerts.push({
      type: 'danger',
      msg: `${unpaid.length} order(s) with pending payment`
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      type: 'info',
      msg: 'All systems normal'
    });
  }

  container.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.type}">
      <i class="fa-solid fa-circle-info"></i>
      <span>${escHtml(a.msg)}</span>
    </div>
  `).join('');
}

function renderPayments() {
  const container = document.getElementById('paymentsContent');
  if (!container) return;

  if (!DB.orders.length) {
    container.innerHTML = `
      <div class="widget glass full-width">
        <div class="widget-body">
          <div class="empty-state">No payment data yet</div>
        </div>
      </div>
    `;
    return;
  }

  const rows = DB.orders.map(o => `
    <tr>
      <td>${escHtml(o.product_name || '—')}</td>
      <td>${escHtml(o.order_number || o.id)}</td>
      <td>₹${(o.total || 0).toLocaleString('en-IN')}</td>
      <td style="color:var(--green)">₹${(o.paid || 0).toLocaleString('en-IN')}</td>
      <td style="color:${(o.pending || 0) > 0 ? 'var(--orange)' : 'var(--green)'}">₹${(o.pending || 0).toLocaleString('en-IN')}</td>
      <td>${escHtml(o.status || 'Ordered')}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="widget glass full-width">
      <div class="widget-header">
        <h3><i class="fa-solid fa-credit-card"></i> Payment Overview</h3>
      </div>
      <div class="table-wrap">
        <table class="orders-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Order #</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Pending</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAnalytics() {
  const vendorChart = document.getElementById('vendorChart');
  const statusChart = document.getElementById('statusChart');
  const monthlyChart = document.getElementById('monthlyChart');

  if (vendorChart) {
    const vendorMap = {};
    DB.orders.forEach(o => {
      const key = o.vendor || 'Unknown';
      vendorMap[key] = (vendorMap[key] || 0) + 1;
    });

    const html = Object.entries(vendorMap).map(([k, v]) => `
      <div class="mini-bar-row">
        <span>${escHtml(k)}</span>
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100, v * 20)}%"></div></div>
        <strong>${v}</strong>
      </div>
    `).join('') || `<div class="empty-state">No data</div>`;

    vendorChart.innerHTML = html;
  }

  if (statusChart) {
    const statusMap = {};
    DB.orders.forEach(o => {
      const key = o.status || 'Unknown';
      statusMap[key] = (statusMap[key] || 0) + 1;
    });

    const html = Object.entries(statusMap).map(([k, v]) => `
      <div class="mini-bar-row">
        <span>${escHtml(k)}</span>
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100, v * 20)}%"></div></div>
        <strong>${v}</strong>
      </div>
    `).join('') || `<div class="empty-state">No data</div>`;

    statusChart.innerHTML = html;
  }

  if (monthlyChart) {
    const monthMap = {};
    DB.orders.forEach(o => {
      if (!o.order_date) return;
      const d = new Date(o.order_date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
      monthMap[key] = (monthMap[key] || 0) + (o.total || 0);
    });

    const html = Object.entries(monthMap).sort().map(([k, v]) => `
      <div class="mini-bar-row">
        <span>${escHtml(k)}</span>
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100, Math.round(v / 500))}%"></div></div>
        <strong>₹${v.toLocaleString('en-IN')}</strong>
      </div>
    `).join('') || `<div class="empty-state">No data</div>`;

    monthlyChart.innerHTML = html;
  }
}

function renderVendorFilter() {
  const select = document.getElementById('filterVendor');
  if (!select) return;

  const current = select.value;
  const vendors = [...new Set(DB.orders.map(o => o.vendor).filter(Boolean))];

  select.innerHTML = `<option value="">All Vendors</option>` +
    vendors.map(v => `<option value="${escHtml(v)}">${escHtml(v)}</option>`).join('');

  select.value = current;
}

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}

function escHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function showToast(message, type = 'info') {
  let toast = document.getElementById('globalToast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.style.position = 'fixed';
    toast.style.right = '20px';
    toast.style.bottom = '20px';
    toast.style.zIndex = '9999';
    toast.style.padding = '12px 16px';
    toast.style.borderRadius = '12px';
    toast.style.color = '#fff';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '600';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
    toast.style.transition = 'all .25s ease';
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
    document.body.appendChild(toast);
  }

  const colors = {
    success: 'linear-gradient(135deg,#22c55e,#14b8a6)',
    warning: 'linear-gradient(135deg,#f97316,#ef4444)',
    info: 'linear-gradient(135deg,#7c5cfc,#6366f1)'
  };

  toast.style.background = colors[type] || colors.info;
  toast.textContent = message;

  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
  }, 2500);
}

/* ══════════════════════════════════════
   OPTIONAL: ONE-TIME ADMIN CREATION
   Uncomment once, run, then comment again
══════════════════════════════════════ */
/*
async function createAdminOnce() {
  try {
    const userCred = await createUserWithEmailAndPassword(
      auth,
      "dlaize",
      "dlaize"
    );
    console.log("Admin created:", userCred.user.email);
    alert("Admin created successfully!");
  } catch (e) {
    console.error(e);
    alert(e.message);
  }
}
createAdminOnce();
*/
