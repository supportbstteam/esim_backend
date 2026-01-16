import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Add paths to skip auth if needed
const allowedPaths = ["/login", "/register"];

export const auth = (req:any, res: Response, next: NextFunction) => {
  // ✅ Allow CORS preflight
  if (req.method === "OPTIONS") return next();

  const allowedPaths = ["/login", "/register"];

  if (allowedPaths.includes(req.path)) return next();

  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid token" });
  }
};
