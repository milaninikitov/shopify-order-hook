// utils/mailer.js
export async function sendEmailNotification(order) {
  const from = process.env.ALERT_EMAIL_FROM || "Orders <noreply@example.com>";
  const to = process.env.NOTIFY_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  const store = process.env.SHOPIFY_STORE;

  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  if (!to) throw new Error("Missing NOTIFY_EMAIL");
  if (!store) throw new Error("Missing SHOPIFY_STORE");

  const subject = `Клиент редактира поръчка ${order?.name ?? order?.id ?? ""}`;
  const text = `Поръчка ${order?.name ?? order?.id ?? ""} беше редактирана.

Клиент: ${order?.customer?.first_name ?? ""} ${order?.customer?.last_name ?? ""}
Имейл: ${order?.email ?? ""}

Виж поръчката: https://${store}/admin/orders/${order?.id}`;

  const html = `<p>Поръчка <b>${escapeHtml(order?.name ?? order?.id ?? "")}</b> беше редактирана.</p>
<p>Клиент: ${escapeHtml(order?.customer?.first_name ?? "")} ${escapeHtml(order?.customer?.last_name ?? "")}<br/>
Имейл: ${escapeHtml(order?.email ?? "")}</p>
<p><a href="https://${store}/admin/orders/${order?.id}">Отвори поръчката в Shopify</a></p>`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: controller.signal
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend error:", res.status, body);
      throw new Error(`Resend failed: ${res.status} ${body}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}
