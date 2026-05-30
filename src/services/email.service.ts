import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to: string, otp: string) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'MathMotion <noreply@mathmotion.in>', 
      to,
      subject: 'MathMotion Verification Code',
      html: `<p>Welcome to MathMotion! Your 6-character verification code is: <strong>${otp}</strong></p>`
    });

    if (error) {
      console.error("Resend API Error:", error);
      throw new Error("Failed to send email via Resend");
    }

    console.log("Email sent successfully!", data);
    return data;
    
  } catch (err) {
    console.error("Email Service Error:", err);
    throw err;
  }
};