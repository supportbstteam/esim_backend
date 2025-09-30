import { AppDataSource } from "../data-source";

let isDataSourceInitialized = false;

export const connectDB = async () => {
  if (!isDataSourceInitialized) {
    await AppDataSource.initialize();
    isDataSourceInitialized = true;
    console.log("📦 Data Source initialized");
    console.log("📦 Loaded entities:", AppDataSource.entityMetadatas.map(e => e.name));
  }
  return AppDataSource;
};
