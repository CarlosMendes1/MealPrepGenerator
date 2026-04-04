import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase.js';

export interface AuthRequest extends Request {
  userId?:    string;
  userEmail?: string;  // needed by billing (Stripe customer creation)
  userRole?:  string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.userId    = user.id;
  req.userEmail = user.email;

  // Fetch role from profiles (single query — no RLS since service_role)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  req.userRole = profile?.role;
  next();
}

export function requireRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.userRole !== role) {
      res.status(403).json({ error: `Access denied. Requires role: ${role}` });
      return;
    }
    next();
  };
}
