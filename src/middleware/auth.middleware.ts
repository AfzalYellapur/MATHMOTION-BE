import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as { userId: string };
    req.user = { id: payload.userId };
    next();
  } catch (err: any) {
    // Explicitly handle TokenExpiredError as per Module 2 specifications
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token Expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
