// utils/mailer.js
export async function sendEmailNotification(order) {
  const from = process.env.ALERT_EMAIL_FROM || "Orders <noreply@example.com>";
  const to = process.env.NOTIFY_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  const store = process.env.SHOPIFY_STORE;

  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  if (!to) throw new Error("Missing NOTIFY_EMAIL");
  if (!store) throw new Error("Missing SHOPIFY_STORE");

  // --- Тагове и флагове ---
  const tags = normalizeTags(order);
  const hasItems   = tags.includes("coe:items_updated");
  const hasAddress = tags.includes("coe:address_updated");

  const orderRef = order?.name ?? order?.id ?? "";

  // --- SUBJECT ---
  const subject = `Клиент редактира поръчка ${orderRef}`;

  // --- TEXT (plain) ---
  const textLines = [];
  textLines.push(`Поръчка ${orderRef} беше редактирана.`);
  if (hasItems)   textLines.push(`Редакция на продукти.`);
  if (hasAddress) textLines.push(`Редакция на адреса.`);
  textLines.push(""); // празен ред
  textLines.push(`Клиент: ${order?.customer?.first_name ?? ""} ${order?.customer?.last_name ?? ""}`);
  textLines.push(`Имейл: ${order?.email ?? ""}`);
  textLines.push("");
  textLines.push(`Виж поръчката: https://${store}/admin/orders/${order?.id}`);
  const text = textLines.join("\n");

  // --- HTML ---
  const htmlParts = [];
  htmlParts.push(
    `<p>Поръчка <b>${escapeHtml(orderRef)}</b> беше редактирана.</p>`
  );
  if (hasItems) {
    htmlParts.push(`<p><strong>Редакция на продукти.</strong></p>`);
  }
  if (hasAddress) {
    htmlParts.push(`<p><strong>Редакция на адреса.</strong></p>`);
  }
  htmlParts.push(
    `<p>Клиент: ${escapeHtml(order?.customer?.first_name ?? "")} ${escapeHtml(order?.customer?.last_name ?? "")}<br/>
Имейл: ${escapeHtml(order?.email ?? "")}</p>`
  );
  htmlParts.push(
    `<p><a href="https://${store}/admin/orders/${order?.id}">Отвори поръчката в Shopify</a></p>`
  );
  const html = htmlParts.join("\n");

  // --- Resend ---
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

function normalizeTags(order) {
  const t = order?.tags;
  if (!t) return [];
  if (Array.isArray(t)) return t.map(s => String(s).trim().toLowerCase()).filter(Boolean);
  return String(t)
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}

