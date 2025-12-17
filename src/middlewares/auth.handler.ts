import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User.entity";

const allowedPaths = ["/login", "/register"];

export const auth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (allowedPaths.includes(req.path)) return next();

    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized, token missing" });
    }

    // 🔓 Verify token
    const decoded: any = jwt.verify(
      token,
      process.env.JWT_SECRET || "secretkey"
    );

    if (!decoded?.id) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // ✅ ONLY check DB if role === "user"
    if (decoded.role === "user") {
      const userRepo = AppDataSource.getRepository(User);

      const user = await userRepo.findOne({
        where: { id: decoded.id },
      });

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.isBlocked) {
        return res
          .status(403)
          .json({ message: "Your account is blocked." });
      }

      if (user.isDeleted) {
        return res
          .status(403)
          .json({ message: "Your account has been deleted." });
      }

      // attach full user entity
      (req as any).user = user;
    } else {
      // admin / other roles → trust token
      (req as any).user = decoded;
    }

    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
