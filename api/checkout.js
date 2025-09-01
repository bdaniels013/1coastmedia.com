// API route to create a Stripe Checkout session for the 1CoastMedia web3 site.
// This handler accepts a simplified cart payload and uses environment variables
// for the Stripe secret key. Vercel automatically bundles this file as a
// serverless function under `/api/checkout`.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

/**
 * Convert a dollar amount to cents. Non‑numeric values are treated as zero.
 * @param {number|string} n
 */
function toCents(n) {
  const v = Number(n || 0);
  return Math.round(v * 100);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const body = req.body || {};
    const cart = Array.isArray(body.cart) ? body.cart : [];
    const plan = body.plan || 'one-time';
    const contact = body.contact || {};
    if (!cart || cart.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    // Determine Stripe mode based on plan.
    const mode = plan === 'monthly' ? 'subscription' : 'payment';
    const line_items = [];
    for (const item of cart) {
      const amountCents = toCents(item?.price);
      if (amountCents <= 0) continue;
      const prefix = item?.type === 'addon' ? 'Add-on: ' : 'Service: ';
      const productName = `${prefix}${item?.name || 'Item'}`;
      const priceData = {
        currency: 'usd',
        product_data: { name: productName },
        ...(mode === 'subscription'
          ? { recurring: { interval: 'month' }, unit_amount: amountCents }
          : { unit_amount: amountCents })
      };
      line_items.push({ price_data: priceData, quantity: 1 });
    }
    if (line_items.length === 0) {
      return res.status(400).json({ error: 'No billable items' });
    }
    // Compute redirect origin
    const origin =
      req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : '');
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items,
      success_url: `${origin}/?success=1`,
      cancel_url: `${origin}/?canceled=1`,
      metadata: {
        plan,
        email: contact?.email || '',
        name: contact?.name || '',
        company: contact?.company || '',
        phone: contact?.phone || '',
        notes: contact?.notes || ''
      },
      allow_promotion_codes: false,
      automatic_tax: { enabled: false }
    });
    return res.status(200).json({ success: true, id: session.id, url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    const message = err?.message || 'Failed to create checkout session';
    return res.status(500).json({ error: message });
  }
}