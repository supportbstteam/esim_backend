import { Request, Response, NextFunction } from "express";

export const logger = (req:any, res: Response, next: NextFunction) => {
  // console.log(`[Logger] ${req.method} ${req.url}`);
  next();
};
