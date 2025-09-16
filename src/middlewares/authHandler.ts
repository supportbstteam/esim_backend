import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: any;
}

// Paths that do not need authentication
const publicPaths = [
  "/api/v1/users/login", 
  "/api/users/register",
  "/api/admin/login",
  "/api/admin/register",
  ""
];

export const protect = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Skip auth if path is in publicPaths
  if (publicPaths.includes(req.path)) {
    return next();
  }

  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        id: string;
      };

      req.user = decoded;
      return next();
    } catch (error) {
      res.status(401);
      return res.json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    res.status(401);
    return res.json({ message: "Not authorized, no token" });
  }
};
