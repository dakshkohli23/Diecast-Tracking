/* ═══════════════════════════════════════════════
   PRETRACK — app.js
   Complete application: Login → Dashboard → All Features
   ═══════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════
   PHASE 2 — AUTH / LOGIN
══════════════════════════════════════ */

// Simulated SHA-256 (obfuscated hash check)
const _cfg = {
  u: btoa('admin'),
  // SHA256 of 'admin123' (simulated via lookup)
  h: '0192023a7bbd73250516f069df18b500'
};

function _simHash(str) {
  // Lightweight DJB2 obfuscated hash for demo
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + str.split('').reverse().map(c => c.charCodeAt(0).toString(16)).join('').slice(0, 24);
}

function _checkCreds(u, p) {
  return btoa(u) === _cfg.u && _simHash(p) === _cfg.h;
}

// ── LOGIN PAGE INIT ──
if (document.getElementById('loginForm')) {
  const loginForm = document.getElementById('loginForm');
  const loginBtn  = document.getElementById('loginBtn');
  const loginErr  = document.getElementById('loginError');
  const errMsg    = document.getElementById('errorMsg');
  const togglePw  = document.getElementById('togglePw');
  const pwInput   = document.getElementById('password');

  // Redirect if already logged in
  if (localStorage.getItem('pt_session')) {
    window.location.href = 'index.html';
  }

  togglePw?.addEventListener('click', () => {
    const isText = pwInput.type === 'text';
    pwInput.type = isText ? 'password' : 'text';
    togglePw.querySelector('i').className = `fa-solid fa-eye${isText ? '' : '-slash'}`;
  });

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value;

    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
    loginBtn.disabled = true;

    setTimeout(() => {
      if (_checkCreds(u, p)) {
        localStorage.setItem('pt_session', btoa(u + ':' + Date.now()));
        localStorage.setItem('pt_user', u);
        window.location.href = 'index.html';
      } else {
        loginErr.classList.remove('hidden');
        errMsg.textContent = 'Invalid username or password';
        loginBtn.innerHTML = '<span>Sign In</span><i class="fa-solid fa-arrow-right"></i>';
        loginBtn.disabled = false;
        setTimeout(() => loginErr.classList.add('hidden'), 4000);
      }
    }, 600);
  });
}

/* ══════════════════════════════════════
   PHASE 4 — DATA SYSTEM
══════════════════════════════════════ */

let DB = { orders: [], activity: [] };

function fetchData() {
  try {
    const stored = localStorage.getItem('pt_orders');
    if (stored) {
      DB = JSON.parse(stored);
    } else {
      // Load from data.json (GitHub Pages compatible)
      fetch('data.json')
        .then(r => r.json())
        .then(d => {
          DB = d;
          saveData();
          renderAll();
        })
        .catch(() => {
          DB = { orders: [], activity: [] };
          renderAll();
        });
      return;
    }
  } catch (e) {
    DB = { orders: [], activity: [] };
  }
  renderAll();
}

function saveData() {
  localStorage.setItem('pt_orders', JSON.stringify(DB));
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
}

/* ══════════════════════════════════════
   DASHBOARD INIT (index.html)
══════════════════════════════════════ */

if (document.getElementById('pageContent')) {

  // Auth guard
  if (!localStorage.getItem('pt_session')) {
    window.location.href = 'login.html';
  }

  // Set username
  const uName = localStorage.getItem('pt_user') || 'Admin';
  const profileNameEl = document.getElementById('profileName');
  if (profileNameEl) profileNameEl.textContent = uName.charAt(0).toUpperCase() + uName.slice(1);

  // Load data
  fetchData();

  /* ── SIDEBAR TOGGLE ── */
  const sidebar = document.getElementById('sidebar');
  const mainWrap = document.getElementById('mainWrap');
  const sidebarToggle = document.getElementById('sidebarToggle');

  sidebarToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainWrap.classList.toggle('expanded');
  });

  /* ── NAV ROUTING ── */
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.dataset.section;
      navigateTo(target);
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

  /* ── DARK MODE ── */
  const darkToggle = document.getElementById('darkModeToggle');
  const settingDark = document.getElementById('settingDarkMode');
  const html = document.documentElement;

  const savedTheme = localStorage.getItem('pt_theme') || 'dark';
  applyTheme(savedTheme);

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('pt_theme', theme);
    const isDark = theme === 'dark';
    if (darkToggle) darkToggle.querySelector('i').className = `fa-solid fa-${isDark ? 'sun' : 'moon'}`;
    if (settingDark) settingDark.checked = isDark;
  }

  darkToggle?.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  settingDark?.addEventListener('change', () => {
    applyTheme(settingDark.checked ? 'dark' : 'light');
  });

  /* ── LOGOUT ── */
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('pt_session');
    localStorage.removeItem('pt_user');
    window.location.href = 'login.html';
  });

  /* ── GLOBAL SEARCH ── */
  document.getElementById('globalSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (q.length > 0) {
      navigateTo('orders');
      document.getElementById('orderSearch').value = q;
      applyFilters();
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

    let filtered = DB.orders.filter(o => {
      const matchQ      = !q || o.product_name.toLowerCase().includes(q) || o.order_number?.toLowerCase().includes(q);
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
    orderModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    orderModal.classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('orderForm').reset();
    document.getElementById('editOrderId').value = '';
    document.getElementById('imagePreview').innerHTML = '<i class="fa-solid fa-image"></i><p>Click to upload image</p>';
    document.getElementById('fImage').value = '';
    // Reset tabs
    document.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector('.form-tab[data-tab="basic"]')?.classList.add('active');
    document.getElementById('tab-basic')?.classList.add('active');
    calcTotals();
  }

  document.getElementById('addOrderBtn')?.addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Add New Order';
    openModal();
  });
  document.getElementById('quickAddBtn')?.addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Add New Order';
    openModal();
  });
  document.getElementById('qaAddOrder')?.addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Add New Order';
    openModal();
  });
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeModal);
  orderModal?.addEventListener('click', e => { if (e.target === orderModal) closeModal(); });

  // View modal close
  document.getElementById('viewModalClose')?.addEventListener('click', () => {
    viewModal.classList.add('hidden');
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
    const qty   = parseInt(document.getElementById('fQty')?.value)           || 1;
    const ship  = parseFloat(document.getElementById('fShipping')?.value)    || 0;
    const paid  = parseFloat(document.getElementById('fPaid')?.value)        || 0;
    const total   = (price * qty) + ship;
    const pending = Math.max(0, total - paid);
    if (document.getElementById('fTotal'))   document.getElementById('fTotal').value   = `₹${total.toLocaleString('en-IN')}`;
    if (document.getElementById('fPending')) document.getElementById('fPending').value = `₹${pending.toLocaleString('en-IN')}`;
  }

  /* ── IMAGE UPLOAD ── */
  let _currentImageB64 = '';

  document.getElementById('imageUploadArea')?.addEventListener('click', () => {
    document.getElementById('fImage').click();
  });

  document.getElementById('fImage')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image too large (max 2MB)', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      _currentImageB64 = ev.target.result;
      const preview = document.getElementById('imagePreview');
      preview.innerHTML = `<img src="${_currentImageB64}" alt="preview" />`;
    };
    reader.readAsDataURL(file);
  });

  /* ── SAVE ORDER ── */
  document.getElementById('orderForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('editOrderId').value;

    const price = parseFloat(document.getElementById('fActualPrice').value) || 0;
    const qty   = parseInt(document.getElementById('fQty').value) || 1;
    const ship  = parseFloat(document.getElementById('fShipping').value) || 0;
    const paid  = parseFloat(document.getElementById('fPaid').value) || 0;
    const total   = (price * qty) + ship;
    const pending = Math.max(0, total - paid);

    const order = {
      id:             editId || 'ORD' + Date.now(),
      product_name:   document.getElementById('fProductName').value.trim(),
      order_number:   document.getElementById('fOrderNumber').value.trim(),
      vendor:         document.getElementById('fVendor').value.trim(),
      variant:        document.getElementById('fVariant').value,
      quantity:       qty,
      order_date:     document.getElementById('fOrderDate').value,
      eta:            document.getElementById('fEta').value,
      status:         document.getElementById('fStatus').value,
      preorder_price: parseFloat(document.getElementById('fPreorderPrice').value) || 0,
      actual_price:   price,
      shipping:       ship,
      paid:           paid,
      pending:        pending,
      total:          total,
      image:          _currentImageB64 || (editId ? (DB.orders.find(o=>o.id===editId)?.image || '') : ''),
    };

    if (editId) {
      const idx = DB.orders.findIndex(o => o.id === editId);
      if (idx > -1) DB.orders[idx] = order;
      logActivity('info', `Order ${order.order_number || order.id} updated — ${order.product_name}`);
      showToast('Order updated successfully!', 'success');
    } else {
      DB.orders.unshift(order);
      logActivity('success', `New order added — ${order.product_name}`);
      showToast('Order added successfully!', 'success');
    }

    _currentImageB64 = '';
    saveData();
    renderAll();
    closeModal();
  });

  /* ── QUICK ACTIONS ── */
  document.getElementById('qaExport')?.addEventListener('click', exportCSV);
  document.getElementById('qaAnalytics')?.addEventListener('click', () => navigateTo('analytics'));
  document.getElementById('qaDelayed')?.addEventListener('click', () => {
    navigateTo('orders');
    document.getElementById('filterStatus').value = '';
    applyFilters();
    // Highlight delayed
    const today = new Date();
    const delayed = DB.orders.filter(o => o.eta && new Date(o.eta) < today && o.status !== 'Delivered');
    if (delayed.length === 0) {
      showToast('No delayed orders!', 'info');
    } else {
      renderTable(delayed);
      showToast(`${delayed.length} delayed order(s) shown`, 'warning');
    }
  });

  /* ── EXPORT CSV ── */
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportCSV);

  function exportCSV() {
    if (DB.orders.length === 0) { showToast('No orders to export', 'warning'); return; }
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
  document.getElementById('clearDataBtn')?.addEventListener('click', () => {
    if (!confirm('Are you sure? This will delete ALL orders permanently.')) return;
    DB = { orders: [], activity: [] };
    saveData();
    renderAll();
    showToast('All data cleared', 'info');
  });
}

/* ══════════════════════════════════════
   PHASE 3 — RENDER STATS
══════════════════════════════════════ */

function renderStats() {
  const orders   = DB.orders;
  const total    = orders.length;
  const invest   = orders.reduce((s, o) => s + (o.total || 0), 0);
  const pending  = orders.reduce((s, o) => s + (o.pending || 0), 0);
  const delivered = orders.filter(o => o.status === 'Delivered').length;
  const transit   = orders.filter(o => o.status === 'Shipped').length;

  setText('statTotal',     total);
  setText('statInvestment', '₹' + invest.toLocaleString('en-IN'));
  setText('statPending',    '₹' + pending.toLocaleString('en-IN'));
  setText('statDelivered',  delivered);
  setText('statTransit',    transit);

  // Show notification dot if pending > 0
  const dot = document.getElementById('notifDot');
  if (dot) dot.classList.toggle('show', pending > 0);
}

/* ══════════════════════════════════════
   PHASE 5 — RENDER TABLE / EDIT / DELETE
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
    const statusClass = o.status?.toLowerCase().replace(' ', '-');
    const fillClass   = `fill-${o.status?.toLowerCase()}`;
    const payBadge    = o.pending <= 0 ? 'badge-paid' : (o.paid > 0 ? 'badge-partial' : 'badge-pending-b');
    const payLabel    = o.pending <= 0 ? 'Paid' : (o.paid > 0 ? 'Partial' : 'Pending');
    const thumb       = o.image
      ? `<img src="${o.image}" alt="${o.product_name}" />`
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
      <td>${o.quantity}</td>
      <td><strong>₹${(o.total||0).toLocaleString('en-IN')}</strong></td>
      <td style="color:var(--green)">₹${(o.paid||0).toLocaleString('en-IN')}</td>
      <td>
        <div class="pay-bar-wrap">
          <span class="badge ${payBadge}">${payLabel}</span>
          <div class="pay-bar"><div class="pay-fill" style="width:${payPct}%"></div></div>
        </div>
      </td>
      <td>
        <span class="badge badge-${statusClass}">${o.status}</span>
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

function editOrder(id) {
  const o = DB.orders.find(x => x.id === id);
  if (!o) return;

  document.getElementById('modalTitle').textContent = 'Edit Order';
  document.getElementById('editOrderId').value = o.id;
  document.getElementById('fProductName').value  = o.product_name || '';
  document.getElementById('fOrderNumber').value  = o.order_number || '';
  document.getElementById('fVendor').value        = o.vendor || '';
  document.getElementById('fVariant').value       = o.variant || 'Box';
  document.getElementById('fQty').value           = o.quantity || 1;
  document.getElementById('fOrderDate').value     = o.order_date || '';
  document.getElementById('fEta').value           = o.eta || '';
  document.getElementById('fStatus').value        = o.status || 'Ordered';
  document.getElementById('fPreorderPrice').value = o.preorder_price || 0;
  document.getElementById('fActualPrice').value   = o.actual_price || 0;
  document.getElementById('fShipping').value      = o.shipping || 0;
  document.getElementById('fPaid').value          = o.paid || 0;

  if (o.image) {
    document.getElementById('imagePreview').innerHTML = `<img src="${o.image}" alt="preview" />`;
  }

  calcTotals();
  document.getElementById('orderModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function deleteOrder(id) {
  const o = DB.orders.find(x => x.id === id);
  if (!o) return;
  if (!confirm(`Delete "${o.product_name}"? This cannot be undone.`)) return;
  DB.orders = DB.orders.filter(x => x.id !== id);
  logActivity('warning', `Order ${o.order_number || id} deleted — ${o.product_name}`);
  saveData();
  renderAll();
  showToast('Order deleted', 'info');
}

function viewOrder(id) {
  const o = DB.orders.find(x => x.id === id);
  if (!o) return;

  const statusSteps = ['Ordered','Processing','Shipped','Delivered'];
  const currentIdx  = statusSteps.indexOf(o.status);
  const payPct      = o.total ? Math.min(100, Math.round((o.paid / o.total) * 100)) : 0;

  const stepsHtml = statusSteps.map((s, i) => {
    const done   = i < currentIdx;
    const active = i === currentIdx;
    return `<div class="step-node">
      <div class="step-dot ${done ? 'done' : active ? 'active' : ''}">
        ${done ? '<i class="fa-solid fa-check"></i>' : (i + 1)}
      </div>
      <span class="step-label">${s}</span>
    </div>`;
  }).join('');

  document.getElementById('viewModalTitle').textContent = o.product_name;
  document.getElementById('viewModalBody').innerHTML = `
    ${o.image ? `<img src="${o.image}" alt="${o.product_name}" class="view-image" />` : ''}

    <div class="view-status-bar">
      <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.75rem">Order Progress</p>
      <div class="view-status-steps">${stepsHtml}</div>
    </div>

    <div style="margin:0.75rem 0">
      <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.3rem">Payment — ${payPct}% paid</p>
      <div class="pay-bar" style="height:8px">
        <div class="pay-fill" style="width:${payPct}%"></div>
      </div>
    </div>

    <div class="view-grid">
      <div class="view-field"><label>Order #</label><span>${escHtml(o.order_number || o.id)}</span></div>
      <div class="view-field"><label>Vendor</label><span>${escHtml(o.vendor || '—')}</span></div>
      <div class="view-field"><label>Variant</label><span>${escHtml(o.variant || '—')}</span></div>
      <div class="view-field"><label>Quantity</label><span>${o.quantity}</span></div>
      <div class="view-field"><label>Order Date</label><span>${formatDate(o.order_date)}</span></div>
      <div class="view-field"><label>ETA</label><span>${formatDate(o.eta)}</span></div>
      <div class="view-field"><label>Preorder Price</label><span>₹${(o.preorder_price||0).toLocaleString('en-IN')}</span></div>
      <div class="view-field"><label>Actual Price</label><span>₹${(o.actual_price||0).toLocaleString('en-IN')}</span></div>
      <div class="view-field"><label>Shipping</label><span>₹${(o.shipping||0).toLocaleString('en-IN')}</span></div>
      <div class="view-field"><label>Total</label><span style="color:var(--primary-light);font-size:1rem">₹${(o.total||0).toLocaleString('en-IN')}</span></div>
      <div class="view-field"><label>Paid</label><span style="color:var(--green)">₹${(o.paid||0).toLocaleString('en-IN')}</span></div>
      <div class="view-field"><label>Pending</label><span style="color:var(--pink)">₹${(o.pending||0).toLocaleString('en-IN')}</span></div>
    </div>

    <div style="margin-top:1rem;display:flex;gap:0.5rem;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="document.getElementById('viewModal').classList.add('hidden');document.body.style.overflow='';editOrder('${o.id}')">
        <i class="fa-solid fa-pen"></i> Edit
      </button>
      <button class="btn btn-danger" onclick="document.getElementById('viewModal').classList.add('hidden');document.body.style.overflow='';deleteOrder('${o.id}')">
        <i class="fa-solid fa-trash"></i> Delete
      </button>
    </div>
  `;

  document.getElementById('viewModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

/* ══════════════════════════════════════
   PHASE 13 — SMART WIDGETS
══════════════════════════════════════ */

function renderRecentOrders() {
  const list = document.getElementById('recentOrdersList');
  if (!list) return;
  const recent = [...DB.orders].slice(0, 5);
  if (recent.length === 0) { list.innerHTML = '<div class="empty-state">No orders yet</div>'; return; }
  list.innerHTML = recent.map(o => {
    const thumb = o.image ? `<img src="${o.image}" />` : `<i class="fa-solid fa-cube"></i>`;
    const statusClass = o.status?.toLowerCase().replace(' ', '-');
    return `<div class="recent-order-item">
      <div class="roi-thumb">${thumb}</div>
      <div class="roi-info">
        <div class="roi-name">${escHtml(o.product_name)}</div>
        <div class="roi-meta">${escHtml(o.vendor || '')} · ₹${(o.total||0).toLocaleString('en-IN')}</div>
      </div>
      <span class="badge badge-${statusClass}">${o.status}</span>
    </div>`;
  }).join('');
}

function renderEtaWidget() {
  const list = document.getElementById('etaList');
  if (!list) return;
  const today = new Date();
  const upcoming = DB.orders
    .filter(o => o.eta && o.status !== 'Delivered')
    .sort((a, b) => new Date(a.eta) - new Date(b.eta))
    .slice(0, 5);

  if (upcoming.length === 0) { list.innerHTML = '<div class="empty-state">No upcoming ETAs</div>'; return; }

  list.innerHTML = upcoming.map(o => {
    const etaDate = new Date(o.eta);
    const diff    = Math.ceil((etaDate - today) / (1000 * 60 * 60 * 24));
    let cls = 'ok', label = `${diff}d left`;
    if (diff < 0)       { cls = 'overdue'; label = `${Math.abs(diff)}d overdue`; }
    else if (diff <= 7) { cls = 'soon';    label = `${diff}d left`; }
    return `<div class="eta-item">
      <div>
        <div style="font-size:0.82rem;font-weight:600">${escHtml(o.product_name)}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">${formatDate(o.eta)}</div>
      </div>
      <span class="eta-countdown ${cls}">${label}</span>
    </div>`;
  }).join('');
}

function renderAlerts() {
  const panel = document.getElementById('alertsPanel');
  if (!panel) return;
  const alerts = [];
  const today = new Date();

  const delayed = DB.orders.filter(o => o.eta && new Date(o.eta) < today && o.status !== 'Delivered');
  if (delayed.length > 0) {
    alerts.push({ cls: 'danger', icon: 'fa-triangle-exclamation', msg: `${delayed.length} delayed order(s)` });
  }

  const highPending = DB.orders.filter(o => (o.pending || 0) > 5000);
  if (highPending.length > 0) {
    alerts.push({ cls: 'warning', icon: 'fa-circle-exclamation', msg: `High pending ≥₹5k on ${highPending.length} order(s)` });
  }

  // Top vendor
  const vendorMap = {};
  DB.orders.forEach(o => { if (o.vendor) vendorMap[o.vendor] = (vendorMap[o.vendor] || 0) + 1; });
  const topVendor = Object.entries(vendorMap).sort((a, b) => b[1] - a[1])[0];
  if (topVendor) {
    alerts.push({ cls: 'info', icon: 'fa-trophy', msg: `Top vendor: ${topVendor[0]} (${topVendor[1]} orders)` });
  }

  panel.innerHTML = alerts.length === 0
    ? '<div class="alert-item info"><i class="fa-solid fa-circle-check"></i> All good!</div>'
    : alerts.map(a => `<div class="alert-item ${a.cls}"><i class="fa-solid ${a.icon}"></i> ${escHtml(a.msg)}</div>`).join('');
}

function renderActivityFeed() {
  const list = document.getElementById('activityList');
  if (!list) return;
  const acts = (DB.activity || []).slice(0, 8);
  if (acts.length === 0) { list.innerHTML = '<div class="empty-state">No recent activity</div>'; return; }
  list.innerHTML = acts.map(a => `
    <div class="activity-item">
      <div class="activity-dot ${a.type}"></div>
      <span>${escHtml(a.msg)}</span>
      <span class="activity-time">${escHtml(a.time)}</span>
    </div>`).join('');
}

function renderVendorFilter() {
  const sel = document.getElementById('filterVendor');
  if (!sel) return;
  const vendors = [...new Set(DB.orders.map(o => o.vendor).filter(Boolean))];
  const current = sel.value;
  sel.innerHTML = '<option value="">All Vendors</option>' +
    vendors.map(v => `<option value="${escHtml(v)}" ${v === current ? 'selected' : ''}>${escHtml(v)}</option>`).join('');
}

/* ══════════════════════════════════════
   PHASE 9 — PAYMENTS VIEW
══════════════════════════════════════ */

function renderPayments() {
  const list = document.getElementById('paymentsList');
  if (!list) return;
  const sorted = [...DB.orders].sort((a, b) => (b.pending || 0) - (a.pending || 0));
  if (sorted.length === 0) { list.innerHTML = '<div class="empty-state">No payment data</div>'; return; }

  list.innerHTML = sorted.map(o => {
    const payPct  = o.total ? Math.min(100, Math.round((o.paid / o.total) * 100)) : 0;
    const payLabel = o.pending <= 0 ? 'Paid' : (o.paid > 0 ? 'Partial' : 'Pending');
    const payBadge = o.pending <= 0 ? 'badge-paid' : (o.paid > 0 ? 'badge-partial' : 'badge-pending-b');
    return `<div class="payment-card">
      <div class="pay-product">
        <strong>${escHtml(o.product_name)}</strong>
        <span>${escHtml(o.vendor || '')} · ${escHtml(o.order_number || o.id)}</span>
        <div class="pay-bar" style="margin-top:0.4rem"><div class="pay-fill" style="width:${payPct}%"></div></div>
      </div>
      <div class="pay-amounts">
        <div class="total-amt">₹${(o.total||0).toLocaleString('en-IN')}</div>
        ${o.pending > 0 ? `<div class="pending-amt">₹${o.pending.toLocaleString('en-IN')} pending</div>` : ''}
        <span class="badge ${payBadge}" style="margin-top:0.2rem">${payLabel}</span>
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   PHASE 12 — ANALYTICS
══════════════════════════════════════ */

function renderAnalytics() {
  renderVendorChart();
  renderStatusChart();
  renderMonthlyChart();
}

function renderVendorChart() {
  const el = document.getElementById('vendorChart');
  if (!el) return;
  const map = {};
  DB.orders.forEach(o => {
    if (!o.vendor) return;
    map[o.vendor] = (map[o.vendor] || { count: 0, spend: 0 });
    map[o.vendor].count++;
    map[o.vendor].spend += o.total || 0;
  });
  const entries = Object.entries(map).sort((a, b) => b[1].spend - a[1].spend);
  const maxSpend = entries[0]?.[1].spend || 1;

  if (entries.length === 0) { el.innerHTML = '<div class="empty-state">No data</div>'; return; }
  el.innerHTML = entries.map(([v, d]) => `
    <div class="vendor-bar-item">
      <span class="vendor-name">${escHtml(v)}</span>
      <div class="vendor-track"><div class="vendor-fill" style="width:${Math.round((d.spend/maxSpend)*100)}%"></div></div>
      <span class="vendor-val">₹${d.spend.toLocaleString('en-IN')}</span>
    </div>`).join('');
}

function renderStatusChart() {
  const el = document.getElementById('statusChart');
  if (!el) return;
  const map = { Ordered: 0, Processing: 0, Shipped: 0, Delivered: 0 };
  DB.orders.forEach(o => { if (map[o.status] !== undefined) map[o.status]++; });
  const total = DB.orders.length || 1;
  const colors = { Ordered: 'var(--indigo)', Processing: 'var(--orange)', Shipped: 'var(--primary)', Delivered: 'var(--green)' };

  // CSS conic gradient donut
  let angle = 0;
  const segments = Object.entries(map).map(([s, c]) => {
    const pct = (c / total) * 360;
    const seg = { s, c, pct, start: angle, color: colors[s] };
    angle += pct;
    return seg;
  });

  const gradient = segments.map(s => `${s.color} ${s.start}deg ${s.start + s.pct}deg`).join(', ');
  const legend   = segments.map(s => `<div class="legend-item"><div class="legend-dot" style="background:${s.color}"></div>${s.s}: ${s.c}</div>`).join('');

  el.innerHTML = `
    <div class="donut-wrap">
      <div style="width:120px;height:120px;border-radius:50%;background:conic-gradient(${gradient});box-shadow:0 4px 20px rgba(0,0,0,0.3);flex-shrink:0"></div>
      <div class="donut-legend">${legend}</div>
    </div>`;
}

function renderMonthlyChart() {
  const el = document.getElementById('monthlyChart');
  if (!el) return;
  const months = {};
  const mLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  DB.orders.forEach(o => {
    if (!o.order_date) return;
    const m = new Date(o.order_date).getMonth();
    months[m] = (months[m] || 0) + (o.total || 0);
  });

  const maxVal = Math.max(...Object.values(months), 1);
  const bars = mLabels.map((label, i) => {
    const val = months[i] || 0;
    const h   = Math.round((val / maxVal) * 160);
    return `<div class="month-bar-wrap">
      <div class="month-bar" style="height:${h}px" data-val="₹${val.toLocaleString('en-IN')}"></div>
      <span class="month-label">${label}</span>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="monthly-chart">${bars}</div>`;
}

/* ══════════════════════════════════════
   PHASE 7 — TOAST SYSTEM
══════════════════════════════════════ */

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.position = 'relative';
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} toast-icon"></i>
    <span class="toast-msg">${escHtml(msg)}</span>
    <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
    <div class="toast-bar"></div>
  `;

  container.appendChild(toast);
  toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
  setTimeout(() => removeToast(toast), 3500);
}

function removeToast(toast) {
  toast.classList.add('out');
  setTimeout(() => toast.remove(), 350);
}

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) { return dateStr; }
}

function logActivity(type, msg) {
  if (!DB.activity) DB.activity = [];
  DB.activity.unshift({ type, msg, time: 'just now' });
  if (DB.activity.length > 20) DB.activity.pop();
}
