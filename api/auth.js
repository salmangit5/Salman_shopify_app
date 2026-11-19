module.exports = function (req, res) {
  const shop = req.query.shop || process.env.SHOPIFY_SHOP;
  const apiKey = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = `https://${req.headers.host}/api/callback`;
  const scopes = 'read_products,write_products';

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${redirectUri}&expiring=1`;
  res.redirect(installUrl);
};
