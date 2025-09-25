// index.js
import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import { sendEmailNotification } from "./utils/mailer.js";

dotenv.config();

const app = express();

// Shopify подписът се изчислява върху RAW тялото → взимаме го като текст
app.use(express.text({ type: "*/*" }));

function verifyShopifyHmac(rawBody, headerHmac, secret) {
  if (!headerHmac || !secret) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(headerHmac, "utf8"));
  } catch {
    return false;
  }
}

app.post("/webhook/shopify/order-edited", async (req, res) => {
  const topic = req.get("X-Shopify-Topic") || "";
  const shopDomain = req.get("X-Shopify-Shop-Domain") || "";
  const headerHmac = req.get("X-Shopify-Hmac-SHA256") || "";
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const rawBody = req.body || "";

  // 1) HMAC проверка
  if (!verifyShopifyHmac(rawBody, headerHmac, secret)) {
    console.warn("❌ HMAC verification failed");
    return res.status(401).send("Invalid signature");
  }

  // 2) Приемаме само order теми
  if (!/^orders\//.test(topic)) {
    console.log(`ℹ️ Ignoring topic ${topic} from ${shopDomain}`);
    return res.status(200).send("Ignored");
  }

  // 3) Парсваме JSON след HMAC проверката
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    console.error("❌ Cannot parse JSON body:", e);
    return res.status(400).send("Bad JSON");
  }

  // 4) Пращаме имейл (HTTPS към Resend — няма SMTP)
  try {
    await sendEmailNotification(payload);
    console.log(`✅ Email sent for order ${payload?.name ?? payload?.id ?? "?"}`);
  } catch (e) {
    console.error("❌ sendEmailNotification failed:", e);
    // По избор: res.status(500) за Shopify retry; по-често се връща 200, за да не дърпа ретраии
  }

  // Shopify очаква бързо 200
  res.status(200).send("OK");
});

app.get("/", (_req, res) => {
  res.send("Shopify webhook listener running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
