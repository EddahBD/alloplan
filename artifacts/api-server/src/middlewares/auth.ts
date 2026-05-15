import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["SESSION_SECRET"] ?? process.env["JWT_SECRET"];
if (!JWT_SECRET) {
  throw new Error(
    "JWT secret is not set. Set SESSION_SECRET or JWT_SECRET environment variable."
  );
}

export interface AuthPayload {
  userId: number;
  email: string;
  role: "customer" | "vendor" | "admin";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: "7d" });
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign({ ...payload, tokenType: "refresh" }, JWT_SECRET!, {
    expiresIn: "30d",
  });
}

export function signResetToken(payload: Pick<AuthPayload, "userId" | "email">): string {
  return jwt.sign({ ...payload, tokenType: "reset" }, JWT_SECRET!, {
    expiresIn: "1h",
  });
}

export function verifyToken(token: string): AuthPayload & { tokenType?: string } {
  return jwt.verify(token, JWT_SECRET!) as AuthPayload & { tokenType?: string };
}

export function requireAccessToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized", message: "Missing access token" });
      return;
    }
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    // Reject non-access tokens (refresh/reset carry an explicit tokenType)
    if (payload.tokenType && payload.tokenType !== "access") {
      res.status(401).json({ error: "Unauthorized", message: "Invalid token type" });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Missing token" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res
        .status(403)
        .json({ error: "Forbidden", message: "Insufficient permissions" });
      return;
    }
    next();
  };
}
