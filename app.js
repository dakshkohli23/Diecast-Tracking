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
      const isOpen = sidebar.classList.contains('mobile-open');
      sidebar.classList.toggle('mobile-open', !isOpen);
      sidebarOverlay?.classList.toggle('show', !isOpen);
      // Prevent body scroll when sidebar open on mobile
      document.body.style.overflow = isOpen ? '' : 'hidden';
    } else {
      sidebar.classList.toggle('collapsed');
      mainWrap.classList.toggle('expanded');
    }
  });

  function closeMobileSidebar() {
    sidebar.classList.remove('mobile-open');
    sidebarOverlay?.classList.remove('show');
    document.body.style.overflow = '';
  }

  sidebarOverlay?.addEventListener('click', closeMobileSidebar);

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
      if (isMobile()) {
        closeMobileSidebar();
        // Scroll page to top on section change
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
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
  function openModal() {
    orderModal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    orderModal?.classList.add('hidden');
    document.body.style.overflow = '';
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
    const fStatusEl = document.getElementById('fStatus'); if (fStatusEl) fStatusEl.value = 'Ordered';
    // Reset calc displays
    const td = document.getElementById('fTotalDisplay');   if (td) td.textContent = '₹0';
    const pd = document.getElementById('fPendingDisplay'); if (pd) { pd.textContent = '₹0'; pd.classList.remove('fg-calc-overdue'); }
  }

  // ── PAYMENT CALC ──
  ['fPreorderPrice','fActualPrice','fShipping','fPaid','fQty'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcTotals);
  });

  function calcTotals() {
    const price      = parseFloat(document.getElementById('fActualPrice')?.value)    || 0;
    const qty        = parseInt(document.getElementById('fQty')?.value)              || 1;
    const ship       = parseFloat(document.getElementById('fShipping')?.value)       || 0;
    const paidEach   = parseFloat(document.getElementById('fPaid')?.value)           || 0;
    // Total = (buy price per piece × qty) + shipping
    const total      = (price * qty) + ship;
    // Paid total = paid per piece × qty
    const paidTotal  = paidEach * qty;
    // Pending = total - what has been paid
    const pending    = Math.max(0, total - paidTotal);
    const fmt = v => `₹${v.toLocaleString('en-IN')}`;
    const td = document.getElementById('fTotalDisplay');
    if (td) {
      td.textContent = fmt(total);
      td.title = `(₹${price.toLocaleString('en-IN')} × ${qty}) + ₹${ship.toLocaleString('en-IN')} shipping`;
    }
    const pd = document.getElementById('fPendingDisplay');
    if (pd) {
      pd.textContent = fmt(pending);
      pd.classList.toggle('fg-calc-overdue', pending > 0);
      if (paidTotal > 0) pd.title = `Paid ₹${paidEach.toLocaleString('en-IN')} × ${qty} = ₹${paidTotal.toLocaleString('en-IN')}`;
    }
    if (document.getElementById('fTotal'))   document.getElementById('fTotal').value   = total;
    if (document.getElementById('fPending')) document.getElementById('fPending').value = pending;
    // Store actual paid total for Firestore
    if (document.getElementById('fPaidTotal')) document.getElementById('fPaidTotal').value = paidTotal;
  }

  ['addOrderBtn','quickAddBtn','qaAddOrder','sidebarAddOrder','topbarAddBtn'].forEach(id => {
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

    const editId    = document.getElementById('editOrderId')?.value || '';
    const price     = parseFloat(document.getElementById('fActualPrice')?.value)  || 0;
    const qty       = parseInt(document.getElementById('fQty')?.value)            || 1;
    const ship      = parseFloat(document.getElementById('fShipping')?.value)     || 0;
    const paidEach  = parseFloat(document.getElementById('fPaid')?.value)         || 0;
    const paidTotal = paidEach * qty;
    // Total = investment cost: (buy price × qty) + shipping
    const total     = (price * qty) + ship;
    const pending   = Math.max(0, total - paidTotal);
    const existing  = DB.orders.find(o => o.id === editId);

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
        actual_price: price, shipping: ship,
        paid_each: paidEach, paid: paidTotal, pending, total,
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

  // ── ADD ORDER PAGE FORM ──
  const pageForm = document.getElementById('addOrderPageForm');

  // Page form brand dropdown
  const pBrandSelect = document.getElementById('pBrandSelect');
  const pNewBrandRow = document.getElementById('pNewBrandRow');
  const pNewBrandIn  = document.getElementById('pNewBrand');
  const pBrandHidden = document.getElementById('pBrand');
  let   pageCustomBrands = JSON.parse(localStorage.getItem('pretrack_brands') || '[]');

  function rebuildPageBrandDropdown(selectVal) {
    if (!pBrandSelect) return;
    const base = ['Hot Wheels','Mini GT','Pop Race','Tarmac Works','Tomica','Matchbox','Kaido House','Inno64'];
    const all  = [...base, ...pageCustomBrands];
    while (pBrandSelect.options.length > 1) pBrandSelect.remove(1);
    all.forEach(b => {
      const op = document.createElement('option'); op.value = b; op.textContent = b;
      pBrandSelect.insertBefore(op, pBrandSelect.lastElementChild);
    });
    if (selectVal) pBrandSelect.value = selectVal;
  }
  rebuildPageBrandDropdown();

  pBrandSelect?.addEventListener('change', () => {
    if (pBrandSelect.value === '__new__') {
      pNewBrandRow?.classList.remove('hidden'); pNewBrandIn?.focus();
      if (pBrandHidden) pBrandHidden.value = '';
    } else {
      pNewBrandRow?.classList.add('hidden');
      if (pBrandHidden) pBrandHidden.value = pBrandSelect.value;
    }
  });
  document.getElementById('pConfirmNewBrand')?.addEventListener('click', () => {
    const name = pNewBrandIn?.value.trim();
    if (!name) { showToast('Enter a brand name','warning'); return; }
    if (!pageCustomBrands.includes(name)) {
      pageCustomBrands.push(name);
      localStorage.setItem('pretrack_brands', JSON.stringify(pageCustomBrands));
      // also sync the modal dropdown list
      customBrands = pageCustomBrands;
    }
    rebuildPageBrandDropdown(name); rebuildBrandDropdown(name);
    if (pBrandHidden) pBrandHidden.value = name;
    pNewBrandRow?.classList.add('hidden');
    showToast(`Brand "${name}" added!`, 'success');
  });
  document.getElementById('pCancelNewBrand')?.addEventListener('click', () => {
    pNewBrandRow?.classList.add('hidden');
    if (pBrandSelect) pBrandSelect.value = '';
    if (pBrandHidden) pBrandHidden.value = '';
  });

  // Page form status pills
  document.querySelectorAll('#pStatusPillGroup .status-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#pStatusPillGroup .status-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const r = pill.querySelector('input[type="radio"]');
      if (r) { r.checked = true; const ps = document.getElementById('pStatus'); if(ps) ps.value = r.value; }
    });
  });

  // Page form payment calc
  ['pActualPrice','pQty','pShipping','pPaid'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcPageTotals);
  });
  function calcPageTotals() {
    const price    = parseFloat(document.getElementById('pActualPrice')?.value) || 0;
    const qty      = parseInt(document.getElementById('pQty')?.value)           || 1;
    const ship     = parseFloat(document.getElementById('pShipping')?.value)    || 0;
    const paidEach = parseFloat(document.getElementById('pPaid')?.value)        || 0;
    const total    = (price * qty) + ship;
    const pending  = Math.max(0, total - paidEach * qty);
    const fmt = v => `₹${v.toLocaleString('en-IN')}`;
    const td = document.getElementById('pTotalDisplay');   if(td) td.textContent = fmt(total);
    const pd = document.getElementById('pPendingDisplay'); if(pd) { pd.textContent = fmt(pending); pd.classList.toggle('fg-calc-overdue', pending > 0); }
    if(document.getElementById('pTotal'))   document.getElementById('pTotal').value   = total;
    if(document.getElementById('pPending')) document.getElementById('pPending').value = pending;
  }

  // Page form clear
  document.getElementById('addOrderPageClear')?.addEventListener('click', () => {
    pageForm?.reset();
    rebuildPageBrandDropdown();
    if (pBrandHidden) pBrandHidden.value = '';
    pNewBrandRow?.classList.add('hidden');
    document.querySelectorAll('#pStatusPillGroup .status-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('#pStatusPillGroup .status-pill')?.classList.add('active');
    const ps = document.getElementById('pStatus'); if(ps) ps.value = 'Ordered';
    const td = document.getElementById('pTotalDisplay');   if(td) td.textContent = '₹0';
    const pd = document.getElementById('pPendingDisplay'); if(pd) { pd.textContent = '₹0'; pd.classList.remove('fg-calc-overdue'); }
  });

  // Page form submit
  pageForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('addOrderPageSave');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }
    const price    = parseFloat(document.getElementById('pActualPrice')?.value) || 0;
    const qty      = parseInt(document.getElementById('pQty')?.value)           || 1;
    const ship     = parseFloat(document.getElementById('pShipping')?.value)    || 0;
    const paidEach = parseFloat(document.getElementById('pPaid')?.value)        || 0;
    const paidTotal = paidEach * qty;
    const total    = (price * qty) + ship;
    const pending  = Math.max(0, total - paidTotal);
    try {
      const order = {
        product_name:   document.getElementById('pProductName')?.value.trim()  || '',
        brand:          document.getElementById('pBrand')?.value.trim()         || document.getElementById('pBrandSelect')?.value || '',
        order_number:   document.getElementById('pOrderNumber')?.value.trim()  || '',
        scale:          document.getElementById('pScale')?.value               || '1:64',
        variant:        document.getElementById('pVariant')?.value             || '',
        notes:          document.getElementById('pNotes')?.value?.trim()       || '',
        quantity: qty,
        order_date:     document.getElementById('pOrderDate')?.value           || '',
        eta:            document.getElementById('pEta')?.value                 || '',
        status:         document.getElementById('pStatus')?.value              || 'Ordered',
        preorder_price: parseFloat(document.getElementById('pPreorderPrice')?.value) || 0,
        actual_price: price, shipping: ship,
        paid_each: paidEach, paid: paidTotal, pending, total,
        image: '', series: '', condition: 'Mint', vendor: '', location: '',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      };
      await addDoc(collection(db,'orders'), order);
      await addActivity('success', `Added — ${order.product_name}`);
      showToast('Order saved!', 'success');
      await fetchData();
      // Reset form after save
      document.getElementById('addOrderPageClear')?.click();
      navigateTo('orders'); // go to collection to see it
    } catch(err) {
      console.error(err); showToast('Failed to save: ' + err.message, 'warning');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Order'; }
    }
  });

  function exportCSV() {
    if (!DB.orders.length) { showToast('No orders to export', 'warning'); return; }
    const headers = ['ID','Product','Brand','Series','Scale','Condition','Order#','Vendor','Location','Variant','Qty','Buy Price','Market Value','Shipping','Paid','Pending','Total','Status','ETA','Order Date'];
    const rows    = DB.orders.map(o => [o.id,o.product_name,o.brand,o.series,o.scale,o.condition,o.order_number,o.vendor,o.location,o.variant,o.quantity,o.actual_price,o.preorder_price,o.shipping,o.paid,o.pending,o.total,o.status,o.eta,o.order_date]);
    const csv     = [headers,...rows].map(r => r.map(c=>`"${c??''}"`).join(',')).join('\n');
    const a       = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})), download: `pretrack_${Date.now()}.csv` });
    a.click(); showToast('CSV exported!', 'success');
  }

  document.getElementById('clearDataBtn')?.addEventListener('click', async () => {
    // Show password confirmation modal instead of simple confirm
    const pwModal = document.getElementById('clearDataModal');
    if (pwModal) { pwModal.classList.remove('hidden'); document.getElementById('clearDataPw')?.focus(); }
  });

  // Close X button on clear data modal
  document.getElementById('clearDataCancelBtn')?.addEventListener('click', () => {
    document.getElementById('clearDataModal')?.classList.add('hidden');
    if (document.getElementById('clearDataPw')) document.getElementById('clearDataPw').value = '';
    if (document.getElementById('clearDataPwErr')) document.getElementById('clearDataPwErr').textContent = '';
  });

  document.getElementById('clearDataConfirmBtn')?.addEventListener('click', async () => {
    const pw = document.getElementById('clearDataPw')?.value || '';
    const pwErr = document.getElementById('clearDataPwErr');
    if (!pw) { if(pwErr) pwErr.textContent='Enter your password'; return; }
    const user = auth.currentUser;
    if (!user) { if(pwErr) pwErr.textContent='Not logged in'; return; }
    try {
      const { signInWithEmailAndPassword: reauth } = await import("https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js");
      await reauth(auth, user.email, pw);
      // Password correct — proceed with deletion
      document.getElementById('clearDataModal')?.classList.add('hidden');
      if (document.getElementById('clearDataPw')) document.getElementById('clearDataPw').value = '';
      await Promise.all(DB.orders.map(o => o.image ? deleteImageFromSupabase(o.image) : Promise.resolve()));
      await Promise.all(DB.orders.map(o => deleteDoc(doc(db, 'orders', o.id))));
      await addActivity('warning', 'All orders cleared');
      await fetchData(); showToast('All data cleared', 'info');
    } catch(e) {
      if(pwErr) pwErr.textContent = 'Incorrect password. Try again.';
    }
  });

  document.getElementById('clearDataCancelBtnFooter')?.addEventListener('click', () => {
    document.getElementById('clearDataModal')?.classList.add('hidden');
    if (document.getElementById('clearDataPw')) document.getElementById('clearDataPw').value = '';
    if (document.getElementById('clearDataPwErr')) document.getElementById('clearDataPwErr').textContent = '';
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
  renderSettingsInfo();

  const ss = document.getElementById('systemStatus');
  if (ss) { ss.innerHTML = `<span class="status-dot"></span> All systems live`; ss.className = 'system-status live'; }
}

function renderSettingsInfo() {
  const cnt = document.getElementById('settingsModelCount');
  if (cnt) cnt.textContent = `${DB.orders.length} model${DB.orders.length !== 1 ? 's' : ''}`;
  const user = auth.currentUser;
  const emailEl = document.getElementById('settingsUserEmail');
  if (emailEl && user) emailEl.textContent = user.email || '—';
}

/* ══════════════════════════════════════ STATS ══════════════════════════════════════ */
function renderStats() {
  const o = DB.orders, n = o.length;
  const totalQty = o.reduce((s,x) => s + (x.quantity||1), 0);

  // Investment = actual money spent = (buy_price × qty) + shipping for each order
  const investment = o.reduce((s,x) => {
    return s + ((x.actual_price||0) * (x.quantity||1)) + (x.shipping||0);
  }, 0);

  // Avg buy price per unit
  const avgBuy = totalQty > 0 ? Math.round(investment / totalQty) : 0;

  // Pending = amount still owed
  const pendingAmt = o.reduce((s,x) => s + (x.pending||0), 0);

  const pendingPO = o.filter(x => x.status==='Ordered'||x.status==='In Transit').length;
  const delivered = o.filter(x => x.status==='Delivered').length;
  const transit   = o.filter(x => x.status==='In Transit').length;
  const overdue   = o.filter(x => x.eta && new Date(x.eta)<new Date() && x.status!=='Delivered' && x.status!=='Cancelled').length;

  // Top brand by quantity
  const bm = {}; o.forEach(x => { const k=(x.brand||x.vendor||'—').trim(); bm[k]=(bm[k]||0)+(x.quantity||1); });
  const topBrand = Object.entries(bm).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';

  setText('statTotal', n);
  setText('statQty', totalQty);
  setText('statAvgBuy',   avgBuy > 0 ? '₹' + avgBuy.toLocaleString('en-IN') : '₹0');
  setText('statInvestment', '₹' + investment.toLocaleString('en-IN'));
  setText('statPending',    '₹' + pendingAmt.toLocaleString('en-IN'));
  setText('statPendingPO', pendingPO);
  setText('statDelivered', delivered);
  setText('statTransit',   transit);
  setText('statOverdue',   overdue);
  setText('statTopBrand',  topBrand);

  const pct = (x) => n > 0 ? Math.min(100, Math.round((x/n)*100)) : 0;
  const sb  = (id,v) => { const el=document.getElementById(id); if(el) el.style.width=v+'%'; };
  sb('statDeliveredBar',  pct(delivered));
  sb('statTransitBar',    pct(transit));
  sb('statPendingPOBar',  pct(pendingPO));
  sb('statOverdueBar',    pct(overdue));
  sb('statPendingBar',    investment > 0 ? Math.min(100, Math.round((pendingAmt/investment)*100)) : 0);

  const dot = document.getElementById('notifDot');
  if (dot) dot.classList.toggle('show', pendingAmt > 0 || overdue > 0);
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

/* ══════════════════════════════════════ TABLE + MOBILE CARDS ══════════════════════════════════════ */
function renderTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  const mobileList = document.getElementById('mobileOrderList');

  if (!orders?.length) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="empty-row"><i class="fa-solid fa-inbox"></i> No items found</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i> No items found</div>`;
    return;
  }

  // ── DESKTOP TABLE ──
  if (tbody) {
    tbody.innerHTML = orders.map(o => {
      const sc     = (o.status||'').toLowerCase().replace(/\s+/g,'-');
      const thumb  = o.image ? `<img src="${o.image}" alt="${escHtml(o.product_name)}" />` : `<i class="fa-solid fa-car-side"></i>`;
      const payPct = o.total ? Math.min(100,Math.round(((o.paid||0)/o.total)*100)) : 0;
      const pb     = (o.pending||0)<=0?'badge-paid':((o.paid||0)>0?'badge-partial':'badge-pending-b');
      const pl     = (o.pending||0)<=0?'Paid':((o.paid||0)>0?'Partial':'Pending');
      return `<tr>
        <td>
          <div class="order-product-cell">
            <div class="order-thumb">${thumb}</div>
            <div>
              <div class="order-product-name">${escHtml(o.product_name)}</div>
              <div style="font-size:0.7rem;opacity:0.6">${escHtml(o.brand||o.vendor||'—')} · ${escHtml(o.scale||'1:64')}</div>
            </div>
          </div>
        </td>
        <td>${escHtml(o.brand||o.vendor||'—')}</td>
        <td><span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span></td>
        <td>${o.quantity||1}</td>
        <td>₹${(o.actual_price||0).toLocaleString('en-IN')}</td>
        <td><strong>₹${(o.total||0).toLocaleString('en-IN')}</strong></td>
        <td style="color:var(--green)">₹${(o.paid||0).toLocaleString('en-IN')}</td>
        <td>
          <div class="pay-bar-wrap">
            <span class="badge ${pb}">${pl}</span>
            <div class="pay-bar"><div class="pay-fill" style="width:${payPct}%"></div></div>
          </div>
        </td>
        <td style="font-size:0.76rem;color:var(--text-muted)">${o.eta?formatDate(o.eta):'—'}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost btn-icon" onclick="viewOrder('${o.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
            <button class="btn btn-ghost btn-icon" onclick="editOrder('${o.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-danger btn-icon" onclick="deleteOrder('${o.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // ── MOBILE CARDS ──
  if (mobileList) {
    mobileList.innerHTML = orders.map(o => {
      const sc    = (o.status||'').toLowerCase().replace(/\s+/g,'-');
      const thumb = o.image ? `<img src="${o.image}" alt="${escHtml(o.product_name)}" />` : `<i class="fa-solid fa-car-side"></i>`;
      const pb    = (o.pending||0)<=0?'badge-paid':((o.paid||0)>0?'badge-partial':'badge-pending-b');
      const pl    = (o.pending||0)<=0?'Paid':((o.paid||0)>0?'Partial':'Pending');
      return `<div class="mob-order-card glass">
        <div class="mob-card-top">
          <div class="mob-thumb">${thumb}</div>
          <div class="mob-card-info">
            <div class="mob-card-name">${escHtml(o.product_name)}</div>
            <div class="mob-card-brand">${escHtml(o.brand||o.vendor||'—')} · ${escHtml(o.scale||'1:64')}</div>
            <span class="badge badge-${sc}" style="margin-top:0.3rem;display:inline-block">${escHtml(o.status||'Ordered')}</span>
          </div>
        </div>
        <div class="mob-card-stats">
          <div class="mob-stat"><span>Qty</span><strong>${o.quantity||1}</strong></div>
          <div class="mob-stat"><span>Total</span><strong>₹${(o.total||0).toLocaleString('en-IN')}</strong></div>
          <div class="mob-stat"><span>Paid</span><strong style="color:var(--green)">₹${(o.paid||0).toLocaleString('en-IN')}</strong></div>
          <div class="mob-stat"><span>Pending</span><strong style="color:${(o.pending||0)>0?'var(--orange)':'var(--green)'}">₹${(o.pending||0).toLocaleString('en-IN')}</strong></div>
          ${o.eta ? `<div class="mob-stat"><span>ETA</span><strong>${formatDate(o.eta)}</strong></div>` : ''}
        </div>
        <div class="mob-card-actions">
          <button class="btn btn-ghost btn-sm" onclick="viewOrder('${o.id}')"><i class="fa-solid fa-eye"></i> View</button>
          <button class="btn btn-ghost btn-sm" onclick="editOrder('${o.id}')"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteOrder('${o.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
    }).join('');
  }
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
    ['fShipping','shipping']
  ].forEach(([fieldId, key]) => { const el=document.getElementById(fieldId); if(el) el.value = key==='id' ? o.id : (o[key]??''); });
  // fPaid should show paid per piece (paid_each), not total paid
  const paidEachEl = document.getElementById('fPaid');
  if (paidEachEl) paidEachEl.value = o.paid_each ?? (o.paid || 0);

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
  const price2=(parseFloat(o.actual_price)||0), qty2=(parseInt(o.quantity)||1), ship2=(parseFloat(o.shipping)||0);
  const paidEach2 = parseFloat(o.paid_each ?? o.paid) || 0;
  const paidTotal2 = paidEach2 * qty2;
  const total2=(price2*qty2)+ship2, pending2=Math.max(0,total2-paidTotal2);
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
  const c = document.getElementById('paymentsContent'); if (!c) return;
  if (!DB.orders.length) {
    c.innerHTML = `<div class="widget glass full-width"><div class="widget-body"><div class="empty-state">No payment data yet</div></div></div>`;
    return;
  }

  const fmt = v => `₹${v.toLocaleString('en-IN')}`;
  const totalSpent   = DB.orders.reduce((s,o) => s+(o.total||0), 0);
  const totalPaid    = DB.orders.reduce((s,o) => s+(o.paid||0), 0);
  const totalPending = DB.orders.reduce((s,o) => s+(o.pending||0), 0);

  // Desktop table rows
  const rows = DB.orders.map(o => {
    const sc = (o.status||'').toLowerCase().replace(/\s+/g,'-');
    const pb = (o.pending||0)<=0 ? 'badge-paid' : ((o.paid||0)>0 ? 'badge-partial' : 'badge-pending-b');
    const pl = (o.pending||0)<=0 ? 'Paid'       : ((o.paid||0)>0 ? 'Partial'       : 'Pending');
    return `<tr>
      <td>
        <div style="font-weight:600;font-size:0.85rem">${escHtml(o.product_name||'—')}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(o.brand||o.vendor||'—')} · ${escHtml(o.scale||'1:64')}</div>
      </td>
      <td>${fmt(o.total||0)}</td>
      <td style="color:var(--green)">${fmt(o.paid||0)}</td>
      <td style="color:${(o.pending||0)>0?'var(--orange)':'var(--green)'}">${fmt(o.pending||0)}</td>
      <td><span class="badge ${pb}">${pl}</span></td>
      <td><span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span></td>
      <td style="font-size:0.76rem;color:var(--text-muted)">${o.eta?formatDate(o.eta):'—'}</td>
    </tr>`;
  }).join('');

  // Mobile payment cards
  const mobCards = DB.orders.map(o => {
    const sc = (o.status||'').toLowerCase().replace(/\s+/g,'-');
    const pb = (o.pending||0)<=0 ? 'badge-paid' : ((o.paid||0)>0 ? 'badge-partial' : 'badge-pending-b');
    const pl = (o.pending||0)<=0 ? 'Paid'       : ((o.paid||0)>0 ? 'Partial'       : 'Pending');
    return `<div class="pay-mob-card glass">
      <div class="pay-mob-top">
        <div class="pay-mob-name">${escHtml(o.product_name||'—')}</div>
        <span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.65rem">${escHtml(o.brand||o.vendor||'—')} · ${escHtml(o.scale||'1:64')}</div>
      <div class="pay-mob-stats">
        <div class="mob-stat"><span>Total</span><strong>${fmt(o.total||0)}</strong></div>
        <div class="mob-stat"><span>Paid</span><strong style="color:var(--green)">${fmt(o.paid||0)}</strong></div>
        <div class="mob-stat"><span>Pending</span><strong style="color:${(o.pending||0)>0?'var(--orange)':'var(--green)'}">${fmt(o.pending||0)}</strong></div>
        <div class="mob-stat"><span>Status</span><strong><span class="badge ${pb}" style="font-size:0.68rem">${pl}</span></strong></div>
      </div>
      ${o.eta ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.4rem"><i class="fa-solid fa-calendar-days" style="color:var(--primary)"></i> ETA: ${formatDate(o.eta)}</div>` : ''}
    </div>`;
  }).join('');

  c.innerHTML = `
    <div class="pay-summary-row">
      <div class="pay-sum-card glass">
        <div class="pay-sum-label"><i class="fa-solid fa-receipt"></i> Total Amount</div>
        <div class="pay-sum-val">${fmt(totalSpent)}</div>
      </div>
      <div class="pay-sum-card glass">
        <div class="pay-sum-label"><i class="fa-solid fa-circle-check" style="color:var(--green)"></i> Total Paid</div>
        <div class="pay-sum-val" style="color:var(--green)">${fmt(totalPaid)}</div>
      </div>
      <div class="pay-sum-card glass">
        <div class="pay-sum-label"><i class="fa-solid fa-hourglass-half" style="color:var(--orange)"></i> Total Pending</div>
        <div class="pay-sum-val" style="color:${totalPending>0?'var(--orange)':'var(--green)'}">${fmt(totalPending)}</div>
      </div>
    </div>

    <div class="widget glass full-width">
      <div class="widget-header"><h3><i class="fa-solid fa-credit-card"></i> Payment Overview</h3></div>

      <!-- Desktop table -->
      <div class="table-wrap desktop-only" style="overflow-x:auto">
        <table class="orders-table">
          <thead><tr><th>Product</th><th>Total</th><th>Paid</th><th>Pending</th><th>Payment</th><th>Status</th><th>ETA</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="pay-mob-list mobile-only">${mobCards}</div>
    </div>`;
}

function renderAnalytics() {
  const o = DB.orders;

  // ── SUMMARY CARDS ──
  const totalCost   = o.reduce((s,x) => s + ((x.actual_price||0)*(x.quantity||1)) + (x.shipping||0), 0);
  const totalPend   = o.reduce((s,x) => s + (x.pending||0), 0);
  const totalUnits  = o.reduce((s,x) => s + (x.quantity||1), 0);
  const avgBuy      = totalUnits > 0 ? Math.round(totalCost / totalUnits) : 0;
  const fmt = v => `₹${v.toLocaleString('en-IN')}`;

  setText('roiTotalCost',    fmt(totalCost));
  setText('roiTotalPending', fmt(totalPend));
  setText('roiTotalUnits',   totalUnits.toString());
  setText('roiAvgValue',     fmt(avgBuy));

  // ── BRAND SPEND COMPARISON ──
  const bvc = document.getElementById('brandValueChart');
  if (bvc) {
    const bv = {};
    o.forEach(x => {
      const k = (x.brand||x.vendor||'Unknown').trim();
      bv[k] = (bv[k]||0) + ((x.actual_price||0)*(x.quantity||1)) + (x.shipping||0);
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

  // ── STATUS DISTRIBUTION — only 4 statuses ──
  const sdEl = document.getElementById('statusDistList');
  if (sdEl) {
    const sm = {};
    o.forEach(x => { const k=x.status||'Unknown'; sm[k]=(sm[k]||0)+1; });
    const statusConfig = [
      { s:'Ordered',    icon:'fa-cart-shopping',  grad:'linear-gradient(135deg,#6366f1,#7c5cfc)' },
      { s:'In Transit', icon:'fa-truck-moving',   grad:'linear-gradient(135deg,#14b8a6,#06b6d4)' },
      { s:'Delivered',  icon:'fa-box-open',        grad:'linear-gradient(135deg,#22c55e,#14b8a6)' },
      { s:'Cancelled',  icon:'fa-ban',             grad:'linear-gradient(135deg,#ef4444,#f97316)' }
    ];
    const total = o.length || 1;
    sdEl.innerHTML = statusConfig.map(({s,icon,grad}) => {
      const count = sm[s]||0;
      const pct   = Math.round((count/total)*100);
      return `<div class="sd-item">
        <div class="sd-icon" style="background:${grad}"><i class="fa-solid ${icon}"></i></div>
        <div class="sd-info">
          <div class="sd-name">${s}</div>
          <div class="sd-count">${count} item${count!==1?'s':''} · ${pct}%</div>
        </div>
        <span class="sd-badge">${count}</span>
      </div>`;
    }).join('');
  }

  // ── BRAND BREAKDOWN by count ──
  const vc = document.getElementById('vendorChart');
  if (vc) {
    const vm = {};
    o.forEach(x => { const k=x.brand||x.vendor||'Unknown'; vm[k]=(vm[k]||0)+1; });
    vc.innerHTML = Object.entries(vm).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`
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
    o.forEach(x => {
      if (!x.order_date) return;
      const d=new Date(x.order_date), k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      mm[k] = (mm[k]||0) + ((x.actual_price||0)*(x.quantity||1)) + (x.shipping||0);
    });
    mc.innerHTML = Object.entries(mm).sort().map(([k,v])=>`
      <div class="mini-bar-row">
        <span>${escHtml(k)}</span>
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100,Math.round(v/500))}%"></div></div>
        <strong>${fmt(v)}</strong>
      </div>`).join('') || `<div class="empty-state">No spend data yet</div>`;
  }
}

function renderCatalog() {
  const grid = document.getElementById('catalogGrid'); if (!grid) return;
  if (!DB.orders.length) { grid.innerHTML = `<div class="empty-state">No models tracked yet</div>`; return; }
  const fmt = v => `₹${Number(v||0).toLocaleString('en-IN')}`;
  grid.innerHTML = DB.orders.map(o => {
    const sc      = (o.status||'').toLowerCase().replace(/\s+/g,'-');
    const hasImg  = !!o.image;
    const pending = o.pending||0;
    const payIcon = pending <= 0
      ? `<span class="cc-pay-badge cc-paid"><i class="fa-solid fa-circle-check"></i> Paid</span>`
      : `<span class="cc-pay-badge cc-pending"><i class="fa-solid fa-hourglass-half"></i> ₹${pending.toLocaleString('en-IN')} due</span>`;
    const etaStr  = o.eta ? formatDate(o.eta) : null;
    const isOverdue = o.eta && new Date(o.eta) < new Date() && o.status !== 'Delivered' && o.status !== 'Cancelled';

    return `<div class="catalog-card cc-rich" onclick="viewOrder('${o.id}')">

      <!-- Image / placeholder -->
      <div class="cc-img ${hasImg?'cc-has-img':''}">
        ${hasImg
          ? `<img src="${o.image}" alt="${escHtml(o.product_name)}" />`
          : `<div class="cc-img-placeholder"><i class="fa-solid fa-car-side"></i></div>`}
        <span class="badge badge-${sc} cc-status-badge">${escHtml(o.status||'Ordered')}</span>
      </div>

      <!-- Body -->
      <div class="cc-body">
        <div class="cc-brand-row">
          <span class="cc-brand">${escHtml(o.brand||o.vendor||'—')}</span>
          <span class="cc-scale">${escHtml(o.scale||'1:64')}</span>
        </div>
        <div class="cc-name">${escHtml(o.product_name)}</div>
        ${o.variant ? `<div class="cc-variant"><i class="fa-solid fa-cube"></i> ${escHtml(o.variant)}</div>` : ''}

        <!-- Price row -->
        <div class="cc-price-row">
          <div class="cc-price-block">
            <span class="cc-price-label">Buy Price</span>
            <span class="cc-price-val">${fmt(o.actual_price)}</span>
          </div>
          <div class="cc-price-block">
            <span class="cc-price-label">Qty</span>
            <span class="cc-price-val">${o.quantity||1}</span>
          </div>
          <div class="cc-price-block">
            <span class="cc-price-label">Total</span>
            <span class="cc-price-val cc-total">${fmt(o.total)}</span>
          </div>
        </div>

        <!-- Payment status -->
        <div class="cc-footer-row">
          ${payIcon}
          ${etaStr
            ? `<span class="cc-eta ${isOverdue?'cc-eta-overdue':''}">
                <i class="fa-solid fa-${isOverdue?'triangle-exclamation':'calendar-days'}"></i> ${etaStr}
               </span>`
            : ''}
        </div>

        <!-- Actions -->
        <div class="cc-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-icon cc-btn" onclick="editOrder('${o.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-icon cc-btn" onclick="deleteOrder('${o.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
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
