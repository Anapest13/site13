import mysql from "mysql2/promise";
import "dotenv/config";

async function inspectSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: (process.env.DB_SSL === 'true' || process.env.DB_SSL === 'required') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const tables = ['authors', 'publishers', 'notifications', 'books'];
    for (const table of tables) {
      console.log(`\n--- Schema for ${table} ---`);
      const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
      console.table(columns);
    }
  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

inspectSchema();
