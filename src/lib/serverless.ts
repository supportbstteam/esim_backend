import { DataSource } from "typeorm";
import { AppDataSource } from "../data-source";

// Singleton instance
let AppDataSourceInstance: DataSource | null = null;

/**
 * Returns a single initialized DataSource instance.
 * Safe for serverless and multiple imports.
 */
export const getDataSource = async (): Promise<DataSource> => {
  if (AppDataSourceInstance) {
    // Already initialized
    if (AppDataSourceInstance.isInitialized) {
      return AppDataSourceInstance;
    }
    // If not initialized yet (rare)
    return await AppDataSourceInstance.initialize();
  }

  // First time initialization
  AppDataSourceInstance = AppDataSource;
  if (!AppDataSourceInstance.isInitialized) {
    await AppDataSourceInstance.initialize();
  }
  return AppDataSourceInstance;
};
