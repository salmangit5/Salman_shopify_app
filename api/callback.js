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
    res.send(`
      <div style="font-family:sans-serif; padding:20px;">
        <h2>Mubarak Ho! Asli Expiring Token Mil Gaya:</h2>
        <p><b>Access Token:</b></p>
        <p style="background:#f0f0f0; padding:10px; word-break:break-all;">${data.access_token || 'Nahi mila'}</p>
        <p><b>Refresh Token:</b></p>
        <p style="background:#f0f0f0; padding:10px; word-break:break-all;">${data.refresh_token || 'Nahi mila'}</p>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </div>
    `);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
};
