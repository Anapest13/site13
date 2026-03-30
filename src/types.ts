export interface Publisher {
  publisher_id: number;
  name: string;
  email: string;
  phone: string;
}

export interface Author {
  author_id: number;
  name: string;
  biography: string;
}

export interface Genre {
  genre_id: number;
  name: string;
}

export interface Book {
  book_id: number;
  title: string;
  isbn: string;
  price: number;
  quantity_in_stock: number;
  publisher_id: number;
  publisher_name?: string;
  publication_year: number;
  description: string;
  cover_image_url: string;
  reserved_quantity?: number;
  author_ids?: number[];
  authors_list?: Author[];
  genre_ids?: number[];
  genres_list?: Genre[];
}

export interface Client {
  id: number;
  customer_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  password_hash?: string;
  last_login: string;
  created_at: string;
  isAdmin?: boolean;
}

export interface Promotion {
  promotion_id: number;
  name: string;
  start_date: string;
  end_date: string;
  discount_type: string;
  discount_value: number;
  code_word: string;
  is_active: number;
}

export interface OrderItem {
  order_id: number;
  book_id: number;
  quantity: number;
  unit_price: number;
  title?: string;
}

export interface Order {
  order_id: number;
  customer_id: number;
  order_type: 'sale' | 'reservation' | 'preorder';
  total_amount: number;
  net_amount: number;
  discount_amount: number;
  promotion_id?: number;
  status: string;
  order_date: string;
  items?: OrderItem[];
}

export interface Invoice {
  invoice_id: number;
  order_id: number;
  invoice_number: string;
  total_amount: number;
  paid_status: number;
  created_at: string;
  order_date?: string;
}

export interface SalesReport {
  date: string;
  total: number;
}

export interface UserActivityReport {
  customer_id: number;
  full_name: string;
  last_login: string;
  total_transactions: number;
  total_spent: number;
  avg_check: number;
  last_purchase: string;
}

export interface PromotionImpact {
  name: string;
  during: number;
  before: number;
}
