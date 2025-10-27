import { AppDataSource } from "../data-source";

export const clearDatabase = async () => {
    const connection = AppDataSource;
    const entities = connection.entityMetadatas;

    for (const entity of entities) {
        const repository = connection.getRepository(entity.name);
        await repository.query(`TRUNCATE TABLE \`${entity.tableName}\``);
    }

    console.log("✅ All tables truncated successfully.");
};