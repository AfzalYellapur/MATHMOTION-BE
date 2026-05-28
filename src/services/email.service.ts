import nodemailer from 'nodemailer';

// 1. Create the transporter directly using your environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (to: string, otp: string) => {
  try {
    // 2. Send the email using the configured transporter
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM_ADDRESS,
      to,
      subject: 'Verify your MathMotion Account',
      text: `Your verification code is: ${otp}. This code will expire soon.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Welcome to MathMotion!</h2>
          <p>Your verification code is:</p>
          <h1 style="color: #005cc5ff; letter-spacing: 2px;">${otp}</h1>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    console.log(`[Email Service] Message sent successfully to ${to}. Message ID: ${info.messageId}`);
  } catch (err) {
    console.error('[Email Service] Failed to send email:', err);
    // 3. Throw the error so the calling controller knows the OTP failed to send
    throw err;
  }
};