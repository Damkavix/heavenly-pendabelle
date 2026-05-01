module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'POST')  return await createOrder(req, res)
    if (req.method === 'GET')   return await listOrders(req, res)
    if (req.method === 'PATCH') return await updateOrder(req, res)
    res.status(405).json({ error: 'Méthode non autorisée' })
  } catch (err) {
    console.error('Handler error:', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
}

function isAdmin(req) {
  const auth = (req.headers.authorization || '').replace('Bearer ', '').trim()
  return auth.length > 0 && auth === process.env.ADMIN_PASSWORD
}

function supaFetch(path, options = {}) {
  const url = process.env.SUPABASE_URL + '/rest/v1' + path
  return fetch(url, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
}

async function createOrder(req, res) {
  const { customerName, customerPhone, products, quantity, deliveryMode, address } = req.body || {}

  if (!customerName?.trim() || !customerPhone?.trim() || !Array.isArray(products) || !products.length) {
    return res.status(400).json({ error: 'Champs requis manquants' })
  }

  const payload = {
    customer_name: customerName.trim(),
    customer_phone: customerPhone.trim(),
    products: products,
    quantity: parseInt(quantity) || 1,
    delivery_mode: deliveryMode || 'Livraison à domicile',
    address: (address || '').trim(),
    status: 'nouveau',
  }

  const r = await supaFetch('/orders', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })

  if (!r.ok) {
    console.error('Supabase insert error:', await r.text())
    return res.status(500).json({ error: 'Erreur enregistrement commande' })
  }

  const [order] = await r.json()
  notifyWhatsApp(order).catch(e => console.error('WA notify failed:', e))
  res.status(201).json({ success: true, orderId: order.id })
}

async function listOrders(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Non autorisé' })

  // Ping : vérifie juste le mot de passe sans toucher Supabase
  if (req.query.ping === '1') return res.status(200).json({ ok: true })

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Base de données non configurée. Ajouter SUPABASE_URL et SUPABASE_SERVICE_KEY dans les variables Vercel.' })
  }

  const { status } = req.query
  let path = '/orders?order=created_at.desc&limit=200'
  if (status && status !== 'tous') path += `&status=eq.${status}`

  const r = await supaFetch(path)
  if (!r.ok) return res.status(500).json({ error: 'Erreur chargement commandes' })

  res.status(200).json(await r.json())
}

async function updateOrder(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Non autorisé' })

  const { id, status, notes } = req.body || {}
  if (!id || !status) return res.status(400).json({ error: 'id et status requis' })

  const VALID_STATUSES = ['nouveau', 'confirmé', 'en_livraison', 'livré', 'annulé']
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Statut invalide' })

  const patch = { status, updated_at: new Date().toISOString() }
  if (notes !== undefined) patch.notes = notes

  const r = await supaFetch(`/orders?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })

  if (!r.ok) return res.status(500).json({ error: 'Erreur mise à jour' })

  const [updated] = await r.json()
  res.status(200).json(updated)
}

async function notifyWhatsApp(order) {
  const phone = process.env.WA_PHONE
  const apiKey = process.env.WA_APIKEY
  if (!phone || !apiKey) return

  const productsList = order.products.map(p => `• ${p}`).join('\n')
  const addrLine = order.address ? `\n📍 ${order.address}` : ''

  const msg = encodeURIComponent(
    `🛍️ Nouvelle commande Heavenly!\n\n` +
    `👤 ${order.customer_name}\n` +
    `📱 ${order.customer_phone}\n\n` +
    `🛒 Produits :\n${productsList}\n\n` +
    `📦 ${order.delivery_mode}${addrLine}`
  )

  await fetch(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${msg}&apikey=${apiKey}`)
}
