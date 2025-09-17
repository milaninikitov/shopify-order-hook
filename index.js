// index.js
import express from 'express';
import crypto from 'crypto';
import { sendEmailNotification } from './utils/mailer.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// ВАЖНО: за HMAC трябва "raw" тяло (string), не JSON парснато автоматично
app.use(express.text({ type: '*/*' }));

// Кеш за поръчки, за които вече е изпратен имейл (анти-дубликат)
const notifiedOrders = new Map();

/**
 * Проверка на Shopify HMAC подпис
 * - rawBody: оригиналното string тяло на заявката (точно така, както е получено)
 * - headerHmac: X-Shopify-Hmac-SHA256
 * - secret: SHOPIFY_WEBHOOK_SECRET от Shopify (същият, който си задал при създаване на webhook)
 */
function verifyShopifyHmac(rawBody, headerHmac, secret) {
  if (!headerHmac || !secret) return false;
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  try {
    // timing-safe сравнение
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(headerHmac));
  } catch {
    return false;
  }
}

app.post('/webhook/order-updated', async (req, res) => {
  const raw = req.body; // string (заради express.text)
  const headerHmac = req.get('X-Shopify-Hmac-SHA256') || '';
  const topic = req.get('X-Shopify-Topic') || '';

  // 1) HMAC проверка
  const ok = verifyShopifyHmac(raw, headerHmac, process.env.SHOPIFY_WEBHOOK_SECRET);
  if (!ok) {
    // отговаряме с 401, за да не ре-траи Shopify този уебхук
    return res.status(401).send('Unauthorized');
  }

  // 2) Парсваме JSON payload-а
  let order;
  try {
    order = JSON.parse(raw);
  } catch {
    return res.status(400).send('Bad JSON');
  }

  const orderId = order?.id;

  // 3) Връщаме 200 веднага (Shopify се интересува само от статуса)
  res.status(200).send('Webhook received');

  // 4) Отложена обработка (твоята 2-минутна логика)
  setTimeout(async () => {
    try {
      // (по желание) проверка, че наистина е order update
      if (topic && !topic.includes('orders/update')) {
        console.log(`ℹ️ Пропуснат topic: ${topic}`);
        return;
      }

      // Анти-дубликат
      if (notifiedOrders.has(orderId)) {
        console.log(`🔁 Пропуснат дублиращ се имейл за поръчка ${orderId}`);
        return;
      }

      // ✔️ Ползваме payload-а директно (Shopify праща пълната поръчка)
      const updatedOrder = order;
      const tags = updatedOrder?.tags || '';

      if (tags.includes('coe:address_updated') || tags.includes('coe:items_updated')) {
        await sendEmailNotification(updatedOrder);

        // Маркираме поръчката като "уведомена"
        notifiedOrders.set(orderId, true);

        // Изчистваме флага след 30 минути (ако дойде още един уебхук по-късно)
        setTimeout(() => {
          notifiedOrders.delete(orderId);
        }, 30 * 60 * 1000);
      } else {
        console.log(`ℹ️ Поръчка ${orderId} без релевантни тагове, няма да пращаме имейл.`);
      }
    } catch (error) {
      console.error('Error processing webhook:', error.message);
    }
  }, 2 * 60 * 1000); // за тест можеш временно да намалиш на 10 сек
});

app.get('/', (_req, res) => {
  res.send('Shopify webhook listener running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
