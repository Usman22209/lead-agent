require('dotenv').config();
const nodemailer = require('nodemailer');

const user = process.env.GMAIL_USER?.trim();
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass }
});

async function main() {
  console.log('Sending test email to:', user);
  const info = await transporter.sendMail({
    from: `"LeadAgent AI" <${user}>`,
    to: user,
    subject: 'Test Email from LeadAgent AI Outreach Engine',
    text: 'Hello! Your Gmail outreach integration is active and working.',
    html: '<div style="font-family: sans-serif; padding: 24px; background: #f8fafc; border-radius: 8px;"><h2>LeadAgent AI Outreach</h2><p>Your Gmail outreach engine is 100% connected and sending successfully!</p></div>'
  });
  console.log('✅ Real email successfully sent! MessageId:', info.messageId);
}

main().catch(err => console.error('❌ Failed to send email:', err.message));
