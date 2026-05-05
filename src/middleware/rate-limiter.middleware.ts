import rateLimit from 'express-rate-limit';
import { Request } from 'express';

export const expensiveEndpointLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Limit each IP/User to 5 requests per window
  keyGenerator: (req: Request) => {
    // If the user is authenticated, limit by user ID. Otherwise, fallback to IP.
    return req.user?.id || req.ip || 'unknown';
  },
  message: {
    error: 'Too many requests from this IP/User, please try again after a minute.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
