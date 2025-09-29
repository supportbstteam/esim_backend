// src/middlewares/auth.handler.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Paths inside admin that should bypass auth
const allowedPaths = [
  "/login",
  "/register"
];

export const auth = (req: Request, res: Response, next: NextFunction) => {
  // Check if the current route is in allowedPaths
  if (allowedPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: "Unauthorized, token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    (req as any).user = decoded; // attach payload to request
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
