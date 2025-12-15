import "reflect-metadata";
import "dotenv/config";
import app from "./app";
import { AppDataSource } from "./data-source";

let initialized = false;

export default async function handler(req: any, res: any) {
  if (!initialized) {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("📦 DB initialized");
    }
    initialized = true;
  }

  return app(req, res);
}
