import express from 'express';
import bodyParser from 'body-parser';
import { getOrderFromShopify } from './utils/shopify.js';
import { sendEmailNotification } from './utils/mailer.js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(bodyParser.json());

app.post('/webhook/order-updated', async (req, res) => {
  const order = req.body;

  setTimeout(async () => {
    try {
      const updatedOrder = await getOrderFromShopify(order.id);
      const tags = updatedOrder.tags || '';

      if (tags.includes('coe:address_updated') || tags.includes('coe:items_updated')) {
        await sendEmailNotification(updatedOrder);
      }
    } catch (error) {
      console.error('Error processing webhook:', error.message);
    }
  }, 2 * 60 * 1000); // 2 мин

  res.status(200).send('Webhook received');
});

app.get('/', (req, res) => {
  res.send('Shopify webhook listener running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
