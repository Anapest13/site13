import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import path from "path";
import bcrypt from "bcryptjs";
import mysql from "mysql2";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import nodemailer from "nodemailer";

// Ensure images directory exists
const imagesDir = path.join(process.cwd(), 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename
    const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    cb(null, safeName);
  }
});
const upload = multer({ storage });

// MySQL Connection Pool
console.log('Environment variables:', Object.keys(process.env).filter(k => k.startsWith('DB_')));
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306');
const dbSslValue = (process.env.DB_SSL || '').toLowerCase();
const dbSsl = (dbSslValue === 'true' || dbSslValue === 'required') ? { rejectUnauthorized: false } : undefined;

console.log(`Attempting to connect to database at ${dbHost}:${dbPort} (SSL: ${!!dbSsl})`);

const pool = mysql.createPool({
  host: dbHost,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'bookcity',
  port: dbPort,
  ssl: dbSsl,
  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

pool.on('connection', (connection) => {
  console.log('Database connection established');
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

const query = async (sql: string, params?: any[], retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await new Promise<any>((resolve, reject) => {
        pool.query(sql, params, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
    } catch (err) {
      if (i === retries - 1) throw err;
      const isNetworkError = (err as any).code === 'ECONNRESET' || (err as any).code === 'PROTOCOL_CONNECTION_LOST';
      if (isNetworkError) {
        console.log(`Network error, retrying query (${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      } else {
        throw err;
      }
    }
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const sendReceiptEmail = async (orderId: number) => {
  try {
    console.log(`[Email Service] Starting receipt shipment for Order ID: ${orderId}...`);
    const orders = await query('SELECT * FROM orders WHERE order_id = ?', [orderId]);
    if (!orders || orders.length === 0) {
      console.warn(`[Email Service] Order with ID ${orderId} not found.`);
      return;
    }
    const order = orders[0];

    const customers = await query('SELECT * FROM customers WHERE customer_id = ?', [order.customer_id]);
    if (!customers || customers.length === 0) {
      console.warn(`[Email Service] Customer for Order ID ${orderId} not found.`);
      return;
    }
    const customer = customers[0];

    if (!customer.email) {
      console.warn(`[Email Service] Customer for Order ID ${orderId} does not have an email address.`);
      return;
    }

    const items = await query(`
      SELECT oi.*, b.title, b.isbn 
      FROM order_items oi 
      JOIN books b ON oi.book_id = b.book_id 
      WHERE oi.order_id = ?
    `, [orderId]);

    const orderTypeTranslations: Record<string, string> = {
      sale: 'Покупка',
      booking: 'Бронь',
      reservation: 'Резерв',
      preorder: 'Предзаказ'
    };

    const orderTypeStr = orderTypeTranslations[order.order_type] || order.order_type;

    const formattedDate = new Date(order.order_date).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Build invoice item list
    let itemHtmlRows = '';
    items.forEach((item: any) => {
      itemHtmlRows += `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB; text-align: left; vertical-align: top;">
            <div style="font-weight: bold; color: #1A1A1A; font-size: 14px;">${item.title}</div>
            ${item.isbn ? `<div style="font-size: 11px; color: #6B7280; margin-top: 2px;">ISBN: ${item.isbn}</div>` : ''}
          </td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: center; color: #4B5563; font-size: 14px; vertical-align: top;">
            ${item.quantity} шт.
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: bold; color: #1A1A1A; font-size: 14px; vertical-align: top;">
            ${item.unit_price} ₽
          </td>
        </tr>
      `;
    });

    const isMissingYandexKeys = !process.env.YANDEX_USER || !process.env.YANDEX_PASSWORD;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Чек по заказу №${orderId}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F3F4F6; padding: 30px 10px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" style="max-width: 600px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #E5E7EB;" border="0" cellspacing="0" cellpadding="0">
                
                <!-- Header -->
                <tr>
                  <td style="padding: 40px; text-align: center; background-color: #1A1A1A; color: #FFFFFF;">
                    <div style="width: 48px; height: 48px; background-color: #4F46E5; border-radius: 12px; display: inline-block; line-height: 48px; font-weight: 900; font-size: 24px; color: #FFFFFF; margin-bottom: 16px; text-shadow: 0 2px 4px rgba(0,0,0,0.2)">К</div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; text-transform: uppercase;">Книга24</h1>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #9CA3AF;">Электронный чек по заказу №${orderId}</p>
                  </td>
                </tr>

                <!-- Order Summary Info -->
                <tr>
                  <td style="padding: 30px 40px 10px 40px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align: top; padding-bottom: 20px;">
                          <div style="font-size: 12px; color: #9CA3AF; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; margin-bottom: 4px;">Получатель</div>
                          <div style="font-size: 15px; font-weight: bold; color: #111827;">${customer.first_name} ${customer.last_name}</div>
                          <div style="font-size: 14px; color: #4B5563; margin-top: 2px;">${customer.email}</div>
                          ${customer.phone ? `<div style="font-size: 14px; color: #4B5563;">${customer.phone}</div>` : ''}
                        </td>
                        <td style="vertical-align: top; text-align: right; padding-bottom: 20px;">
                          <div style="font-size: 12px; color: #9CA3AF; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; margin-bottom: 4px;">Дата заказа</div>
                          <div style="font-size: 14px; color: #111827; font-weight: bold;">${formattedDate}</div>
                          <div style="margin-top: 8px;">
                            <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; text-transform: uppercase; background-color: #EEF2F6; color: #4F46E5;">
                              ${orderTypeStr}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding: 0 40px;">
                    <hr style="border: 0; border-top: 1px solid #F3F4F6; margin: 0;">
                  </td>
                </tr>

                <!-- Item details -->
                <tr>
                  <td style="padding: 20px 40px 10px 40px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <thead>
                        <tr>
                          <th style="padding-bottom: 12px; border-bottom: 2px solid #E5E7EB; text-align: left; font-size: 12px; text-transform: uppercase; color: #9CA3AF; font-weight: bold; letter-spacing: 0.05em;">Товар</th>
                          <th style="padding-bottom: 12px; border-bottom: 2px solid #E5E7EB; text-align: center; font-size: 12px; text-transform: uppercase; color: #9CA3AF; font-weight: bold; letter-spacing: 0.05em; width: 60px;">Кол-во</th>
                          <th style="padding-bottom: 12px; border-bottom: 2px solid #E5E7EB; text-align: right; font-size: 12px; text-transform: uppercase; color: #9CA3AF; font-weight: bold; letter-spacing: 0.05em; width: 100px;">Цена</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemHtmlRows}
                      </tbody>
                    </table>
                  </td>
                </tr>

                <!-- Totals -->
                <tr>
                  <td style="padding: 20px 40px 30px 40px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px;">
                      <tr>
                        <td style="width: 50%;"></td>
                        <td>
                          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 14px; color: #4B5563;">
                            <tr>
                              <td style="padding: 4px 0;">Сумма:</td>
                              <td style="text-align: right; font-weight: bold; color: #111827;">${order.total_amount} ₽</td>
                            </tr>
                            ${Number(order.discount_amount) > 0 ? `
                            <tr>
                              <td style="padding: 4px 0; color: #10B981;">Скидка:</td>
                              <td style="text-align: right; font-weight: bold; color: #10B981;">-${order.discount_amount} ₽</td>
                            </tr>` : ''}
                            <tr>
                              <td style="padding: 8px 0; border-top: 1px solid #F3F4F6; font-size: 16px; font-weight: bold; color: #111827;">Итого к оплате:</td>
                              <td style="padding: 8px 0; border-top: 1px solid #F3F4F6; text-align: right; font-size: 18px; font-weight: 900; color: #4F46E5;">${order.net_amount} ₽</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding: 0 40px;">
                    <hr style="border: 0; border-top: 1px solid #F3F4F6; margin: 0;">
                  </td>
                </tr>

                <!-- Delivery & Payment -->
                <tr>
                  <td style="padding: 30px 40px;">
                    <div style="background-color: #F9FAFB; border-radius: 16px; padding: 20px; border: 1px solid #F3F4F6;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="vertical-align: top; padding-right: 15px;">
                            <div style="font-size: 12px; color: #9CA3AF; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; margin-bottom: 4px;">Адрес доставки</div>
                            <div style="font-size: 14px; color: #374151; font-weight: 500; line-height: 1.5;">${order.shipping_address || 'Самовывоз / Не указан'}</div>
                          </td>
                          <td style="vertical-align: top; width: 45%;">
                            <div style="font-size: 12px; color: #9CA3AF; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; margin-bottom: 4px;">Способ оплаты</div>
                            <div style="font-size: 14px; color: #047857; font-weight: bold;">Оплата при получении</div>
                            <div style="font-size: 12px; color: #065F46; margin-top: 2px;">Наличными или картой курьеру</div>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>

                <!-- Footer disclaimer -->
                <tr>
                  <td style="padding: 30px 40px 40px 40px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center;">
                    <p style="margin: 0; font-size: 14px; font-weight: bold; color: #4B5563;">Спасибо за покупку в Книга24!</p>
                    <p style="margin: 6px 0 0 0; font-size: 12px; color: #9CA3AF;">Если у вас остались вопросы, обратитесь в нашу службу поддержки.</p>
                    ${isMissingYandexKeys ? `
                    <div style="margin-top: 15px; padding: 10px; background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; font-size: 11px; color: #92400E; text-align: center; font-weight: bold;">
                      [Внимание] Письмо создано в режиме тестирования (данные SMTP не заполнены в .env).
                    </div>` : ''}
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    if (isMissingYandexKeys) {
      console.warn(`[Email Service] Yandex SMTP credentials (YANDEX_USER and YANDEX_PASSWORD) are not configured. Email to ${customer.email} will not be sent physically.`);
      console.log(`[Email Service] Receipt Preview HTML generated successfully for ${customer.email}.`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.yandex.ru',
      port: 465,
      secure: true,
      auth: {
        user: process.env.YANDEX_USER,
        pass: process.env.YANDEX_PASSWORD
      }
    });

    const mailOptions = {
      from: `"Книга24" <${process.env.YANDEX_USER}>`,
      to: customer.email,
      subject: `Электронный чек по заказу №${orderId} — Интернет-магазин Книга24`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Receipt sent to ${customer.email} (Message ID: ${info.messageId})`);
  } catch (error) {
    console.error(`[Email Service] Failed to send receipt email for Order ID ${orderId}:`, error);
  }
};

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const PORT = 3000;

  // --- AUTH ---
  app.get('/api/health', async (req, res) => {
    let dbStatus = 'unknown';
    let dbError = null;
    try {
      await query('SELECT 1');
      dbStatus = 'connected';
    } catch (err) {
      dbStatus = 'error';
      dbError = (err as Error).message;
    }

    res.json({ 
      status: 'ok', 
      message: 'Server is running', 
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        error: dbError,
        config: {
          host: dbHost,
          port: dbPort,
          user: process.env.DB_USER || 'root',
          database: process.env.DB_NAME || 'bookcity'
        }
      },
      env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('DB_')))
    });
  });

  async function setupDatabase() {
    console.log('Starting database setup...');
    try {
      // Disable FK checks to allow modifying columns that are part of FKs
      await query('SET FOREIGN_KEY_CHECKS = 0');
      console.log('Foreign key checks disabled');

      await query(`CREATE TABLE IF NOT EXISTS customers (
        customer_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL
      )`);
      console.log('Customers table checked');
      await sleep(200);
      try { await query('ALTER TABLE customers MODIFY customer_id BIGINT UNSIGNED AUTO_INCREMENT'); } catch(e) {}
      await sleep(200);

      await query(`CREATE TABLE IF NOT EXISTS publishers (
        publisher_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20)
      )`);
      console.log('Publishers table checked');
      await sleep(200);
      try { await query('ALTER TABLE publishers MODIFY publisher_id BIGINT UNSIGNED AUTO_INCREMENT'); } catch(e) {}
      await sleep(200);

      await query(`CREATE TABLE IF NOT EXISTS authors (
        author_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        biography TEXT
      )`);
      console.log('Authors table checked');
      await sleep(200);
      try { await query('ALTER TABLE authors MODIFY author_id BIGINT UNSIGNED AUTO_INCREMENT'); } catch(e) {}
      await sleep(200);

      await query(`CREATE TABLE IF NOT EXISTS genres (
        genre_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE
      )`);
      console.log('Genres table checked');
      await sleep(200);
      try { await query('ALTER TABLE genres MODIFY genre_id BIGINT UNSIGNED AUTO_INCREMENT'); } catch(e) {}
      await sleep(200);

      await query(`CREATE TABLE IF NOT EXISTS books (
        book_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        isbn VARCHAR(20) UNIQUE,
        price DECIMAL(10, 2) NOT NULL,
        quantity_in_stock INT DEFAULT 0,
        reserved_quantity INT DEFAULT 0,
        publisher_id BIGINT UNSIGNED,
        publication_year INT,
        description TEXT,
        cover_image_url VARCHAR(500),
        pages_count INT DEFAULT NULL,
        cover_type ENUM('hard', 'soft') DEFAULT NULL,
        FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id)
      )`);
      console.log('Books table checked');
      try { await query('ALTER TABLE books MODIFY book_id BIGINT UNSIGNED AUTO_INCREMENT'); } catch(e) {}
      try { await query('ALTER TABLE books MODIFY publisher_id BIGINT UNSIGNED'); } catch(e) {}
      try { await query('ALTER TABLE books ADD COLUMN pages_count INT DEFAULT NULL'); } catch(e) {}
      try { await query("ALTER TABLE books MODIFY COLUMN cover_type ENUM('hard', 'soft') DEFAULT NULL"); } catch(e) {}

      await query(`CREATE TABLE IF NOT EXISTS promotions (
        promotion_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        start_date DATE,
        end_date DATE,
        discount_type ENUM('percentage', 'fixed') NOT NULL,
        discount_value DECIMAL(10, 2) NOT NULL,
        code_word VARCHAR(50),
        usage_limit INT DEFAULT NULL,
        used_count INT DEFAULT 0,
        is_active BOOLEAN DEFAULT 1
      )`);
      try { await query('ALTER TABLE promotions MODIFY promotion_id BIGINT UNSIGNED AUTO_INCREMENT'); } catch(e) {}
      try { await query('ALTER TABLE promotions ADD COLUMN usage_limit INT DEFAULT NULL AFTER code_word'); } catch(e) {}
      try { await query('ALTER TABLE promotions ADD COLUMN used_count INT DEFAULT 0 AFTER usage_limit'); } catch(e) {}

      await query(`CREATE TABLE IF NOT EXISTS orders (
        order_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        customer_id BIGINT UNSIGNED,
        order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        order_type ENUM('sale', 'booking', 'reservation', 'preorder') DEFAULT 'sale',
        total_amount DECIMAL(10, 2) NOT NULL,
        discount_amount DECIMAL(10, 2) DEFAULT 0,
        net_amount DECIMAL(10, 2) NOT NULL,
        promotion_id BIGINT UNSIGNED,
        status VARCHAR(50) DEFAULT 'pending',
        shipping_address TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (promotion_id) REFERENCES promotions(promotion_id)
      )`);
      try { await query('ALTER TABLE orders MODIFY order_id BIGINT UNSIGNED AUTO_INCREMENT'); } catch(e) {}
      try { await query('ALTER TABLE orders MODIFY customer_id BIGINT UNSIGNED'); } catch(e) {}
      try { await query('ALTER TABLE orders MODIFY promotion_id BIGINT UNSIGNED'); } catch(e) {}
      try { await query('ALTER TABLE orders ADD COLUMN shipping_address TEXT'); } catch(e) {}
      try { 
        // Ensure the enum is correct even if the table already existed and remove any check constraints
        // Ensure orders table is correct and drop problematic constraints
      try {
        await query(`
          ALTER TABLE orders 
          MODIFY COLUMN order_type ENUM('sale', 'booking', 'reservation', 'preorder') DEFAULT 'sale'
        `);
      } catch (e) { console.log('Enum update skipped or failed'); }

      // Try to drop the check constraint if it exists (MySQL 8.0.16+)
      try {
        await query("ALTER TABLE orders DROP CONSTRAINT orders_chk_1");
      } catch (e) { /* ignore if not exists */ }
      try {
        await query("ALTER TABLE orders DROP CONSTRAINT orders_chk_2");
      } catch (e) { /* ignore if not exists */ }
      
      // Re-add the constraint if needed, or just let ENUM handle it
      // Actually, dropping it is usually enough if the ENUM is correct.
        // Some MySQL versions create a check constraint for ENUMs automatically, we try to drop it if it's causing issues
        // but since we don't know the name, we just ensure the column is correctly defined.
      } catch(e) {
        console.error('Error updating orders enum:', e);
      }

      await query(`CREATE TABLE IF NOT EXISTS book_authors (
        book_id BIGINT UNSIGNED,
        author_id BIGINT UNSIGNED,
        PRIMARY KEY (book_id, author_id),
        FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES authors(author_id) ON DELETE CASCADE
      )`);
      try { await query('ALTER TABLE book_authors MODIFY book_id BIGINT UNSIGNED'); } catch(e) {}
      try { await query('ALTER TABLE book_authors MODIFY author_id BIGINT UNSIGNED'); } catch(e) {}

      await query(`CREATE TABLE IF NOT EXISTS book_genres (
        book_id BIGINT UNSIGNED,
        genre_id BIGINT UNSIGNED,
        PRIMARY KEY (book_id, genre_id),
        FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
        FOREIGN KEY (genre_id) REFERENCES genres(genre_id) ON DELETE CASCADE
      )`);
      try { await query('ALTER TABLE book_genres MODIFY book_id BIGINT UNSIGNED'); } catch(e) {}
      try { await query('ALTER TABLE book_genres MODIFY genre_id BIGINT UNSIGNED'); } catch(e) {}

      await query(`CREATE TABLE IF NOT EXISTS order_items (
        item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_id BIGINT UNSIGNED,
        book_id BIGINT UNSIGNED,
        quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(book_id)
      )`);
      try { await query('ALTER TABLE order_items MODIFY item_id BIGINT UNSIGNED AUTO_INCREMENT'); } catch(e) {}
      try { await query('ALTER TABLE order_items MODIFY order_id BIGINT UNSIGNED'); } catch(e) {}
      try { await query('ALTER TABLE order_items MODIFY book_id BIGINT UNSIGNED'); } catch(e) {}

      await query(`CREATE TABLE IF NOT EXISTS invoices (
        invoice_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_id BIGINT UNSIGNED,
        invoice_number VARCHAR(50) UNIQUE,
        total_amount DECIMAL(10, 2) NOT NULL,
        paid_status BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )`);
      try { await query('ALTER TABLE invoices MODIFY invoice_id BIGINT UNSIGNED AUTO_INCREMENT'); } catch(e) {}
      try { await query('ALTER TABLE invoices MODIFY order_id BIGINT UNSIGNED'); } catch(e) {}
      try {
        // Update foreign key to allow cascade delete
        await query('ALTER TABLE invoices DROP FOREIGN KEY invoices_ibfk_1');
        await query('ALTER TABLE invoices ADD CONSTRAINT invoices_ibfk_1 FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE');
      } catch (e) { /* ignore if constraint name different or already set */ }

      await query(`CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Re-enable FK checks
      await query('SET FOREIGN_KEY_CHECKS = 1');
      
      // Seed genres if empty
      const genresCount = await query('SELECT COUNT(*) as count FROM genres');
      if (genresCount[0].count === 0) {
        const defaultGenres = ['Художественная', 'Научпоп', 'Наука', 'Фантастика', 'Детектив', 'История', 'Классика', 'Детская'];
        for (const genre of defaultGenres) {
          await query('INSERT INTO genres (name) VALUES (?)', [genre]);
        }
      }

      // Seed admin if empty
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@bookcity.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const adminCount = await query("SELECT COUNT(*) as count FROM customers WHERE email = ?", [adminEmail]);
      if (adminCount[0].count === 0) {
        const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
        await query(
          'INSERT INTO customers (first_name, last_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
          ['Admin', 'User', adminEmail, '0000', hashedAdminPassword]
        );
      }
    } catch (err) {
      console.error('Error setting up database:', err);
    }
  }

  async function seedMockData() {
    console.log('Checking if mock data needs to be seeded...');
    try {
      // 1. Publishers
      const publishersCount = await query('SELECT COUNT(*) as count FROM publishers');
      let defaultPublishers: any[] = [];
      if (publishersCount[0].count === 0) {
        await query("INSERT INTO publishers (name, email, phone) VALUES ('Альпина Паблишер', 'info@alpina.ru', '+7(495)120-01-10')");
        await query("INSERT INTO publishers (name, email, phone) VALUES ('Манн, Иванов и Фербер', 'support@mif.ru', '+7(495)648-60-20')");
        await query("INSERT INTO publishers (name, email, phone) VALUES ('Эксмо', 'customer@eksmo.ru', '+7(495)411-68-86')");
      }
      defaultPublishers = await query('SELECT * FROM publishers');

      // 2. Authors
      const authorsCount = await query('SELECT COUNT(*) as count FROM authors');
      let defaultAuthors: any[] = [];
      if (authorsCount[0].count === 0) {
        await query("INSERT INTO authors (name, biography) VALUES ('Айзек Азимов', 'Американский писатель-фантаст, популяризатор науки')");
        await query("INSERT INTO authors (name, biography) VALUES ('Роберт Кийосаки', 'Американский предприниматель, инвестор, автор бестселлеров')");
        await query("INSERT INTO authors (name, biography) VALUES ('Дж. К. Роулинг', 'Британская писательница, автор серии романов о Гарри Поттере')");
      }
      defaultAuthors = await query('SELECT * FROM authors');

      // 3. Books
      const booksCount = await query('SELECT COUNT(*) as count FROM books');
      let defaultBooks: any[] = [];
      if (booksCount[0].count === 0) {
        const b1Result = await query(
          `INSERT INTO books (title, isbn, price, quantity_in_stock, publisher_id, publication_year, description, pages_count, cover_type) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'Основание', 
            '9785171120467', 
            750.00, 
            45, 
            defaultPublishers[0].publisher_id, 
            2021, 
            'Великая классика научной фантастики об упадке Галактической Империи.', 
            320, 
            'hard'
          ]
        );
        const book1Id = b1Result.insertId;

        const b2Result = await query(
          `INSERT INTO books (title, isbn, price, quantity_in_stock, publisher_id, publication_year, description, pages_count, cover_type) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'Богатый папа, бедный папа', 
            '9785171093112', 
            650.00, 
            60, 
            defaultPublishers[1].publisher_id, 
            2019, 
            'Книга по финансовой грамотности для всех слоев населения.', 
            350, 
            'soft'
          ]
        );
        const book2Id = b2Result.insertId;

        const b3Result = await query(
          `INSERT INTO books (title, isbn, price, quantity_in_stock, publisher_id, publication_year, description, pages_count, cover_type) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'Гарри Поттер и философский камень', 
            '9785389074354', 
            950.00, 
            30, 
            defaultPublishers[2].publisher_id, 
            2020, 
            'Первая книга знаменитой серии романов об обучении молодого волшебника.', 
            400, 
            'hard'
          ]
        );
        const book3Id = b3Result.insertId;

        await query('INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)', [book1Id, defaultAuthors[0].author_id]);
        await query('INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)', [book2Id, defaultAuthors[1].author_id]);
        await query('INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)', [book3Id, defaultAuthors[2].author_id]);

        const gFantas = await query("SELECT genre_id FROM genres WHERE name = 'Фантастика'");
        const gSciPop = await query("SELECT genre_id FROM genres WHERE name = 'Научпоп'");
        const gFiction = await query("SELECT genre_id FROM genres WHERE name = 'Художественная'");

        if (gFantas.length > 0) await query('INSERT INTO book_genres (book_id, genre_id) VALUES (?, ?)', [book1Id, gFantas[0].genre_id]);
        if (gSciPop.length > 0) await query('INSERT INTO book_genres (book_id, genre_id) VALUES (?, ?)', [book2Id, gSciPop[0].genre_id]);
        if (gFiction.length > 0) await query('INSERT INTO book_genres (book_id, genre_id) VALUES (?, ?)', [book3Id, gFiction[0].genre_id]);
      }
      defaultBooks = await query('SELECT * FROM books');

      // 4. Promotions
      const promotionsCount = await query('SELECT COUNT(*) as count FROM promotions');
      let defaultPromos: any[] = [];
      if (promotionsCount[0].count === 0) {
        const now = new Date();
        const p1Start = new Date(); p1Start.setDate(now.getDate() - 15);
        const p1End = new Date(); p1End.setDate(now.getDate() - 5);
        
        const p2Start = new Date(); p2Start.setDate(now.getDate() - 4);
        const p2End = new Date(); p2End.setDate(now.getDate() + 1);

        const p3Start = new Date(); p3Start.setDate(now.getDate() + 2);
        const p3End = new Date(); p3End.setDate(now.getDate() + 12);

        await query(
          'INSERT INTO promotions (name, start_date, end_date, discount_type, discount_value, code_word, usage_limit, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
          ['Весенняя распродажа', p1Start.toISOString().split('T')[0], p1End.toISOString().split('T')[0], 'fixed', 100.00, 'SPRING100', 100]
        );
        await query(
          'INSERT INTO promotions (name, start_date, end_date, discount_type, discount_value, code_word, usage_limit, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
          ['Неделя фантастики', p2Start.toISOString().split('T')[0], p2End.toISOString().split('T')[0], 'percentage', 15.00, 'SCIFI15', 50]
        );
        await query(
          'INSERT INTO promotions (name, start_date, end_date, discount_type, discount_value, code_word, usage_limit, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
          ['Летнее чтение', p3Start.toISOString().split('T')[0], p3End.toISOString().split('T')[0], 'percentage', 10.00, 'SUMMER10', 200]
        );
      }
      defaultPromos = await query('SELECT * FROM promotions');

      // 5. Customers
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@bookcity.com';
      const customersCount = await query('SELECT COUNT(*) as count FROM customers WHERE email != ?', [adminEmail]);
      let defaultCustomers: any[] = [];
      if (customersCount[0].count === 0) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        await query(
          'INSERT INTO customers (first_name, last_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
          ['Иван', 'Иванов', 'ivan@mail.ru', '+7(900)123-45-67', hashedPassword]
        );
        await query(
          'INSERT INTO customers (first_name, last_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
          ['Мария', 'Смирнова', 'maria@yandex.ru', '+7(900)765-43-21', hashedPassword]
        );
        await query(
          'INSERT INTO customers (first_name, last_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
          ['Алексей', 'Петров', 'alex@gmail.com', '+7(911)111-22-33', hashedPassword]
        );
      }
      defaultCustomers = await query("SELECT * FROM customers WHERE email != ?", [adminEmail]);

      // 6. Orders
      const ordersCount = await query('SELECT COUNT(*) as count FROM orders');
      if (ordersCount[0].count === 0 && defaultBooks.length >= 3 && defaultPromos.length >= 2 && defaultCustomers.length >= 3) {
        const promoSpring = defaultPromos.find(p => p.name === 'Весенняя распродажа');
        const promoScifi = defaultPromos.find(p => p.name === 'Неделя фантастики');
        
        const now = new Date();

        // Ivanov buys Book 2 (Before Promo 1)
        const dateBeforeP1_A = new Date(); dateBeforeP1_A.setDate(now.getDate() - 20);
        const totalA = defaultBooks[1].price;
        const ordBeforeA = await query(
          `INSERT INTO orders (customer_id, order_date, order_type, total_amount, discount_amount, net_amount, status, shipping_address) 
           VALUES (?, ?, 'sale', ?, 0, ?, 'completed', 'г. Москва, ул. Ленина, д. 5')`,
          [defaultCustomers[0].customer_id, dateBeforeP1_A.toISOString().slice(0, 19).replace('T', ' '), totalA, totalA]
        );
        await query(`INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES (?, ?, 1, ?)`, [ordBeforeA.insertId, defaultBooks[1].book_id, defaultBooks[1].price]);
        await query(`INSERT INTO invoices (order_id, invoice_number, total_amount, paid_status) VALUES (?, ?, ?, 1)`, [ordBeforeA.insertId, `INV-SEED-${ordBeforeA.insertId}`, totalA]);

        // Smirnova buys Book 1 (Before Promo 1)
        const dateBeforeP1_B = new Date(); dateBeforeP1_B.setDate(now.getDate() - 18);
        const totalB = defaultBooks[0].price;
        const ordBeforeB = await query(
          `INSERT INTO orders (customer_id, order_date, order_type, total_amount, discount_amount, net_amount, status, shipping_address) 
           VALUES (?, ?, 'sale', ?, 0, ?, 'completed', 'г. Санкт-Петербург, Невский пр-т, д. 10')`,
          [defaultCustomers[1].customer_id, dateBeforeP1_B.toISOString().slice(0, 19).replace('T', ' '), totalB, totalB]
        );
        await query(`INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES (?, ?, 1, ?)`, [ordBeforeB.insertId, defaultBooks[0].book_id, defaultBooks[0].price]);
        await query(`INSERT INTO invoices (order_id, invoice_number, total_amount, paid_status) VALUES (?, ?, ?, 1)`, [ordBeforeB.insertId, `INV-SEED-${ordBeforeB.insertId}`, totalB]);

        // Ivanov buys Book 1 with SPRING100 promo (During Promo 1)
        if (promoSpring) {
          const dateDuringP1_A = new Date(); dateDuringP1_A.setDate(now.getDate() - 10);
          const totalDuringA = defaultBooks[0].price;
          const netDuringA = Math.max(0, totalDuringA - 100.00);
          const ordDuringA = await query(
            `INSERT INTO orders (customer_id, order_date, order_type, total_amount, discount_amount, net_amount, promotion_id, status, shipping_address) 
             VALUES (?, ?, 'sale', ?, 100, ?, ?, 'completed', 'г. Москва, ул. Ленина, д. 5')`,
            [defaultCustomers[0].customer_id, dateDuringP1_A.toISOString().slice(0, 19).replace('T', ' '), totalDuringA, netDuringA, promoSpring.promotion_id]
          );
          await query(`INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES (?, ?, 1, ?)`, [ordDuringA.insertId, defaultBooks[0].book_id, defaultBooks[0].price]);
          await query(`INSERT INTO invoices (order_id, invoice_number, total_amount, paid_status) VALUES (?, ?, ?, 1)`, [ordDuringA.insertId, `INV-SEED-${ordDuringA.insertId}`, netDuringA]);

          // Petrov buys Book 1 and Book 3 with SPRING100 promo (During Promo 1)
          const dateDuringP1_B = new Date(); dateDuringP1_B.setDate(now.getDate() - 8);
          const totalDuringB = Number(defaultBooks[0].price) + Number(defaultBooks[2].price);
          const netDuringB = totalDuringB - 100.00;
          const ordDuringB = await query(
            `INSERT INTO orders (customer_id, order_date, order_type, total_amount, discount_amount, net_amount, promotion_id, status, shipping_address) 
             VALUES (?, ?, 'sale', ?, 100, ?, ?, 'completed', 'г. Казань, ул. Баумана, д. 12')`,
            [defaultCustomers[2].customer_id, dateDuringP1_B.toISOString().slice(0, 19).replace('T', ' '), totalDuringB, netDuringB, promoSpring.promotion_id]
          );
          await query(`INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES (?, ?, 1, ?)`, [ordDuringB.insertId, defaultBooks[0].book_id, defaultBooks[0].price]);
          await query(`INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES (?, ?, 1, ?)`, [ordDuringB.insertId, defaultBooks[2].book_id, defaultBooks[2].price]);
          await query(`INSERT INTO invoices (order_id, invoice_number, total_amount, paid_status) VALUES (?, ?, ?, 1)`, [ordDuringB.insertId, `INV-SEED-${ordDuringB.insertId}`, netDuringB]);
        }

        // Smirnova buys Book 3 (Before Promo 2)
        const dateBeforeP2_A = new Date(); dateBeforeP2_A.setDate(now.getDate() - 6);
        const totalC = defaultBooks[2].price;
        const ordBeforeC = await query(
          `INSERT INTO orders (customer_id, order_date, order_type, total_amount, discount_amount, net_amount, status, shipping_address) 
           VALUES (?, ?, 'sale', ?, 0, ?, 'completed', 'г. Санкт-Петербург, Невский пр-т, д. 10')`,
          [defaultCustomers[1].customer_id, dateBeforeP2_A.toISOString().slice(0, 19).replace('T', ' '), totalC, totalC]
        );
        await query(`INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES (?, ?, 1, ?)`, [ordBeforeC.insertId, defaultBooks[2].book_id, defaultBooks[2].price]);
        await query(`INSERT INTO invoices (order_id, invoice_number, total_amount, paid_status) VALUES (?, ?, ?, 1)`, [ordBeforeC.insertId, `INV-SEED-${ordBeforeC.insertId}`, totalC]);

        // Ivanov buys Book 1 with SCIFI15 promo (During Promo 2 - 15% discount)
        if (promoScifi) {
          const dateDuringP2_A = new Date(); dateDuringP2_A.setDate(now.getDate() - 3);
          const totalDuringC = defaultBooks[0].price;
          const discC = Number((totalDuringC * 0.15).toFixed(2));
          const netDuringC = totalDuringC - discC;
          const ordDuringC = await query(
            `INSERT INTO orders (customer_id, order_date, order_type, total_amount, discount_amount, net_amount, promotion_id, status, shipping_address) 
             VALUES (?, ?, 'sale', ?, ?, ?, ?, 'completed', 'г. Москва, ул. Ленина, д. 5')`,
            [defaultCustomers[0].customer_id, dateDuringP2_A.toISOString().slice(0, 19).replace('T', ' '), totalDuringC, discC, netDuringC, promoScifi.promotion_id]
          );
          await query(`INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES (?, ?, 1, ?)`, [ordDuringC.insertId, defaultBooks[0].book_id, defaultBooks[0].price]);
          await query(`INSERT INTO invoices (order_id, invoice_number, total_amount, paid_status) VALUES (?, ?, ?, 1)`, [ordDuringC.insertId, `INV-SEED-${ordDuringC.insertId}`, netDuringC]);

          // Petrov preorders Book 2 with SCIFI15 promo (During Promo 2)
          const dateDuringP2_B = new Date(); dateDuringP2_B.setDate(now.getDate() - 1);
          const totalDuringD = defaultBooks[1].price;
          const discD = Number((totalDuringD * 0.15).toFixed(2));
          const netDuringD = totalDuringD - discD;
          const ordDuringD = await query(
            `INSERT INTO orders (customer_id, order_date, order_type, total_amount, discount_amount, net_amount, promotion_id, status, shipping_address) 
             VALUES (?, ?, 'preorder', ?, ?, ?, ?, 'preordered', 'г. Казань, ул. Баумана, д. 12')`,
            [defaultCustomers[2].customer_id, dateDuringP2_B.toISOString().slice(0, 19).replace('T', ' '), totalDuringD, discD, netDuringD, promoScifi.promotion_id]
          );
          await query(`INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES (?, ?, 1, ?)`, [ordDuringD.insertId, defaultBooks[1].book_id, defaultBooks[1].price]);
          await query(`INSERT INTO invoices (order_id, invoice_number, total_amount, paid_status) VALUES (?, ?, ?, 1)`, [ordDuringD.insertId, `INV-SEED-${ordDuringD.insertId}`, netDuringD]);
        }
        
        console.log('Mock database seeding successfully completed!');
      } else {
        console.log('Database already has order data or dependencies are not met.');
      }
    } catch (err) {
      console.error('Error seeding mock database:', err);
    }
  }

  await setupDatabase();
  await seedMockData();

  app.post('/api/register', async (req, res) => {
    const { first_name, last_name, email, phone, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password || 'password123', 10);
      const result = await query(
        'INSERT INTO customers (first_name, last_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
        [first_name, last_name, email, phone, hashedPassword]
      );
      res.json({ message: 'Регистрация успешна', id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка регистрации (возможно, email занят)' });
    }
  });

  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const users = await query('SELECT * FROM customers WHERE email = ?', [email]);
      if (users.length === 0) return res.status(401).json({ error: 'Неверный логин или пароль' });
      
      const user = users[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) return res.status(401).json({ error: 'Неверный логин или пароль' });

      const adminEmail = process.env.ADMIN_EMAIL || 'admin@bookcity.com';
      user.isAdmin = user.email === adminEmail; 
      
      await query('UPDATE customers SET last_login = NOW() WHERE customer_id = ?', [user.customer_id]);
      
      const { password_hash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/clients', async (req, res) => {
    try {
      const results = await query('SELECT customer_id as id, first_name, last_name, CONCAT(first_name, \' \', last_name) as full_name, email, phone, registration_date as created_at, last_login FROM customers');
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/clients', async (req, res) => {
    const { first_name, last_name, email, phone, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password || 'password123', 10);
      const result = await query(
        'INSERT INTO customers (first_name, last_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
        [first_name, last_name, email, phone, hashedPassword]
      );
      res.json({ message: 'Client added', id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/clients/:id', async (req, res) => {
    const { first_name, last_name, email, phone } = req.body;
    try {
      await query(
        'UPDATE customers SET first_name=?, last_name=?, email=?, phone=? WHERE customer_id=?',
        [first_name, last_name, email, phone, req.params.id]
      );
      res.json({ message: 'Client updated' });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  app.delete('/api/clients/:id', async (req, res) => {
    try {
      await query('DELETE FROM customers WHERE customer_id = ?', [req.params.id]);
      res.json({ message: 'Client deleted' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- BOOKS & MANAGEMENT ---
  app.get('/api/genres', async (req, res) => {
    try {
      res.json(await query('SELECT * FROM genres'));
    } catch (err) { res.status(500).json(err); }
  });

  app.get('/api/books', async (req, res) => {
    const { search, genre_id, publisher_id, author_id, year, min_stock, sort, publisher_name, author_name } = req.query;
    try {
      let sql = `
        SELECT b.*, p.name as publisher_name, p.email as publisher_email, p.phone as publisher_phone,
               (SELECT COUNT(*) FROM order_items oi WHERE oi.book_id = b.book_id) as sales_count
        FROM books b 
        LEFT JOIN publishers p ON b.publisher_id = p.publisher_id
      `;
      const params: any[] = [];
      const conditions: string[] = [];
      
      if (search) {
        conditions.push(`(
          LOWER(b.title) LIKE LOWER(?) 
          OR LOWER(b.isbn) LIKE LOWER(?) 
          OR LOWER(b.description) LIKE LOWER(?) 
          OR b.book_id IN (SELECT ba.book_id FROM book_authors ba JOIN authors a ON ba.author_id = a.author_id WHERE LOWER(a.name) LIKE LOWER(?))
          OR LOWER(p.name) LIKE LOWER(?)
        )`);
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
      }

      if (publisher_name) {
        conditions.push(`LOWER(p.name) LIKE LOWER(?)`);
        params.push(`%${publisher_name}%`);
      }

      if (author_name) {
        conditions.push(`b.book_id IN (SELECT ba.book_id FROM book_authors ba JOIN authors a ON ba.author_id = a.author_id WHERE LOWER(a.name) LIKE LOWER(?))`);
        params.push(`%${author_name}%`);
      }
      
      if (genre_id) {
        conditions.push(`b.book_id IN (SELECT book_id FROM book_genres WHERE genre_id = ?)`);
        params.push(genre_id);
      }

      if (publisher_id) {
        conditions.push(`b.publisher_id = ?`);
        params.push(publisher_id);
      }

      if (author_id) {
        conditions.push(`b.book_id IN (SELECT book_id FROM book_authors WHERE author_id = ?)`);
        params.push(author_id);
      }

      if (year) {
        conditions.push(`b.publication_year = ?`);
        params.push(year);
      }

      if (min_stock) {
        conditions.push(`b.quantity_in_stock >= ?`);
        params.push(min_stock);
      }
      
      if (conditions.length > 0) {
        sql += ` WHERE ` + conditions.join(' AND ');
      }

      if (sort === 'price_asc') sql += ` ORDER BY b.price ASC`;
      else if (sort === 'price_desc') sql += ` ORDER BY b.price DESC`;
      else if (sort === 'stock_asc') sql += ` ORDER BY b.quantity_in_stock ASC`;
      else if (sort === 'stock_desc') sql += ` ORDER BY b.quantity_in_stock DESC`;
      else if (sort === 'newest') sql += ` ORDER BY b.publication_year DESC`;
      else sql += ` ORDER BY b.book_id DESC`;
      
      const results = await query(sql, params);
      const booksWithDetails = await Promise.all(results.map(async (book: any) => {
        const authors = await query(`
          SELECT a.author_id, a.name 
          FROM authors a 
          JOIN book_authors ba ON a.author_id = ba.author_id 
          WHERE ba.book_id = ?`, [book.book_id]);
          
        const genres = await query(`
          SELECT g.genre_id, g.name 
          FROM genres g 
          JOIN book_genres bg ON g.genre_id = bg.genre_id 
          WHERE bg.book_id = ?`, [book.book_id]);
          
        const authorsList = Array.isArray(authors) ? authors : [];
        const genresList = Array.isArray(genres) ? genres : [];

        return { 
          ...book, 
          author_ids: authorsList.map((a: any) => a.author_id), 
          authors_list: authorsList,
          genre_ids: genresList.map((g: any) => g.genre_id),
          genres_list: genresList
        };
      }));
      res.json(booksWithDetails);
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  app.post('/api/books', async (req, res) => {
    let { title, isbn, price, quantity_in_stock, publisher_id, author_ids, pages_count, cover_type, publisher_name, author_names, publication_year, description, cover_image_url, genre_ids } = req.body;
    
    try {
      // Robust ID handling
      let pId: number | null = !isNaN(Number(publisher_id)) && Number(publisher_id) !== 0 ? Number(publisher_id) : null;
      let aIds: number[] = Array.isArray(author_ids) ? author_ids.map(id => Number(id)).filter(id => !isNaN(id)) : [];

      // Dynamic publisher creation
      if (!pId && publisher_name && publisher_name.trim()) {
        const existingPub = await query('SELECT publisher_id FROM publishers WHERE name = ?', [publisher_name.trim()]);
        if (existingPub.length > 0) {
          pId = existingPub[0].publisher_id;
        } else {
          const newPub = await query('INSERT INTO publishers (name, email, phone) VALUES (?, ?, ?)', [publisher_name.trim(), "", ""]);
          pId = newPub.insertId;
        }
      }

      // Dynamic authors creation
      if (author_names && Array.isArray(author_names)) {
        for (const aName of author_names) {
          if (!aName || !aName.trim()) continue;
          const existingAuth = await query('SELECT author_id FROM authors WHERE name = ?', [aName.trim()]);
          if (existingAuth.length > 0) {
            if (!aIds.includes(existingAuth[0].author_id)) {
              aIds.push(existingAuth[0].author_id);
            }
          } else {
            const newAuth = await query('INSERT INTO authors (name, biography) VALUES (?, ?)', [aName.trim(), ""]);
            aIds.push(newAuth.insertId);
          }
        }
      }

      // Validation
      if (!title || !isbn || !pId || aIds.length === 0) {
        return res.status(400).json({ error: 'Заполните обязательные поля: название, ISBN, издательство и хотя бы одного автора' });
      }

      const result = await query(
        `INSERT INTO books (title, isbn, price, quantity_in_stock, publisher_id, publication_year, description, cover_image_url, pages_count, cover_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title, 
          isbn, 
          Number(price) || 0, 
          Number(quantity_in_stock) || 0, 
          pId, 
          Number(publication_year) || null, 
          description || null, 
          cover_image_url || null, 
          Number(pages_count) || null, 
          cover_type || null
        ]
      );
      const bookId = result.insertId;
      if (aIds.length > 0) {
        for (const authId of aIds) {
          await query('INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)', [bookId, authId]);
        }
      }
      if (genre_ids && genre_ids.length > 0) {
        for (const genId of genre_ids) {
          await query('INSERT INTO book_genres (book_id, genre_id) VALUES (?, ?)', [bookId, genId]);
        }
      }
      res.json({ message: 'Книга добавлена', id: bookId });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  app.put('/api/books/:id', async (req, res) => {
    let { title, isbn, price, quantity_in_stock, publisher_id, publication_year, description, cover_image_url, author_ids, genre_ids, pages_count, cover_type, publisher_name, author_names } = req.body;
    try {
      // Robust ID handling
      let pId: number | null = !isNaN(Number(publisher_id)) && Number(publisher_id) !== 0 ? Number(publisher_id) : null;
      let aIds: number[] = Array.isArray(author_ids) ? author_ids.map(id => Number(id)).filter(id => !isNaN(id)) : [];

      // Dynamic publisher creation
      if (!pId && publisher_name && publisher_name.trim()) {
        const existingPub = await query('SELECT publisher_id FROM publishers WHERE name = ?', [publisher_name.trim()]);
        if (existingPub.length > 0) {
          pId = existingPub[0].publisher_id;
        } else {
          const newPub = await query('INSERT INTO publishers (name, email, phone) VALUES (?, ?, ?)', [publisher_name.trim(), "", ""]);
          pId = newPub.insertId;
        }
      }

      // Dynamic authors creation
      if (author_names && Array.isArray(author_names)) {
        for (const aName of author_names) {
          if (!aName || !aName.trim()) continue;
          const existingAuth = await query('SELECT author_id FROM authors WHERE name = ?', [aName.trim()]);
          if (existingAuth.length > 0) {
            if (!aIds.includes(existingAuth[0].author_id)) {
              aIds.push(existingAuth[0].author_id);
            }
          } else {
            const newAuth = await query('INSERT INTO authors (name, biography) VALUES (?, ?)', [aName.trim(), ""]);
            aIds.push(newAuth.insertId);
          }
        }
      }

      if (!title || !isbn || !pId || aIds.length === 0) {
        return res.status(400).json({ error: 'Заполните обязательные поля: название, ISBN, издательство и хотя бы одного автора' });
      }

      await query(
        `UPDATE books SET title=?, isbn=?, price=?, quantity_in_stock=?, publisher_id=?, publication_year=?, description=?, cover_image_url=?, pages_count=?, cover_type=? WHERE book_id=?`,
        [
          title, 
          isbn, 
          Number(price) || 0, 
          Number(quantity_in_stock) || 0, 
          pId, 
          Number(publication_year) || null, 
          description || null, 
          cover_image_url || null, 
          Number(pages_count) || null, 
          cover_type || null, 
          req.params.id
        ]
      );
      
      // Update authors
      await query('DELETE FROM book_authors WHERE book_id = ?', [req.params.id]);
      if (aIds.length > 0) {
        for (const authId of aIds) {
          await query('INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)', [req.params.id, authId]);
        }
      }
      
      // Update genres
      await query('DELETE FROM book_genres WHERE book_id = ?', [req.params.id]);
      if (genre_ids && genre_ids.length > 0) {
        for (const genId of genre_ids) {
          await query('INSERT INTO book_genres (book_id, genre_id) VALUES (?, ?)', [req.params.id, genId]);
        }
      }
      
      res.json({ message: 'Книга обновлена' });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  app.delete('/api/books/:id', async (req, res) => {
    try {
      await query('DELETE FROM book_authors WHERE book_id = ?', [req.params.id]);
      await query('DELETE FROM books WHERE book_id = ?', [req.params.id]);
      res.json({ message: 'Книга удалена' });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  // --- DICTIONARIES ---
  app.get('/api/authors', async (req, res) => {
    try { res.json(await query('SELECT * FROM authors')); } catch (e) { res.status(500).json(e); }
  });
  app.post('/api/authors', async (req, res) => {
    try { await query('INSERT INTO authors (name, biography) VALUES (?, ?)', [req.body.name, req.body.biography]); res.json({msg:'OK'}); } catch (e) { res.status(500).json(e); }
  });

  app.get('/api/publishers', async (req, res) => {
    try { res.json(await query('SELECT * FROM publishers')); } catch (e) { res.status(500).json(e); }
  });
  app.post('/api/publishers', async (req, res) => {
    try { await query('INSERT INTO publishers (name, email, phone) VALUES (?, ?, ?)', [req.body.name, req.body.email, req.body.phone]); res.json({msg:'OK'}); } catch (e) { res.status(500).json(e); }
  });

  app.get('/api/promotions', async (req, res) => {
    try { res.json(await query('SELECT * FROM promotions')); } catch (e) { res.status(500).json(e); }
  });
  app.post('/api/promotions', async (req, res) => {
    try {
      const { name, start_date, end_date, discount_type, discount_value, code_word, usage_limit } = req.body;
      await query(
        'INSERT INTO promotions (name, start_date, end_date, discount_type, discount_value, code_word, usage_limit, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)', 
        [name, start_date, end_date, discount_type, discount_value, code_word, usage_limit || null]
      );
      res.json({ message: 'OK' });
    } catch (e) { res.status(500).json(e); }
  });

  app.put('/api/promotions/:id', async (req, res) => {
    const { name, start_date, end_date, discount_type, discount_value, code_word, is_active, usage_limit } = req.body;
    try {
      await query(
        'UPDATE promotions SET name=?, start_date=?, end_date=?, discount_type=?, discount_value=?, code_word=?, is_active=?, usage_limit=? WHERE promotion_id=?',
        [name, start_date, end_date, discount_type, discount_value, code_word, is_active, usage_limit, req.params.id]
      );
      res.json({ message: 'Promotion updated' });
    } catch (e) { res.status(500).json(e); }
  });

  app.delete('/api/promotions/:id', async (req, res) => {
    try {
      await query('DELETE FROM promotions WHERE promotion_id = ?', [req.params.id]);
      res.json({ message: 'Promotion deleted' });
    } catch (e) { res.status(500).json(e); }
  });

  // --- ORDERS & PROFILE ---
  app.get('/api/notifications', async (req, res) => {
    console.log('GET /api/notifications request received');
    try {
      const rows = await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20');
      res.json(rows);
    } catch (err) { 
      console.error('Error in GET /api/notifications:', err);
      res.status(500).json({ error: (err as Error).message || 'Internal Server Error' }); 
    }
  });

  app.post('/api/notifications/read', async (req, res) => {
    console.log('POST /api/notifications/read request received');
    try {
      await query('UPDATE notifications SET is_read = 1');
      res.json({ message: 'OK' });
    } catch (err) { 
      console.error('Error in POST /api/notifications/read:', err);
      res.status(500).json({ error: (err as Error).message || 'Internal Server Error' }); 
    }
  });

  app.get('/api/orders', async (req, res) => {
    const { all, client_id } = req.query;
    try {
      let sql = `
        SELECT o.*, CONCAT(c.first_name, ' ', c.last_name) as customer_name 
        FROM orders o 
        LEFT JOIN customers c ON o.customer_id = c.customer_id 
      `;
      const params: any[] = [];
      
      if (client_id) {
        sql += ' WHERE o.customer_id = ?';
        params.push(client_id);
      }
      
      sql += ' ORDER BY o.order_date DESC';
      
      if (all !== 'true' && !client_id) {
        sql += ' LIMIT 10';
      }
      
      const rows = await query(sql, params);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  app.post('/api/orders', async (req, res) => {
    const { customer_id, items, total_amount, net_amount, discount_amount, promotion_id, shipping_address } = req.body;
    
    // Validation
    if (!customer_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Некорректные данные заказа' });
    }

    try {
      // Check promotion usage limit
      if (promotion_id) {
        const promo = await query('SELECT usage_limit, used_count FROM promotions WHERE promotion_id = ?', [promotion_id]);
        if (promo[0] && promo[0].usage_limit !== null && promo[0].used_count >= promo[0].usage_limit) {
          return res.status(400).json({ error: 'Лимит использования промокода исчерпан' });
        }
      }

      // Determine overall order type (if mixed, default to sale)
      const order_type = items[0]?.order_type || 'sale';
      const status = order_type === 'sale' ? 'completed' : (order_type === 'preorder' ? 'preordered' : 'reserved');
      
      const orderRes = await query(
        'INSERT INTO orders (customer_id, order_type, total_amount, net_amount, discount_amount, promotion_id, status, shipping_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [customer_id, order_type, total_amount, net_amount, discount_amount || 0, promotion_id || null, status, shipping_address || '']
      );
      const orderId = orderRes.insertId;

      if (promotion_id) {
        await query('UPDATE promotions SET used_count = used_count + 1 WHERE promotion_id = ?', [promotion_id]);
      }

      for (const item of items) {
        // Stock validation for non-preorders
        if (item.order_type !== 'preorder') {
          const [bookStock] = await query('SELECT quantity_in_stock FROM books WHERE book_id = ?', [item.book_id]);
          if (!bookStock || bookStock.quantity_in_stock < item.quantity) {
             // If we already inserted order, this is problematic. 
             // In a real app we'd use transactions.
             // For now, let's just hope it doesn't happen often or we handle it gracefully.
             throw new Error(`Недостаточно товара на складе для книги ID: ${item.book_id}`);
          }
        }

        await query(
          'INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
          [orderId, item.book_id, item.quantity, item.unit_price]
        );
        
        if (item.order_type === 'sale') {
           await query('UPDATE books SET quantity_in_stock = GREATEST(0, quantity_in_stock - ?) WHERE book_id = ?', [item.quantity, item.book_id]);
           
           // Create invoice for each sale
           const invoiceNum = `INV-${Date.now()}-${Math.floor(Math.random()*1000)}`;
           await query(
             'INSERT INTO invoices (order_id, invoice_number, total_amount, paid_status) VALUES (?, ?, ?, 1)',
             [orderId, invoiceNum, item.unit_price * item.quantity]
           );
        } else if (item.order_type === 'booking' || item.order_type === 'reservation') {
           // For booking, we decrease stock and increase reserved
           await query('UPDATE books SET quantity_in_stock = GREATEST(0, quantity_in_stock - ?), reserved_quantity = reserved_quantity + ? WHERE book_id = ?', [item.quantity, item.quantity, item.book_id]);
        }
        // Pre-order doesn't affect stock immediately as it's out of stock anyway
      }
      
      // Add notification for admin
      await query('INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)', [
        'Новый заказ',
        `Создан новый заказ (${order_type}) на сумму ${net_amount} ₽`,
        order_type
      ]);

      // Asynchronously send detailed email receipt via Yandex Mail and App Password
      sendReceiptEmail(orderId).catch(err => console.error('[Email Service Error]', err));

      res.json({ message: 'Заказ создан', orderId });
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  app.get('/api/orders/user/:id', async (req, res) => {
    try {
      const orders = await query('SELECT * FROM orders WHERE customer_id = ? ORDER BY order_date DESC', [req.params.id]);
      const fullOrders = await Promise.all(orders.map(async (o: any) => {
        const items = await query('SELECT oi.*, b.title FROM order_items oi JOIN books b ON oi.book_id = b.book_id WHERE oi.order_id = ?', [o.order_id]);
        return { ...o, items };
      }));
      res.json(fullOrders);
    } catch (e) { res.status(500).json(e); }
  });

  app.get('/api/invoices', async (req, res) => {
    try {
      const { order_id } = req.query;
      let sql = 'SELECT * FROM invoices';
      let params: any[] = [];
      if (order_id) {
        sql += ' WHERE order_id = ?';
        params.push(order_id);
      }
      const results: any[] = await query(sql, params);
      
      // Fetch items for each invoice
      for (let inv of results) {
        inv.items = await query(`
          SELECT oi.*, b.title 
          FROM order_items oi 
          JOIN books b ON oi.book_id = b.book_id 
          WHERE oi.order_id = ?`, [inv.order_id]);
      }
      
      res.json(results);
    } catch (e) { res.status(500).json(e); }
  });

  app.get('/api/invoices/user/:id', async (req, res) => {
    try {
      const sql = `
        SELECT i.*, o.order_date 
        FROM invoices i 
        JOIN orders o ON i.order_id = o.order_id 
        WHERE o.customer_id = ?
        ORDER BY i.created_at DESC`;
      const invoices: any[] = await query(sql, [req.params.id]);
      
      for (let inv of invoices) {
        inv.items = await query(`
          SELECT oi.*, b.title 
          FROM order_items oi 
          JOIN books b ON oi.book_id = b.book_id 
          WHERE oi.order_id = ?`, [inv.order_id]);
      }
      
      res.json(invoices);
    } catch (e) { res.status(500).json(e); }
  });

  // --- ANALYTICS ---
  app.delete('/api/orders/:id', async (req, res) => {
    try {
      console.log(`Deleting order ${req.params.id}`);
      await query('DELETE FROM orders WHERE order_id = ?', [req.params.id]);
      res.json({ message: 'Order deleted' });
    } catch (err) { 
      console.error('Delete order error:', err);
      res.status(500).json({ error: (err as Error).message || 'Internal Server Error' }); 
    }
  });

  app.patch('/api/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
      const orderId = req.params.id;
      console.log(`Updating status of order ${orderId} to ${status}`);
      const [order] = await query('SELECT * FROM orders WHERE order_id = ?', [orderId]);
      
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });

      // If fulfilling a pre-order
      if (order.status === 'preordered' && status === 'completed') {
        const items = await query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
        for (const item of items) {
          // Decrease stock (if it's back in stock)
          await query('UPDATE books SET quantity_in_stock = GREATEST(0, quantity_in_stock - ?) WHERE book_id = ?', [item.quantity, item.book_id]);
          
          // Create invoice
          const invoiceNum = `INV-${Date.now()}-${Math.floor(Math.random()*1000)}`;
          await query(
            'INSERT INTO invoices (order_id, invoice_number, total_amount, paid_status) VALUES (?, ?, ?, 1)',
            [orderId, invoiceNum, item.unit_price * item.quantity]
          );
        }
        await query("UPDATE orders SET order_type = 'sale' WHERE order_id = ?", [orderId]);
      }

      // If confirming a booking
      if (order.status === 'reserved' && status === 'completed') {
        const items = await query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
        for (const item of items) {
          // Decrease reserved quantity (stock was already decreased on booking)
          await query('UPDATE books SET reserved_quantity = GREATEST(0, reserved_quantity - ?) WHERE book_id = ?', [item.quantity, item.book_id]);
          
          // Create invoice
          const invoiceNum = `INV-${Date.now()}-${Math.floor(Math.random()*1000)}`;
          await query(
            'INSERT INTO invoices (order_id, invoice_number, total_amount, paid_status) VALUES (?, ?, ?, 1)',
            [orderId, invoiceNum, item.unit_price * item.quantity]
          );
        }
        await query("UPDATE orders SET order_type = 'sale' WHERE order_id = ?", [orderId]);
      }

      // If cancelling a booking
      if (order.status === 'reserved' && status === 'cancelled') {
        const items = await query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
        for (const item of items) {
          // Return to stock and decrease reserved
          await query('UPDATE books SET quantity_in_stock = quantity_in_stock + ?, reserved_quantity = GREATEST(0, reserved_quantity - ?) WHERE book_id = ?', [item.quantity, item.quantity, item.book_id]);
        }
      }

      const result = await query('UPDATE orders SET status = ? WHERE order_id = ?', [status, orderId]);
      console.log(`Status update result:`, result);
      res.json({ message: 'Статус обновлен' });
    } catch (e) { 
      res.status(500).json({ error: (e as Error).message }); 
    }
  });

  app.get('/api/reports/detailed-sales', async (req, res) => {
    const { start_date, end_date, period } = req.query;
    try {
      let sql = `
        SELECT 
          o.order_id,
          o.order_date,
          o.order_type,
          o.status,
          o.total_amount as order_total,
          o.discount_amount as order_discount,
          o.net_amount as order_net,
          CONCAT(c.first_name, ' ', c.last_name) as customer_name,
          c.email as customer_email,
          oi.quantity,
          oi.unit_price,
          (oi.quantity * oi.unit_price) as item_total,
          b.title as book_title,
          b.isbn as book_isbn,
          p.name as publisher_name,
          pr.name as promotion_name,
          pr.code_word as promotion_code
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        JOIN books b ON oi.book_id = b.book_id
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        LEFT JOIN publishers p ON b.publisher_id = p.publisher_id
        LEFT JOIN promotions pr ON o.promotion_id = pr.promotion_id
        WHERE o.status IN ('completed', 'preordered', 'reserved')
      `;
      const params: any[] = [];
      
      if (start_date) {
        sql += ` AND o.order_date >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND o.order_date <= ?`;
        params.push(end_date);
      }

      if (period === 'day') {
        sql += ` AND DATE(o.order_date) = CURDATE()`;
      } else if (period === 'month') {
        sql += ` AND MONTH(o.order_date) = MONTH(CURDATE()) AND YEAR(o.order_date) = YEAR(CURDATE())`;
      } else if (period === 'year') {
        sql += ` AND YEAR(o.order_date) = YEAR(CURDATE())`;
      }
      
      sql += ` ORDER BY o.order_date DESC`;
      
      res.json(await query(sql, params));
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  app.get('/api/reports/sales', async (req, res) => {
    const { start_date, end_date, period = 'day' } = req.query;
    try {
      let groupBy = 'DATE(order_date)';
      if (period === 'month') groupBy = 'DATE_FORMAT(order_date, \'%Y-%m\')';
      if (period === 'year') groupBy = 'YEAR(order_date)';

      let sql = `
        SELECT ${groupBy} as date, SUM(net_amount) as total 
        FROM orders 
        WHERE status IN ('completed', 'preordered', 'reserved') 
      `;
      const params: any[] = [];
      
      if (start_date) {
        sql += ` AND order_date >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND order_date <= ?`;
        params.push(end_date);
      }
      
      sql += ` GROUP BY ${groupBy} ORDER BY date ASC`;
      
      res.json(await query(sql, params));
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  app.get('/api/books/purchased/:customerId', async (req, res) => {
    try {
      const sql = `
        SELECT DISTINCT b.*, p.name as publisher_name
        FROM books b
        JOIN order_items oi ON b.book_id = oi.book_id
        JOIN orders o ON oi.order_id = o.order_id
        LEFT JOIN publishers p ON b.publisher_id = p.publisher_id
        WHERE o.customer_id = ? AND o.status = 'completed'
      `;
      const results = await query(sql, [req.params.customerId]);
      
      const booksWithDetails = await Promise.all(results.map(async (book: any) => {
        const authors = await query(`
          SELECT a.author_id, a.name 
          FROM authors a 
          JOIN book_authors ba ON a.author_id = ba.author_id 
          WHERE ba.book_id = ?`, [book.book_id]);
        return { ...book, authors_list: authors };
      }));
      
      res.json(booksWithDetails);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/reports/user-activity', async (req, res) => {
    try {
      const sql = `
        SELECT 
          c.customer_id,
          CONCAT(c.first_name, ' ', c.last_name) as full_name,
          c.last_login,
          COUNT(o.order_id) as total_transactions,
          COALESCE(SUM(o.net_amount), 0) as total_spent,
          COALESCE(AVG(o.net_amount), 0) as avg_check,
          MAX(o.order_date) as last_purchase
        FROM customers c
        LEFT JOIN orders o ON c.customer_id = o.customer_id AND o.status IN ('completed', 'preordered', 'reserved')
        GROUP BY c.customer_id, c.first_name, c.last_name, c.last_login
        ORDER BY total_spent DESC
        LIMIT 50
      `;
      res.json(await query(sql));
    } catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  app.get('/api/reports/promotions-impact', async (req, res) => {
    try {
      const promotions = await query('SELECT * FROM promotions');
      const impactData = [];

      for (const promo of promotions) {
        // Set end_date to end of day for precise comparison
        const endDate = new Date(promo.end_date);
        endDate.setHours(23, 59, 59, 999);

        const during = await query(
          'SELECT SUM(net_amount) as total FROM orders WHERE status IN ("completed", "preordered", "reserved") AND order_date BETWEEN ? AND ?',
          [promo.start_date, endDate]
        );
        
        const duration = (endDate.getTime() - new Date(promo.start_date).getTime());
        const preStart = new Date(new Date(promo.start_date).getTime() - duration);
        
        const before = await query(
          'SELECT SUM(net_amount) as total FROM orders WHERE status IN ("completed", "preordered", "reserved") AND order_date BETWEEN ? AND ?',
          [preStart, promo.start_date]
        );

        const activityDuring = await query(
          'SELECT order_type, COUNT(*) as count FROM orders WHERE order_date BETWEEN ? AND ? GROUP BY order_type',
          [promo.start_date, endDate]
        );

        const activityBefore = await query(
          'SELECT order_type, COUNT(*) as count FROM orders WHERE order_date BETWEEN ? AND ? GROUP BY order_type',
          [preStart, promo.start_date]
        );

        impactData.push({
          name: promo.name,
          during: during[0].total || 0,
          before: before[0].total || 0,
          activityDuring: activityDuring,
          activityBefore: activityBefore
        });
      }
      res.json(impactData);
    } catch (e) { res.status(500).json(e); }
  });

  app.get('/api/reports/top-categories', async (req, res) => {
    try {
      const sql = `
        SELECT g.name as label, COUNT(oi.item_id) as value
        FROM genres g
        JOIN book_genres bg ON g.genre_id = bg.genre_id
        JOIN order_items oi ON bg.book_id = oi.book_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status = 'completed'
        GROUP BY g.genre_id, g.name
        ORDER BY value DESC
        LIMIT 5
      `;
      const results = await query(sql);
      const total = results.reduce((acc: number, curr: any) => acc + Number(curr.value), 0);
      
      const formatted = results.map((row: any, i: number) => ({
        label: row.label,
        value: Math.round((Number(row.value) / (total || 1)) * 100),
        color: ['bg-indigo-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500'][i % 5]
      }));
      
      res.json(formatted);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    res.json({ url: `images/${req.file.filename}` });
  });

  app.use('/images', express.static(imagesDir));

  // --- SCRAPING PROXY ---
  app.get('/api/scrape-proxy', async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL is required' });
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'upgrade-insecure-requests': '1'
        }
      });
      if (!response.ok) {
        return res.status(response.status).json({ error: `Target site returned ${response.status}` });
      }
      const html = await response.text();
      res.send(html);
    } catch (err) {
      console.error('Scraper Proxy Error:', err);
      res.status(500).json({ error: 'Failed to fetch the page' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
