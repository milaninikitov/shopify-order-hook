// utils/shopify.js
// Ползва глобалния fetch от Node 18+
export async function getOrderFromShopify(orderId) {
  const res = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2024-10/orders/${orderId}.json`, {
    headers: {
      "X-Shopify-Access-Token": process.env.SHOPIFY_API_TOKEN,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) throw new Error(`Shopify API Error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.order;
}
