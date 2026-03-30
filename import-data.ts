import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import "dotenv/config";

async function importData() {
  const dbHost = process.env.DB_HOST;
  const dbPort = parseInt(process.env.DB_PORT || '3306');
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME;
  const dbSslValue = (process.env.DB_SSL || '').toLowerCase();
  const dbSsl = (dbSslValue === 'true' || dbSslValue === 'required') ? { rejectUnauthorized: false } : undefined;

  if (!dbHost || !dbUser || !dbPassword || !dbName) {
    console.error("❌ Ошибка: Не все переменные окружения (DB_...) установлены в .env файле.");
    process.exit(1);
  }

  console.log(`\n🚀 Начинаю импорт данных в ${dbHost}:${dbPort}...`);
  console.log(`📦 База данных: ${dbName}`);
  console.log(`🔒 SSL: ${!!dbSsl}\n`);

  const connection = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    ssl: dbSsl,
    multipleStatements: true // Позволяет выполнять весь файл целиком
  });

  try {
    const sqlPath = path.join(process.cwd(), 'seed.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error("❌ Ошибка: Файл seed.sql не найден в корне проекта.");
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log("⏳ Подготовка SQL запросов...");
    
    // Разбиваем файл на отдельные запросы (по точке с запятой)
    // Учитываем, что точка с запятой может быть внутри текста, но для простых дампов это сработает
    const statements = sql
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .filter(s => {
        const upper = s.toUpperCase();
        // Убираем команды, которые Aiven запрещает
        return !upper.startsWith('CREATE DATABASE') && 
               !upper.startsWith('USE ') && 
               !upper.startsWith('DROP DATABASE');
      });

    console.log(`📊 Найдено ${statements.length} запросов. Начинаю выполнение...`);
    
    // Отключаем проверку внешних ключей
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    for (let i = 0; i < statements.length; i++) {
      try {
        await connection.query(statements[i]);
        if (i % 10 === 0 || i === statements.length - 1) {
          console.log(`⏳ Прогресс: ${i + 1}/${statements.length}`);
        }
      } catch (stmtError) {
        console.warn(`⚠️ Пропущен запрос ${i + 1} из-за ошибки:`, (stmtError as Error).message);
      }
    }
    
    // Включаем обратно
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log("\n✅ Импорт завершен!");
  } catch (error) {
    console.error("❌ Ошибка при импорте:");
    console.error(error);
  } finally {
    await connection.end();
    console.log("\n👋 Соединение закрыто.");
  }
}

importData();
