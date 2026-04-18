
import mysql from 'mysql2/promise';
import 'dotenv/config';

const dropTables = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'bookcity',
    port: parseInt(process.env.DB_PORT || '3306'),
    ssl: (process.env.DB_SSL === 'true' || process.env.DB_SSL === 'required') ? { rejectUnauthorized: false } : undefined
  });

  console.log('Подключение к базе данных для удаления таблиц...');

  try {
    // Отключаем проверку внешних ключей, чтобы удаление прошло без ошибок
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    const tables = [
      'order_items',
      'book_authors',
      'book_genres',
      'invoices',
      'orders',
      'books',
      'promotions',
      'genres',
      'authors',
      'publishers',
      'customers',
      'notifications'
    ];

    for (const table of tables) {
      console.log(`Удаление таблицы ${table}...`);
      await connection.query(`DROP TABLE IF EXISTS ${table}`);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('--- ОЧИСТКА ЗАВЕРШЕНА ---');
    console.log('Все таблицы успешно удалены. Теперь перезапустите сервер, чтобы он создал новую структуру.');
  } catch (error) {
    console.error('Ошибка при удалении таблиц:', error);
  } finally {
    await connection.end();
  }
};

dropTables();
