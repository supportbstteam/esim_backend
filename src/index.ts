import "reflect-metadata";
import "dotenv/config";
import app from "./app";
import { AppDataSource } from "./data-source";

let isInitialized = false;

export default async function handler(req: any, res: any) {
  if (!isInitialized) {
    await AppDataSource.initialize();
    isInitialized = true;

    console.log(
      "📦 Entities loaded:",
      AppDataSource.entityMetadatas.map(e => e.name)
    );
  }

  return app(req, res);
}