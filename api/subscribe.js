module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const shop = req.body.shop || process.env.SHOPIFY_SHOP;
  if (!shop) return res.status(400).json({ error: 'Shop URL missing hai' });

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const returnUrl = `https://${shop}/admin/apps`;

  try {
    let refreshToken = process.env.SHOPIFY_REFRESH_TOKEN;
    let fallbackAccessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (process.env.STORAGE_REST_API_URL && process.env.STORAGE_REST_API_TOKEN) {
      const dbRes = await fetch(`${process.env.STORAGE_REST_API_URL}/get/${shop}`, {
        headers: { Authorization: `Bearer ${process.env.STORAGE_REST_API_TOKEN}` }
      });
      const dbData = await dbRes.json();
      if (dbData && dbData.result) {
        const parsed = typeof dbData.result === 'string' ? JSON.parse(dbData.result) : dbData.result;
        if (parsed.refresh_token) refreshToken = parsed.refresh_token;
        if (parsed.access_token) fallbackAccessToken = parsed.access_token;
      }
    }

    let accessToken = fallbackAccessToken;
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
      if (tokenData.access_token) {
        accessToken = tokenData.access_token;
      }
    }

    if (!accessToken) {
      return res.status(401).json({ error: 'Store ka token nahi mila, pehle app install karein' });
    }

    const query = `
      mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean) {
        appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {
          userErrors { field message }
          confirmationUrl
          appSubscription { id }
        }
      }
    `;

    const variables = {
      name: "Salman Smart Products Pro",
      returnUrl: returnUrl,
      test: false,
      lineItems: [{
        plan: {
          appRecurringPricingDetails: {
            price: { amount: 5.00, currencyCode: "USD" },
            interval: "EVERY_30_DAYS"
          }
        }
      }]
    };

    const gqlRes = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({ query, variables })
    });

    const result = await gqlRes.json();
    const subData = result.data?.appSubscriptionCreate;

    if (subData?.userErrors?.length > 0) {
      return res.status(400).json({ error: subData.userErrors[0].message, details: subData.userErrors });
    }

    if (subData?.confirmationUrl) {
      return res.status(200).json({ confirmationUrl: subData.confirmationUrl });
    }

    return res.status(400).json({ error: 'Subscription creation failed', details: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
