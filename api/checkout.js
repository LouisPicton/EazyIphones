const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
  const sb = createClient(
    process.env.SUPABASE_URL || 'https://evtmqqqcmxbpyrsagadx.supabase.co',
    process.env.SUPABASE_ANON_KEY
  )

  const { phoneId } = req.body || {}
  if (!phoneId) return res.status(400).json({ error: 'Missing phoneId' })

  // Fetch the phone from Supabase
  const { data: phone, error } = await sb
    .from('phones')
    .select('*')
    .eq('id', phoneId)
    .single()

  if (error || !phone) return res.status(404).json({ error: 'Phone not found' })
  if (phone.sold) return res.status(400).json({ error: 'Sorry — this phone has just sold. Please go back and choose another.' })

  const productName = [phone.model, phone.storage, phone.colour].filter(Boolean).join(' ')
  const description = [
    phone.battery ? `${phone.battery}% battery` : null,
    phone.condition,
    phone.network
  ].filter(Boolean).join(' · ')

  const origin = process.env.SITE_URL || `https://${req.headers.host}`

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'gbp',
        product_data: {
          name: productName,
          description: description || undefined,
        },
        unit_amount: Math.round(phone.price * 100),
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/buy.html`,
    metadata: {
      phone_id: String(phoneId),
      phone_name: productName,
    },
    shipping_address_collection: {
      allowed_countries: ['GB', 'IE'],
    },
    phone_number_collection: {
      enabled: true,
    },
    billing_address_collection: 'auto',
  })

  return res.json({ url: session.url })
}
