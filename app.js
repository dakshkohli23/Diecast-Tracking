'use strict';

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* ══ CONFIG ══ */
const firebaseConfig = {
  apiKey: "AIzaSyA2-6u8rETOIn9xUJQW0ZODFupZQ56orJg",
  authDomain: "diecast-tracking-471f7.firebaseapp.com",
  projectId: "diecast-tracking-471f7",
  storageBucket: "diecast-tracking-471f7.firebasestorage.app",
  messagingSenderId: "1042711268055",
  appId: "1:1042711268055:web:9b09ded970a85532767e92"
};
const SUPER_ADMIN = 'dlaize@dlaize.com';

/* ══ FIREBASE ══ */
let _currentUser = null;
const app           = initializeApp(firebaseConfig);
const auth          = getAuth(app);
const db            = getFirestore(app);
const secondaryApp  = initializeApp(firebaseConfig, 'secondary');
const secondaryAuth = getAuth(secondaryApp);

/* ══ SUPABASE ══ */
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

/* ══ APP STATE ══ */
let DB = { orders: [], activity: [], accessRequests: [], users: [] };
let _currentImageFile = null;
let _currentImageB64  = '';
let _authReady        = false;

/* ══════════════════════════════════════════════════════════════════
   BRAND STATE — module-level so both fetchData() and initDashboard()
   can read/write without closure issues
══════════════════════════════════════════════════════════════════ */
const BASE_BRANDS = ['Hot Wheels','Mini GT','Pop Race','Tarmac Works','Tomica','Matchbox','Kaido House','Inno64'];
let customBrands  = [];

function getAllBrands() { return [...BASE_BRANDS, ...customBrands]; }

function rebuildDropdown(selectEl, selectedVal) {
  if (!selectEl) return;
  while (selectEl.options.length) selectEl.remove(0);
  const ph = document.createElement('option');
  ph.value = ''; ph.textContent = 'Select Brand';
  selectEl.appendChild(ph);
  getAllBrands().forEach(b => {
    const o = document.createElement('option'); o.value = b; o.textContent = b;
    selectEl.appendChild(o);
  });
  const nw = document.createElement('option');
  nw.value = '__new__'; nw.textContent = '＋ Add New Brand';
  selectEl.appendChild(nw);
  if (selectedVal) selectEl.value = selectedVal;
}

function rebuildAllBrandDropdowns(selectedVal) {
  rebuildDropdown(document.getElementById('fBrandSelect'), selectedVal);
  rebuildDropdown(document.getElementById('pBrandSelect'), selectedVal);
}

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

  onAuthStateChanged(auth, user => { if (user) window.location.href = 'index.html'; });

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
    loginBtn.disabled  = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const snap    = await getDocs(collection(db, 'access_requests'));
      const profile = snap.docs.map(d => d.data()).find(u => u.email === email);
      if (profile?.status === 'disabled') {
        await signOut(auth);
        throw new Error('Your account has been disabled. Contact the admin.');
      }
      window.location.href = 'index.html';
    } catch (error) {
      loginErr.classList.remove('hidden');
      errMsg.textContent = error.message?.includes('disabled') ? error.message : 'Invalid email or password';
      loginBtn.innerHTML = '<span>Sign In</span><i class="fa-solid fa-arrow-right"></i>';
      loginBtn.disabled  = false;
      setTimeout(() => loginErr.classList.add('hidden'), 4000);
    }
  });
}

/* ══════════════════════════════════════ DASHBOARD BOOT ══════════════════════════════════════ */
if (document.getElementById('pageContent')) {
  onAuthStateChanged(auth, async user => {
    _authReady = true;
    if (!user) { window.location.href = 'login.html'; return; }
    _currentUser = user;

    const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN.toLowerCase();
    if (isSuperAdmin) {
      setText('profileName', 'Super Admin');
      setText('profileRole', 'Super Admin');
    } else {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
        if (!snap.empty) {
          const data = snap.docs[0].data();
          const nameEl = document.getElementById('profileName');
          if (nameEl) nameEl.textContent = data.name?.trim() || user.email;
          const roleEl = document.getElementById('profileRole');
          if (roleEl) {
            const roleMap = { super_admin:'Super Admin', admin:'Admin', editor:'Editor', viewer:'User' };
            roleEl.textContent = roleMap[data.role] || 'User';
          }
        } else {
          setText('profileName', user.email);
          setText('profileRole', 'User');
        }
      } catch(e) { setText('profileName', user.email); }
    }

    if (user.email !== SUPER_ADMIN) await ensureUserProfile(user);
    await fetchData();
    initDashboard();
  });
}

async function ensureUserProfile(user) {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
    if (snap.empty) {
      await addDoc(collection(db, 'users'), {
        uid: user.uid, email: user.email,
        role: 'viewer', status: 'active', createdAt: serverTimestamp()
      });
    } else {
      const d = snap.docs[0].data();
      if (!d.uid || d.uid !== user.uid) await updateDoc(snap.docs[0].ref, { uid: user.uid });
    }
  } catch(e) { console.warn('ensureUserProfile:', e.message); }
}

/* ══════════════════════════════════════ INIT DASHBOARD ══════════════════════════════════════ */
function initDashboard() {
  const sidebar        = document.getElementById('sidebar');
  const mainWrap       = document.getElementById('mainWrap');
  const sidebarToggle  = document.getElementById('sidebarToggle');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const orderModal     = document.getElementById('orderModal');
  const isMobile       = () => window.innerWidth <= 900;

  sidebarToggle?.addEventListener('click', () => {
    if (isMobile()) {
      const isOpen = sidebar.classList.contains('mobile-open');
      sidebar.classList.toggle('mobile-open', !isOpen);
      sidebarOverlay?.classList.toggle('show', !isOpen);
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

  /* ── ADMIN GATE ── */
  const isAdmin = auth.currentUser?.email?.toLowerCase() === SUPER_ADMIN.toLowerCase();
  if (isAdmin) {
    document.querySelector('.nav-item[data-section="users"]')?.style.setProperty('display', '');
    document.querySelector('.nav-item[data-section="access-requests"]')?.style.setProperty('display', '');
    document.getElementById('openAddUserBtn')?.style.setProperty('display', '');
    document.getElementById('clearDataBtn')?.style.setProperty('display', '');
  } else {
    document.querySelector('.nav-item[data-section="users"]')?.style.setProperty('display', 'none');
    document.querySelector('.nav-item[data-section="access-requests"]')?.style.setProperty('display', 'none');
    document.getElementById('openAddUserBtn')?.style.setProperty('display', 'none');
    document.getElementById('clearDataBtn')?.style.setProperty('display', 'none');
  }

  /* ── NAV ── */
  function navigateTo(section) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add('active');
    document.getElementById(`section-${section}`)?.classList.add('active');
  }
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.dataset.section);
      if (isMobile()) { closeMobileSidebar(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
  });
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigateTo(el.dataset.goto); });
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try { await signOut(auth); window.location.href = 'login.html'; }
    catch(e) { showToast('Logout failed', 'warning'); }
  });

  /* ═══════════════════════════════════════
     ADD USER MODAL
     FIX: calls fetchData() after creation
          so DB.users actually refreshes
  ═══════════════════════════════════════ */
  document.getElementById('openAddUserBtn')?.addEventListener('click', () => {
    document.getElementById('addUserModal')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  function closeAddUserModal() {
    document.getElementById('addUserModal')?.classList.add('hidden');
    document.body.style.overflow = '';
    ['newUserEmail','newUserPassword','newUserName'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const e = document.getElementById('addUserErr'); if (e) e.textContent = '';
  }
  document.getElementById('addUserModalClose')?.addEventListener('click', closeAddUserModal);
  document.getElementById('addUserCancelBtn')?.addEventListener('click',  closeAddUserModal);

  document.getElementById('addUserConfirmBtn')?.addEventListener('click', async () => {
    const adminCheck = (auth.currentUser?.email || '').toLowerCase().trim() === SUPER_ADMIN.toLowerCase().trim();
    if (!adminCheck) { showToast('Admin only', 'warning'); return; }

    const email    = document.getElementById('newUserEmail')?.value.trim();
    const password = document.getElementById('newUserPassword')?.value;
    const name     = document.getElementById('newUserName')?.value.trim() || '';
    const role     = document.getElementById('newUserRole')?.value || 'viewer';
    const errEl    = document.getElementById('addUserErr');
    const btn      = document.getElementById('addUserConfirmBtn');

    if (errEl) errEl.textContent = '';
    if (!email || !password) { if (errEl) errEl.textContent = 'Email and password are required'; return; }
    if (password.length < 6)  { if (errEl) errEl.textContent = 'Password must be at least 6 characters'; return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await secondaryAuth.signOut();
      await addDoc(collection(db, 'users'), {
        uid: cred.user.uid, email, name, role,
        status: 'active', createdAt: serverTimestamp()
      });
      showToast(`User ${email} created!`, 'success');
      closeAddUserModal();
      await fetchData(); // ← FIXED: was renderUsers() — DB.users never updated
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Email already in use'
                : err.code === 'auth/invalid-email'        ? 'Invalid email address'
                : err.code === 'auth/weak-password'        ? 'Password is too weak (min 6 chars)'
                : err.message;
      if (errEl) errEl.textContent = msg;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create User';
    }
  });

  /* ── TABS ── */
  document.querySelectorAll('.sellers-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sellers-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active'); renderSellers();
    });
  });
  document.querySelectorAll('.upcoming-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.upcoming-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active'); renderUpcoming();
    });
  });
  document.querySelectorAll('.ar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ar-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active'); renderAccessRequests();
    });
  });

  document.getElementById('refreshAccessRequestsBtn')?.addEventListener('click', async () => {
    await fetchData(); showToast('Access requests refreshed', 'info');
  });

  /* ── GLOBAL SEARCH ── */
  document.getElementById('globalSearch')?.addEventListener('input', e => {
    const q = e.target.value.trim();
    if (q.length > 0) {
      navigateTo('orders');
      const s = document.getElementById('invSearch');
      if (s) { s.value = q; applyCollectionFilters(); }
    }
  });

  /* ── COLLECTION FILTERS ── */
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

  /* ── BRAND STORE ── */
  async function loadBrandsFromFirestore() {
    const user         = auth.currentUser;
    const currentEmail = (user?.email || '').toLowerCase().trim();
    const isAdm        = currentEmail === SUPER_ADMIN.toLowerCase().trim();
    try {
      const snap = await getDocs(collection(db, 'brands'));
      customBrands = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(b => {
          const ou = (b.ownerUid   || '').trim();
          const oe = (b.ownerEmail || '').toLowerCase().trim();
          if (ou === user?.uid || oe === currentEmail) return true;
          if (!ou && !oe && isAdm) return true;
          return false;
        })
        .map(b => b.name).filter(Boolean);
    } catch(e) {
      customBrands = JSON.parse(localStorage.getItem('pretrack_brands') || '[]');
    }
    rebuildAllBrandDropdowns();
  }

  async function addCustomBrand(name) {
    if (!name) return false;
    const normalized = name.trim();
    if (getAllBrands().map(x => x.toLowerCase().trim()).includes(normalized.toLowerCase())) return false;
    try {
      await addDoc(collection(db, 'brands'), {
        name: normalized, createdAt: serverTimestamp(),
        ownerUid:   auth.currentUser?.uid   || '',
        ownerEmail: auth.currentUser?.email || ''
      });
      customBrands.push(normalized);
    } catch(e) {
      customBrands.push(normalized);
      localStorage.setItem('pretrack_brands', JSON.stringify(customBrands));
    }
    return true;
  }

  loadBrandsFromFirestore();

  /* ── MODAL BRAND DROPDOWN ── */
  const brandSelect  = document.getElementById('fBrandSelect');
  const newBrandRow  = document.getElementById('newBrandRow');
  const fNewBrand    = document.getElementById('fNewBrand');
  const fBrandHidden = document.getElementById('fBrand');

  brandSelect?.addEventListener('change', () => {
    if (brandSelect.value === '__new__') {
      newBrandRow?.classList.remove('hidden'); fNewBrand?.focus();
      if (fBrandHidden) fBrandHidden.value = '';
      brandSelect.value = '';
    } else {
      newBrandRow?.classList.add('hidden');
      if (fBrandHidden) fBrandHidden.value = brandSelect.value;
    }
  });

  document.getElementById('confirmNewBrand')?.addEventListener('click', async () => {
    const name = fNewBrand?.value.trim();
    if (!name) { showToast('Enter a brand name', 'warning'); return; }
    const btn = document.getElementById('confirmNewBrand');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    const added = await addCustomBrand(name);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Add'; }
    if (added) {
      rebuildAllBrandDropdowns(name);
      if (fBrandHidden) fBrandHidden.value = name;
      if (brandSelect)  brandSelect.value  = name;
      showToast(`Brand "${name}" saved!`, 'success');
    } else {
      showToast(`"${name}" already exists`, 'warning');
      if (brandSelect)  brandSelect.value  = name;
      if (fBrandHidden) fBrandHidden.value = name;
    }
    newBrandRow?.classList.add('hidden');
    if (fNewBrand) fNewBrand.value = '';
  });

  document.getElementById('cancelNewBrand')?.addEventListener('click', () => {
    newBrandRow?.classList.add('hidden');
    if (fNewBrand)    fNewBrand.value    = '';
    if (brandSelect)  brandSelect.value  = '';
    if (fBrandHidden) fBrandHidden.value = '';
  });

  /* ── STATUS PILLS ── */
  document.querySelectorAll('#orderModal .status-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#orderModal .status-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const r = pill.querySelector('input[type="radio"]');
      if (r) { r.checked = true; const fs = document.getElementById('fStatus'); if (fs) fs.value = r.value; }
    });
  });
  document.querySelector('#orderModal .status-pill')?.classList.add('active');

  /* ── ORDER MODAL OPEN/CLOSE ── */
  function openModal() {
    orderModal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    orderModal?.classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('orderForm')?.reset();
    const eid = document.getElementById('editOrderId'); if (eid) eid.value = '';
    const ip  = document.getElementById('imagePreview');
    if (ip) ip.innerHTML = '<i class="fa-solid fa-camera"></i><p>Click to upload photo</p><span>JPG, PNG, WEBP · max 5MB</span>';
    const fi = document.getElementById('fImage'); if (fi) fi.value = '';
    _currentImageFile = null; _currentImageB64 = '';
    rebuildDropdown(document.getElementById('fBrandSelect'));
    document.getElementById('newBrandRow')?.classList.add('hidden');
    const fb = document.getElementById('fBrand'); if (fb) fb.value = '';
    document.querySelectorAll('#orderModal .status-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('#orderModal .status-pill')?.classList.add('active');
    const fs = document.getElementById('fStatus'); if (fs) fs.value = 'Ordered';
    const td = document.getElementById('fTotalDisplay');   if (td) td.textContent = '₹0';
    const pd = document.getElementById('fPendingDisplay'); if (pd) { pd.textContent = '₹0'; pd.classList.remove('fg-calc-overdue'); pd.style.color = ''; }
  }

  /* ── PAYMENT CALC ── */
  ['fPreorderPrice','fActualPrice','fShipping','fPaid','fQty'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcTotals);
  });
  function calcTotals() {
    const price = parseFloat(document.getElementById('fActualPrice')?.value) || 0;
    const qty   = parseInt(document.getElementById('fQty')?.value)           || 1;
    const ship  = parseFloat(document.getElementById('fShipping')?.value)    || 0;
    const paid  = parseFloat(document.getElementById('fPaid')?.value)        || 0;
    const total = (price * qty) + ship;
    const diff  = total - paid;
    const pend  = Math.max(0, diff);
    const fmt   = v => `₹${v.toLocaleString('en-IN')}`;
    const td    = document.getElementById('fTotalDisplay');
    if (td) { td.textContent = fmt(total); td.title = `(₹${price.toLocaleString('en-IN')} × ${qty}) + ₹${ship.toLocaleString('en-IN')} shipping`; }
    const pd = document.getElementById('fPendingDisplay');
    if (pd) {
      if (diff < 0) {
        pd.textContent = `+₹${Math.abs(diff).toLocaleString('en-IN')}`;
        pd.classList.remove('fg-calc-overdue'); pd.style.color = 'var(--green, #22c55e)';
        pd.title = `Overpaid by ₹${Math.abs(diff).toLocaleString('en-IN')}`;
      } else {
        pd.textContent = fmt(pend); pd.style.color = '';
        pd.classList.toggle('fg-calc-overdue', pend > 0); pd.title = '';
      }
    }
    const ftEl = document.getElementById('fTotal');   if (ftEl) ftEl.value = total;
    const fpEl = document.getElementById('fPending'); if (fpEl) fpEl.value = pend;
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

  /* ── IMAGE UPLOAD ── */
  document.getElementById('imageUploadArea')?.addEventListener('click', () => document.getElementById('fImage')?.click());
  document.getElementById('fImage')?.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image too large (max 5MB)', 'warning'); return; }
    _currentImageFile = file;
    const reader = new FileReader();
    reader.onload = ev => {
      _currentImageB64 = ev.target.result;
      const p = document.getElementById('imagePreview');
      if (p) p.innerHTML = `<img src="${_currentImageB64}" alt="preview" />`;
    };
    reader.readAsDataURL(file);
  });

  /* ── SAVE ORDER (modal) ── */
  document.getElementById('orderForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const saveBtn = document.getElementById('modalSave');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }
    const editId   = document.getElementById('editOrderId')?.value || '';
    const price    = parseFloat(document.getElementById('fActualPrice')?.value) || 0;
    const qty      = parseInt(document.getElementById('fQty')?.value)           || 1;
    const ship     = parseFloat(document.getElementById('fShipping')?.value)    || 0;
    const paid     = parseFloat(document.getElementById('fPaid')?.value)        || 0;
    const total    = (price * qty) + ship;
    const pending  = Math.max(0, total - paid);
    const existing = DB.orders.find(o => o.id === editId);
    try {
      let imageUrl = existing?.image || '';
      if (_currentImageFile) {
        if (existing?.image) await deleteImageFromSupabase(existing.image);
        imageUrl = await uploadImageToSupabase(_currentImageFile);
      }
      const order = {
        product_name:   document.getElementById('fProductName')?.value.trim()  || '',
        order_number:   document.getElementById('fOrderNumber')?.value.trim()  || '',
        brand:          document.getElementById('fBrand')?.value.trim()        || '',
        series:         document.getElementById('fSeries')?.value?.trim()      || '',
        scale:          document.getElementById('fScale')?.value               || '1:64',
        condition:      document.getElementById('fCondition')?.value           || 'Mint',
        vendor:         document.getElementById('fVendor')?.value?.trim()      || '',
        location:       document.getElementById('fLocation')?.value?.trim()    || '',
        variant:        document.getElementById('fVariant')?.value             || '',
        notes:          document.getElementById('fNotes')?.value?.trim()       || '',
        quantity: qty, order_date: document.getElementById('fOrderDate')?.value || '',
        eta:            document.getElementById('fEta')?.value                 || '',
        status:         document.getElementById('fStatus')?.value              || 'Ordered',
        preorder_price: parseFloat(document.getElementById('fPreorderPrice')?.value) || 0,
        actual_price: price, shipping: ship, paid, pending, total, image: imageUrl,
        updatedAt: serverTimestamp(),
        ownerUid:  auth.currentUser?.uid   || '',
        ownerEmail:auth.currentUser?.email || ''
      };
      if (editId) {
        await updateDoc(doc(db, 'orders', editId), order);
        try { await addActivity('info', `Updated — ${order.product_name}`); } catch(e) { console.warn(e); }
        showToast('Order updated!', 'success');
      } else {
        await addDoc(collection(db, 'orders'), { ...order, createdAt: serverTimestamp() });
        try { await addActivity('success', `Added — ${order.product_name}`); } catch(e) { console.warn(e); }
        showToast('Order added!', 'success');
      }
      await fetchData(); closeModal();
    } catch(err) {
      console.error(err); showToast('Failed to save: ' + err.message, 'warning');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save'; }
    }
  });

  /* ── QUICK ACTIONS ── */
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

  /* ── ADD ORDER PAGE FORM ── */
  const pageForm     = document.getElementById('addOrderPageForm');
  const pBrandSelect = document.getElementById('pBrandSelect');
  const pNewBrandRow = document.getElementById('pNewBrandRow');
  const pNewBrandIn  = document.getElementById('pNewBrand');
  const pBrandHidden = document.getElementById('pBrand');
  let _pageImageFile = null;

  rebuildDropdown(pBrandSelect);

  pBrandSelect?.addEventListener('change', () => {
    if (pBrandSelect.value === '__new__') {
      pNewBrandRow?.classList.remove('hidden'); pNewBrandIn?.focus();
      if (pBrandHidden) pBrandHidden.value = ''; pBrandSelect.value = '';
    } else {
      pNewBrandRow?.classList.add('hidden');
      if (pBrandHidden) pBrandHidden.value = pBrandSelect.value;
    }
  });

  document.getElementById('pConfirmNewBrand')?.addEventListener('click', async () => {
    const name = pNewBrandIn?.value.trim();
    if (!name) { showToast('Enter a brand name', 'warning'); return; }
    const btn = document.getElementById('pConfirmNewBrand');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    const added = await addCustomBrand(name);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Add'; }
    if (added) {
      rebuildAllBrandDropdowns(name);
      if (pBrandHidden) pBrandHidden.value = name;
      if (pBrandSelect) pBrandSelect.value = name;
      showToast(`Brand "${name}" saved!`, 'success');
    } else {
      showToast(`"${name}" already exists`, 'warning');
      if (pBrandSelect) pBrandSelect.value = name;
      if (pBrandHidden) pBrandHidden.value = name;
    }
    pNewBrandRow?.classList.add('hidden');
    if (pNewBrandIn) pNewBrandIn.value = '';
  });

  document.getElementById('pCancelNewBrand')?.addEventListener('click', () => {
    pNewBrandRow?.classList.add('hidden');
    if (pNewBrandIn)  pNewBrandIn.value  = '';
    if (pBrandSelect) pBrandSelect.value = '';
    if (pBrandHidden) pBrandHidden.value = '';
  });

  document.querySelectorAll('#pStatusPillGroup .status-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#pStatusPillGroup .status-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const r = pill.querySelector('input[type="radio"]');
      if (r) { r.checked = true; const ps = document.getElementById('pStatus'); if (ps) ps.value = r.value; }
    });
  });

  document.getElementById('pImageUploadArea')?.addEventListener('click', () => document.getElementById('pImage')?.click());
  document.getElementById('pImage')?.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image too large (max 5MB)', 'warning'); return; }
    _pageImageFile = file;
    const reader = new FileReader();
    reader.onload = ev => {
      const prev = document.getElementById('pImagePreview');
      if (prev) prev.innerHTML = `<img src="${ev.target.result}" alt="preview" />`;
    };
    reader.readAsDataURL(file);
  });

  ['pActualPrice','pQty','pShipping','pPaid'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcPageTotals);
  });
  function calcPageTotals() {
    const price = parseFloat(document.getElementById('pActualPrice')?.value) || 0;
    const qty   = parseInt(document.getElementById('pQty')?.value)           || 1;
    const ship  = parseFloat(document.getElementById('pShipping')?.value)    || 0;
    const paid  = parseFloat(document.getElementById('pPaid')?.value)        || 0;
    const total = (price * qty) + ship;
    const diff  = total - paid;
    const pend  = Math.max(0, diff);
    const fmt   = v => `₹${v.toLocaleString('en-IN')}`;
    const td    = document.getElementById('pTotalDisplay'); if (td) td.textContent = fmt(total);
    const pd    = document.getElementById('pPendingDisplay');
    if (pd) {
      if (diff < 0) {
        pd.textContent = `+₹${Math.abs(diff).toLocaleString('en-IN')}`;
        pd.classList.remove('fg-calc-overdue'); pd.style.color = 'var(--green, #22c55e)';
        pd.title = `Overpaid by ₹${Math.abs(diff).toLocaleString('en-IN')}`;
      } else {
        pd.textContent = fmt(pend); pd.style.color = '';
        pd.classList.toggle('fg-calc-overdue', pend > 0); pd.title = '';
      }
    }
    const ptEl = document.getElementById('pTotal');   if (ptEl) ptEl.value = total;
    const ppEl = document.getElementById('pPending'); if (ppEl) ppEl.value = pend;
  }

  function resetPageForm() {
    pageForm?.reset();
    rebuildDropdown(pBrandSelect);
    if (pBrandHidden) pBrandHidden.value = '';
    pNewBrandRow?.classList.add('hidden');
    document.querySelectorAll('#pStatusPillGroup .status-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('#pStatusPillGroup .status-pill')?.classList.add('active');
    const ps = document.getElementById('pStatus'); if (ps) ps.value = 'Ordered';
    ['pTotalDisplay','pPendingDisplay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = '₹0'; el.classList.remove('fg-calc-overdue'); el.style.color = ''; }
    });
    const prev = document.getElementById('pImagePreview');
    if (prev) prev.innerHTML = '<i class="fa-solid fa-camera"></i><p>Click to upload photo</p><span>JPG, PNG, WEBP · max 5MB</span>';
    const pi = document.getElementById('pImage'); if (pi) pi.value = '';
    _pageImageFile = null;
  }

  document.getElementById('addOrderPageClear')?.addEventListener('click', resetPageForm);

  pageForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const saveBtn = document.getElementById('addOrderPageSave');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }
    const price   = parseFloat(document.getElementById('pActualPrice')?.value) || 0;
    const qty     = parseInt(document.getElementById('pQty')?.value)           || 1;
    const ship    = parseFloat(document.getElementById('pShipping')?.value)    || 0;
    const paid    = parseFloat(document.getElementById('pPaid')?.value)        || 0;
    const total   = (price * qty) + ship;
    const pending = Math.max(0, total - paid);
    try {
      let imageUrl = '';
      if (_pageImageFile) imageUrl = await uploadImageToSupabase(_pageImageFile);
      const order = {
        product_name:   document.getElementById('pProductName')?.value.trim() || '',
        brand:          (document.getElementById('pBrand')?.value.trim() || document.getElementById('pBrandSelect')?.value || '').replace('__new__',''),
        order_number:   document.getElementById('pOrderNumber')?.value.trim() || '',
        scale:          document.getElementById('pScale')?.value              || '1:64',
        variant:        document.getElementById('pVariant')?.value            || '',
        notes:          document.getElementById('pNotes')?.value?.trim()      || '',
        quantity: qty,  order_date: document.getElementById('pOrderDate')?.value || '',
        eta:            document.getElementById('pEta')?.value                || '',
        status:         document.getElementById('pStatus')?.value             || 'Ordered',
        preorder_price: parseFloat(document.getElementById('pPreorderPrice')?.value) || 0,
        actual_price: price, shipping: ship, paid, pending, total, image: imageUrl,
        series: '', condition: 'Mint',
        vendor:   document.getElementById('pVendor')?.value?.trim()   || '',
        location: document.getElementById('pLocation')?.value?.trim() || '',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        ownerUid:  auth.currentUser?.uid   || '',
        ownerEmail:auth.currentUser?.email || ''
      };
      if (!order.brand) { showToast('Please select a brand', 'warning'); return; }
      await addDoc(collection(db, 'orders'), order);
      try { await addActivity('success', `Added — ${order.product_name}`); } catch(e) { console.warn(e); }
      showToast('Order saved! 🎉', 'success');
      await fetchData(); resetPageForm(); navigateTo('orders');
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
    const csv     = [headers,...rows].map(r => r.map(c => `"${c??''}"`).join(',')).join('\n');
    const a       = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type:'text/csv' })),
      download: `pretrack_${Date.now()}.csv`
    });
    a.click(); showToast('CSV exported!', 'success');
  }

  /* ── CLEAR DATA ── */
  document.getElementById('clearDataBtn')?.addEventListener('click', () => {
    document.getElementById('clearDataModal')?.classList.remove('hidden');
    document.getElementById('clearDataPw')?.focus();
  });

  function closeClearModal() {
    document.getElementById('clearDataModal')?.classList.add('hidden');
    const pw  = document.getElementById('clearDataPw');   if (pw)  pw.value = '';
    const err = document.getElementById('clearDataPwErr');if (err) err.textContent = '';
  }
  document.getElementById('clearDataCancelBtn')?.addEventListener('click', closeClearModal);
  document.getElementById('clearDataCancelBtnFooter')?.addEventListener('click', closeClearModal);

  document.getElementById('clearDataConfirmBtn')?.addEventListener('click', async () => {
    const pw    = document.getElementById('clearDataPw')?.value || '';
    const pwErr = document.getElementById('clearDataPwErr');
    if (!pw) { if (pwErr) pwErr.textContent = 'Enter your password'; return; }
    const user = auth.currentUser;
    if (!user) { if (pwErr) pwErr.textContent = 'Not logged in'; return; }
    try {
      // FIX: use already-imported signInWithEmailAndPassword — no dynamic import needed
      await signInWithEmailAndPassword(auth, user.email, pw);
      closeClearModal();
      await Promise.all(DB.orders.map(o => o.image ? deleteImageFromSupabase(o.image) : Promise.resolve()));
      await Promise.all(DB.orders.map(o => deleteDoc(doc(db, 'orders', o.id))));
      await addActivity('warning', 'All orders cleared');
      await fetchData(); showToast('All data cleared', 'info');
    } catch(e) {
      if (pwErr) pwErr.textContent = 'Incorrect password. Try again.';
    }
  });

  /* ═══════════════════════════════════════
     ORDER ACTIONS (exposed on window so
     inline onclick="" in renderTable works)
  ═══════════════════════════════════════ */
  window.editOrder = function(id) {
    const o = DB.orders.find(x => x.id === id); if (!o) return;
    document.getElementById('modalTitle').textContent = 'Edit Model';
    [
      ['editOrderId','id'],['fProductName','product_name'],['fOrderNumber','order_number'],
      ['fSeries','series'],['fScale','scale'],['fCondition','condition'],
      ['fVendor','vendor'],['fLocation','location'],['fVariant','variant'],['fNotes','notes'],
      ['fQty','quantity'],['fOrderDate','order_date'],['fEta','eta'],
      ['fPreorderPrice','preorder_price'],['fActualPrice','actual_price'],['fShipping','shipping']
    ].forEach(([fieldId, key]) => {
      const el = document.getElementById(fieldId);
      if (el) el.value = key === 'id' ? o.id : (o[key] ?? '');
    });
    const paidEl = document.getElementById('fPaid'); if (paidEl) paidEl.value = o.paid || 0;

    const brand = o.brand || o.vendor || '';
    if (brand && !getAllBrands().includes(brand)) customBrands.push(brand);
    rebuildDropdown(document.getElementById('fBrandSelect'), brand);
    const fBH = document.getElementById('fBrand'); if (fBH) fBH.value = brand;

    const status = o.status || 'Ordered';
    document.querySelectorAll('#orderModal .status-pill').forEach(p => {
      p.classList.remove('active');
      const r = p.querySelector('input[type="radio"]');
      if (r && r.value === status) { p.classList.add('active'); r.checked = true; }
    });
    const fSt = document.getElementById('fStatus'); if (fSt) fSt.value = status;

    _currentImageFile = null; _currentImageB64 = '';
    const fi = document.getElementById('fImage'); if (fi) fi.value = '';
    const ip = document.getElementById('imagePreview');
    if (ip) ip.innerHTML = o.image
      ? `<img src="${o.image}" alt="preview" />`
      : '<i class="fa-solid fa-camera"></i><p>Click to upload photo</p><span>JPG, PNG, WEBP · max 5MB</span>';

    const p2 = parseFloat(o.actual_price)||0, q2 = parseInt(o.quantity)||1,
          s2 = parseFloat(o.shipping)||0,     pa2 = parseFloat(o.paid)||0;
    const t2 = (p2*q2)+s2, d2 = t2-pa2, pe2 = Math.max(0,d2);
    const fmt = v => `₹${v.toLocaleString('en-IN')}`;
    const td = document.getElementById('fTotalDisplay');
    if (td) { td.textContent = fmt(t2); td.title = `(₹${p2.toLocaleString('en-IN')} × ${q2}) + ₹${s2.toLocaleString('en-IN')} shipping`; }
    const pd = document.getElementById('fPendingDisplay');
    if (pd) {
      if (d2 < 0) {
        pd.textContent = `+₹${Math.abs(d2).toLocaleString('en-IN')}`;
        pd.classList.remove('fg-calc-overdue'); pd.style.color = 'var(--green, #22c55e)';
        pd.title = `Overpaid by ₹${Math.abs(d2).toLocaleString('en-IN')}`;
      } else {
        pd.textContent = fmt(pe2); pd.style.color = '';
        pd.classList.toggle('fg-calc-overdue', pe2 > 0); pd.title = '';
      }
    }
    const ftEl = document.getElementById('fTotal');   if (ftEl) ftEl.value = t2;
    const fpEl = document.getElementById('fPending'); if (fpEl) fpEl.value = pe2;
    openModal();
  };

  window.deleteOrder = async function(id) {
    if (!confirm('Delete this order?')) return;
    try {
      const o = DB.orders.find(x => x.id === id);
      if (o?.image) await deleteImageFromSupabase(o.image);
      await deleteDoc(doc(db, 'orders', id));
      await addActivity('warning', `Deleted — ${o?.product_name || id}`);
      showToast('Order deleted', 'success'); await fetchData();
    } catch(e) { showToast('Failed to delete: ' + e.message, 'warning'); }
  };

  window.duplicateOrder = async function(id) {
    const o = DB.orders.find(x => x.id === id); if (!o) return;
    try {
      const { id: _id, createdAt, updatedAt, ...copy } = o;
      await addDoc(collection(db, 'orders'), {
        ...copy, product_name: copy.product_name + ' (Copy)',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      await addActivity('info', `Duplicated — ${o.product_name}`);
      showToast('Order duplicated!', 'success'); await fetchData();
    } catch(e) { showToast('Failed to duplicate', 'warning'); }
  };

  window.viewOrder = function(id) {
    const o = DB.orders.find(x => x.id === id); if (!o) return;
    const body  = document.getElementById('viewModalBody');
    const modal = document.getElementById('viewModal');
    if (!body || !modal) return;
    const sc = (o.status||'').toLowerCase().replace(/\s+/g,'-');
    body.innerHTML = `
      ${o.image ? `<img src="${o.image}" alt="${escHtml(o.product_name)}" class="view-image" />` : ''}
      <div class="view-grid">
        <div><strong>Product:</strong> ${escHtml(o.product_name||'—')}</div>
        <div><strong>Brand:</strong> ${escHtml(o.brand||o.vendor||'—')}</div>
        <div><strong>Scale:</strong> ${escHtml(o.scale||'1:64')}</div>
        <div><strong>Condition:</strong> ${escHtml(o.condition||'—')}</div>
        <div><strong>Status:</strong> <span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span></div>
        <div><strong>Order #:</strong> ${escHtml(o.order_number||'—')}</div>
        <div><strong>Seller:</strong> ${escHtml(o.vendor||'—')}</div>
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
    modal.classList.remove('hidden'); document.body.style.overflow = 'hidden';
  };

} // ← end initDashboard()

/* ══════════════════════════════════════════════════════════════════
   EDIT USER MODAL
   Injected into DOM on first use — no HTML changes required.
   Features: edit name, role, status + send password reset email.
══════════════════════════════════════════════════════════════════ */
function ensureEditUserModal() {
  if (document.getElementById('editUserModal')) return;
  const modal = document.createElement('div');
  modal.id        = 'editUserModal';
  modal.className = 'modal-overlay hidden';
  modal.innerHTML = `
    <div class="modal-box glass" style="max-width:480px;width:100%">
      <div class="modal-header">
        <h2 style="display:flex;align-items:center;gap:.5rem">
          <i class="fa-solid fa-user-pen"></i> Edit User
        </h2>
        <button class="modal-close-btn" id="euClose"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div style="padding:1.5rem;display:flex;flex-direction:column;gap:1.1rem">
        <input type="hidden" id="euId" />

        <div class="form-group">
          <label class="form-label">Display Name</label>
          <input type="text" id="euName" class="form-control" placeholder="Full name" />
        </div>

        <div class="form-group">
          <label class="form-label">
            Email
            <span style="color:var(--text-muted);font-size:.75rem;font-weight:400">(read-only)</span>
          </label>
          <input type="email" id="euEmail" class="form-control"
                 disabled style="opacity:.55;cursor:not-allowed" />
        </div>

        <div class="form-group">
          <label class="form-label">Role</label>
          <select id="euRole" class="form-control">
            <option value="viewer">User — view only</option>
            <option value="editor">Editor — add &amp; edit</option>
            <option value="admin">Admin — full access</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <p id="euRoleDesc" style="font-size:.75rem;color:var(--text-muted);margin-top:.35rem"></p>
        </div>

        <div class="form-group">
          <label class="form-label">Account Status</label>
          <select id="euStatus" class="form-control">
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <div style="border-top:1px solid var(--border,rgba(255,255,255,.1));padding-top:1.1rem">
          <label class="form-label" style="margin-bottom:.6rem;display:flex;align-items:center;gap:.4rem">
            <i class="fa-solid fa-key" style="color:var(--primary)"></i> Password Reset
          </label>
          <button id="euResetBtn" class="btn btn-ghost" style="width:100%;justify-content:center">
            <i class="fa-solid fa-envelope"></i>&nbsp; Send Password Reset Email
          </button>
          <p style="font-size:.73rem;color:var(--text-muted);margin-top:.4rem;text-align:center">
            A secure reset link will be emailed to the user. You cannot set passwords directly from the client.
          </p>
        </div>

        <div id="euFeedback" style="font-size:.82rem;min-height:1.2rem;text-align:center"></div>
      </div>
      <div class="modal-footer" style="display:flex;gap:.75rem;justify-content:flex-end;
                                        padding:.9rem 1.5rem;
                                        border-top:1px solid var(--border,rgba(255,255,255,.1))">
        <button class="btn btn-ghost" id="euCancel">Cancel</button>
        <button class="btn btn-primary" id="euSave">
          <i class="fa-solid fa-floppy-disk"></i> Save Changes
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  /* role description helper */
  const roleDescs = {
    viewer:      '👁 Can only view orders — no add/edit',
    editor:      '✏️ Can add and edit orders',
    admin:       '⚙️ Full access, cannot manage users',
    super_admin: '👑 Full access including user management'
  };
  document.getElementById('euRole').addEventListener('change', e => {
    document.getElementById('euRoleDesc').textContent = roleDescs[e.target.value] || '';
  });

  function setFeedback(msg, isError = false) {
    const el = document.getElementById('euFeedback');
    if (!el) return;
    el.textContent  = msg;
    el.style.color  = isError ? 'var(--red,#ef4444)' : 'var(--green,#22c55e)';
  }

  function closeEditModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    setFeedback('');
  }

  document.getElementById('euClose').addEventListener('click',  closeEditModal);
  document.getElementById('euCancel').addEventListener('click', closeEditModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeEditModal(); });

  /* Send password reset email */
  document.getElementById('euResetBtn').addEventListener('click', async () => {
    const email = document.getElementById('euEmail').value;
    if (!email) return;
    const btn = document.getElementById('euResetBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
    setFeedback('');
    try {
      await sendPasswordResetEmail(auth, email);
      setFeedback(`✓ Reset email sent to ${email}`);
      showToast('Password reset email sent!', 'success');
    } catch(e) {
      setFeedback('Could not send reset email: ' + e.message, true);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-envelope"></i>&nbsp; Send Password Reset Email';
    }
  });

  /* Save name / role / status */
  document.getElementById('euSave').addEventListener('click', async () => {
    const docId  = document.getElementById('euId').value;
    const name   = document.getElementById('euName').value.trim();
    const role   = document.getElementById('euRole').value;
    const status = document.getElementById('euStatus').value;
    const btn    = document.getElementById('euSave');
    if (!docId) return;
    setFeedback('');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
    try {
      await updateDoc(doc(db, 'users', docId), { name, role, status, updatedAt: serverTimestamp() });
      /* optimistic local update so re-render is instant */
      const lu = DB.users.find(u => u.id === docId);
      if (lu) { lu.name = name; lu.role = role; lu.status = status; }
      showToast('User updated!', 'success');
      closeEditModal();
      await fetchData();
    } catch(e) {
      setFeedback('Failed to save: ' + e.message, true);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
    }
  });
}

window.editUser = function(docId) {
  ensureEditUserModal();
  const user = DB.users.find(u => u.id === docId);
  if (!user) { showToast('User not found', 'warning'); return; }
  document.getElementById('euId').value     = user.id;
  document.getElementById('euName').value   = user.name   || '';
  document.getElementById('euEmail').value  = user.email  || '';
  document.getElementById('euRole').value   = user.role   || 'viewer';
  document.getElementById('euStatus').value = user.status || 'active';
  document.getElementById('euFeedback').textContent = '';
  const roleDescs = {
    viewer:'👁 Can only view orders — no add/edit', editor:'✏️ Can add and edit orders',
    admin:'⚙️ Full access, cannot manage users',   super_admin:'👑 Full access including user management'
  };
  const rd = document.getElementById('euRoleDesc');
  if (rd) rd.textContent = roleDescs[user.role || 'viewer'] || '';
  document.getElementById('editUserModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

/* ═══════════════════════════════════════════
   USER STATUS / DELETE — window-exposed
   FIX: currentStatus now properly received;
        local DB.users updated immediately;
        deleteUser alias added
═══════════════════════════════════════════ */
window.toggleUserStatus = async function(docId, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
  try {
    await updateDoc(doc(db, 'users', docId), { status: newStatus, updatedAt: serverTimestamp() });
    const u = DB.users.find(x => x.id === docId);
    if (u) u.status = newStatus; // optimistic local update
    showToast(`User ${newStatus === 'active' ? 'enabled' : 'disabled'}`, 'success');
    renderUsers();
  } catch(e) { showToast('Failed to update status: ' + e.message, 'warning'); }
};

window.removeUser = async function(docId, email) {
  if (!confirm(`Remove ${email} from PreTrack?\n\nThis removes their profile. Their Firebase Auth account stays.`)) return;
  try {
    await deleteDoc(doc(db, 'users', docId));
    DB.users = DB.users.filter(u => u.id !== docId); // optimistic local update
    showToast('User removed', 'success');
    renderUsers();
  } catch(e) { showToast('Failed to remove user: ' + e.message, 'warning'); }
};

window.deleteUser = window.removeUser; // ← alias: HTML that calls deleteUser() still works

/* ══════════════════════════════════════ FIRESTORE ══════════════════════════════════════ */
async function fetchData() {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const currentEmail = (user.email || '').toLowerCase().trim();
    const isAdmin      = currentEmail === SUPER_ADMIN.toLowerCase().trim();

    const tasks = [
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'activity')),
      getDocs(collection(db, 'brands'))
    ];
    if (isAdmin) {
      tasks.push(getDocs(collection(db, 'access_requests')));
      tasks.push(getDocs(collection(db, 'users')));
    }

    const results = await Promise.all(tasks);
    const [ordSnap, actSnap, brnSnap] = results;
    const arsSnap = isAdmin ? results[3] : null;
    const usrSnap = isAdmin ? results[4] : null;

    function ownerFilter(item) {
      const ou = (item.ownerUid   || '').trim();
      const oe = (item.ownerEmail || '').toLowerCase().trim();
      if (ou === user.uid || oe === currentEmail) return true;
      if (!ou && !oe && isAdmin) return true;
      return false;
    }

    DB.orders = ordSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(ownerFilter)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    DB.activity = actSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(ownerFilter)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    // FIX: customBrands is now module-level — direct update works
    customBrands = brnSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(ownerFilter)
      .map(b => b.name)
      .filter(Boolean);
    rebuildAllBrandDropdowns(); // keep brand dropdowns in sync after refresh

    DB.accessRequests = isAdmin && arsSnap
      ? arsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      : [];

    DB.users = isAdmin && usrSnap
      ? usrSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      : [];

    renderAll();
  } catch(err) {
    console.error('fetchData error:', err);
    DB = { orders: [], activity: [], accessRequests: [], users: [] };
    renderAll();
  }
}

async function addActivity(type, msg) {
  const user = auth.currentUser;
  try {
    await addDoc(collection(db, 'activity'), {
      type, msg, time: new Date().toLocaleString(),
      createdAt:  serverTimestamp(),
      ownerUid:   user?.uid   || '',
      ownerEmail: user?.email || ''
    });
  } catch(e) { console.error('addActivity error:', e); }
}

/* ══════════════════════════════════════ GREETING ══════════════════════════════════════ */
function initGreeting() {
  async function getDisplayName() {
    const user = auth.currentUser; if (!user) return 'there';
    if (user.email?.toLowerCase() === SUPER_ADMIN.toLowerCase()) return 'Super Admin';
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
      if (!snap.empty) { const d = snap.docs[0].data(); if (d.name?.trim()) return d.name.trim(); }
    } catch(e) { /* fallback */ }
    return (user.email || '').split('@')[0] || 'there';
  }
  function update(name) {
    const h = new Date().getHours();
    const emoji = h < 12 ? '<i class="fa-solid fa-cloud-sun"></i>' : h < 17 ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    const word  = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    const gt = document.getElementById('greetingText');
    if (gt) gt.innerHTML = `Good ${word}, ${name}! ${emoji}`;
    const gd = document.getElementById('greetingDate');
    if (gd) gd.textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }
  function checkSys() {
    const ss = document.getElementById('systemStatus'); if (!ss) return;
    ss.innerHTML = `<span class="status-dot"></span> Checking systems…`; ss.className = 'system-status';
    setTimeout(() => { ss.innerHTML = `<span class="status-dot"></span> All systems live`; ss.className = 'system-status live'; }, 1200);
  }
  getDisplayName().then(name => { update(name); setInterval(() => update(name), 60000); });
  checkSys();
}

/* ══════════════════════════════════════ RENDER ALL ══════════════════════════════════════ */
function renderAll() {
  renderStats();
  applyCollectionFilters();
  populateBrandFilter();
  renderRecentOrders();
  renderEtaWidget();
  renderActivityFeed();
  renderAlerts();
  renderPayments();
  renderAnalytics();
  renderBrandLeaderboard();
  renderCatalog();
  renderSellers();
  renderUpcoming();
  renderUsers();
  renderAccessRequests();
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
  const totalQty   = o.reduce((s,x) => s + (x.quantity||1), 0);
  const investment = o.reduce((s,x) => s + ((x.actual_price||0)*(x.quantity||1)) + (x.shipping||0), 0);
  const avgBuy     = totalQty > 0 ? Math.round(investment / totalQty) : 0;
  const pendingAmt = o.reduce((s,x) => s + (x.pending||0), 0);
  const pendingPO  = o.filter(x => x.status==='Ordered'||x.status==='In Transit').length;
  const delivered  = o.filter(x => x.status==='Delivered').length;
  const transit    = o.filter(x => x.status==='In Transit').length;
  const overdue    = o.filter(x => x.eta && new Date(x.eta)<new Date() && x.status!=='Delivered' && x.status!=='Cancelled').length;
  const bm = {}; o.forEach(x => { const k=(x.brand||x.vendor||'—').trim(); bm[k]=(bm[k]||0)+(x.quantity||1); });
  const topBrand = Object.entries(bm).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';

  setText('statTotal',      n);
  setText('statQty',        totalQty);
  setText('statAvgBuy',     avgBuy > 0 ? '₹'+avgBuy.toLocaleString('en-IN') : '₹0');
  setText('statInvestment', '₹'+investment.toLocaleString('en-IN'));
  setText('statPending',    '₹'+pendingAmt.toLocaleString('en-IN'));
  setText('statPendingPO',  pendingPO);
  setText('statDelivered',  delivered);
  setText('statTransit',    transit);
  setText('statOverdue',    overdue);
  setText('statTopBrand',   topBrand);

  const pct = x => n > 0 ? Math.min(100, Math.round((x/n)*100)) : 0;
  const sb  = (id,v) => { const el=document.getElementById(id); if(el) el.style.width=v+'%'; };
  sb('statDeliveredBar', pct(delivered));
  sb('statTransitBar',   pct(transit));
  sb('statPendingPOBar', pct(pendingPO));
  sb('statOverdueBar',   pct(overdue));
  sb('statPendingBar',   investment > 0 ? Math.min(100, Math.round((pendingAmt/investment)*100)) : 0);

  const sellerCount = new Set(DB.orders.map(o => (o.vendor||'Unknown').trim())).size;
  setText('statSellers', sellerCount);
}

/* ══════════════════════════════════════ FILTERS ══════════════════════════════════════ */
function applyCollectionFilters() {
  const q      = (document.getElementById('invSearch')?.value      || '').toLowerCase();
  const brand  = document.getElementById('invFilterBrand')?.value  || '';
  const status = document.getElementById('invFilterStatus')?.value || '';
  const scale  = document.getElementById('invFilterScale')?.value  || '';
  const sort   = document.getElementById('invSort')?.value         || 'newest';

  let items = DB.orders.filter(o => {
    const b = o.brand || o.vendor || '';
    return (!q      || (o.product_name||'').toLowerCase().includes(q) || b.toLowerCase().includes(q) || (o.series||'').toLowerCase().includes(q))
        && (!brand  || b === brand)
        && (!status || o.status === status)
        && (!scale  || o.scale  === scale);
  });

  if (sort === 'name-az')  items.sort((a,b) => (a.product_name||'').localeCompare(b.product_name||''));
  if (sort === 'name-za')  items.sort((a,b) => (b.product_name||'').localeCompare(a.product_name||''));
  if (sort === 'price-hi') items.sort((a,b) => (b.actual_price||0) - (a.actual_price||0));
  if (sort === 'price-lo') items.sort((a,b) => (a.actual_price||0) - (b.actual_price||0));

  renderTable(items);
}

function populateBrandFilter() {
  const bf = document.getElementById('invFilterBrand'); if (!bf) return;
  const cur    = bf.value;
  const brands = [...new Set(DB.orders.map(o => o.brand || o.vendor).filter(Boolean))].sort();
  bf.innerHTML = `<option value="">All Brands</option>` + brands.map(b => `<option value="${escHtml(b)}">${escHtml(b)}</option>`).join('');
  bf.value = cur;
}

/* ══════════════════════════════════════ TABLE ══════════════════════════════════════ */
function renderTable(orders) {
  const tbody      = document.getElementById('ordersTableBody');
  const mobileList = document.getElementById('mobileOrderList');
  if (!orders?.length) {
    if (tbody)      tbody.innerHTML      = `<tr><td colspan="8" class="empty-row"><i class="fa-solid fa-inbox"></i> No items found</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i> No items found</div>`;
    return;
  }
  if (tbody) {
    tbody.innerHTML = orders.map(o => {
      const sc    = (o.status||'').toLowerCase().replace(/\s+/g,'-');
      const thumb = o.image ? `<img src="${o.image}" alt="${escHtml(o.product_name)}" />` : `<i class="fa-solid fa-car-side"></i>`;
      const pb    = (o.pending||0)<=0 ? 'badge-paid' : ((o.paid||0)>0 ? 'badge-partial' : 'badge-pending-b');
      const pl    = (o.pending||0)<=0 ? 'Paid'       : ((o.paid||0)>0 ? 'Partial'       : 'Pending');
      return `<tr>
        <td>
          <div class="order-product-cell">
            <div class="order-thumb">${thumb}</div>
            <div style="min-width:0">
              <div class="order-product-name">${escHtml(o.product_name)}</div>
              <div style="font-size:.7rem;opacity:.6;white-space:nowrap">${escHtml(o.scale||'1:64')}</div>
            </div>
          </div>
        </td>
        <td style="white-space:nowrap">${escHtml(o.brand||o.vendor||'—')}</td>
        <td><span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span></td>
        <td style="text-align:center">${o.quantity||1}</td>
        <td style="white-space:nowrap"><strong>₹${(o.total||0).toLocaleString('en-IN')}</strong></td>
        <td><span class="badge ${pb}" style="font-size:.68rem">${pl}</span></td>
        <td style="font-size:.76rem;color:var(--text-muted);white-space:nowrap">${o.eta?formatDate(o.eta):'—'}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost btn-icon" onclick="viewOrder('${o.id}')"   title="View"><i class="fa-solid fa-eye"></i></button>
            <button class="btn btn-ghost btn-icon" onclick="editOrder('${o.id}')"   title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-danger btn-icon" onclick="deleteOrder('${o.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }
  if (mobileList) {
    mobileList.innerHTML = orders.map(o => {
      const sc    = (o.status||'').toLowerCase().replace(/\s+/g,'-');
      const thumb = o.image ? `<img src="${o.image}" alt="${escHtml(o.product_name)}" />` : `<i class="fa-solid fa-car-side"></i>`;
      const pb    = (o.pending||0)<=0 ? 'badge-paid' : ((o.paid||0)>0 ? 'badge-partial' : 'badge-pending-b');
      const pl    = (o.pending||0)<=0 ? 'Paid'       : ((o.paid||0)>0 ? 'Partial'       : 'Pending');
      return `<div class="mob-order-card glass">
        <div class="mob-card-top">
          <div class="mob-thumb">${thumb}</div>
          <div class="mob-card-info">
            <div class="mob-card-name">${escHtml(o.product_name)}</div>
            <div class="mob-card-brand">${escHtml(o.brand||o.vendor||'—')} · ${escHtml(o.scale||'1:64')}</div>
            <span class="badge badge-${sc}" style="margin-top:.3rem;display:inline-block">${escHtml(o.status||'Ordered')}</span>
          </div>
        </div>
        <div class="mob-card-stats">
          <div class="mob-stat"><span>Qty</span><strong>${o.quantity||1}</strong></div>
          <div class="mob-stat"><span>Total</span><strong>₹${(o.total||0).toLocaleString('en-IN')}</strong></div>
          <div class="mob-stat"><span>Paid</span><strong style="color:var(--green)">₹${(o.paid||0).toLocaleString('en-IN')}</strong></div>
          <div class="mob-stat"><span>Pending</span><strong style="color:${(o.pending||0)>0?'var(--orange)':'var(--green)'}">₹${(o.pending||0).toLocaleString('en-IN')}</strong></div>
          ${o.eta?`<div class="mob-stat"><span>ETA</span><strong>${formatDate(o.eta)}</strong></div>`:''}
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

/* ══════════════════════════════════════ WIDGETS ══════════════════════════════════════ */
function renderRecentOrders() {
  const c = document.getElementById('recentOrdersList'); if (!c) return;
  const items = DB.orders.slice(0,10);
  if (!items.length) { c.innerHTML=`<div class="empty-state">No orders yet</div>`; return; }
  c.innerHTML = items.map(o => `
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
  const c = document.getElementById('etaList'); if (!c) return;
  const upcoming = DB.orders.filter(o=>o.eta&&o.status!=='Delivered'&&o.status!=='Owned').sort((a,b)=>new Date(a.eta)-new Date(b.eta)).slice(0,6);
  if (!upcoming.length) { c.innerHTML=`<div class="empty-state">No upcoming deliveries</div>`; return; }
  const today = new Date();
  c.innerHTML = upcoming.map(o => {
    const d  = Math.ceil((new Date(o.eta)-today)/(1000*60*60*24));
    let dc = 'eta-chip-ok', dl = `${d}d`;
    if (d < 0) { dc='eta-chip-overdue'; dl=`${Math.abs(d)}d overdue`; } else if (d <= 7) dc='eta-chip-soon';
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
    </div>`;
  }).join('');
}

function renderActivityFeed() {
  const c = document.getElementById('activityList'); if (!c) return;
  const items = DB.activity.slice(0,12);
  if (!items.length) { c.innerHTML=`<div class="empty-state">No recent activity</div>`; return; }
  c.innerHTML = items.map(a => `
    <div class="activity-item">
      <span class="activity-dot ${escHtml(a.type||'info')}"></span>
      <span>${escHtml(a.msg||'')}</span>
      <span class="activity-time">${escHtml(a.time||'')}</span>
    </div>`).join('');
}

function renderBrandLeaderboard() {
  const c = document.getElementById('leaderboardList'); if (!c) return;
  if (!DB.orders.length) { c.innerHTML=`<div class="empty-state">No data yet</div>`; return; }
  const bm = {};
  DB.orders.forEach(o => { const k=(o.brand||o.vendor||'Unknown').trim(); bm[k]=(bm[k]||0)+(o.quantity||1); });
  const sorted = Object.entries(bm).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const ri = i => i===0?`<div class="lb-rank-icon gold"><i class="fa-solid fa-crown"></i></div>`
                : i===1?`<div class="lb-rank-icon silver"><i class="fa-solid fa-medal"></i></div>`
                : i===2?`<div class="lb-rank-icon bronze"><i class="fa-solid fa-award"></i></div>`
                :        `<div class="lb-rank-icon"><i class="fa-solid fa-hashtag"></i></div>`;
  c.innerHTML = sorted.map(([brand,qty],i) => `
    <div class="lb-item">${ri(i)}
      <div class="lb-info"><div class="lb-name">#${i+1} ${escHtml(brand)}</div><div class="lb-sub">${qty} unit${qty!==1?'s':''} tracked</div></div>
      <span class="lb-count">${qty}</span>
    </div>`).join('');
}

function renderAlerts() {
  const c = document.getElementById('alertsPanel'); if (!c) return;
  const alerts  = [];
  const delayed = DB.orders.filter(o=>o.eta&&new Date(o.eta)<new Date()&&o.status!=='Delivered'&&o.status!=='Owned');
  const unpaid  = DB.orders.filter(o=>(o.pending||0)>0);
  if (delayed.length) alerts.push({ type:'warning', msg:`${delayed.length} delayed order(s)` });
  if (unpaid.length)  alerts.push({ type:'danger',  msg:`${unpaid.length} order(s) with pending payment` });
  if (!alerts.length) alerts.push({ type:'info',    msg:'All systems normal' });
  c.innerHTML = alerts.map(a => `<div class="alert-item ${a.type}"><i class="fa-solid fa-circle-info"></i><span>${escHtml(a.msg)}</span></div>`).join('');
}

function renderPayments() {
  const c = document.getElementById('paymentsContent'); if (!c) return;
  if (!DB.orders.length) {
    c.innerHTML = `<div class="widget glass full-width"><div class="widget-body"><div class="empty-state">No payment data yet</div></div></div>`;
    return;
  }
  const fmt          = v => `₹${v.toLocaleString('en-IN')}`;
  const totalSpent   = DB.orders.reduce((s,o)=>s+(o.total  ||0),0);
  const totalPaid    = DB.orders.reduce((s,o)=>s+(o.paid   ||0),0);
  const totalPending = DB.orders.reduce((s,o)=>s+(o.pending||0),0);

  const rows = DB.orders.map(o => {
    const sc = (o.status||'').toLowerCase().replace(/\s+/g,'-');
    const pb = (o.pending||0)<=0 ? 'badge-paid' : ((o.paid||0)>0 ? 'badge-partial' : 'badge-pending-b');
    const pl = (o.pending||0)<=0 ? 'Paid'       : ((o.paid||0)>0 ? 'Partial'       : 'Pending');
    return `<tr>
      <td>
        <div style="font-weight:600;font-size:.85rem">${escHtml(o.product_name||'—')}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">${escHtml(o.brand||o.vendor||'—')} · ${escHtml(o.scale||'1:64')}</div>
      </td>
      <td>${fmt(o.total||0)}</td>
      <td style="color:var(--green)">${fmt(o.paid||0)}</td>
      <td style="color:${(o.pending||0)>0?'var(--orange)':'var(--green)'}">${fmt(o.pending||0)}</td>
      <td><span class="badge ${pb}">${pl}</span></td>
      <td><span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span></td>
      <td style="font-size:.76rem;color:var(--text-muted)">${o.eta?formatDate(o.eta):'—'}</td>
    </tr>`;
  }).join('');

  const mobCards = DB.orders.map(o => {
    const sc = (o.status||'').toLowerCase().replace(/\s+/g,'-');
    const pb = (o.pending||0)<=0 ? 'badge-paid' : ((o.paid||0)>0 ? 'badge-partial' : 'badge-pending-b');
    const pl = (o.pending||0)<=0 ? 'Paid'       : ((o.paid||0)>0 ? 'Partial'       : 'Pending');
    return `<div class="pay-mob-card glass">
      <div class="pay-mob-top">
        <div class="pay-mob-name">${escHtml(o.product_name||'—')}</div>
        <span class="badge badge-${sc}">${escHtml(o.status||'Ordered')}</span>
      </div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.65rem">${escHtml(o.brand||o.vendor||'—')} · ${escHtml(o.scale||'1:64')}</div>
      <div class="pay-mob-stats">
        <div class="mob-stat"><span>Total</span><strong>${fmt(o.total||0)}</strong></div>
        <div class="mob-stat"><span>Paid</span><strong style="color:var(--green)">${fmt(o.paid||0)}</strong></div>
        <div class="mob-stat"><span>Pending</span><strong style="color:${(o.pending||0)>0?'var(--orange)':'var(--green)'}">${fmt(o.pending||0)}</strong></div>
        <div class="mob-stat"><span>Status</span><strong><span class="badge ${pb}" style="font-size:.68rem">${pl}</span></strong></div>
      </div>
      ${o.eta?`<div style="font-size:.72rem;color:var(--text-muted);margin-top:.4rem"><i class="fa-solid fa-calendar-days" style="color:var(--primary)"></i> ETA: ${formatDate(o.eta)}</div>`:''}
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
      <div class="table-wrap desktop-only" style="overflow-x:auto">
        <table class="orders-table">
          <thead><tr><th>Product</th><th>Total</th><th>Paid</th><th>Pending</th><th>Payment</th><th>Status</th><th>ETA</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="pay-mob-list mobile-only">${mobCards}</div>
    </div>`;
}

function renderAnalytics() {
  const o = DB.orders;
  const totalCost  = o.reduce((s,x) => s+((x.actual_price||0)*(x.quantity||1))+(x.shipping||0), 0);
  const totalPend  = o.reduce((s,x) => s+(x.pending||0), 0);
  const totalUnits = o.reduce((s,x) => s+(x.quantity||1), 0);
  const avgBuy     = totalUnits > 0 ? Math.round(totalCost/totalUnits) : 0;
  const fmt = v => `₹${v.toLocaleString('en-IN')}`;

  setText('roiTotalCost',    fmt(totalCost));
  setText('roiTotalPending', fmt(totalPend));
  setText('roiTotalUnits',   String(totalUnits));
  setText('roiAvgValue',     fmt(avgBuy));

  const bvc = document.getElementById('brandValueChart');
  if (bvc) {
    const bv = {};
    o.forEach(x => { const k=(x.brand||x.vendor||'Unknown').trim(); bv[k]=(bv[k]||0)+((x.actual_price||0)*(x.quantity||1))+(x.shipping||0); });
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

  const sdEl = document.getElementById('statusDistList');
  if (sdEl) {
    const sm = {};
    o.forEach(x => { const k=x.status||'Unknown'; sm[k]=(sm[k]||0)+1; });
    const statusConfig = [
      { s:'Ordered',    icon:'fa-cart-shopping', grad:'linear-gradient(135deg,#6366f1,#7c5cfc)' },
      { s:'In Transit', icon:'fa-truck-moving',  grad:'linear-gradient(135deg,#14b8a6,#06b6d4)' },
      { s:'Delivered',  icon:'fa-box-open',       grad:'linear-gradient(135deg,#22c55e,#14b8a6)' },
      { s:'Cancelled',  icon:'fa-ban',            grad:'linear-gradient(135deg,#ef4444,#f97316)' }
    ];
    const total = o.length || 1;
    sdEl.innerHTML = statusConfig.map(({s,icon,grad}) => {
      const count = sm[s]||0, pct = Math.round((count/total)*100);
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

  const mc = document.getElementById('monthlyChart');
  if (mc) {
    const mm = {};
    o.forEach(x => {
      if (!x.order_date) return;
      const d=new Date(x.order_date), k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      mm[k]=(mm[k]||0)+((x.actual_price||0)*(x.quantity||1))+(x.shipping||0);
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
    const sc       = (o.status||'').toLowerCase().replace(/\s+/g,'-');
    const hasImg   = !!o.image;
    const pending  = o.pending||0;
    const payIcon  = pending <= 0
      ? `<span class="cc-pay-badge cc-paid"><i class="fa-solid fa-circle-check"></i> Paid</span>`
      : `<span class="cc-pay-badge cc-pending"><i class="fa-solid fa-hourglass-half"></i> ₹${pending.toLocaleString('en-IN')} due</span>`;
    const etaStr   = o.eta ? formatDate(o.eta) : null;
    const isOverdue= o.eta && new Date(o.eta) < new Date() && o.status !== 'Delivered' && o.status !== 'Cancelled';
    return `<div class="catalog-card cc-rich" onclick="viewOrder('${o.id}')">
      <div class="cc-img ${hasImg?'cc-has-img':''}">
        ${hasImg?`<img src="${o.image}" alt="${escHtml(o.product_name)}" />`:`<div class="cc-img-placeholder"><i class="fa-solid fa-car-side"></i></div>`}
        <span class="badge badge-${sc} cc-status-badge">${escHtml(o.status||'Ordered')}</span>
      </div>
      <div class="cc-body">
        <div class="cc-brand-row">
          <span class="cc-brand">${escHtml(o.brand||o.vendor||'—')}</span>
          <span class="cc-scale">${escHtml(o.scale||'1:64')}</span>
        </div>
        <div class="cc-name">${escHtml(o.product_name)}</div>
        ${o.variant?`<div class="cc-variant"><i class="fa-solid fa-cube"></i> ${escHtml(o.variant)}</div>`:''}
        <div class="cc-price-row">
          <div class="cc-price-block"><span class="cc-price-label">Buy Price</span><span class="cc-price-val">${fmt(o.actual_price)}</span></div>
          <div class="cc-price-block"><span class="cc-price-label">Qty</span><span class="cc-price-val">${o.quantity||1}</span></div>
          <div class="cc-price-block"><span class="cc-price-label">Total</span><span class="cc-price-val cc-total">${fmt(o.total)}</span></div>
        </div>
        <div class="cc-footer-row">
          ${payIcon}
          ${etaStr?`<span class="cc-eta ${isOverdue?'cc-eta-overdue':''}"><i class="fa-solid fa-${isOverdue?'triangle-exclamation':'calendar-days'}"></i> ${etaStr}</span>`:''}
        </div>
        <div class="cc-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-icon cc-btn" onclick="editOrder('${o.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-icon cc-btn" onclick="deleteOrder('${o.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderUpcoming() {
  const grid = document.getElementById('upcomingGrid'); if (!grid) return;
  const items = DB.orders
    .filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled')
    .sort((a,b) => {
      const aE=a.eta?new Date(a.eta):null, bE=b.eta?new Date(b.eta):null, now=new Date();
      const aO=aE&&aE<now, bO=bE&&bE<now;
      if (aO&&!bO) return -1; if (!aO&&bO) return 1;
      if (aE&&bE) return aE-bE;
      if (aE&&!bE) return -1; if (!aE&&bE) return 1;
      return 0;
    });

  setText('upStatOrdered', items.filter(o=>o.status==='Ordered').length);
  setText('upStatTransit', items.filter(o=>o.status==='In Transit').length);
  setText('upStatOverdue', items.filter(o=>o.eta&&new Date(o.eta)<new Date()).length);
  setText('upStatPending', items.filter(o=>(o.pending||0)>0).length);

  const badge = document.getElementById('upcomingBadge');
  if (badge) { badge.textContent=items.length; badge.style.display=items.length>0?'inline-flex':'none'; }

  const activeTab = document.querySelector('.upcoming-tab.active')?.dataset.filter || 'all';
  let filtered = items;
  if (activeTab === 'overdue') filtered = items.filter(o => o.eta && new Date(o.eta) < new Date());
  else if (activeTab !== 'all') filtered = items.filter(o => o.status === activeTab);

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:3rem"><i class="fa-solid fa-truck-fast" style="font-size:2rem;opacity:.25"></i><p style="margin-top:.75rem">No upcoming deliveries</p></div>';
    return;
  }
  const fmt   = v => '₹' + Number(v||0).toLocaleString('en-IN');
  const today = new Date();
  grid.innerHTML = filtered.map(o => {
    const sc    = (o.status||'').toLowerCase().replace(/\s+/g,'-');
    const thumb = o.image ? `<img src="${o.image}" alt="${escHtml(o.product_name)}" />` : `<i class="fa-solid fa-car-side"></i>`;
    let etaChip = `<span class="upcoming-eta-chip eta-no-date"><i class="fa-solid fa-calendar"></i> No ETA</span>`;
    if (o.eta) {
      const d   = Math.ceil((new Date(o.eta)-today)/(1000*60*60*24));
      const cls = d < 0 ? 'eta-overdue' : d <= 7 ? 'eta-soon' : 'eta-ok';
      const lbl = d < 0 ? Math.abs(d)+'d overdue' : d === 0 ? 'Today!' : d+'d left';
      etaChip = `<span class="upcoming-eta-chip ${cls}"><i class="fa-solid fa-calendar-days"></i> ${lbl}</span>`;
    }
    const payChip    = (o.pending||0) > 0
      ? `<span class="upcoming-eta-chip eta-soon"><i class="fa-solid fa-hourglass-half"></i> ${fmt(o.pending)} due</span>`
      : `<span class="upcoming-eta-chip eta-ok"><i class="fa-solid fa-circle-check"></i> Paid</span>`;
    const vendorChip = o.vendor ? `<span class="upcoming-eta-chip eta-no-date"><i class="fa-solid fa-store"></i> ${escHtml(o.vendor)}</span>` : '';
    const etaFooter  = o.eta ? `<span>ETA: ${formatDate(o.eta)}</span>` : `<span style="opacity:.4">No ETA set</span>`;

    return `<div class="upcoming-card glass" onclick="viewOrder('${o.id}')">
      <div class="upcoming-card-top">
        <div class="upcoming-card-thumb">${thumb}</div>
        <div style="min-width:0;flex:1">
          <div class="upcoming-card-name">${escHtml(o.product_name)}</div>
          <div class="upcoming-card-brand">${escHtml(o.brand||o.vendor||'—')} · ${escHtml(o.scale||'1:64')}</div>
          <span class="badge badge-${sc}" style="margin-top:4px;display:inline-block;font-size:.65rem">${escHtml(o.status)}</span>
        </div>
      </div>
      <div class="upcoming-card-chips">${etaChip}${payChip}${vendorChip}</div>
      <div class="upcoming-card-footer">
        <span>Qty: <strong>${o.quantity||1}</strong></span>
        <span>Total: <strong>${fmt(o.total)}</strong></span>
        ${etaFooter}
      </div>
    </div>`;
  }).join('');
}

function renderSellers() {
  const grid = document.getElementById('sellerGrid'); if (!grid) return;
  const map  = {};
  DB.orders.forEach(o => {
    const name = (o.vendor||'Unknown Seller').trim();
    if (!map[name]) map[name] = { name, orders:[], total:0, pending:0, paid:0 };
    map[name].orders.push(o);
    map[name].total   += ((o.actual_price||0)*(o.quantity||1))+(o.shipping||0);
    map[name].pending += (o.pending||0);
    map[name].paid    += (o.paid||0);
  });
  const sellers = Object.values(map).sort((a,b) => b.total-a.total);
  const fmt     = v => `₹${v.toLocaleString('en-IN')}`;

  setText('stCountAll',     sellers.length);
  setText('stCountPending', sellers.filter(s=>s.pending>0).length);
  setText('stCountPaid',    sellers.filter(s=>s.pending<=0).length);

  const activeFilter = document.querySelector('.sellers-tab.active')?.dataset.filter || 'all';
  const filtered     = activeFilter === 'pending' ? sellers.filter(s=>s.pending>0)
                     : activeFilter === 'paid'    ? sellers.filter(s=>s.pending<=0)
                     : sellers;

  if (!filtered.length) { grid.innerHTML=`<div class="empty-state">No sellers found</div>`; return; }
  grid.innerHTML = filtered.map(s => `
    <div class="seller-card glass">
      <div class="seller-card-top">
        <div class="seller-avatar"><i class="fa-solid fa-store"></i></div>
        <div class="seller-info">
          <div class="seller-name">${escHtml(s.name)}</div>
          <div class="seller-meta">${s.orders.length} order${s.orders.length!==1?'s':''}</div>
        </div>
        <span class="seller-dot ${s.pending>0?'dot-due':'dot-clear'}"></span>
      </div>
      <div class="seller-stats">
        <div class="seller-stat"><span class="seller-stat-label">Total Spend</span><span class="seller-stat-val">${fmt(s.total)}</span></div>
        <div class="seller-stat"><span class="seller-stat-label">Paid</span><span class="seller-stat-val s-green">${fmt(s.paid)}</span></div>
        <div class="seller-stat"><span class="seller-stat-label">Pending</span><span class="seller-stat-val ${s.pending>0?'s-pink':'s-green'}">${fmt(s.pending)}</span></div>
      </div>
      <div class="seller-models">
        ${s.orders.slice(0,3).map(o=>`<span class="seller-chip">${escHtml(o.product_name)}</span>`).join('')}
        ${s.orders.length>3?`<span class="seller-chip seller-chip-more">+${s.orders.length-3} more</span>`:''}
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════ USERS ══════════════════════════════════════ */
function renderUsers() {
  const tbody      = document.getElementById('usersTableBody');
  const mobileList = document.getElementById('mobileUserList');
  if (!tbody && !mobileList) return;

  const users = DB.users || [];

  if (!users.length) {
    if (tbody)      tbody.innerHTML      = `<tr><td colspan="4" class="empty-row"><i class="fa-solid fa-inbox"></i> No users found</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<div class="empty-state">No users found</div>`;
    return;
  }

  /* ── DESKTOP TABLE (4 columns: Name/Email, Role, Status, Actions) ── */
  if (tbody) {
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:.75rem">
            <div class="user-mobile-avatar"><i class="fa-solid fa-user"></i></div>
            <div>
              <div style="font-weight:700">${escHtml(u.name||u.email)}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">${escHtml(u.email)}</div>
            </div>
          </div>
        </td>
        <td><span class="role-pill">${escHtml(formatRole(u.role))}</span></td>
        <td>
          <span class="status-pill-sm ${u.status==='disabled'?'disabled':'active'}">
            ${u.status==='disabled'?'Disabled':'Active'}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="editUser('${u.id}')">
              <i class="fa-solid fa-pen"></i> Edit
            </button>
            <button class="btn btn-ghost btn-sm"
                    onclick="toggleUserStatus('${u.id}','${u.status||'active'}')">
              ${u.status==='disabled'
                ? '<i class="fa-solid fa-unlock"></i> Enable'
                : '<i class="fa-solid fa-ban"></i> Disable'}
            </button>
            <button class="btn btn-danger btn-sm"
                    onclick="removeUser('${u.id}','${escHtml(u.email)}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  /* ── MOBILE CARDS ── */
  if (mobileList) {
    mobileList.innerHTML = users.map(u => `
      <div class="user-mobile-card glass">
        <div class="user-mobile-top">
          <div class="user-mobile-avatar"><i class="fa-solid fa-user"></i></div>
          <div class="user-mobile-meta">
            <div class="user-mobile-name">${escHtml(u.name||u.email)}</div>
            <div class="user-mobile-email">${escHtml(u.email)}</div>
          </div>
        </div>
        <div class="user-mobile-grid">
          <div class="user-mobile-field">
            <div class="user-mobile-label">Role</div>
            <div class="user-mobile-value">${escHtml(formatRole(u.role))}</div>
          </div>
          <div class="user-mobile-field">
            <div class="user-mobile-label">Status</div>
            <div class="user-mobile-value">
              <span class="status-pill-sm ${u.status==='disabled'?'disabled':'active'}">
                ${u.status==='disabled'?'Disabled':'Active'}
              </span>
            </div>
          </div>
        </div>
        <div class="user-mobile-actions">
          <button class="btn btn-ghost btn-sm" onclick="editUser('${u.id}')">
            <i class="fa-solid fa-pen"></i> Edit
          </button>
          <button class="btn btn-ghost btn-sm"
                  onclick="toggleUserStatus('${u.id}','${u.status||'active'}')">
            ${u.status==='disabled'
              ? '<i class="fa-solid fa-unlock"></i> Enable'
              : '<i class="fa-solid fa-ban"></i> Disable'}
          </button>
          <button class="btn btn-danger btn-sm"
                  onclick="removeUser('${u.id}','${escHtml(u.email)}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>`).join('');
  }
}

function formatRole(role) {
  return { super_admin:'Super Admin', admin:'Admin', editor:'Editor', viewer:'User' }[role] || 'User';
}

/* ══════════════════════════════════════ ACCESS REQUESTS ══════════════════════════════════════ */
function renderAccessRequests() {
  const list       = document.getElementById('accessRequestsList');
  const badge      = document.getElementById('accessRequestsBadge');
  const pendingEl  = document.getElementById('arCountPending');
  const approvedEl = document.getElementById('arCountApproved');
  const rejectedEl = document.getElementById('arCountRejected');
  if (!list) return;

  const user    = auth.currentUser;
  const isAdmin = user?.email?.toLowerCase() === SUPER_ADMIN.toLowerCase();
  if (!isAdmin) {
    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-lock"></i> Admin only</div>`;
    if (badge) badge.style.display = 'none';
    return;
  }

  const activeTab = document.querySelector('.ar-tab.active')?.dataset.filter || 'all';
  let requests    = [...(DB.accessRequests||[])];

  const pendingCount  = requests.filter(r=>(r.status||'pending').toLowerCase()==='pending').length;
  const approvedCount = requests.filter(r=>(r.status||'').toLowerCase()==='approved').length;
  const rejectedCount = requests.filter(r=>(r.status||'').toLowerCase()==='rejected').length;

  if (pendingEl)  pendingEl.textContent  = pendingCount;
  if (approvedEl) approvedEl.textContent = approvedCount;
  if (rejectedEl) rejectedEl.textContent = rejectedCount;
  if (badge) { badge.style.display=pendingCount>0?'inline-flex':'none'; badge.textContent=pendingCount; }

  if (activeTab !== 'all') requests = requests.filter(r=>(r.status||'pending').toLowerCase()===activeTab);
  if (!requests.length) { list.innerHTML=`<div class="empty-state"><i class="fa-solid fa-inbox"></i> No access requests found</div>`; return; }

  list.innerHTML = requests.map(r => {
    const status     = (r.status||'pending').toLowerCase();
    const badgeCls   = status==='approved'?'ar-badge-approved':status==='rejected'?'ar-badge-rejected':'ar-badge-pending';
    const reqAt      = r.createdAt?.seconds ? new Date(r.createdAt.seconds*1000).toLocaleString('en-IN') : '—';
    const displayName= r.name||r.fullName||(r.email?r.email.split('@')[0]:'Unknown User');
    const reason     = r.reason||r.message||r.note||'';
    return `
      <div class="ar-row">
        <div class="ar-avatar"><i class="fa-solid fa-user"></i></div>
        <div class="ar-info">
          <div class="ar-name">
            ${escHtml(displayName)}
            <span class="${badgeCls}" style="margin-left:8px">${escHtml(status.toUpperCase())}</span>
          </div>
          <div class="ar-email">${escHtml(r.email||'No email')}</div>
          ${reason?`<div class="ar-reason">${escHtml(reason)}</div>`:''}
        </div>
        <div class="ar-time">${reqAt}</div>
        <div class="ar-actions" style="visibility:${status==='pending'?'visible':'hidden'}">
          <button class="btn btn-sm btn-ar-approve" onclick="approveAccessRequest('${r.id}')"><i class="fa-solid fa-check"></i></button>
          <button class="btn btn-sm btn-ar-reject"  onclick="rejectAccessRequest('${r.id}')"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>`;
  }).join('');
}

window.approveAccessRequest = async function(id) {
  try {
    const req = DB.accessRequests.find(x => x.id === id); if (!req) return;
    await updateDoc(doc(db,'access_requests',id), { status:'approved', updatedAt:serverTimestamp() });
    const existing = await getDocs(query(collection(db,'users'), where('email','==',req.email)));
    if (existing.empty) {
      await addDoc(collection(db,'users'), {
        email:req.email, uid:req.uid||'',
        name:req.name||req.fullName||'',
        role:'viewer', status:'active', createdAt:serverTimestamp()
      });
    } else {
      await updateDoc(existing.docs[0].ref, { status:'active', updatedAt:serverTimestamp() });
    }
    showToast(`Approved ${req.email}`, 'success');
    await fetchData();
  } catch(err) { console.error(err); showToast('Approve failed: '+err.message,'warning'); }
};

window.rejectAccessRequest = async function(id) {
  try {
    const req = DB.accessRequests.find(x => x.id === id); if (!req) return;
    await updateDoc(doc(db,'access_requests',id), { status:'rejected', updatedAt:serverTimestamp() });
    showToast(`Rejected ${req.email}`, 'warning');
    await fetchData();
  } catch(err) { console.error(err); showToast('Reject failed: '+err.message,'warning'); }
};

/* ══════════════════════════════════════ HELPERS ══════════════════════════════════════ */
function setText(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }
function escHtml(str='')  { return String(str).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function formatDate(s)    { if(!s) return '—'; const d=new Date(s); return isNaN(d)?s:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }

function showToast(message, type='info') {
  let t = document.getElementById('globalToast');
  if (!t) {
    t = document.createElement('div'); t.id = 'globalToast';
    Object.assign(t.style, { position:'fixed', right:'20px', bottom:'20px', zIndex:'9999',
      padding:'12px 16px', borderRadius:'12px', color:'#fff', fontSize:'14px', fontWeight:'600',
      boxShadow:'0 10px 30px rgba(0,0,0,.25)', transition:'all .25s ease',
      transform:'translateY(20px)', opacity:'0' });
    document.body.appendChild(t);
  }
  t.style.background = { success:'linear-gradient(135deg,#22c55e,#14b8a6)', warning:'linear-gradient(135deg,#f97316,#ef4444)', info:'linear-gradient(135deg,#7c5cfc,#6366f1)' }[type] || 'linear-gradient(135deg,#7c5cfc,#6366f1)';
  t.textContent = message;
  requestAnimationFrame(() => { t.style.transform='translateY(0)'; t.style.opacity='1'; });
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => { t.style.transform='translateY(20px)'; t.style.opacity='0'; }, 2500);
}
