const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { session_id } = req.query
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' })

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
  const sb = createClient(
    process.env.SUPABASE_URL || 'https://evtmqqqcmxbpyrsagadx.supabase.co',
    process.env.SUPABASE_ANON_KEY
  )

  const session = await stripe.checkout.sessions.retrieve(session_id)

  if (session.payment_status !== 'paid') {
    return res.status(400).json({ error: 'Payment not completed' })
  }

  const phoneId = session.metadata?.phone_id
  if (phoneId) {
    await sb.from('phones').update({ sold: true }).eq('id', phoneId)
  }

  const orderNumber = 'EI-' + session.id.replace('cs_live_', '').replace('cs_test_', '').substring(0, 8).toUpperCase()

  return res.json({
    orderNumber,
    customerName: session.customer_details?.name || '',
    customerEmail: session.customer_details?.email || '',
    phone: session.metadata?.phone_name || 'iPhone',
    amount: (session.amount_total / 100).toFixed(2),
    shipping: session.shipping_details?.address || null,
  })
}
