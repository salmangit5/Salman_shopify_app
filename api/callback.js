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
        code: code
      })
    });

    const data = await response.json();
    res.send(`
      <div style="font-family:sans-serif; padding:20px;">
        <h2>Mubarak Ho! Partner App Token Mil Gaya:</h2>
        <p style="background:#f0f0f0; padding:15px; font-size:16px; word-break:break-all;"><b>${data.access_token || JSON.stringify(data)}</b></p>
        <p>Is token ko copy karke Vercel mein <b>SHOPIFY_ADMIN_ACCESS_TOKEN</b> ki jagah paste kar dein!</p>
      </div>
    `);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
};
