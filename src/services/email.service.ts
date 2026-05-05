import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter;

export const initEmailService = async () => {
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
    });
    console.log(`[Email Service] Ethereal Email Ready. User: ${testAccount.user}`);
  } catch (err) {
    console.error('[Email Service] Failed to initialize Ethereal:', err);
  }
};

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
  if (!transporter) {
    await initEmailService();
  }

  try {
    const info = await transporter.sendMail({
      from: '"MathMotion" <noreply@mathmotion.com>',
      to,
      subject,
      text,
      html: html || text,
    });

    console.log(`[Email Service] Message sent: ${info.messageId}`);
    console.log(`[Email Service] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  } catch (err) {
    console.error('[Email Service] Failed to send email:', err);
  }
};
