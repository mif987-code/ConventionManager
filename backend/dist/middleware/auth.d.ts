import { Request, Response, NextFunction } from 'express';
export declare function apiKeyAuth(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function adminOnly(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map