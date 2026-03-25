import { Request, Response, NextFunction } from 'express';

// For now, this is a simple key check to match existing behavior, 
// but prepared for full JWT implementation.
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader === 'master2024') {
    return next();
  }

  // In a real JWT setup, we would verify the token here
  // For this version, we stick to the provided key for simplicity but wrapped in middleware
  res.status(401).json({ error: 'Unauthorized' });
};
