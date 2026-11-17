
const API_VERSION = "2026-07";

module.exports = async function (req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  // Only POST requests allowed
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Only POST requests are allowed."
    });
  }

  try {
    // Read request body
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const shop = String(body.shop || "")
      .trim()
      .toLowerCase();

    // Server-side secrets (never send these from frontend)
    const accessToken =
      process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    const expectedShop =
      String(process.env.SHOPIFY_SHOP || "")
        .trim()
        .toLowerCase();

    const appReturnUrl =
      process.env.APP_RETURN_URL;

    // Validate configuration
    if (!accessToken || !expectedShop || !appReturnUrl) {
      return res.status(500).json({
        success: false,
        error: "Server configuration is incomplete."
      });
    }

    // Validate Shopify shop domain
    if (
      !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) ||
      shop !== expectedShop
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid or unauthorized Shopify store."
      });
    }

    // Validate app return URL
    const returnUrl = new URL(appReturnUrl);

    if (returnUrl.protocol !== "https:") {
      return res.status(500).json({
        success: false,
        error: "A valid HTTPS return URL is required."
      });
    }

    returnUrl.searchParams.set("shop", shop);

    // Shopify GraphQL mutation
    const query = `
      mutation CreateSubscription(
        $name: String!,
        $returnUrl: URL!,
        $lineItems: [AppSubscriptionLineItemInput!]!,
        $test: Boolean
      ) {
        appSubscriptionCreate(
          name: $name,
          returnUrl: $returnUrl,
          lineItems: $lineItems,
          test: $test
        ) {
          confirmationUrl
          appSubscription {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      name: "Premium Plan",
      returnUrl: returnUrl.toString(),
      test: true,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: 5.00,
                currencyCode: "USD"
              },
              interval: "EVERY_30_DAYS"
            }
          }
        }
      ]
    };

    // Send request to Shopify
    const response = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken
        },
        body: JSON.stringify({
          query,
          variables
        })
      }
    );

    const data = await response.json();

    // Check HTTP and GraphQL errors
    if (!response.ok || data.errors?.length) {
      return res.status(502).json({
        success: false,
        error: "Shopify API request failed.",
        details: data.errors || []
      });
    }

    const result = data.data?.appSubscriptionCreate;

    if (!result) {
      return res.status(502).json({
        success: false,
        error: "Invalid Shopify response."
      });
    }

    // Check Shopify user errors
    if (result.userErrors?.length) {
      return res.status(422).json({
        success: false,
        error: "Subscription creation failed.",
        details: result.userErrors
      });
    }

    // Check confirmation URL
    if (!result.confirmationUrl) {
      return res.status(502).json({
        success: false,
        error: "Shopify confirmation URL was not returned."
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      message: "Subscription created successfully.",
      confirmationUrl: result.confirmationUrl,
      subscriptionId: result.appSubscription?.id
    });

  } catch (error) {
    console.error("Subscription Error:", error);

    return res.status(500).json({
      success: false,
      error: "Internal server error."
    });
  }
};
  
