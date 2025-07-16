import express from 'express';
import bodyParser from 'body-parser';
import { getOrderFromShopify } from './utils/shopify.js';
import { sendEmailNotification } from './utils/mailer.js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(bodyParser.json());

// Кеш за поръчки, за които вече е изпратен имейл
const notifiedOrders = new Map();

app.post('/webhook/order-updated', async (req, res) => {
  const order = req.body;
  const orderId = order.id;

  // Приемаме Webhook веднага
  res.status(200).send('Webhook received');

  setTimeout(async () => {
    try {
      // Проверка дали вече е изпратен имейл за тази поръчка
      if (notifiedOrders.has(orderId)) {
        console.log(`🔁 Пропуснат дублиращ се имейл за поръчка ${orderId}`);
        return;
      }

      const updatedOrder = await getOrderFromShopify(orderId);
      const tags = updatedOrder.tags || '';

      if (tags.includes('coe:address_updated') || tags.includes('coe:items_updated')) {
        await sendEmailNotification(updatedOrder);

        // Маркираме поръчката като "уведомена"
        notifiedOrders.set(orderId, true);

        // Изчистваме флага след 30 минути (по избор)
        setTimeout(() => {
          notifiedOrders.delete(orderId);
        }, 30 * 60 * 1000);
      }
    } catch (error) {
      console.error('Error processing webhook:', error.message);
    }
  }, 2 * 60 * 1000); // Изчакване 2 минути
});

app.get('/', (req, res) => {
  res.send('Shopify webhook listener running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
