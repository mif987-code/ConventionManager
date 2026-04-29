import { ParsedQs } from 'qs';

declare module 'express-serve-static-core' {
  interface Request {
    /** Parsed from x-convention-id header by conventionMiddleware */
    conventionId?: number;
    /** Set by admin auth middleware */
    adminId?: number;
    /** Set by admin auth middleware */
    isAdmin?: boolean;
  }
}
