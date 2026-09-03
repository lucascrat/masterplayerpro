import { Request, Response, NextFunction } from 'express';

// For now, this is a simple key check to match existing behavior, 
// but prepared for full JWT implementation.
const ADMIN_KEY = process.env.ADMIN_KEY || 'master2024';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || '';
  // Accept either the raw key or a "Bearer <key>" form.
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (provided && provided === ADMIN_KEY) {
    return next();
  }

  res.status(401).json({ error: 'Unauthorized' });
};
