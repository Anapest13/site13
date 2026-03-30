-- SQL Queries to seed the database with real images and data

-- 1. Clear existing data
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM book_genres;
DELETE FROM book_authors;
DELETE FROM order_items;
DELETE FROM invoices;
DELETE FROM orders;
DELETE FROM books;
DELETE FROM authors;
DELETE FROM publishers;
DELETE FROM genres;
DELETE FROM customers;
DELETE FROM promotions;
DELETE FROM notifications;
SET FOREIGN_KEY_CHECKS = 1;

-- 2. Seed Genres
INSERT IGNORE INTO genres (genre_id, name) VALUES 
(1, 'Художественная литература'),
(2, 'Научная фантастика'),
(3, 'Фэнтези'),
(4, 'Детектив'),
(5, 'Бизнес и экономика'),
(6, 'Психология'),
(7, 'История'),
(8, 'Программирование');

-- 3. Seed Authors
INSERT IGNORE INTO authors (author_id, name, biography) VALUES 
(1, 'Джордж Оруэлл', 'Английский писатель и публицист, автор знаменитого романа "1984".'),
(2, 'Айзек Азимов', 'Американский писатель-фантаст, популяризатор науки, автор цикла "Основание".'),
(3, 'Стивен Кинг', 'Американский писатель, "Король ужасов", автор множества бестселлеров.'),
(4, 'Роберт Кийосаки', 'Американский предприниматель, инвестор, автор книги "Богатый папа, бедный папа".'),
(5, 'Михаил Булгаков', 'Выдающийся русский писатель и драматург, автор "Мастера и Маргариты".'),
(6, 'Фёдор Достоевский', 'Один из самых значимых русских писателей и мыслителей мирового значения.'),
(7, 'Мартин Фаулер', 'Британский программист, автор книг по архитектуре ПО и рефакторингу.');

-- 4. Seed Publishers
INSERT IGNORE INTO publishers (publisher_id, name, phone, email) VALUES 
(1, 'Эксмо', '+7 (495) 411-68-86', 'info@eksmo.ru'),
(2, 'АСТ', '+7 (495) 981-64-29', 'ast@ast.ru'),
(3, 'Манн, Иванов и Фербер', '+7 (495) 700-70-00', 'info@mif.ru'),
(4, 'Питер', '+7 (812) 703-73-73', 'piter@piter.com');

-- 5. Seed Books
INSERT IGNORE INTO books (book_id, title, isbn, publisher_id, publication_year, price, quantity_in_stock, cover_image_url, description) VALUES 
(1, '1984', '978-5-17-090630-7', 2, 2021, 450.00, 50, 'https://images.unsplash.com/photo-1543005127-b186c4ee1935?auto=format&fit=crop&q=80&w=800', 'Культовый роман-антиутопия Джорджа Оруэлла о тоталитарном обществе.'),
(2, 'Основание', '978-5-699-90630-7', 1, 2020, 600.00, 30, 'https://images.unsplash.com/photo-1589998059171-988d887df646?auto=format&fit=crop&q=80&w=800', 'Первая книга из легендарного цикла Айзека Азимова о психоистории.'),
(3, 'Сияние', '978-5-17-090630-8', 2, 2019, 550.00, 20, 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800', 'Классический хоррор Стивена Кинга о заброшенном отеле в горах.'),
(4, 'Богатый папа, бедный папа', '978-5-699-90630-9', 3, 2022, 750.00, 100, 'https://images.unsplash.com/photo-1592492159418-39f319320569?auto=format&fit=crop&q=80&w=800', 'Книга, изменившая финансовое мышление миллионов людей по всему миру.'),
(5, 'Мастер и Маргарита', '978-5-17-090630-9', 2, 2021, 500.00, 40, 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=800', 'Бессмертный роман Михаила Булгакова о любви, вере и дьяволе в Москве.'),
(6, 'Преступление и наказание', '978-5-04-112345-6', 1, 2023, 480.00, 25, 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=800', 'Глубокое философское исследование души Родиона Раскольникова.'),
(7, 'Рефакторинг', '978-5-4461-1234-5', 4, 2022, 1200.00, 15, 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&q=80&w=800', 'Фундаментальный труд Мартина Фаулера по улучшению дизайна существующего кода.');

-- 6. Link Books to Authors
INSERT IGNORE INTO book_authors (book_id, author_id) VALUES 
(1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6), (7, 7);

-- 7. Link Books to Genres
INSERT IGNORE INTO book_genres (book_id, genre_id) VALUES 
(1, 1), (1, 2), (2, 2), (3, 1), (3, 3), (4, 5), (5, 1), (5, 3), (6, 1), (7, 8);

-- 8. Seed Customers (including admin)
-- Password for admin is 'admin123' (hashed)
INSERT IGNORE INTO customers (customer_id, first_name, last_name, email, phone, password_hash) VALUES 
(1, 'Admin', 'User', 'admin@bookcity.com', '0000', '$2b$10$Rk6Pe6qtG35sTGuuNGitA.tYeCqHwZGQD4IYz3VYatl9apE7YYXM.'),
(2, 'Иван', 'Иванов', 'ivan@example.com', '+79001112233', '$2a$10$6m.Ym.7v8.Ym.7v8.Ym.7v8.Ym.7v8.Ym.7v8.Ym.7v8.Ym.7v'),
(3, 'Мария', 'Петрова', 'maria@example.com', '+79004445566', '$2a$10$6m.Ym.7v8.Ym.7v8.Ym.7v8.Ym.7v8.Ym.7v8.Ym.7v8.Ym.7v');

-- 9. Seed Promotions
INSERT IGNORE INTO promotions (promotion_id, name, start_date, end_date, discount_type, discount_value, code_word, usage_limit, used_count, is_active) VALUES 
(1, 'Весенняя распродажа', '2026-03-01', '2026-05-31', 'percentage', 15.00, 'SPRING15', 100, 0, 1),
(2, 'Первая покупка', '2026-01-01', '2026-12-31', 'fixed', 200.00, 'WELCOME', 500, 0, 1),
(3, 'Ограниченная акция', '2026-03-20', '2026-03-25', 'percentage', 50.00, 'FAST50', 5, 0, 1);

-- 10. Seed Orders
INSERT IGNORE INTO orders (order_id, customer_id, order_date, order_type, total_amount, discount_amount, net_amount, status) VALUES 
(1, 2, '2026-03-25 10:00:00', 'sale', 1050.00, 0.00, 1050.00, 'completed'),
(2, 3, '2026-03-28 14:30:00', 'sale', 600.00, 0.00, 600.00, 'completed');

-- 11. Seed Order Items
INSERT IGNORE INTO order_items (order_id, book_id, quantity, unit_price) VALUES 
(1, 1, 1, 450.00),
(1, 2, 1, 600.00),
(2, 2, 1, 600.00);

-- 12. Seed Invoices
INSERT IGNORE INTO invoices (order_id, invoice_number, total_amount, paid_status) VALUES 
(1, 'INV-20260325-001', 1050.00, 1),
(2, 'INV-20260328-002', 600.00, 1);

-- 13. Seed Notifications
INSERT IGNORE INTO notifications (title, message, type) VALUES 
('Добро пожаловать!', 'Система успешно запущена и готова к работе.', 'info'),
('Новый заказ', 'Пользователь Иван Иванов совершил покупку на сумму 1050 ₽', 'sale'),
('Пополнение склада', 'На склад поступили новые экземпляры книги "Рефакторинг"', 'info');
