import nodemailer from 'nodemailer';

export async function sendEmailNotification(order) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const mailOptions = {
    from: `"Shopify Bot" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: `Поръчка ${order.name} е редактирана`,
    text: `Поръчката съдържа таг: ${order.tags}\n\nЛинк: https://${process.env.SHOPIFY_STORE}/admin/orders/${order.id}`
  };

  await transporter.sendMail(mailOptions);
}
