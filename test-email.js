require('dotenv').config();
const nodemailer = require('nodemailer');

const user = process.env.GMAIL_USER?.trim() || '';
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '') || '';

console.log('----------------------------------------------------');
console.log('Testing Gmail SMTP Authentication:');
console.log('User:', user);
console.log('Password length:', pass.length, 'characters');
console.log('----------------------------------------------------');

if (!user || !pass) {
  console.error('❌ GMAIL_USER or GMAIL_APP_PASSWORD missing in .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass }
});

transporter.verify()
  .then(() => {
    console.log('✅ SUCCESS! Google SMTP authenticated successfully!');
    console.log('Your Gmail outreach engine is ready to send emails.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Authentication failed with Google:');
    console.error(err.message);
    console.log('\nCommon causes:');
    console.log('1. Account mismatch: The App Password was generated while logged into a different Google account in your browser.');
    console.log('2. 2-Step Verification must be ON for ' + user);
    console.log('3. Open an Incognito window, log into ' + user + ', and generate the App Password at: https://myaccount.google.com/apppasswords');
    process.exit(1);
  });
