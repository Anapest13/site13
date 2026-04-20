import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import path from "path";
import bcrypt from "bcryptjs";
import mysql from "mysql2";
import cors from "cors";
import multer from "multer";
import fs from "fs";

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
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (promotion_id) REFERENCES promotions(promotion_id)
      )`);
      try { await query('ALTER TABLE orders MODIFY order_id BIGINT UNSIGNED AUTO_INCREMENT'); } catch(e) {}
      try { await query('ALTER TABLE orders MODIFY customer_id BIGINT UNSIGNED'); } catch(e) {}
      try { await query('ALTER TABLE orders MODIFY promotion_id BIGINT UNSIGNED'); } catch(e) {}
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

  await setupDatabase();

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
    const { customer_id, items, total_amount, net_amount, discount_amount, promotion_id } = req.body;
    
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
        'INSERT INTO orders (customer_id, order_type, total_amount, net_amount, discount_amount, promotion_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [customer_id, order_type, total_amount, net_amount, discount_amount || 0, promotion_id || null, status]
      );
      const orderId = orderRes.insertId;

      if (promotion_id) {
        await query('UPDATE promotions SET used_count = used_count + 1 WHERE promotion_id = ?', [promotion_id]);
      }

      for (const item of items) {
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
      const results = await query(sql, params);
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
      res.json(await query(sql, [req.params.id]));
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
        const during = await query(
          'SELECT SUM(net_amount) as total FROM orders WHERE status="completed" AND order_date BETWEEN ? AND ?',
          [promo.start_date, promo.end_date]
        );
        
        const duration = (new Date(promo.end_date).getTime() - new Date(promo.start_date).getTime());
        const preStart = new Date(new Date(promo.start_date).getTime() - duration);
        
        const before = await query(
          'SELECT SUM(net_amount) as total FROM orders WHERE status="completed" AND order_date BETWEEN ? AND ?',
          [preStart, promo.start_date]
        );

        impactData.push({
          name: promo.name,
          during: during[0].total || 0,
          before: before[0].total || 0
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
