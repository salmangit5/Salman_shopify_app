module.exports = async function (req, res) {
  const { shop, code } = req.query;
  if (!shop || !code) return res.status(400).send('Shop ya Code missing hai');

  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code: code,
        expiring: 1
      })
    });

    const data = await response.json();

    if (data.refresh_token || data.access_token) {
      const tokenData = JSON.stringify({
        refresh_token: data.refresh_token || '',
        access_token: data.access_token || ''
      });

      await fetch(`${process.env.STORAGE_REST_API_URL}/set/${shop}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.STORAGE_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: tokenData
      });
    }

    res.redirect(`https://${shop}/admin/apps`);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
};
