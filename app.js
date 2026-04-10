'use strict';

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ── FIREBASE ──
const firebaseConfig = {
  apiKey: "AIzaSyA2-6u8rETOIn9xUJQW0ZODFupZQ56orJg",
  authDomain: "diecast-tracking-471f7.firebaseapp.com",
  projectId: "diecast-tracking-471f7",
  storageBucket: "diecast-tracking-471f7.firebasestorage.app",
  messagingSenderId: "1042711268055",
  appId: "1:1042711268055:web:9b09ded970a85532767e92"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── SUPABASE ──
// TODO: Replace these with your actual Supabase project credentials
// Get them from: https://supabase.com/dashboard → Project Settings → API
const SUPABASE_URL      = 'https://ifzioqfkgjkqkirmtgly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmemlvcWZrZ2prcWtpcm10Z2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MDk4ODMsImV4cCI6MjA5MTM4NTg4M30.3sRDtBjSVcOPjS817TjR6ZP1druW-WW7rxiV1Zb3NCQ';
const SUPABASE_BUCKET   = 'order-images'; // must match your bucket name exactly

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Upload a File to Supabase Storage — returns the public URL */
async function uploadImageToSupabase(file) {
  const ext  = file.name.split('.').pop() || 'jpg';
  const path = `orders/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseClient.storage
    .from(SUPABASE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  const { data } = supabaseClient.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Delete an image from Supabase Storage by its public URL */
async function deleteImageFromSupabase(imageUrl) {
  if (!imageUrl || !imageUrl.includes(SUPABASE_URL)) return; // not a Supabase URL
  const marker = `/object/public/${SUPABASE_BUCKET}/`;
  const idx    = imageUrl.indexOf(marker);
  if (idx === -1) return;
  const filePath = decodeURIComponent(imageUrl.slice(idx + marker.length).split('?')[0]);
  const { error } = await supabaseClient.storage.from(SUPABASE_BUCKET).remove([filePath]);
  if (error) console.warn('Supabase delete failed:', error.message);
}

let DB = { orders: [], activity: [] };
let _currentImageFile = null;  // raw File for Supabase upload
let _currentImageB64  = '';    // preview only — no longer stored in Firestore
let _authReady = false;

/* ── LOGIN ── */
if (document.getElementById('loginForm')) initLoginPage();

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

  onAuthStateChanged(auth, (user) => { if (user) window.location.href = 'index.html'; });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
    loginBtn.disabled  = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = 'index.html';
    } catch (error) {
      loginErr.classList.remove('hidden');
      errMsg.textContent = 'Invalid email or password';
      loginBtn.innerHTML = '<span>Sign In</span><i class="fa-solid fa-arrow-right"></i>';
      loginBtn.disabled  = false;
      setTimeout(() => loginErr.classList.add('hidden'), 4000);
    }
  });
}

/* ── DASHBOARD AUTH ── */
if (document.getElementById('pageContent')) {
  onAuthStateChanged(auth, async (user) => {
    _authReady = true;
    if (!user) { window.location.href = 'login.html'; return; }
    const el = document.getElementById('profileName');
    if (el) el.textContent = user.email || 'Admin';
    await fetchData();
    initDashboard();
  });
}

function initDashboard() {
  const sidebar        = document.getElementById('sidebar');
  const mainWrap       = document.getElementById('mainWrap');
  const sidebarToggle  = document.getElementById('sidebarToggle');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const isMobile       = () => window.innerWidth <= 900;

  sidebarToggle?.addEventListener('click', () => {
    if (isMobile()) {
      sidebar.classList.toggle('mobile-open');
      sidebarOverlay?.classList.toggle('show');
    } else {
      sidebar.classList.toggle('collapsed');
      mainWrap.classList.toggle('expanded');
    }
  });

  sidebarOverlay?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('show');
  });

  initGreeting();

  function navigateTo(section) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add('active');
    document.getElementById(`section-${section}`)?.classList.add('active');
  }

  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.section);
      if (isMobile()) { sidebar.classList.remove('mobile-open'); sidebarOverlay?.classList.remove('show'); }
    });
  });

  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); navigateTo(el.dataset.goto); });
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try { await signOut(auth); window.location.href = 'login.html'; }
    catch (e) { showToast('Logout failed', 'warning'); }
  });

  // Inventory filters
  ['invSearch','invFilterBrand','invFilterStatus','invFilterScale','invSort'].forEach(id => {
    document.getElementById(id)?.addEventListener('input',  applyInventoryFilters);
    document.getElementById(id)?.addEventListener('change', applyInventoryFilters);
  });

  // invAddBtn opens the same modal
  document.getElementById('invAddBtn')?.addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Add New Model'; openModal();
  });

  document.getElementById('globalSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (q.length > 0) {
      navigateTo('orders');
      const s = document.getElementById('orderSearch');
      if (s) { s.value = q; applyFilters(); }
    }
  });

  document.getElementById('orderSearch')?.addEventListener('input',   applyFilters);
  document.getElementById('filterStatus')?.addEventListener('change', applyFilters);
  document.getElementById('filterVendor')?.addEventListener('change', applyFilters);
  document.getElementById('filterDateFrom')?.addEventListener('change', applyFilters);
  document.getElementById('filterDateTo')?.addEventListener('change',   applyFilters);

  document.getElementById('clearFilters')?.addEventListener('click', () => {
    ['orderSearch','filterStatus','filterVendor','filterDateFrom','filterDateTo'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    renderTable(DB.orders);
  });

  function applyFilters() {
    const q      = (document.getElementById('orderSearch')?.value   || '').toLowerCase();
    const status = document.getElementById('filterStatus')?.value   || '';
    const vendor = document.getElementById('filterVendor')?.value   || '';
    const from   = document.getElementById('filterDateFrom')?.value;
    const to     = document.getElementById('filterDateTo')?.value;
    renderTable(DB.orders.filter(o => {
      const matchQ      = !q      || (o.product_name || '').toLowerCase().includes(q) || (o.order_number || '').toLowerCase().includes(q);
      const matchStatus = !status || o.status === status;
      const matchVendor = !vendor || o.vendor === vendor;
      const matchFrom   = !from   || new Date(o.order_date) >= new Date(from);
      const matchTo     = !to     || new Date(o.order_date) <= new Date(to);
      return matchQ && matchStatus && matchVendor && matchFrom && matchTo;
    }));
  }

  const orderModal = document.getElementById('orderModal');
  const viewModal  = document.getElementById('viewModal');

  function openModal() { orderModal?.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal() {
    orderModal?.classList.add('hidden'); document.body.style.overflow = '';
    document.getElementById('orderForm')?.reset();
    if (document.getElementById('editOrderId')) document.getElementById('editOrderId').value = '';
    const ip = document.getElementById('imagePreview');
    if (ip) ip.innerHTML = '<i class="fa-solid fa-image"></i><p>Click to upload image</p>';
    const fi = document.getElementById('fImage'); if (fi) fi.value = '';
    _currentImageFile = null;
    _currentImageB64  = '';
    document.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector('.form-tab[data-tab="basic"]')?.classList.add('active');
    document.getElementById('tab-basic')?.classList.add('active');
    calcTotals();
  }

  ['addOrderBtn','quickAddBtn','qaAddOrder'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      document.getElementById('modalTitle').textContent = 'Add New Order'; openModal();
    });
  });
  document.getElementById('modalClose')?.addEventListener('click',  closeModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeModal);
  orderModal?.addEventListener('click', e => { if (e.target === orderModal) closeModal(); });

  document.getElementById('viewModalClose')?.addEventListener('click', () => {
    viewModal?.classList.add('hidden'); document.body.style.overflow = '';
  });
  viewModal?.addEventListener('click', e => {
    if (e.target === viewModal) { viewModal.classList.add('hidden'); document.body.style.overflow = ''; }
  });

  document.querySelectorAll('.form-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
    });
  });

  ['fPreorderPrice','fActualPrice','fShipping','fPaid','fQty'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcTotals);
  });

  function calcTotals() {
    const price = parseFloat(document.getElementById('fActualPrice')?.value) || 0;
    const qty   = parseInt(document.getElementById('fQty')?.value)           || 1;
    const ship  = parseFloat(document.getElementById('fShipping')?.value)    || 0;
    const paid  = parseFloat(document.getElementById('fPaid')?.value)        || 0;
    const total = (price * qty) + ship, pending = Math.max(0, total - paid);
    if (document.getElementById('fTotal'))   document.getElementById('fTotal').value   = `₹${total.toLocaleString('en-IN')}`;
    if (document.getElementById('fPending')) document.getElementById('fPending').value = `₹${pending.toLocaleString('en-IN')}`;
  }

  document.getElementById('imageUploadArea')?.addEventListener('click', () => document.getElementById('fImage')?.click());
  document.getElementById('fImage')?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image too large (max 5MB)', 'warning'); return; }
    _currentImageFile = file; // store raw file for Supabase upload
    const reader = new FileReader();
    reader.onload = (ev) => {
      _currentImageB64 = ev.target.result; // preview only
      const p = document.getElementById('imagePreview');
      if (p) p.innerHTML = `<img src="${_currentImageB64}" alt="preview" />`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('orderForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('modalSave');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }

    const editId   = document.getElementById('editOrderId')?.value || '';
    const price    = parseFloat(document.getElementById('fActualPrice')?.value) || 0;
    const qty      = parseInt(document.getElementById('fQty')?.value)           || 1;
    const ship     = parseFloat(document.getElementById('fShipping')?.value)    || 0;
    const paid     = parseFloat(document.getElementById('fPaid')?.value)        || 0;
    const total    = (price * qty) + ship, pending = Math.max(0, total - paid);
    const existing = DB.orders.find(o => o.id === editId);

    try {
      // ── IMAGE: upload new file to Supabase, or keep existing URL ──
      let imageUrl = existing?.image || '';
      if (_currentImageFile) {
        // If editing and there was an old image, delete it first
        if (existing?.image) await deleteImageFromSupabase(existing.image);
        imageUrl = await uploadImageToSupabase(_currentImageFile);
      }

      const order = {
        product_name: document.getElementById('fProductName')?.value.trim() || '',
        order_number: document.getElementById('fOrderNumber')?.value.trim() || '',
        brand:        document.getElementById('fBrand')?.value.trim()       || '',
        series:       document.getElementById('fSeries')?.value.trim()      || '',
        scale:        document.getElementById('fScale')?.value              || '1:64',
        condition:    document.getElementById('fCondition')?.value          || 'Mint',
        vendor:       document.getElementById('fVendor')?.value.trim()      || '',
        location:     document.getElementById('fLocation')?.value.trim()    || '',
        variant:      document.getElementById('fVariant')?.value            || '',
        quantity: qty, order_date: document.getElementById('fOrderDate')?.value || '',
        eta:      document.getElementById('fEta')?.value    || '',
        status:   document.getElementById('fStatus')?.value || 'Ordered',
        preorder_price: parseFloat(document.getElementById('fPreorderPrice')?.value) || 0,
        actual_price: price, shipping: ship, paid, pending, total,
        image: imageUrl,
        updatedAt: serverTimestamp()
      };

      if (editId) {
        await updateDoc(doc(db, 'orders', editId), order);
        await addActivity('info', `Order updated — ${order.product_name}`);
        showToast('Order updated!', 'success');
      } else {
        await addDoc(collection(db, 'orders'), { ...order, createdAt: serverTimestamp() });
        await addActivity('success', `New order added — ${order.product_name}`);
        showToast('Order added!', 'success');
      }
      await fetchData(); closeModal();
    } catch (err) {
      console.error(err);
      showToast('Failed to save order: ' + err.message, 'warning');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Order'; }
    }
  });

  document.getElementById('qaExport')?.addEventListener('click', exportCSV);
  document.getElementById('qaAnalytics')?.addEventListener('click', () => navigateTo('analytics'));
  document.getElementById('qaDelayed')?.addEventListener('click', () => {
    navigateTo('orders');
    const delayed = DB.orders.filter(o => o.eta && new Date(o.eta) < new Date() && o.status !== 'Delivered');
    delayed.length === 0 ? showToast('No delayed orders!', 'info') : (renderTable(delayed), showToast(`${delayed.length} delayed shown`, 'warning'));
  });
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportCSV);

  function exportCSV() {
    if (!DB.orders.length) { showToast('No orders to export', 'warning'); return; }
    const headers = ['ID','Product','Order#','Vendor','Variant','Qty','Preorder Price','Actual Price','Shipping','Paid','Pending','Total','Status','ETA','Order Date'];
    const rows    = DB.orders.map(o => [o.id,o.product_name,o.order_number,o.vendor,o.variant,o.quantity,o.preorder_price,o.actual_price,o.shipping,o.paid,o.pending,o.total,o.status,o.eta,o.order_date]);
    const csv     = [headers,...rows].map(r => r.map(c=>`"${c??''}"`).join(',')).join('\n');
    const a       = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})), download: `pretrack_${Date.now()}.csv` });
    a.click(); showToast('CSV exported!', 'success');
  }

  document.getElementById('clearDataBtn')?.addEventListener('click', async () => {
    if (!confirm('Delete ALL orders? This will also remove all uploaded images.')) return;
    try {
      // Delete all Supabase images first
      await Promise.all(DB.orders.map(o => o.image ? deleteImageFromSupabase(o.image) : Promise.resolve()));
      await Promise.all(DB.orders.map(o => deleteDoc(doc(db, 'orders', o.id))));
      await addActivity('warning', 'All orders cleared');
      await fetchData(); showToast('All data cleared', 'info');
    } catch (e) { showToast('Failed to clear: ' + e.message, 'warning'); }
  });
}

/* ── FIRESTORE ── */
async function fetchData() {
  try {
    const os = await getDocs(query(collection(db,'orders'),   orderBy('createdAt','desc')));
    const as = await getDocs(query(collection(db,'activity'), orderBy('createdAt','desc')));
    DB.orders   = os.docs.map(d => ({ id: d.id, ...d.data() }));
    DB.activity = as.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  } catch (err) {
    console.error(err); DB = { orders:[], activity:[] }; renderAll();
  }
}

async function addActivity(type, msg) {
  try { await addDoc(collection(db,'activity'), { type, msg, time: new Date().toLocaleString(), createdAt: serverTimestamp() }); }
  catch (e) { console.error(e); }
}

function compressImage(base64, maxWidth=300, quality=0.7) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxWidth/img.width);
      const c = document.createElement('canvas');
      c.width = img.width*s; c.height = img.height*s;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src = base64;
  });
}

/* ── GREETING ── */
function initGreeting() {
  const gt = document.getElementById('greetingText');
  const gd = document.getElementById('greetingDate');
  const ss = document.getElementById('systemStatus');

  function update() {
    const h = new Date().getHours();
    const emoji = h < 12 ? '<i class="fa-solid fa-cloud-sun"></i>' : h < 17 ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    const word  = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    if (gt) gt.innerHTML = `Good ${word}, Daksh! ${emoji}`;
    if (gd) gd.textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

  function checkSys() {
    if (!ss) return;
    ss.innerHTML = `<span class="status-dot"></span> Checking systems...`; ss.className = 'system-status';
    setTimeout(() => { ss.innerHTML = `<span class="status-dot"></span> All systems live`; ss.className = 'system-status live'; }, 1200);
  }

  update(); checkSys(); setInterval(update, 60000);
}

/* ── RENDER ALL ── */
function renderAll() {
  renderStats(); renderTable(DB.orders); renderRecentOrders(); renderEtaWidget();
  renderActivityFeed(); renderAlerts(); renderPayments(); renderAnalytics();
  renderVendorFilter(); renderBrandLeaderboard(); renderInventory(); renderCatalog(); renderKanban();
  const ss = document.getElementById('systemStatus');
  if (ss) { ss.innerHTML = `<span class="status-dot"></span> All systems live`; ss.className = 'system-status live'; }
}

/* ── STATS ── */
function renderStats() {
  const o = DB.orders, n = o.length;
  const totalQty   = o.reduce((s,x) => s+(x.quantity||1), 0);
  const marketVal  = o.reduce((s,x) => s+((x.preorder_price||0)*(x.quantity||1)), 0);
  const investment = o.reduce((s,x) => s+(x.total||0), 0);
  const pendingAmt = o.reduce((s,x) => s+(x.pending||0), 0);
  const pendingPO  = o.filter(x => x.status==='Ordered'||x.status==='Processing').length;
  const delivered  = o.filter(x => x.status==='Delivered').length;
  const transit    = o.filter(x => x.status==='Shipped').length;
  const overdue    = o.filter(x => x.eta && new Date(x.eta)<new Date() && x.status!=='Delivered').length;
  const nc = {}; o.forEach(x => { const k=(x.product_name||'').toLowerCase().trim(); nc[k]=(nc[k]||0)+1; });
  const dups = Object.values(nc).filter(v=>v>1).length;

  setText('statTotal',n); setText('statQty',totalQty);
  setText('statMarketValue','₹'+marketVal.toLocaleString('en-IN'));
  setText('statInvestment','₹'+investment.toLocaleString('en-IN'));
  setText('statPending','₹'+pendingAmt.toLocaleString('en-IN'));
  setText('statPendingPO',pendingPO); setText('statDelivered',delivered);
  setText('statTransit',transit); setText('statOverdue',overdue); setText('statDuplicates',dups);

  const pct=(x)=>n>0?Math.round((x/n)*100):0;
  const sb=(id,v)=>{const el=document.getElementById(id);if(el)el.style.width=v+'%';};
  sb('statDeliveredBar',pct(delivered)); sb('statTransitBar',pct(transit));
  sb('statPendingPOBar',pct(pendingPO)); sb('statOverdueBar',pct(overdue));
  sb('statDuplicatesBar',pct(dups));
  sb('statPendingBar',investment>0?Math.round((pendingAmt/investment)*100):0);
  const dot=document.getElementById('notifDot');
  if(dot) dot.classList.toggle('show',pendingAmt>0||overdue>0);
}

/* ── TABLE ── */
function renderTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;
  if (!orders?.length) { tbody.innerHTML=`<tr><td colspan="10" class="empty-row"><i class="fa-solid fa-inbox"></i> No orders found</td></tr>`; return; }
  tbody.innerHTML = orders.map(o => {
    const payPct = o.total ? Math.min(100,Math.round((o.paid/o.total)*100)) : 0;
    const sc     = (o.status||'').toLowerCase().replace(/\s+/g,'-');
    const pb     = o.pending<=0?'badge-paid':(o.paid>0?'badge-partial':'badge-pending-b');
    const pl     = o.pending<=0?'Paid':(o.paid>0?'Partial':'Pending');
    const thumb  = o.image?`<img src="${o.image}" alt="${escHtml(o.product_name)}" />`:`<i class="fa-solid fa-cube"></i>`;
    return `<tr>
      <td><div class="order-product-cell"><div class="order-thumb">${thumb}</div><div>
        <div class="order-product-name">${escHtml(o.product_name)}</div>
        <div class="order-variant">${escHtml(o.variant||'')}</div>
      </div></div></td>
      <td><code style="font-size:0.75rem;opacity:0.8">${escHtml(o.order_number||o.id)}</code></td>
      <td>${escHtml(o.vendor||'—')}</td>
      <td>${o.quantity||1}</td>
      <td><strong>₹${(o.total||0).toLocaleString('en-IN')}</strong></td>
      <td style="color:var(--green)">₹${(o.paid||0).toLocaleString('en-IN')}</td>
      <td><div class="pay-bar-wrap"><span class="badge ${pb}">${pl}</span><div class="pay-bar"><div class="pay-fill" style="width:${payPct}%"></div></div></div></td>
      <td><span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span><div class="status-bar"><div class="status-fill fill-${sc}"></div></div></td>
      <td style="font-size:0.78rem;color:var(--text-muted)">${o.eta?formatDate(o.eta):'—'}</td>
      <td><div class="table-actions">
        <button class="btn btn-ghost btn-icon" onclick="viewOrder('${o.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
        <button class="btn btn-ghost btn-icon" onclick="editOrder('${o.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-icon" onclick="deleteOrder('${o.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ── GLOBAL ACTIONS ── */
window.editOrder = function(id) {
  const o = DB.orders.find(x=>x.id===id); if(!o) return;
  document.getElementById('modalTitle').textContent = 'Edit Order';
  [
    ['editOrderId','id'],['fProductName','product_name'],['fOrderNumber','order_number'],
    ['fBrand','brand'],['fSeries','series'],['fScale','scale'],['fCondition','condition'],
    ['fVendor','vendor'],['fLocation','location'],['fVariant','variant'],
    ['fQty','quantity'],['fOrderDate','order_date'],['fEta','eta'],['fStatus','status'],
    ['fPreorderPrice','preorder_price'],['fActualPrice','actual_price'],
    ['fShipping','shipping'],['fPaid','paid']
  ].forEach(([fieldId, key]) => { setVal(fieldId, key==='id' ? o.id : o[key]); });
  _currentImageFile = null;
  _currentImageB64  = '';
  const ip = document.getElementById('imagePreview');
  if(ip) ip.innerHTML = o.image ? `<img src="${o.image}" alt="preview" />` : '<i class="fa-solid fa-image"></i><p>Click to upload image</p>';
  document.getElementById('orderModal')?.classList.remove('hidden'); document.body.style.overflow='hidden';
  document.querySelectorAll('.form-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelector('.form-tab[data-tab="basic"]')?.classList.add('active');
  document.getElementById('tab-basic')?.classList.add('active');
  const price=(parseFloat(o.actual_price)||0), qty=(parseInt(o.quantity)||1), ship=(parseFloat(o.shipping)||0), paid=(parseFloat(o.paid)||0);
  const total=(price*qty)+ship, pending=Math.max(0,total-paid);
  if(document.getElementById('fTotal'))   document.getElementById('fTotal').value   = `₹${total.toLocaleString('en-IN')}`;
  if(document.getElementById('fPending')) document.getElementById('fPending').value = `₹${pending.toLocaleString('en-IN')}`;
};

window.deleteOrder = async function(id) {
  if(!confirm('Delete this order?')) return;
  try {
    const o = DB.orders.find(x=>x.id===id);
    if (o?.image) await deleteImageFromSupabase(o.image);
    await deleteDoc(doc(db,'orders',id));
    await addActivity('warning',`Order deleted — ${o?.product_name||id}`);
    showToast('Order deleted','success'); await fetchData();
  } catch(e) { showToast('Failed to delete: ' + e.message,'warning'); }
};

window.duplicateOrder = async function(id) {
  const o = DB.orders.find(x=>x.id===id); if(!o) return;
  try {
    const { id: _id, createdAt, updatedAt, ...copy } = o;
    await addDoc(collection(db,'orders'), { ...copy, product_name: copy.product_name + ' (Copy)', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    await addActivity('info', `Order duplicated — ${o.product_name}`);
    showToast('Order duplicated!', 'success'); await fetchData();
  } catch(e) { showToast('Failed to duplicate', 'warning'); }
};

window.viewOrder = function(id) {
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  const body=document.getElementById('viewModalBody'), modal=document.getElementById('viewModal');
  if(!body||!modal) return;
  body.innerHTML = `
    ${o.image?`<img src="${o.image}" alt="${escHtml(o.product_name)}" class="view-image" />`:''}
    <div class="view-grid">
      <div><strong>Product:</strong> ${escHtml(o.product_name||'—')}</div>
      <div><strong>Order #:</strong> ${escHtml(o.order_number||o.id)}</div>
      <div><strong>Vendor:</strong> ${escHtml(o.vendor||'—')}</div>
      <div><strong>Variant:</strong> ${escHtml(o.variant||'—')}</div>
      <div><strong>Qty:</strong> ${o.quantity||1}</div>
      <div><strong>Status:</strong> ${escHtml(o.status||'Ordered')}</div>
      <div><strong>Order Date:</strong> ${formatDate(o.order_date)}</div>
      <div><strong>ETA:</strong> ${formatDate(o.eta)}</div>
      <div><strong>Preorder Price:</strong> ₹${(o.preorder_price||0).toLocaleString('en-IN')}</div>
      <div><strong>Actual Price:</strong> ₹${(o.actual_price||0).toLocaleString('en-IN')}</div>
      <div><strong>Shipping:</strong> ₹${(o.shipping||0).toLocaleString('en-IN')}</div>
      <div><strong>Paid:</strong> ₹${(o.paid||0).toLocaleString('en-IN')}</div>
      <div><strong>Pending:</strong> ₹${(o.pending||0).toLocaleString('en-IN')}</div>
      <div><strong>Total:</strong> ₹${(o.total||0).toLocaleString('en-IN')}</div>
    </div>`;
  modal.classList.remove('hidden'); document.body.style.overflow='hidden';
};

/* ── INVENTORY ── */
function renderInventory() {
  applyInventoryFilters();
  // Populate brand filter
  const bf = document.getElementById('invFilterBrand');
  if (bf) {
    const cur = bf.value;
    const brands = [...new Set(DB.orders.map(o => o.brand || o.vendor).filter(Boolean))];
    bf.innerHTML = `<option value="">All Brands</option>` + brands.map(b => `<option value="${escHtml(b)}">${escHtml(b)}</option>`).join('');
    bf.value = cur;
  }
}

function applyInventoryFilters() {
  const q      = (document.getElementById('invSearch')?.value || '').toLowerCase();
  const brand  = document.getElementById('invFilterBrand')?.value  || '';
  const status = document.getElementById('invFilterStatus')?.value || '';
  const scale  = document.getElementById('invFilterScale')?.value  || '';
  const sort   = document.getElementById('invSort')?.value         || 'name-az';

  let items = DB.orders.filter(o => {
    const b = o.brand || o.vendor || '';
    const matchQ      = !q      || (o.product_name||'').toLowerCase().includes(q) || b.toLowerCase().includes(q) || (o.series||'').toLowerCase().includes(q);
    const matchBrand  = !brand  || b === brand;
    const matchStatus = !status || o.status === status;
    const matchScale  = !scale  || o.scale  === scale;
    return matchQ && matchBrand && matchStatus && matchScale;
  });

  if (sort === 'name-az')  items.sort((a,b) => (a.product_name||'').localeCompare(b.product_name||''));
  if (sort === 'name-za')  items.sort((a,b) => (b.product_name||'').localeCompare(a.product_name||''));
  if (sort === 'price-hi') items.sort((a,b) => (b.actual_price||0) - (a.actual_price||0));
  if (sort === 'price-lo') items.sort((a,b) => (a.actual_price||0) - (b.actual_price||0));

  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-row"><i class="fa-solid fa-inbox"></i> No items found</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(o => {
    const sc    = (o.status||'').toLowerCase().replace(/\s+/g,'-');
    const thumb = o.image ? `<img src="${o.image}" alt="${escHtml(o.product_name)}" />` : `<i class="fa-solid fa-car-side"></i>`;
    const cond  = o.condition || 'Mint';
    const track = o.order_number ? `• ${escHtml(o.order_number)}` : '• No tracking';
    return `<tr>
      <td><div class="order-product-cell">
        <div class="order-thumb">${thumb}</div>
        <div>
          <div class="order-product-name">${escHtml(o.product_name)}</div>
          <div class="order-variant" style="font-size:0.7rem;opacity:0.6">${escHtml(cond)} ${track}</div>
        </div>
      </div></td>
      <td>${escHtml(o.brand||o.vendor||'—')}</td>
      <td>${escHtml(o.series||'—')}</td>
      <td><code style="font-size:0.75rem">${escHtml(o.scale||'1:64')}</code></td>
      <td><span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span></td>
      <td>${o.quantity||1}</td>
      <td>₹${(o.actual_price||0).toLocaleString('en-IN')}</td>
      <td>₹${(o.preorder_price||0).toLocaleString('en-IN')}</td>
      <td>${escHtml(o.vendor||'—')}</td>
      <td style="font-size:0.78rem;color:var(--text-muted)">${escHtml(o.location||'—')}</td>
      <td><div class="table-actions">
        <button class="btn btn-ghost btn-icon" onclick="viewOrder('${o.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
        <button class="btn btn-ghost btn-icon" onclick="editOrder('${o.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-ghost btn-icon" onclick="duplicateOrder('${o.id}')" title="Duplicate"><i class="fa-solid fa-copy"></i></button>
        <button class="btn btn-danger btn-icon" onclick="deleteOrder('${o.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ── CATALOG ── */
function renderCatalog() {
  const grid = document.getElementById('catalogGrid'); if(!grid) return;
  if(!DB.orders.length) { grid.innerHTML=`<div class="empty-state">No models tracked yet</div>`; return; }
  grid.innerHTML = DB.orders.map(o=>{
    const sc=(o.status||'').toLowerCase().replace(/\s+/g,'-');
    return `<div class="catalog-card">
      <div class="catalog-card-img">${o.image?`<img src="${o.image}" alt="${escHtml(o.product_name)}" />`:`<i class="fa-solid fa-car-side"></i>`}</div>
      <div class="catalog-card-body">
        <div class="catalog-card-name">${escHtml(o.product_name)}</div>
        <div class="catalog-card-vendor">${escHtml(o.vendor||'—')} • ${escHtml(o.variant||'Box')}</div>
        <div class="catalog-card-footer">
          <span class="catalog-card-price">₹${(o.total||0).toLocaleString('en-IN')}</span>
          <span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span>
        </div>
      </div>
    </div>`;}).join('');
}

/* ── KANBAN ── */
function renderKanban() {
  const cols={'Ordered':'kbc-ordered','Processing':'kbc-processing','Shipped':'kbc-shipped','Delivered':'kbc-delivered'};
  Object.entries(cols).forEach(([status,colId])=>{
    const col=document.getElementById(colId); if(!col) return;
    const items=DB.orders.filter(o=>o.status===status);
    if(!items.length) { col.innerHTML=`<div class="kb-empty">No orders</div>`; return; }
    col.innerHTML=items.map(o=>`
      <div class="kb-card" onclick="viewOrder('${o.id}')">
        <div class="kb-card-name">${escHtml(o.product_name)}</div>
        <div style="font-size:0.71rem;color:var(--text-muted);margin-bottom:0.3rem">${escHtml(o.vendor||'—')}</div>
        <div class="kb-card-meta">
          <span class="kb-card-price">₹${(o.total||0).toLocaleString('en-IN')}</span>
          <span style="font-size:0.7rem;color:var(--text-muted)">${o.eta?formatDate(o.eta):'No ETA'}</span>
        </div>
      </div>`).join('');
  });
}

/* ── WIDGETS ── */
function renderRecentOrders() {
  const c=document.getElementById('recentOrdersList'); if(!c) return;
  const items=DB.orders.slice(0,5);
  if(!items.length){c.innerHTML=`<div class="empty-state">No orders yet</div>`;return;}
  c.innerHTML=items.map(o=>`
    <div class="recent-order-item">
      <div class="roi-thumb">${o.image?`<img src="${o.image}" alt="${escHtml(o.product_name)}" />`:`<i class="fa-solid fa-cube"></i>`}</div>
      <div class="roi-info">
        <div class="roi-name">${escHtml(o.product_name)}</div>
        <div class="roi-meta">${escHtml(o.order_number||o.id)} • ${escHtml(o.vendor||'—')}</div>
      </div>
      <div class="roi-status"><span class="badge badge-${(o.status||'').toLowerCase().replace(/\s+/g,'-')}">${escHtml(o.status||'Ordered')}</span></div>
    </div>`).join('');
}

function renderEtaWidget() {
  const c=document.getElementById('etaList'); if(!c) return;
  const upcoming=DB.orders.filter(o=>o.eta&&o.status!=='Delivered').sort((a,b)=>new Date(a.eta)-new Date(b.eta)).slice(0,6);
  if(!upcoming.length){c.innerHTML=`<div class="empty-state">No upcoming deliveries</div>`;return;}
  const today=new Date();
  c.innerHTML=upcoming.map(o=>{
    const d=Math.ceil((new Date(o.eta)-today)/(1000*60*60*24));
    let dc='eta-chip-ok',dl=`${d}d`;
    if(d<0){dc='eta-chip-overdue';dl=`${Math.abs(d)}d overdue`;}else if(d<=7){dc='eta-chip-soon';}
    return `<div class="delivery-item">
      <div class="delivery-icon"><i class="fa-solid fa-truck"></i></div>
      <div class="delivery-info">
        <div class="delivery-name">${escHtml(o.product_name)}</div>
        <div class="delivery-meta">${escHtml(o.vendor||'—')} • ETA ${escHtml(o.eta)}</div>
        <div class="delivery-chips">
          <span class="delivery-chip eta-chip ${dc}"><i class="fa-solid fa-calendar-days"></i> ${dl}</span>
          <span class="delivery-chip vendor-chip"><i class="fa-solid fa-store"></i> ${escHtml(o.vendor||'—')}</span>
        </div>
      </div>
    </div>`;}).join('');
}

function renderActivityFeed() {
  const c=document.getElementById('activityList'); if(!c) return;
  const items=DB.activity.slice(0,8);
  if(!items.length){c.innerHTML=`<div class="empty-state">No recent activity</div>`;return;}
  c.innerHTML=items.map(a=>`
    <div class="activity-item">
      <span class="activity-dot ${escHtml(a.type||'info')}"></span>
      <span>${escHtml(a.msg||'')}</span>
      <span class="activity-time">${escHtml(a.time||'')}</span>
    </div>`).join('');
}

function renderBrandLeaderboard() {
  const c=document.getElementById('leaderboardList'); if(!c) return;
  if(!DB.orders.length){c.innerHTML=`<div class="empty-state">No data yet</div>`;return;}
  const bm={};
  DB.orders.forEach(o=>{const k=(o.vendor||'Unknown').trim();bm[k]=(bm[k]||0)+(o.quantity||1);});
  const sorted=Object.entries(bm).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const ri=(i)=>i===0?`<div class="lb-rank-icon gold"><i class="fa-solid fa-crown"></i></div>`:i===1?`<div class="lb-rank-icon silver"><i class="fa-solid fa-medal"></i></div>`:i===2?`<div class="lb-rank-icon bronze"><i class="fa-solid fa-award"></i></div>`:`<div class="lb-rank-icon"><i class="fa-solid fa-hashtag"></i></div>`;
  c.innerHTML=sorted.map(([brand,qty],i)=>`
    <div class="lb-item">${ri(i)}
      <div class="lb-info"><div class="lb-name">#${i+1} ${escHtml(brand)}</div><div class="lb-sub">${qty} unit${qty!==1?'s':''} tracked</div></div>
      <span class="lb-count">${qty}</span>
    </div>`).join('');
}

function renderAlerts() {
  const c=document.getElementById('alertsPanel'); if(!c) return;
  const alerts=[];
  const delayed=DB.orders.filter(o=>o.eta&&new Date(o.eta)<new Date()&&o.status!=='Delivered');
  const unpaid=DB.orders.filter(o=>(o.pending||0)>0);
  if(delayed.length>0) alerts.push({type:'warning',msg:`${delayed.length} delayed order(s)`});
  if(unpaid.length>0)  alerts.push({type:'danger', msg:`${unpaid.length} order(s) with pending payment`});
  if(!alerts.length)   alerts.push({type:'info',   msg:'All systems normal'});
  c.innerHTML=alerts.map(a=>`<div class="alert-item ${a.type}"><i class="fa-solid fa-circle-info"></i><span>${escHtml(a.msg)}</span></div>`).join('');
}

function renderPayments() {
  const c=document.getElementById('paymentsContent'); if(!c) return;
  if(!DB.orders.length){c.innerHTML=`<div class="widget glass full-width"><div class="widget-body"><div class="empty-state">No payment data yet</div></div></div>`;return;}
  const rows=DB.orders.map(o=>`<tr>
    <td>${escHtml(o.product_name||'—')}</td><td>${escHtml(o.order_number||o.id)}</td>
    <td>₹${(o.total||0).toLocaleString('en-IN')}</td>
    <td style="color:var(--green)">₹${(o.paid||0).toLocaleString('en-IN')}</td>
    <td style="color:${(o.pending||0)>0?'var(--orange)':'var(--green)'}">₹${(o.pending||0).toLocaleString('en-IN')}</td>
    <td>${escHtml(o.status||'Ordered')}</td>
  </tr>`).join('');
  c.innerHTML=`<div class="widget glass full-width"><div class="widget-header"><h3><i class="fa-solid fa-credit-card"></i> Payment Overview</h3></div><div class="table-wrap"><table class="orders-table"><thead><tr><th>Product</th><th>Order #</th><th>Total</th><th>Paid</th><th>Pending</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function renderAnalytics() {
  const vc=document.getElementById('vendorChart'), sc=document.getElementById('statusChart'), mc=document.getElementById('monthlyChart');
  if(vc){const vm={};DB.orders.forEach(o=>{const k=o.vendor||'Unknown';vm[k]=(vm[k]||0)+1;});
    vc.innerHTML=Object.entries(vm).map(([k,v])=>`<div class="mini-bar-row"><span>${escHtml(k)}</span><div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100,v*20)}%"></div></div><strong>${v}</strong></div>`).join('')||`<div class="empty-state">No data</div>`;}
  if(sc){const sm={};DB.orders.forEach(o=>{const k=o.status||'Unknown';sm[k]=(sm[k]||0)+1;});
    sc.innerHTML=Object.entries(sm).map(([k,v])=>`<div class="mini-bar-row"><span>${escHtml(k)}</span><div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100,v*20)}%"></div></div><strong>${v}</strong></div>`).join('')||`<div class="empty-state">No data</div>`;}
  if(mc){const mm={};DB.orders.forEach(o=>{if(!o.order_date)return;const d=new Date(o.order_date),k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;mm[k]=(mm[k]||0)+(o.total||0);});
    mc.innerHTML=Object.entries(mm).sort().map(([k,v])=>`<div class="mini-bar-row"><span>${escHtml(k)}</span><div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100,Math.round(v/500))}%"></div></div><strong>₹${v.toLocaleString('en-IN')}</strong></div>`).join('')||`<div class="empty-state">No data</div>`;}
}

function renderVendorFilter() {
  const s=document.getElementById('filterVendor'); if(!s) return;
  const cur=s.value, vendors=[...new Set(DB.orders.map(o=>o.vendor).filter(Boolean))];
  s.innerHTML=`<option value="">All Vendors</option>`+vendors.map(v=>`<option value="${escHtml(v)}">${escHtml(v)}</option>`).join('');
  s.value=cur;
}

/* ── HELPERS ── */
function setText(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
function setVal(id,val){const el=document.getElementById(id);if(el)el.value=val??'';}
function escHtml(str=''){return String(str).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function formatDate(s){if(!s)return'—';const d=new Date(s);return isNaN(d)?s:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}
function showToast(message,type='info'){
  let t=document.getElementById('globalToast');
  if(!t){t=document.createElement('div');t.id='globalToast';Object.assign(t.style,{position:'fixed',right:'20px',bottom:'20px',zIndex:'9999',padding:'12px 16px',borderRadius:'12px',color:'#fff',fontSize:'14px',fontWeight:'600',boxShadow:'0 10px 30px rgba(0,0,0,0.25)',transition:'all .25s ease',transform:'translateY(20px)',opacity:'0'});document.body.appendChild(t);}
  t.style.background={success:'linear-gradient(135deg,#22c55e,#14b8a6)',warning:'linear-gradient(135deg,#f97316,#ef4444)',info:'linear-gradient(135deg,#7c5cfc,#6366f1)'}[type]||'linear-gradient(135deg,#7c5cfc,#6366f1)';
  t.textContent=message;
  requestAnimationFrame(()=>{t.style.transform='translateY(0)';t.style.opacity='1';});
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>{t.style.transform='translateY(20px)';t.style.opacity='0';},2500);
}
