import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const auth = (req: Request, res: Response, next: NextFunction) => {
  // Paths that do NOT require authentication
  const allowPaths = [
    "/api/admin/login",
    "/api/admin/register",
  ];

  // If current path is allowed, skip auth
  if (allowPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: "Unauthorized, token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    (req as any).user = decoded; // attach payload
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
