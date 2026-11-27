module.exports = async function (req, res) {
  const shop = req.query.shop || process.env.SHOPIFY_SHOP;
  if (!shop) return res.status(400).json({ active: false });

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

    const query = `{
      currentAppInstallation {
        activeSubscriptions {
          id
          status
        }
      }
    }`;

    const gqlRes = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({ query })
    });

    const result = await gqlRes.json();
    const subs = result.data?.currentAppInstallation?.activeSubscriptions || [];
    const isActive = subs.some(s => s.status === 'ACTIVE');

    return res.status(200).json({ active: isActive });
  } catch (err) {
    return res.status(500).json({ active: false, error: err.message });
  }
};
