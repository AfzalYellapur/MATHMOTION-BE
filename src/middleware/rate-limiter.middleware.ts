import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';

export const expensiveEndpointLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Limit each IP/User to 5 requests per window
  keyGenerator: (req: Request, res: Response) => {
    // 1. If the user is logged in, limit by their specific User ID
    if (req.user?.id) {
      return req.user.id;
    }
    // 2. Otherwise, safely handle the IP (including IPv6) using the built-in helper
    return ipKeyGenerator(req.ip || '');
  },
  message: {
    error: 'Too many requests from this IP/User, please try again after a minute.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});