import { Request, Response, NextFunction } from 'express';
export declare function conventionMiddleware(req: Request, res: Response, next: NextFunction): void;
export declare function apiKeyAuth(req: Request, res: Response, next: NextFunction): void;
export declare function adminOnly(req: Request, res: Response, next: NextFunction): void;
export declare function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map