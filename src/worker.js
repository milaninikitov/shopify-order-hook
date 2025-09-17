export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // здраве/probe
    if (request.method === "GET") {
      return new Response("OK");
    }

    // приемаме Shopify уебхука на /webhooks/shopify (или целия корен)
    if (request.method !== "POST" || !url.pathname.startsWith("/webhooks/shopify")) {
      return new Response("Not found", { status: 404 });
    }

    // Shopify дава тялото сурово — трябва ни .text(), после JSON
    const raw = await request.text();

    // --- 1) HMAC проверка ---
    const recvHmac = request.headers.get("X-Shopify-Hmac-SHA256") || "";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.SHOPIFY_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
    const calcHmac = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
    if (calcHmac !== recvHmac) {
      return new Response("Unauthorized", { status: 401 });
    }

    // --- 2) Бизнес логика ---
    let payload;
    try { payload = JSON.parse(raw); } catch {
      return new Response("Bad JSON", { status: 400 });
    }

    // Пример: изпращане на имейл през Resend (HTTP API, не SMTP)
    if (env.RESEND_API_KEY && env.ALERT_EMAIL_TO && env.ALERT_EMAIL_FROM) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: env.ALERT_EMAIL_FROM,            // напр. "Shop <noreply@yourdomain.com>"
          to: [env.ALERT_EMAIL_TO],              // твоя поща
          subject: `Shopify order edited: ${payload.name || payload.id || ""}`,
          html: `<p>Има редакция по поръчка.</p><pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`
        })
      });
    }

    // Върни 200 бързо — Shopify чака само статус кода
    return new Response("OK", { status: 200 });
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
