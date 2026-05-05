import { Request, Response, NextFunction } from "express";

const VALID_API_KEYS = new Set(
  (process.env.MCP_API_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
);

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Support both header formats Claude.ai may use
  const authHeader = req.headers["authorization"] || req.headers["x-api-key"];

  if (!authHeader) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const key = typeof authHeader === "string"
    ? authHeader.replace(/^Bearer\s+/i, "").trim()
    : authHeader[0].replace(/^Bearer\s+/i, "").trim();

  if (VALID_API_KEYS.size === 0) {
    console.warn("⚠️  No MCP_API_KEYS set — all requests are allowed. Set this in production!");
    return next();
  }

  if (!VALID_API_KEYS.has(key)) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
}
