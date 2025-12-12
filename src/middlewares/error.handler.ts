import { Request, Response, NextFunction } from "express";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("[ErrorHandler]", err.stack);
  res.status(500).json({ message: "Internal Server Error" });
};
