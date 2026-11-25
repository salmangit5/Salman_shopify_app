module.exports = async function (req, res) {
  const shop = req.query.shop || req.body?.shop || process.env.SHOPIFY_SHOP;
  if (!shop) return res.status(400).json({ error: 'Shop URL missing hai' });

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  try {
    let refreshToken = process.env.SHOPIFY_REFRESH_TOKEN;
    let accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (process.env.STORAGE_REST_API_URL && process.env.STORAGE_REST_API_TOKEN) {
      const dbRes = await fetch(`${process.env.STORAGE_REST_API_URL}/get/${shop}`, {
        headers: { Authorization: `Bearer ${process.env.STORAGE_REST_API_TOKEN}` }
      });
      const dbData = await dbRes.json();
      if (dbData && dbData.result) {
        const parsed = typeof dbData.result === 'string' ? JSON.parse(dbData.result) : dbData.result;
        if (parsed.refresh_token) refreshToken = parsed.refresh_token;
        if (parsed.access_token) accessToken = parsed.access_token;
      }
    }

    if (refreshToken) {
      const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) accessToken = tokenData.access_token;
    }

    const baseUrl = `https://${shop}/admin/api/2026-01/products.json`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    };

    // GET: Store ke asli products aur stock mangwayein
    if (req.method === 'GET') {
      const response = await fetch(baseUrl, { headers });
      const data = await response.json();
      return res.status(200).json({ products: data.products || [] });
    }

    // POST: Naya product add karein
    if (req.method === 'POST') {
      const { title, price, stock } = req.body;
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          product: {
            title: title,
            status: 'active',
            variants: [{
              price: price || '10.00',
              inventory_management: 'shopify',
              inventory_quantity: parseInt(stock) || 10
            }]
          }
        })
      });
      const data = await response.json();
      return res.status(200).json({ product: data.product });
    }

    // PUT: Quick Restock (+10) ya 1-Click Bulk Sale Discount
    if (req.method === 'PUT') {
      const { action, variantId, newPrice, discountPercent } = req.body;

      // 1. Single variant price update
      if (action === 'update_price' && variantId) {
        const response = await fetch(`https://${shop}/admin/api/2026-01/variants/${variantId}.json`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ variant: { id: variantId, price: newPrice } })
        });
        const data = await response.json();
        return res.status(200).json({ variant: data.variant });
      }

      // 2. 1-Click Bulk Discount on all store products
      if (action === 'bulk_discount') {
        const listRes = await fetch(baseUrl, { headers });
        const listData = await listRes.json();
        const products = listData.products || [];
        const factor = 1 - (parseFloat(discountPercent) / 100);

        for (const p of products) {
          if (p.variants && p.variants[0]) {
            const v = p.variants[0];
            const updatedPrice = (parseFloat(v.price) * factor).toFixed(2);
            await fetch(`https://${shop}/admin/api/2026-01/variants/${v.id}.json`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({ variant: { id: v.id, price: updatedPrice } })
            });
          }
        }
        return res.status(200).json({ success: true });
      }
    }

    // DELETE: Product delete karein
    if (req.method === 'DELETE') {
      const { id } = req.query;
      await fetch(`https://${shop}/admin/api/2026-01/products/${id}.json`, {
        method: 'DELETE',
        headers
      });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
