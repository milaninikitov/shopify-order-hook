// index.js
import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import { sendEmailNotification } from "./utils/mailer.js";

dotenv.config();

const app = express();

/**
 * ВАЖНО: За HMAC трябва raw body (Buffer) само за този маршрут.
 * Не добавяй глобално express.json() преди този рут.
 */
app.post("/webhook/shopify/order-edited", express.raw({ type: "application/json" }), async (req, res) => {
  const topic = req.get("X-Shopify-Topic") || "";
  const shopDomain = req.get("X-Shopify-Shop-Domain") || "";
  const headerHmac = req.get("X-Shopify-Hmac-SHA256") || "";
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  const rawBody = req.body; // Buffer

  // 1) HMAC валидация
  if (!headerHmac || !secret) {
    console.warn("❌ Missing HMAC header or secret");
    return res.status(401).send("Invalid signature");
  }
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  let ok = false;
  try {
    ok = crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(headerHmac, "utf8"));
  } catch { /* noop */ }
  if (!ok) {
    console.warn("❌ HMAC verification failed");
    return res.status(401).send("Invalid signature");
  }

  // 2) Приемаме само order теми (можеш да махнеш филтъра, ако искаш всичко)
  if (!/^orders\//.test(topic)) {
    console.log(`ℹ️ Ignoring topic ${topic} from ${shopDomain}`);
    return res.status(200).send("Ignored");
  }

  // 3) Парсваме JSON
  let order;
  try {
    order = JSON.parse(rawBody.toString("utf8"));
  } catch (e) {
    console.error("❌ Cannot parse JSON:", e);
    return res.status(400).send("Bad JSON");
  }

  // 4) Филтър по тагове: пращаме имейл само ако има coe:items_updated или coe:address_updated
  const tags = normalizeTags(order);
  const watch = new Set(["coe:items_updated", "coe:address_updated"]);
  const hasWatchedTag = tags.some(t => watch.has(t));
  if (!hasWatchedTag) {
    console.log(`↩️ No-op: order ${order?.name ?? order?.id ?? "?"} without watched tags. Got: [${tags.join(", ")}]`);
    return res.status(200).send("No-op (tags filter)");
  }

  // 5) НЕ изпращаме имейл, ако ъпдейтът е свързан с fulfillment (fulfilled/partial)
  const fulfillmentStatus = String(order?.fulfillment_status || "").toLowerCase();
  const isFulfillmentUpdate = fulfillmentStatus === "fulfilled" || fulfillmentStatus === "partial";
  if (isFulfillmentUpdate) {
    console.log(`↩️ No-op: fulfillment update for ${order?.name ?? order?.id ?? "?"} (status=${fulfillmentStatus})`);
    return res.status(200).send("No-op (fulfillment)");
  }

  // 6) Пращаме имейл (Resend през HTTPS)
  try {
    await sendEmailNotification(order);
    console.log(`✅ Email sent for order ${order?.name ?? order?.id ?? "?"}`);
  } catch (e) {
    console.error("❌ sendEmailNotification failed:", e);
    // по избор: върни 500, за да накараш Shopify да ретрайнe
  }

  return res.status(200).send("OK");
});

app.get("/", (_req, res) => {
  res.send("Shopify webhook listener running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

/**
 * Нормализира таговете от Shopify към масив от lower-case strings.
 * - REST API често дава "tags" като comma-separated string.
 * - GraphQL може да върне масив.
 */
function normalizeTags(order) {
  const t = order?.tags;
  if (!t) return [];
  if (Array.isArray(t)) return t.map(s => String(s).trim().toLowerCase()).filter(Boolean);
  return String(t)
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}
