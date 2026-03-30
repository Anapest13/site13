import mysql from "mysql2/promise";
import "dotenv/config";

async function dropAllTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: (process.env.DB_SSL === 'true' || process.env.DB_SSL === 'required') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log("🚀 Disabling foreign key checks...");
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = (tables as any[]).map(t => Object.values(t)[0]);

    console.log(`📦 Found ${tableNames.length} tables. Dropping them...`);
    for (const table of tableNames) {
      await connection.query(`DROP TABLE IF EXISTS ${table}`);
      console.log(`✅ Dropped table: ${table}`);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log("✨ All tables dropped successfully!");
  } catch (error) {
    console.error("❌ Error dropping tables:", error);
  } finally {
    await connection.end();
  }
}

dropAllTables();
