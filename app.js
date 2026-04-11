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
const SUPABASE_URL      = 'https://ifzioqfkgjkqkirmtgly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmemlvcWZrZ2prcWtpcm10Z2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MDk4ODMsImV4cCI6MjA5MTM4NTg4M30.3sRDtBjSVcOPjS817TjR6ZP1druW-WW7rxiV1Zb3NCQ';
const SUPABASE_BUCKET   = 'order-images';
const supabaseClient    = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function uploadImageToSupabase(file) {
  const ext  = file.name.split('.').pop() || 'jpg';
  const path = `orders/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseClient.storage.from(SUPABASE_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  const { data } = supabaseClient.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function deleteImageFromSupabase(imageUrl) {
  if (!imageUrl || !imageUrl.includes(SUPABASE_URL)) return;
  const marker = `/object/public/${SUPABASE_BUCKET}/`;
  const idx    = imageUrl.indexOf(marker);
  if (idx === -1) return;
  const filePath = decodeURIComponent(imageUrl.slice(idx + marker.length).split('?')[0]);
  const { error } = await supabaseClient.storage.from(SUPABASE_BUCKET).remove([filePath]);
  if (error) console.warn('Supabase delete failed:', error.message);
}

// ── STATE ──
let DB = { orders: [], activity: [] };
let _currentImageFile = null;
let _currentImageB64  = '';
let _authReady = false;

/* ══════════════════════════════════════ LOGIN ══════════════════════════════════════ */
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

/* ══════════════════════════════════════ DASHBOARD ══════════════════════════════════════ */
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

  // ── NAV ──
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

  // ── GLOBAL SEARCH → goes to orders ──
  document.getElementById('globalSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (q.length > 0) {
      navigateTo('orders');
      const s = document.getElementById('invSearch');
      if (s) { s.value = q; applyCollectionFilters(); }
    }
  });

  // ── UNIFIED COLLECTION FILTERS ──
  ['invSearch','invFilterBrand','invFilterStatus','invFilterScale','invSort'].forEach(id => {
    document.getElementById(id)?.addEventListener('input',  applyCollectionFilters);
    document.getElementById(id)?.addEventListener('change', applyCollectionFilters);
  });

  document.getElementById('invClearFilters')?.addEventListener('click', () => {
    ['invSearch','invFilterBrand','invFilterStatus','invFilterScale'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const sort = document.getElementById('invSort'); if (sort) sort.value = 'newest';
    applyCollectionFilters();
  });

  // ── BRAND DROPDOWN LOGIC ──
  const brandSelect    = document.getElementById('fBrandSelect');
  const newBrandRow    = document.getElementById('newBrandRow');
  const fNewBrand      = document.getElementById('fNewBrand');
  const confirmNewBrand = document.getElementById('confirmNewBrand');
  const cancelNewBrand  = document.getElementById('cancelNewBrand');
  const fBrandHidden   = document.getElementById('fBrand');

  // Custom brands stored in localStorage
  let customBrands = JSON.parse(localStorage.getItem('pretrack_brands') || '[]');

  function rebuildBrandDropdown(selectVal) {
    if (!brandSelect) return;
    const base = ['Hot Wheels','Mini GT','Pop Race','Tarmac Works','Tomica','Matchbox','Kaido House','Inno64'];
    const all  = [...base, ...customBrands];
    // Remove all options except first (placeholder) and last (+Add New)
    while (brandSelect.options.length > 1) brandSelect.remove(1);
    all.forEach(b => {
      const o = document.createElement('option'); o.value = b; o.textContent = b;
      brandSelect.insertBefore(o, brandSelect.lastElementChild);
    });
    if (selectVal) brandSelect.value = selectVal;
  }
  rebuildBrandDropdown();

  brandSelect?.addEventListener('change', () => {
    if (brandSelect.value === '__new__') {
      newBrandRow?.classList.remove('hidden');
      fNewBrand?.focus();
      fBrandHidden && (fBrandHidden.value = '');
    } else {
      newBrandRow?.classList.add('hidden');
      fBrandHidden && (fBrandHidden.value = brandSelect.value);
    }
  });

  confirmNewBrand?.addEventListener('click', () => {
    const name = fNewBrand?.value.trim();
    if (!name) { showToast('Enter a brand name', 'warning'); return; }
    if (!customBrands.includes(name)) {
      customBrands.push(name);
      localStorage.setItem('pretrack_brands', JSON.stringify(customBrands));
    }
    rebuildBrandDropdown(name);
    fBrandHidden && (fBrandHidden.value = name);
    newBrandRow?.classList.add('hidden');
    showToast(`Brand "${name}" added!`, 'success');
  });

  cancelNewBrand?.addEventListener('click', () => {
    newBrandRow?.classList.add('hidden');
    brandSelect && (brandSelect.value = '');
    fBrandHidden && (fBrandHidden.value = '');
  });

  // ── STATUS PILL LOGIC ──
  document.querySelectorAll('.status-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.status-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const radio = pill.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        const fStatus = document.getElementById('fStatus');
        if (fStatus) fStatus.value = radio.value;
      }
    });
  });
  // Activate first pill by default
  document.querySelector('.status-pill')?.classList.add('active');

  // ── MODAL OPEN/CLOSE ──
  function openModal() { orderModal?.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal() {
    orderModal?.classList.add('hidden'); document.body.style.overflow = '';
    document.getElementById('orderForm')?.reset();
    if (document.getElementById('editOrderId')) document.getElementById('editOrderId').value = '';
    const ip = document.getElementById('imagePreview');
    if (ip) ip.innerHTML = '<i class="fa-solid fa-camera"></i><p>Click to upload photo</p><span>JPG, PNG, WEBP · max 5MB</span>';
    const fi = document.getElementById('fImage'); if (fi) fi.value = '';
    _currentImageFile = null; _currentImageB64 = '';
    // Reset brand
    rebuildBrandDropdown();
    newBrandRow?.classList.add('hidden');
    if (fBrandHidden) fBrandHidden.value = '';
    // Reset status pills
    document.querySelectorAll('.status-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('.status-pill')?.classList.add('active');
    const fStatus = document.getElementById('fStatus'); if (fStatus) fStatus.value = 'Ordered';
    // Reset calc displays
    const td = document.getElementById('fTotalDisplay'); if (td) td.textContent = '₹0';
    const pd = document.getElementById('fPendingDisplay'); if (pd) pd.textContent = '₹0';
  }

  // ── PAYMENT CALC ──
  ['fPreorderPrice','fActualPrice','fShipping','fPaid','fQty'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcTotals);
  });

  function calcTotals() {
    const price = parseFloat(document.getElementById('fActualPrice')?.value) || 0;
    const qty   = parseInt(document.getElementById('fQty')?.value)           || 1;
    const ship  = parseFloat(document.getElementById('fShipping')?.value)    || 0;
    const paid  = parseFloat(document.getElementById('fPaid')?.value)        || 0;
    const total = (price * qty) + ship;
    const pending = Math.max(0, total - paid);
    const fmt = v => `₹${v.toLocaleString('en-IN')}`;
    const td = document.getElementById('fTotalDisplay'); if (td) td.textContent = fmt(total);
    const pd = document.getElementById('fPendingDisplay'); if (pd) {
      pd.textContent = fmt(pending);
      pd.classList.toggle('fg-calc-overdue', pending > 0);
    }
    if (document.getElementById('fTotal'))   document.getElementById('fTotal').value   = total;
    if (document.getElementById('fPending')) document.getElementById('fPending').value = pending;
  }

  ['addOrderBtn','quickAddBtn','qaAddOrder'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      document.getElementById('modalTitle').textContent = 'Add New Model'; openModal();
    });
  });
  document.getElementById('modalClose')?.addEventListener('click',  closeModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeModal);
  orderModal?.addEventListener('click', e => { if (e.target === orderModal) closeModal(); });

  const viewModal = document.getElementById('viewModal');
  document.getElementById('viewModalClose')?.addEventListener('click', () => {
    viewModal?.classList.add('hidden'); document.body.style.overflow = '';
  });
  viewModal?.addEventListener('click', e => {
    if (e.target === viewModal) { viewModal.classList.add('hidden'); document.body.style.overflow = ''; }
  });

  // ── IMAGE UPLOAD ──
  document.getElementById('imageUploadArea')?.addEventListener('click', () => document.getElementById('fImage')?.click());
  document.getElementById('fImage')?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image too large (max 5MB)', 'warning'); return; }
    _currentImageFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      _currentImageB64 = ev.target.result;
      const p = document.getElementById('imagePreview');
      if (p) p.innerHTML = `<img src="${_currentImageB64}" alt="preview" />`;
    };
    reader.readAsDataURL(file);
  });

  // ── SAVE ORDER ──
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
      let imageUrl = existing?.image || '';
      if (_currentImageFile) {
        if (existing?.image) await deleteImageFromSupabase(existing.image);
        imageUrl = await uploadImageToSupabase(_currentImageFile);
      }

      const order = {
        product_name: document.getElementById('fProductName')?.value.trim() || '',
        order_number: document.getElementById('fOrderNumber')?.value.trim() || '',
        brand:        document.getElementById('fBrand')?.value.trim()       || '',
        series:       document.getElementById('fSeries')?.value?.trim()     || '',
        scale:        document.getElementById('fScale')?.value              || '1:64',
        condition:    document.getElementById('fCondition')?.value          || 'Mint',
        vendor:       document.getElementById('fVendor')?.value?.trim()     || '',
        location:     document.getElementById('fLocation')?.value?.trim()   || '',
        variant:      document.getElementById('fVariant')?.value            || '',
        notes:        document.getElementById('fNotes')?.value?.trim()      || '',
        quantity: qty, order_date: document.getElementById('fOrderDate')?.value || '',
        eta:      document.getElementById('fEta')?.value    || '',
        status:   document.getElementById('fStatus')?.value || 'Ordered',
        preorder_price: parseFloat(document.getElementById('fPreorderPrice')?.value) || 0,
        actual_price: price, shipping: ship, paid, pending, total,
        image: imageUrl, updatedAt: serverTimestamp()
      };

      if (editId) {
        await updateDoc(doc(db, 'orders', editId), order);
        await addActivity('info', `Updated — ${order.product_name}`);
        showToast('Order updated!', 'success');
      } else {
        await addDoc(collection(db, 'orders'), { ...order, createdAt: serverTimestamp() });
        await addActivity('success', `Added — ${order.product_name}`);
        showToast('Order added!', 'success');
      }
      await fetchData(); closeModal();
    } catch (err) {
      console.error(err); showToast('Failed to save: ' + err.message, 'warning');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save'; }
    }
  });

  // ── QUICK ACTIONS ──
  document.getElementById('qaExport')?.addEventListener('click', exportCSV);
  document.getElementById('qaAnalytics')?.addEventListener('click', () => navigateTo('analytics'));
  document.getElementById('qaDelayed')?.addEventListener('click', () => {
    navigateTo('orders');
    const delayed = DB.orders.filter(o => o.eta && new Date(o.eta) < new Date() && o.status !== 'Delivered');
    delayed.length === 0
      ? showToast('No delayed orders!', 'info')
      : (renderTable(delayed), showToast(`${delayed.length} delayed shown`, 'warning'));
  });
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportCSV);

  function exportCSV() {
    if (!DB.orders.length) { showToast('No orders to export', 'warning'); return; }
    const headers = ['ID','Product','Brand','Series','Scale','Condition','Order#','Vendor','Location','Variant','Qty','Buy Price','Market Value','Shipping','Paid','Pending','Total','Status','ETA','Order Date'];
    const rows    = DB.orders.map(o => [o.id,o.product_name,o.brand,o.series,o.scale,o.condition,o.order_number,o.vendor,o.location,o.variant,o.quantity,o.actual_price,o.preorder_price,o.shipping,o.paid,o.pending,o.total,o.status,o.eta,o.order_date]);
    const csv     = [headers,...rows].map(r => r.map(c=>`"${c??''}"`).join(',')).join('\n');
    const a       = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})), download: `pretrack_${Date.now()}.csv` });
    a.click(); showToast('CSV exported!', 'success');
  }

  document.getElementById('clearDataBtn')?.addEventListener('click', async () => {
    if (!confirm('Delete ALL orders? This will also remove all uploaded images.')) return;
    try {
      await Promise.all(DB.orders.map(o => o.image ? deleteImageFromSupabase(o.image) : Promise.resolve()));
      await Promise.all(DB.orders.map(o => deleteDoc(doc(db, 'orders', o.id))));
      await addActivity('warning', 'All orders cleared');
      await fetchData(); showToast('All data cleared', 'info');
    } catch (e) { showToast('Failed to clear: ' + e.message, 'warning'); }
  });
}

/* ══════════════════════════════════════ FIRESTORE ══════════════════════════════════════ */
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

/* ══════════════════════════════════════ GREETING ══════════════════════════════════════ */
function initGreeting() {
  const gt = document.getElementById('greetingText');
  const gd = document.getElementById('greetingDate');
  const ss = document.getElementById('systemStatus');

  function update() {
    const h     = new Date().getHours();
    const emoji = h < 12 ? '<i class="fa-solid fa-cloud-sun"></i>' : h < 17 ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    const word  = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    if (gt) gt.innerHTML = `${word}, Mr. Dlaize! ${emoji}`;
    if (gd) gd.textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

  function checkSys() {
    if (!ss) return;
    ss.innerHTML = `<span class="status-dot"></span> Checking systems...`; ss.className = 'system-status';
    setTimeout(() => { ss.innerHTML = `<span class="status-dot"></span> All systems live`; ss.className = 'system-status live'; }, 1200);
  }
  update(); checkSys(); setInterval(update, 60000);
}

/* ══════════════════════════════════════ RENDER ALL ══════════════════════════════════════ */
function renderAll() {
  renderStats();
  applyCollectionFilters(); // renders the unified collection table
  populateBrandFilter();
  renderRecentOrders();
  renderEtaWidget();
  renderActivityFeed();
  renderAlerts();
  renderPayments();
  renderAnalytics();
  renderBrandLeaderboard();
  renderCatalog();

  const ss = document.getElementById('systemStatus');
  if (ss) { ss.innerHTML = `<span class="status-dot"></span> All systems live`; ss.className = 'system-status live'; }
}

/* ══════════════════════════════════════ STATS ══════════════════════════════════════ */
function renderStats() {
  const o = DB.orders, n = o.length;
  const totalQty   = o.reduce((s,x) => s+(x.quantity||1), 0);
  const marketVal  = o.reduce((s,x) => s+((x.preorder_price||0)*(x.quantity||1)), 0);
  const investment = o.reduce((s,x) => s+(x.total||0), 0);
  const pendingAmt = o.reduce((s,x) => s+(x.pending||0), 0);
  const pendingPO  = o.filter(x => x.status==='Ordered'||x.status==='Processing'||x.status==='Preorder').length;
  const delivered  = o.filter(x => x.status==='Delivered'||x.status==='Owned').length;
  const transit    = o.filter(x => x.status==='Shipped'||x.status==='In Transit').length;
  const overdue    = o.filter(x => x.eta && new Date(x.eta)<new Date() && x.status!=='Delivered' && x.status!=='Owned').length;
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

/* ══════════════════════════════════════ UNIFIED COLLECTION FILTERS ══════════════════════════════════════ */
function applyCollectionFilters() {
  const q      = (document.getElementById('invSearch')?.value      || '').toLowerCase();
  const brand  = document.getElementById('invFilterBrand')?.value  || '';
  const status = document.getElementById('invFilterStatus')?.value || '';
  const scale  = document.getElementById('invFilterScale')?.value  || '';
  const sort   = document.getElementById('invSort')?.value         || 'newest';

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
  // newest = default Firestore ordering (createdAt desc)

  renderTable(items);
}

function populateBrandFilter() {
  const bf = document.getElementById('invFilterBrand');
  if (!bf) return;
  const cur    = bf.value;
  const brands = [...new Set(DB.orders.map(o => o.brand || o.vendor).filter(Boolean))].sort();
  bf.innerHTML = `<option value="">All Brands</option>` + brands.map(b => `<option value="${escHtml(b)}">${escHtml(b)}</option>`).join('');
  bf.value = cur;
}

/* ══════════════════════════════════════ TABLE — FULL COLUMNS ══════════════════════════════════════ */
function renderTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;
  if (!orders?.length) {
    tbody.innerHTML = `<tr><td colspan="14" class="empty-row"><i class="fa-solid fa-inbox"></i> No items found</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const sc    = (o.status||'').toLowerCase().replace(/\s+/g,'-');
    const thumb = o.image ? `<img src="${o.image}" alt="${escHtml(o.product_name)}" />` : `<i class="fa-solid fa-car-side"></i>`;
    const cond  = o.condition || '';
    const payPct = o.total ? Math.min(100,Math.round((o.paid/o.total)*100)) : 0;
    const pb    = o.pending<=0?'badge-paid':(o.paid>0?'badge-partial':'badge-pending-b');
    const pl    = o.pending<=0?'Paid':(o.paid>0?'Partial':'Pending');

    return `<tr>
      <td>
        <div class="order-product-cell">
          <div class="order-thumb">${thumb}</div>
          <div>
            <div class="order-product-name">${escHtml(o.product_name)}</div>
            <div class="order-variant" style="font-size:0.7rem;opacity:0.65">${escHtml(cond)}${o.order_number ? ` • ${escHtml(o.order_number)}` : ''}</div>
          </div>
        </div>
      </td>
      <td>${escHtml(o.brand||o.vendor||'—')}</td>
      <td>${escHtml(o.series||'—')}</td>
      <td><code style="font-size:0.72rem">${escHtml(o.scale||'1:64')}</code></td>
      <td><span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span></td>
      <td>${o.quantity||1}</td>
      <td>₹${(o.actual_price||0).toLocaleString('en-IN')}</td>
      <td>₹${(o.preorder_price||0).toLocaleString('en-IN')}</td>
      <td><strong>₹${(o.total||0).toLocaleString('en-IN')}</strong></td>
      <td style="color:var(--green)">₹${(o.paid||0).toLocaleString('en-IN')}</td>
      <td>
        <div class="pay-bar-wrap">
          <span class="badge ${pb}">${pl}</span>
          <div class="pay-bar"><div class="pay-fill" style="width:${payPct}%"></div></div>
        </div>
      </td>
      <td style="font-size:0.76rem;color:var(--text-muted)">${o.eta?formatDate(o.eta):'—'}</td>
      <td style="font-size:0.76rem;color:var(--text-muted)">${escHtml(o.location||'—')}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-icon" onclick="viewOrder('${o.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          <button class="btn btn-ghost btn-icon" onclick="editOrder('${o.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-ghost btn-icon" onclick="duplicateOrder('${o.id}')" title="Duplicate"><i class="fa-solid fa-copy"></i></button>
          <button class="btn btn-danger btn-icon" onclick="deleteOrder('${o.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════ GLOBAL ACTIONS ══════════════════════════════════════ */
window.editOrder = function(id) {
  const o = DB.orders.find(x=>x.id===id); if(!o) return;
  document.getElementById('modalTitle').textContent = 'Edit Model';
  [
    ['editOrderId','id'],['fProductName','product_name'],['fOrderNumber','order_number'],
    ['fSeries','series'],['fScale','scale'],['fCondition','condition'],
    ['fVendor','vendor'],['fLocation','location'],['fVariant','variant'],
    ['fNotes','notes'],
    ['fQty','quantity'],['fOrderDate','order_date'],['fEta','eta'],
    ['fPreorderPrice','preorder_price'],['fActualPrice','actual_price'],
    ['fShipping','shipping'],['fPaid','paid']
  ].forEach(([fieldId, key]) => { const el=document.getElementById(fieldId); if(el) el.value = key==='id' ? o.id : (o[key]??''); });

  // Set brand dropdown
  const brandSel = document.getElementById('fBrandSelect');
  const fBrandH  = document.getElementById('fBrand');
  const customBrandsStored = JSON.parse(localStorage.getItem('pretrack_brands') || '[]');
  if (brandSel) {
    // Rebuild dropdown so custom brands are present
    const base = ['Hot Wheels','Mini GT','Pop Race','Tarmac Works','Tomica','Matchbox','Kaido House','Inno64'];
    const all  = [...base, ...customBrandsStored];
    while (brandSel.options.length > 1) brandSel.remove(1);
    all.forEach(b => {
      const opt = document.createElement('option'); opt.value = b; opt.textContent = b;
      brandSel.insertBefore(opt, brandSel.lastElementChild);
    });
    const brand = o.brand || o.vendor || '';
    brandSel.value = brand;
    if (brandSel.value !== brand && brand) {
      // It's a custom brand not in list yet — add it
      const opt = document.createElement('option'); opt.value = brand; opt.textContent = brand;
      brandSel.insertBefore(opt, brandSel.lastElementChild);
      brandSel.value = brand;
    }
    if (fBrandH) fBrandH.value = brand;
  }

  // Set status pills
  const status = o.status || 'Ordered';
  document.querySelectorAll('.status-pill').forEach(p => {
    p.classList.remove('active');
    const r = p.querySelector('input[type="radio"]');
    if (r && r.value === status) { p.classList.add('active'); r.checked = true; }
  });
  const fSt = document.getElementById('fStatus'); if (fSt) fSt.value = status;

  _currentImageFile = null; _currentImageB64 = '';
  const ip = document.getElementById('imagePreview');
  if(ip) ip.innerHTML = o.image ? `<img src="${o.image}" alt="preview" />` : '<i class="fa-solid fa-camera"></i><p>Click to upload photo</p><span>JPG, PNG, WEBP · max 5MB</span>';
  document.getElementById('orderModal')?.classList.remove('hidden'); document.body.style.overflow='hidden';

  // Recalc totals display
  const price=(parseFloat(o.actual_price)||0), qty2=(parseInt(o.quantity)||1), ship2=(parseFloat(o.shipping)||0), paid2=(parseFloat(o.paid)||0);
  const total2=(price*qty2)+ship2, pending2=Math.max(0,total2-paid2);
  const fmt = v=>`₹${v.toLocaleString('en-IN')}`;
  const td=document.getElementById('fTotalDisplay'); if(td) td.textContent=fmt(total2);
  const pd=document.getElementById('fPendingDisplay'); if(pd){ pd.textContent=fmt(pending2); pd.classList.toggle('fg-calc-overdue',pending2>0); }
  if(document.getElementById('fTotal'))   document.getElementById('fTotal').value   = total2;
  if(document.getElementById('fPending')) document.getElementById('fPending').value = pending2;
};

window.deleteOrder = async function(id) {
  if(!confirm('Delete this order?')) return;
  try {
    const o = DB.orders.find(x=>x.id===id);
    if (o?.image) await deleteImageFromSupabase(o.image);
    await deleteDoc(doc(db,'orders',id));
    await addActivity('warning',`Deleted — ${o?.product_name||id}`);
    showToast('Order deleted','success'); await fetchData();
  } catch(e) { showToast('Failed to delete: ' + e.message,'warning'); }
};

window.duplicateOrder = async function(id) {
  const o = DB.orders.find(x=>x.id===id); if(!o) return;
  try {
    const { id: _id, createdAt, updatedAt, ...copy } = o;
    await addDoc(collection(db,'orders'), { ...copy, product_name: copy.product_name + ' (Copy)', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    await addActivity('info', `Duplicated — ${o.product_name}`);
    showToast('Order duplicated!', 'success'); await fetchData();
  } catch(e) { showToast('Failed to duplicate', 'warning'); }
};

window.viewOrder = function(id) {
  const o=DB.orders.find(x=>x.id===id); if(!o) return;
  const body=document.getElementById('viewModalBody'), modal=document.getElementById('viewModal');
  if(!body||!modal) return;
  const sc=(o.status||'').toLowerCase().replace(/\s+/g,'-');
  body.innerHTML = `
    ${o.image?`<img src="${o.image}" alt="${escHtml(o.product_name)}" class="view-image" />`:''}
    <div class="view-grid">
      <div><strong>Product:</strong> ${escHtml(o.product_name||'—')}</div>
      <div><strong>Brand:</strong> ${escHtml(o.brand||o.vendor||'—')}</div>
      <div><strong>Series:</strong> ${escHtml(o.series||'—')}</div>
      <div><strong>Scale:</strong> ${escHtml(o.scale||'1:64')}</div>
      <div><strong>Condition:</strong> ${escHtml(o.condition||'—')}</div>
      <div><strong>Status:</strong> <span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span></div>
      <div><strong>Order #:</strong> ${escHtml(o.order_number||'—')}</div>
      <div><strong>Seller:</strong> ${escHtml(o.vendor||'—')}</div>
      <div><strong>Location:</strong> ${escHtml(o.location||'—')}</div>
      <div><strong>Qty:</strong> ${o.quantity||1}</div>
      <div><strong>Order Date:</strong> ${formatDate(o.order_date)}</div>
      <div><strong>ETA:</strong> ${formatDate(o.eta)}</div>
      <div><strong>Buy Price:</strong> ₹${(o.actual_price||0).toLocaleString('en-IN')}</div>
      <div><strong>Market Value:</strong> ₹${(o.preorder_price||0).toLocaleString('en-IN')}</div>
      <div><strong>Shipping:</strong> ₹${(o.shipping||0).toLocaleString('en-IN')}</div>
      <div><strong>Paid:</strong> ₹${(o.paid||0).toLocaleString('en-IN')}</div>
      <div><strong>Pending:</strong> ₹${(o.pending||0).toLocaleString('en-IN')}</div>
      <div><strong>Total:</strong> ₹${(o.total||0).toLocaleString('en-IN')}</div>
    </div>`;
  modal.classList.remove('hidden'); document.body.style.overflow='hidden';
};

/* ══════════════════════════════════════ WIDGETS ══════════════════════════════════════ */
function renderRecentOrders() {
  const c=document.getElementById('recentOrdersList'); if(!c) return;
  const items=DB.orders.slice(0,5);
  if(!items.length){c.innerHTML=`<div class="empty-state">No orders yet</div>`;return;}
  c.innerHTML=items.map(o=>`
    <div class="recent-order-item">
      <div class="roi-thumb">${o.image?`<img src="${o.image}" alt="${escHtml(o.product_name)}" />`:`<i class="fa-solid fa-cube"></i>`}</div>
      <div class="roi-info">
        <div class="roi-name">${escHtml(o.product_name)}</div>
        <div class="roi-meta">${escHtml(o.brand||o.vendor||'—')} • ${escHtml(o.scale||'1:64')}</div>
      </div>
      <div class="roi-status"><span class="badge badge-${(o.status||'').toLowerCase().replace(/\s+/g,'-')}">${escHtml(o.status||'Ordered')}</span></div>
    </div>`).join('');
}

function renderEtaWidget() {
  const c=document.getElementById('etaList'); if(!c) return;
  const upcoming=DB.orders.filter(o=>o.eta&&o.status!=='Delivered'&&o.status!=='Owned').sort((a,b)=>new Date(a.eta)-new Date(b.eta)).slice(0,6);
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
        <div class="delivery-meta">${escHtml(o.brand||o.vendor||'—')} • ETA ${escHtml(o.eta)}</div>
        <div class="delivery-chips">
          <span class="delivery-chip eta-chip ${dc}"><i class="fa-solid fa-calendar-days"></i> ${dl}</span>
          <span class="delivery-chip vendor-chip"><i class="fa-solid fa-store"></i> ${escHtml(o.brand||o.vendor||'—')}</span>
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
  DB.orders.forEach(o=>{const k=(o.brand||o.vendor||'Unknown').trim();bm[k]=(bm[k]||0)+(o.quantity||1);});
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
  const delayed=DB.orders.filter(o=>o.eta&&new Date(o.eta)<new Date()&&o.status!=='Delivered'&&o.status!=='Owned');
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
    <td>${escHtml(o.product_name||'—')}</td>
    <td>${escHtml(o.brand||o.vendor||'—')}</td>
    <td>₹${(o.total||0).toLocaleString('en-IN')}</td>
    <td style="color:var(--green)">₹${(o.paid||0).toLocaleString('en-IN')}</td>
    <td style="color:${(o.pending||0)>0?'var(--orange)':'var(--green)'}">₹${(o.pending||0).toLocaleString('en-IN')}</td>
    <td><span class="badge badge-${(o.status||'').toLowerCase().replace(/\s+/g,'-')}">${escHtml(o.status||'Ordered')}</span></td>
  </tr>`).join('');
  c.innerHTML=`<div class="widget glass full-width"><div class="widget-header"><h3><i class="fa-solid fa-credit-card"></i> Payment Overview</h3></div><div class="table-wrap"><table class="orders-table"><thead><tr><th>Product</th><th>Brand</th><th>Total</th><th>Paid</th><th>Pending</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function renderAnalytics() {
  // ── ROI SUMMARY CARDS ──
  const totalCost      = DB.orders.reduce((s,o)=>(s+(o.total||0)),0);
  const portfolioValue = DB.orders.reduce((s,o)=>(s+(o.preorder_price||o.actual_price||0)*(o.quantity||1)),0);
  const roi            = totalCost > 0 ? Math.round(((portfolioValue - totalCost)/totalCost)*100) : 0;
  const avgValue       = DB.orders.length ? Math.round(portfolioValue / DB.orders.length) : 0;

  const fmt = v => `₹${v.toLocaleString('en-IN')}`;
  setText('roiPortfolioValue', fmt(portfolioValue));
  setText('roiTotalCost',      fmt(totalCost));
  setText('roiPercent',        `${roi >= 0 ? '+' : ''}${roi}%`);
  setText('roiAvgValue',       fmt(avgValue));
  const roiEl = document.getElementById('roiPercent');
  if (roiEl) roiEl.style.color = roi >= 0 ? 'var(--green)' : 'var(--red)';

  // ── BRAND VALUE COMPARISON ──
  const bvc = document.getElementById('brandValueChart');
  if (bvc) {
    const bv = {};
    DB.orders.forEach(o => {
      const k = (o.brand||o.vendor||'Unknown').trim();
      bv[k] = (bv[k]||0) + (o.preorder_price||o.actual_price||0)*(o.quantity||1);
    });
    const entries = Object.entries(bv).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const maxVal  = entries[0]?.[1] || 1;
    bvc.innerHTML = entries.length
      ? entries.map(([brand,val]) => `
        <div class="bv-bar-row">
          <div class="bv-bar-label">${escHtml(brand)}</div>
          <div class="bv-bar-track">
            <div class="bv-bar-fill" style="width:${Math.max(8,Math.round((val/maxVal)*100))}%">
              <span>${fmt(val)}</span>
            </div>
          </div>
        </div>`).join('')
      : `<div class="empty-state">No data yet</div>`;
  }

  // ── STATUS DISTRIBUTION (list, Image 1 style) ──
  const sdEl = document.getElementById('statusDistList');
  if (sdEl) {
    const sm = {};
    DB.orders.forEach(o => { const k=o.status||'Unknown'; sm[k]=(sm[k]||0)+1; });
    const statusIcons = {
      'Owned':'fa-box-open','Ordered':'fa-cart-shopping','In Transit':'fa-truck-moving',
      'Preorder':'fa-clock','Sold':'fa-tag','Delivered':'fa-circle-check',
      'Shipped':'fa-plane-departure','Processing':'fa-gear','Wishlist':'fa-heart','Unknown':'fa-circle-question'
    };
    const allStatuses = ['Owned','Ordered','In Transit','Preorder','Sold','Delivered','Shipped','Processing','Wishlist'];
    sdEl.innerHTML = allStatuses.map(s => {
      const count = sm[s]||0;
      const icon  = statusIcons[s]||'fa-circle';
      return `<div class="sd-item">
        <div class="sd-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="sd-info">
          <div class="sd-name">${s}</div>
          <div class="sd-count">${count} item${count!==1?'s':''}</div>
        </div>
        <span class="sd-badge">${count}</span>
      </div>`;
    }).join('');
  }

  // ── STATUS MIX (same data, slightly different display) ──
  const smEl = document.getElementById('statusMixList');
  if (smEl) {
    const sm = {};
    DB.orders.forEach(o => { const k=o.status||'Unknown'; sm[k]=(sm[k]||0)+1; });
    const total = DB.orders.length||1;
    const statusColors = {
      'Owned':'var(--green)','Ordered':'var(--indigo)','In Transit':'var(--teal)',
      'Preorder':'var(--orange)','Sold':'var(--red)','Delivered':'var(--green)',
      'Shipped':'var(--primary)','Processing':'var(--orange)','Wishlist':'var(--pink)'
    };
    smEl.innerHTML = Object.entries(sm).sort((a,b)=>b[1]-a[1]).map(([s,c])=>`
      <div class="sd-item">
        <div class="sd-icon" style="background:${statusColors[s]||'var(--primary)'}20">
          <i class="fa-solid fa-layer-group" style="color:${statusColors[s]||'var(--primary)'}"></i>
        </div>
        <div class="sd-info">
          <div class="sd-name">${escHtml(s)}</div>
          <div class="sd-count">${c} item${c!==1?'s':''} · ${Math.round((c/total)*100)}%</div>
        </div>
        <span class="sd-badge">${c}</span>
      </div>`).join('') || `<div class="empty-state">No data</div>`;
  }

  // ── PROFIT LEADERBOARD ──
  const plbEl = document.getElementById('profitLeaderboard');
  if (plbEl && DB.orders.length) {
    const bm = {};
    DB.orders.forEach(o => {
      const k = (o.brand||o.vendor||'Unknown').trim();
      if (!bm[k]) bm[k] = { cost:0, value:0 };
      bm[k].cost  += o.total||0;
      bm[k].value += (o.preorder_price||o.actual_price||0)*(o.quantity||1);
    });
    const sorted = Object.entries(bm).sort((a,b)=>(b[1].value-b[1].cost)-(a[1].value-a[1].cost)).slice(0,8);
    const ranks = ['gold','silver','bronze'];
    plbEl.innerHTML = sorted.map(([brand,d],i) => {
      const profit = d.value - d.cost;
      const cls = i < 3 ? ranks[i] : 'other';
      const sign = profit >= 0 ? '+' : '';
      return `<div class="plb-item">
        <div class="plb-rank ${cls}">${i+1}</div>
        <div class="plb-info">
          <div class="plb-brand">${escHtml(brand)}</div>
          <div class="plb-profit ${profit>=0?'positive':'negative'}">${sign}${fmt(Math.abs(profit))} profit potential</div>
        </div>
        <span class="plb-value">${fmt(d.value)}</span>
      </div>`;
    }).join('');
  } else if (plbEl) {
    plbEl.innerHTML = `<div class="empty-state">No data yet</div>`;
  }

  // ── BRAND BREAKDOWN ──
  const vc = document.getElementById('vendorChart');
  if (vc) {
    const vm = {};
    DB.orders.forEach(o => { const k=o.brand||o.vendor||'Unknown'; vm[k]=(vm[k]||0)+1; });
    vc.innerHTML = Object.entries(vm).map(([k,v])=>`
      <div class="mini-bar-row">
        <span>${escHtml(k)}</span>
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100,v*20)}%"></div></div>
        <strong>${v}</strong>
      </div>`).join('') || `<div class="empty-state">No data</div>`;
  }

  // ── MONTHLY SPEND ──
  const mc = document.getElementById('monthlyChart');
  if (mc) {
    const mm = {};
    DB.orders.forEach(o => {
      if (!o.order_date) return;
      const d=new Date(o.order_date), k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      mm[k] = (mm[k]||0) + (o.total||0);
    });
    mc.innerHTML = Object.entries(mm).sort().map(([k,v])=>`
      <div class="mini-bar-row">
        <span>${escHtml(k)}</span>
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100,Math.round(v/500))}%"></div></div>
        <strong>₹${v.toLocaleString('en-IN')}</strong>
      </div>`).join('') || `<div class="empty-state">No data</div>`;
  }
}

function renderCatalog() {
  const grid=document.getElementById('catalogGrid'); if(!grid) return;
  if(!DB.orders.length){grid.innerHTML=`<div class="empty-state">No models tracked yet</div>`;return;}
  grid.innerHTML=DB.orders.map(o=>{
    const sc=(o.status||'').toLowerCase().replace(/\s+/g,'-');
    return `<div class="catalog-card">
      <div class="catalog-card-img">${o.image?`<img src="${o.image}" alt="${escHtml(o.product_name)}" />`:`<i class="fa-solid fa-car-side"></i>`}</div>
      <div class="catalog-card-body">
        <div class="catalog-card-name">${escHtml(o.product_name)}</div>
        <div class="catalog-card-vendor">${escHtml(o.brand||o.vendor||'—')} • ${escHtml(o.scale||'1:64')}</div>
        <div class="catalog-card-footer">
          <span class="catalog-card-price">₹${(o.actual_price||0).toLocaleString('en-IN')}</span>
          <span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span>
        </div>
      </div>
    </div>`;}).join('');
}

/* ══════════════════════════════════════ HELPERS ══════════════════════════════════════ */
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
