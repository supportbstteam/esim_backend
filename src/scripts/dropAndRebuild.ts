// src/scripts/dropAndRebuild.ts
import "reflect-metadata";
import { AppDataSource } from "../data-source";

(async () => {
  console.log("⚠️  Connecting to database...");

  try {
    const dataSource = await AppDataSource.initialize();
    console.log(`✅ Connected to database: ${AppDataSource.options.database}`);

    // Disable FK constraints (so we can drop everything)
    await dataSource.query("SET FOREIGN_KEY_CHECKS = 0;");

    console.log("💣 Dropping all tables...");
    for (const entity of dataSource.entityMetadatas) {
      const tableName = entity.tableName;
      try {
        await dataSource.query(`DROP TABLE IF EXISTS \`${tableName}\`;`);
        console.log(`🗑 Dropped table: ${tableName}`);
      } catch (err:any) {
        console.warn(`⚠️  Failed to drop ${tableName}:`, err.message);
      }
    }

    await dataSource.query("SET FOREIGN_KEY_CHECKS = 1;");
    console.log("✅ All tables dropped successfully!");

    console.log("🔁 Rebuilding schema from entities...");
    await dataSource.synchronize();
    console.log("✅ All tables recreated successfully!");

    await dataSource.destroy();
    console.log("🏁 Done!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during drop/rebuild:", err);
    process.exit(1);
  }
})();
