
import mysql from 'mysql2/promise';
import 'dotenv/config';

const wipeData = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'bookcity',
    port: parseInt(process.env.DB_PORT || '3306'),
    ssl: (process.env.DB_SSL === 'true' || process.env.DB_SSL === 'required') ? { rejectUnauthorized: false } : undefined
  });

  console.log('Connecting to database...');

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    console.log('Wiping book authors...');
    await connection.query('TRUNCATE TABLE book_authors');
    
    console.log('Wiping book genres...');
    await connection.query('TRUNCATE TABLE book_genres');
    
    console.log('Wiping order items...');
    await connection.query('TRUNCATE TABLE order_items');
    
    console.log('Wiping invoices...');
    await connection.query('TRUNCATE TABLE invoices');
    
    console.log('Wiping books...');
    await connection.query('TRUNCATE TABLE books');
    
    // Optional: wipe publishers and authors if requested, but user specifically said "books"
    // await connection.query('TRUNCATE TABLE publishers');
    // await connection.query('TRUNCATE TABLE authors');

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('--- WIPE COMPLETE ---');
    console.log('All books and related order data have been cleared.');
  } catch (error) {
    console.error('Error wiping data:', error);
  } finally {
    await connection.end();
  }
};

wipeData();
