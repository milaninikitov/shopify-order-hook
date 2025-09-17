// utils/mailer.js
export async function sendEmailNotification(order) {
  const from = process.env.ALERT_EMAIL_FROM || "Orders <noreply@example.com>";
  const to = process.env.NOTIFY_EMAIL;
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }
  if (!to) {
    throw new Error("Missing NOTIFY_EMAIL");
  }

  const subject = `Клиент редактира поръчка ${order?.name ?? order?.id ?? ""}`;
  const text = `Поръчка ${order?.name ?? order?.id ?? ""} беше редактирана.

Клиент: ${order?.customer?.first_name ?? ""} ${order?.customer?.last_name ?? ""}
Имейл: ${order?.email ?? ""}

Виж поръчката: https://${process.env.SHOPIFY_STORE}/admin/orders/${order?.id}`;

  // по желание: същото съдържание и в HTML
  const html = `<p>Поръчка <b>${escapeHtml(order?.name ?? order?.id ?? "")}</b> беше редактирана.</p>
<p>Клиент: ${escapeHtml(order?.customer?.first_name ?? "")} ${escapeHtml(order?.customer?.last_name ?? "")}<br/>
Имейл: ${escapeHtml(order?.email ?? "")}</p>
<p><a href="https://${process.env.SHOPIFY_STORE}/admin/orders/${order?.id}">Отвори поръчката в Shopify</a></p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed: ${res.status} ${body}`);
  }
}

function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
