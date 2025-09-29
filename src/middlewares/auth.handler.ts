import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Add paths to skip auth if needed
const allowedPaths = ["/login", "/register"];

export const auth = (req: Request, res: Response, next: NextFunction) => {
  if (allowedPaths.includes(req.path)) return next();

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized, token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
