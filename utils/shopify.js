import fetch from 'node-fetch';

export async function getOrderFromShopify(orderId) {
  const response = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2023-07/orders/${orderId}.json`, {
    headers: {
      'X-Shopify-Access-Token': process.env.SHOPIFY_API_TOKEN,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Shopify API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.order;
}
