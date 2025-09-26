import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.JWT_SECRET || "HOOK";

export const generateToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, SECRET_KEY);
};
