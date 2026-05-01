'use strict';

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let token = sessionStorage.getItem('adminToken') || ''
let currentStatus = 'tous'
let allOrders = []
let refreshTimer = null
const REFRESH_INTERVAL = 30000 // 30s

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    showDashboard()
    loadOrders()
  }

  // Login form
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault()
    const pwd = document.getElementById('admin-pwd').value.trim()
    const btn = document.getElementById('login-btn')
    const err = document.getElementById('login-error')

    btn.disabled = true
    btn.textContent = 'Connexion…'
    err.hidden = true

    // Test the password against the API
    const ok = await checkPassword(pwd)
    if (ok) {
      token = pwd
      sessionStorage.setItem('adminToken', token)
      showDashboard()
      loadOrders()
    } else {
      err.hidden = false
      btn.disabled = false
      btn.textContent = 'Se connecter'
      document.getElementById('admin-pwd').focus()
    }
  })

  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout)

  // Refresh button
  document.getElementById('refresh-btn').addEventListener('click', () => {
    loadOrders(true)
  })

  // Filter pills
  document.getElementById('filter-bar').addEventListener('click', e => {
    const pill = e.target.closest('.filter-pill')
    if (!pill) return
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'))
    pill.classList.add('active')
    currentStatus = pill.dataset.status
    renderOrders()
  })
})

/* ─────────────────────────────────────────────
   AUTH
───────────────────────────────────────────── */
async function checkPassword(pwd) {
  try {
    // ?ping=1 vérifie uniquement le mot de passe, sans requête Supabase
    const r = await fetch('/api/orders?ping=1', {
      headers: { Authorization: `Bearer ${pwd}` }
    })
    return r.ok
  } catch {
    return false
  }
}

function logout() {
  token = ''
  sessionStorage.removeItem('adminToken')
  allOrders = []
  clearAutoRefresh()
  document.getElementById('screen-dash').hidden = true
  document.getElementById('screen-login').style.display = 'flex'
  document.getElementById('admin-pwd').value = ''
}

/* ─────────────────────────────────────────────
   SCREEN MANAGEMENT
───────────────────────────────────────────── */
function showDashboard() {
  document.getElementById('screen-login').style.display = 'none'
  document.getElementById('screen-dash').hidden = false
  startAutoRefresh()
}

/* ─────────────────────────────────────────────
   AUTO REFRESH
───────────────────────────────────────────── */
function startAutoRefresh() {
  clearAutoRefresh()
  refreshTimer = setInterval(() => loadOrders(false, true), REFRESH_INTERVAL)
}

function clearAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = null
}

/* ─────────────────────────────────────────────
   LOAD ORDERS
───────────────────────────────────────────── */
async function loadOrders(showSpinner = true, silent = false) {
  if (showSpinner) {
    document.getElementById('state-loading').hidden = false
    document.getElementById('state-empty').hidden = true
    document.getElementById('orders-list').innerHTML = ''
  }

  const refreshBtn = document.getElementById('refresh-btn')
  refreshBtn.classList.add('spinning')

  try {
    const r = await fetch('/api/orders', {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (r.status === 401) { logout(); return }
    if (!r.ok) throw new Error('Erreur serveur')

    if (r.status === 503) {
      const data = await r.json()
      document.getElementById('state-loading').hidden = true
      document.getElementById('state-empty').hidden = false
      document.getElementById('state-empty').textContent = data.error || 'Base de données non configurée'
      return
    }

    const orders = await r.json()

    // Detect new orders since last fetch
    if (!silent && allOrders.length > 0) {
      const prevIds = new Set(allOrders.map(o => o.id))
      const newOnes = orders.filter(o => !prevIds.has(o.id))
      if (newOnes.length > 0) {
        showToast(`🛍️ ${newOnes.length} nouvelle(s) commande(s) !`, 'success')
        document.title = `(${newOnes.length}) Admin – Heavenly`
      }
    }

    allOrders = orders
    updateStats()
    renderOrders()

    // Update new orders badge
    const newCount = orders.filter(o => o.status === 'nouveau').length
    const badge = document.getElementById('new-badge')
    if (newCount > 0) {
      badge.textContent = newCount
      badge.hidden = false
    } else {
      badge.hidden = true
    }

  } catch (err) {
    if (!silent) showToast('Impossible de charger les commandes', 'error')
  } finally {
    document.getElementById('state-loading').hidden = true
    refreshBtn.classList.remove('spinning')
  }
}

/* ─────────────────────────────────────────────
   STATS
───────────────────────────────────────────── */
function updateStats() {
  document.getElementById('sv-total').textContent = allOrders.length
  document.getElementById('sv-new').textContent = allOrders.filter(o => o.status === 'nouveau').length
  document.getElementById('sv-inprog').textContent = allOrders.filter(o => ['confirmé', 'en_livraison'].includes(o.status)).length
  document.getElementById('sv-done').textContent = allOrders.filter(o => o.status === 'livré').length
}

/* ─────────────────────────────────────────────
   RENDER ORDERS
───────────────────────────────────────────── */
function renderOrders() {
  const list = document.getElementById('orders-list')
  const empty = document.getElementById('state-empty')

  const filtered = currentStatus === 'tous'
    ? allOrders
    : allOrders.filter(o => o.status === currentStatus)

  if (filtered.length === 0) {
    list.innerHTML = ''
    empty.hidden = false
    return
  }

  empty.hidden = true
  list.innerHTML = filtered.map(order => orderCardHTML(order)).join('')

  // Bind action buttons
  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, id } = btn.dataset
      if (action === 'status') updateStatus(id, btn.dataset.status)
    })
  })

  // Bind notes save (on blur)
  list.querySelectorAll('.order-card__notes').forEach(textarea => {
    textarea.addEventListener('change', () => {
      const id = textarea.dataset.id
      saveNotes(id, textarea.value)
    })
  })
}

/* ─────────────────────────────────────────────
   ORDER CARD HTML
───────────────────────────────────────────── */
const STATUS_LABELS = {
  nouveau:      'Nouveau',
  confirmé:     'Confirmé',
  en_livraison: 'En livraison',
  livré:        'Livré',
  annulé:       'Annulé',
}

function orderCardHTML(order) {
  const status = order.status
  const products = Array.isArray(order.products)
    ? order.products.map(p => `<span class="product-tag">${escHtml(p)}</span>`).join('')
    : escHtml(order.products || '')

  const addrLine = order.address
    ? `<div class="order-card__row">
        <span class="order-card__row-icon">📍</span>
        <div class="order-card__row-content">
          <div class="order-card__row-label">Adresse</div>
          <div class="order-card__row-value">${escHtml(order.address)}</div>
        </div>
       </div>`
    : ''

  const notesLine = `
    <div class="order-card__notes-wrap">
      <textarea
        class="order-card__notes"
        data-id="${order.id}"
        placeholder="Notes internes…"
        rows="2"
      >${escHtml(order.notes || '')}</textarea>
    </div>`

  const actions = buildActions(order)

  return `
    <div class="order-card order-card--${status}" id="card-${order.id}">
      <div class="order-card__head">
        <div class="order-card__head-left">
          <span class="status-badge badge--${status}">${STATUS_LABELS[status] || status}</span>
          <span class="order-card__time">${timeAgo(order.created_at)}</span>
        </div>
        <span class="order-card__id">#${order.id.slice(0, 8)}</span>
      </div>

      <div class="order-card__body">
        <div class="order-card__row">
          <span class="order-card__row-icon">👤</span>
          <div class="order-card__row-content">
            <div class="order-card__row-label">Client</div>
            <div class="order-card__row-value">${escHtml(order.customer_name)}</div>
          </div>
        </div>

        <div class="order-card__row">
          <span class="order-card__row-icon">📱</span>
          <div class="order-card__row-content">
            <div class="order-card__row-label">Téléphone</div>
            <div class="order-card__row-value">
              <a href="tel:${escHtml(order.customer_phone)}">${escHtml(order.customer_phone)}</a>
              &nbsp;·&nbsp;
              <a href="https://wa.me/${order.customer_phone.replace(/\D/g, '')}" target="_blank" rel="noopener">WhatsApp</a>
            </div>
          </div>
        </div>

        <div class="order-card__row">
          <span class="order-card__row-icon">🛒</span>
          <div class="order-card__row-content">
            <div class="order-card__row-label">Produits · Qté ${order.quantity}</div>
            <div class="order-card__row-value">${products}</div>
          </div>
        </div>

        <div class="order-card__row">
          <span class="order-card__row-icon">📦</span>
          <div class="order-card__row-content">
            <div class="order-card__row-label">Livraison</div>
            <div class="order-card__row-value">${escHtml(order.delivery_mode)}</div>
          </div>
        </div>

        ${addrLine}
      </div>

      ${notesLine}

      ${actions ? `<div class="order-card__divider"></div><div class="order-card__actions">${actions}</div>` : ''}
    </div>
  `
}

function buildActions(order) {
  const { id, status } = order
  if (status === 'livré' || status === 'annulé') return ''

  const btnConfirm = `<button class="btn btn--confirm btn--sm" data-action="status" data-id="${id}" data-status="confirmé">✓ Confirmer</button>`
  const btnDeliver = `<button class="btn btn--deliver btn--sm" data-action="status" data-id="${id}" data-status="en_livraison">🚚 En livraison</button>`
  const btnDone    = `<button class="btn btn--done btn--sm" data-action="status" data-id="${id}" data-status="livré">✓ Livré</button>`
  const btnCancel  = `<button class="btn btn--cancel btn--sm" data-action="status" data-id="${id}" data-status="annulé">✕ Annuler</button>`

  if (status === 'nouveau')      return btnConfirm + btnCancel
  if (status === 'confirmé')     return btnDeliver + btnCancel
  if (status === 'en_livraison') return btnDone    + btnCancel
  return ''
}

/* ─────────────────────────────────────────────
   UPDATE STATUS
───────────────────────────────────────────── */
async function updateStatus(id, newStatus) {
  const card = document.getElementById(`card-${id}`)
  if (card) card.classList.add('updating')

  try {
    const r = await fetch('/api/orders', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, status: newStatus }),
    })

    if (r.status === 401) { logout(); return }
    if (!r.ok) throw new Error()

    const updated = await r.json()
    // Update in local state
    const idx = allOrders.findIndex(o => o.id === id)
    if (idx !== -1) allOrders[idx] = { ...allOrders[idx], ...updated }

    updateStats()
    renderOrders()
    showToast(`Commande ${STATUS_LABELS[newStatus].toLowerCase()}`, 'success')

  } catch {
    showToast('Erreur mise à jour', 'error')
    if (card) card.classList.remove('updating')
  }
}

/* ─────────────────────────────────────────────
   SAVE NOTES
───────────────────────────────────────────── */
async function saveNotes(id, notes) {
  const order = allOrders.find(o => o.id === id)
  if (!order) return

  await fetch('/api/orders', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id, status: order.status, notes }),
  }).catch(() => {})
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  const wrap = document.getElementById('toast-wrap')
  const toast = document.createElement('div')
  toast.className = `toast toast--${type}`
  toast.textContent = msg
  wrap.appendChild(toast)
  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity .3s'
    setTimeout(() => toast.remove(), 300)
  }, 3500)
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'à l\'instant'
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7)  return `il y a ${days}j`
  return new Date(dateStr).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short' })
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
