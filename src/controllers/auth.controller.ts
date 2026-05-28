import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User';
import { sendEmail } from '../services/email.service';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const setTokenCookie = (res: Response, token: string) => {
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 Hrs
  });
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otpSecret = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 char OTP
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const user = new User({ email, passwordHash, otpSecret, otpExpiry });
    await user.save();

    await sendEmail(email, otpSecret);
    res.status(201).json({ message: 'User created. Please check your email for the OTP.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Email not verified. Please verify your email first.' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });
    setTokenCookie(res, token);

    res.json({ message: 'Logged in successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('accessToken');
  res.json({ message: 'Logged out successfully' });
};

export const me = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('-passwordHash -otpSecret -otpExpiry');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'User is already verified' });
    if (user.otpSecret !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otpSecret = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });
    setTokenCookie(res, token);

    res.json({ message: 'Email verified successfully. You are now logged in.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const resendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'User is already verified' });
    }

    const otpSecret = crypto.randomBytes(3).toString('hex').toUpperCase();
    user.otpSecret = otpSecret;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendEmail(email, otpSecret);

    res.json({ message: 'If the email exists, an OTP was sent.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (user) {
      const otpSecret = crypto.randomBytes(3).toString('hex').toUpperCase();
      user.otpSecret = otpSecret;
      user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      await sendEmail(email, otpSecret);
    }
    res.json({ message: 'If the email exists, an OTP was sent.' });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.otpSecret !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.otpSecret = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
