import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ShoppingCart, 
  User as UserIcon, 
  BookOpen, 
  Star, 
  ChevronRight, 
  Filter,
  X,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  Calendar,
  TrendingUp,
  Truck,
  ArrowRight,
  Heart,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Book, Genre } from '../types';
import Modal from './Modal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type UserView = 'home' | 'catalog' | 'cart' | 'profile' | 'about' | 'promotions';

const getImageUrl = (url: string | null, id?: number | string) => {
  if (!url) return `https://picsum.photos/seed/${id || 'book'}/400/600`;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return url;
  if (url.startsWith('images/')) return `/${url}`;
  return `/images/${url}`;
};

export default function UserSite() {
  const [view, setView] = useState<UserView>('home');
  const [filterType, setFilterType] = useState<'all' | 'bestsellers' | 'newest'>('all');
  const [books, setBooks] = useState<Book[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [cart, setCart] = useState<{ book: Book, quantity: number, type: 'sale' | 'booking' | 'preorder' }[]>([]);
  const [search, setSearch] = useState('');
  const [authorNameSearch, setAuthorNameSearch] = useState('');
  const [publisherNameSearch, setPublisherNameSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState<any>(null);
  const [selectedPublisher, setSelectedPublisher] = useState<any>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<any>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Modal state
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'info' | 'confirm' | 'error';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: string, type: 'info' | 'error' = 'info') => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
    });
  };
  const [sortOrder, setSortOrder] = useState<'price_asc' | 'price_desc' | 'newest' | null>(null);
  const [minStock, setMinStock] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [authors, setAuthors] = useState<any[]>([]);
  const [publishers, setPublishers] = useState<any[]>([]);
  const [publisherBooks, setPublisherBooks] = useState<Book[]>([]);
  const [authorBooks, setAuthorBooks] = useState<Book[]>([]);
  const [showContactsModal, setShowContactsModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const authorsRes = await fetch('/api/authors');
        const authorsData = await authorsRes.json();
        if (Array.isArray(authorsData)) setAuthors(authorsData);

        const publishersRes = await fetch('/api/publishers');
        const publishersData = await publishersRes.json();
        if (Array.isArray(publishersData)) setPublishers(publishersData);
      } catch (error) {
        console.error('Error fetching authors/publishers:', error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPublisher) {
      fetch(`/api/books?publisher_id=${selectedPublisher.publisher_id}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setPublisherBooks(data);
        })
        .catch(err => console.error('Error fetching publisher books:', err));
    }
  }, [selectedPublisher]);

  useEffect(() => {
    if (selectedAuthor) {
      fetch(`/api/books?author_id=${selectedAuthor.author_id}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAuthorBooks(data);
        })
        .catch(err => console.error('Error fetching author books:', err));
    }
  }, [selectedAuthor]);

  useEffect(() => {
    // Reset other filters when switching views, except when specifically navigating to catalog with a filterType
    if (view !== 'catalog') {
      setSelectedGenre(null);
      setSelectedAuthor(null);
      setSelectedPublisher(null);
      setSelectedYear(null);
      setSortOrder(null);
      setMinStock(null);
      setFilterType('all');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view, filterType]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));

    const fetchBooksAndGenres = async () => {
      try {
        const booksRes = await fetch('/api/books');
        const booksData = await booksRes.json();
        if (Array.isArray(booksData)) setBooks(booksData);

        const genresRes = await fetch('/api/genres');
        const genresData = await genresRes.json();
        if (Array.isArray(genresData)) setGenres(genresData);
      } catch (error) {
        console.error('Error fetching books/genres:', error);
      }
    };
    fetchBooksAndGenres();
    (window as any).setSelectedBookGlobal = setSelectedBook;
    return () => { (window as any).setSelectedBookGlobal = null; };
  }, []);

  const addToCart = (book: Book, type: 'sale' | 'booking' | 'preorder' = 'sale') => {
    // Stock validation
    if (type !== 'preorder') {
       const existingInCart = cart.find(item => item.book.book_id === book.book_id && item.type === type);
       const currentQty = existingInCart ? existingInCart.quantity : 0;
       if (currentQty + 1 > book.quantity_in_stock) {
         showAlert('Ошибка', `На складе всего ${book.quantity_in_stock} шт. этой книги.`, 'error');
         return;
       }
    }

    setCart(prev => {
      const existing = prev.find(item => item.book.book_id === book.book_id && item.type === type);
      if (existing) {
        return prev.map(item => 
          item.book.book_id === book.book_id && item.type === type 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { book, quantity: 1, type }];
    });
  };

  const removeFromCart = (bookId: number, type: string) => {
    setCart(prev => prev.filter(item => !(item.book.book_id === bookId && item.type === type)));
  };

  const updateQuantity = (bookId: number, type: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.book.book_id === bookId && item.type === type) {
        const newQty = Math.max(1, item.quantity + delta);
        
        // Stock check on increase
        if (delta > 0 && item.type !== 'preorder') {
           if (newQty > item.book.quantity_in_stock) {
             showAlert('Ошибка', `На складе всего ${item.book.quantity_in_stock} шт.`, 'error');
             return item;
           }
        }
        
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const totalAmount = cart.reduce((acc, item) => acc + (item.book.price * item.quantity), 0);
  const discountAmount = appliedPromotion ? (
    appliedPromotion.discount_type === 'percentage' 
      ? (totalAmount * appliedPromotion.discount_value / 100)
      : appliedPromotion.discount_value
  ) : 0;
  const netAmount = Math.max(0, totalAmount - discountAmount);

  const filteredBooks = books.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(search.toLowerCase()) || 
                         (b.authors_list?.[0]?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                         (b.publisher_name || '').toLowerCase().includes(search.toLowerCase());
    
    const matchesAuthorName = authorNameSearch ? (b.authors_list || []).some((a: any) => a.name.toLowerCase().includes(authorNameSearch.toLowerCase())) : true;
    const matchesPublisherName = publisherNameSearch ? (b.publisher_name || '').toLowerCase().includes(publisherNameSearch.toLowerCase()) : true;

    const matchesGenre = selectedGenre ? b.genre_ids?.includes(selectedGenre) : true;
    const matchesAuthor = selectedAuthor ? b.authors_list?.some((a: any) => a.author_id === selectedAuthor.author_id) : true;
    const matchesPublisher = selectedPublisher ? b.publisher_id === selectedPublisher.publisher_id : true;
    const matchesYear = selectedYear ? b.publication_year === selectedYear : true;
    const matchesStock = minStock !== null ? b.quantity_in_stock >= minStock : true;
    
    // Additional filters for novelty/popularity
    if (filterType === 'newest') {
      const currentYear = new Date().getFullYear();
      if ((b.publication_year || 0) < currentYear - 1) return false;
    }
    // For bestsellers, we use the sales_count field
    if (filterType === 'bestsellers') {
      if ((b.sales_count || 0) < 1) return false; // Show books with at least 1 sale as bestsellers (can be adjusted)
    }

    return matchesSearch && matchesAuthorName && matchesPublisherName && matchesGenre && matchesAuthor && matchesPublisher && matchesYear && matchesStock;
  }).sort((a, b) => {
    if (sortOrder === 'price_asc') return a.price - b.price;
    if (sortOrder === 'price_desc') return b.price - a.price;
    if (sortOrder === 'newest') return (b.publication_year || 0) - (a.publication_year || 0);
    return 0;
  });

  const handleApplyPromo = async () => {
    if (!promoCode) return;
    try {
      const res = await fetch('/api/promotions');
      const promos = await res.json();
      const promo = promos.find((p: any) => p.code_word === promoCode && p.is_active);
      if (promo) {
        setAppliedPromotion(promo);
        alert('Промокод применен!');
      } else {
        alert('Неверный или неактивный промокод');
      }
    } catch (e) {
      alert('Ошибка при проверке промокода');
    }
  };

  const handleCheckout = async () => {
    if (!user) {
      alert('Пожалуйста, войдите в аккаунт для оформления заказа');
      return;
    }

    const orderData = {
      customer_id: user.customer_id || user.id,
      items: cart.map(item => ({
        book_id: item.book.book_id,
        quantity: item.quantity,
        unit_price: item.book.price,
        order_type: item.type
      })),
      total_amount: totalAmount,
      discount_amount: discountAmount,
      promotion_id: appliedPromotion?.promotion_id,
      net_amount: netAmount
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (res.ok) {
        setCart([]);
        setAppliedPromotion(null);
        setPromoCode('');
        alert('Заказ успешно оформлен!');
        setView('profile');
      } else {
        const err = await res.json();
        alert('Ошибка при оформлении заказа: ' + (err.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Ошибка при оформлении заказа');
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#1A1A1A]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <button onClick={() => setView('home')} className="flex items-center gap-2 group">
                <img src="/images/logo.png" alt="Книга24" className="h-8 w-auto" onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }} />
                <div className="hidden flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform">
                    К
                  </div>
                  <span className="font-bold text-xl tracking-tight">Книга24</span>
                </div>
              </button>
              <div className="hidden md:flex items-center gap-6">
                <button 
                  onClick={() => {
                    setView('catalog');
                    setFilterType('all');
                    setSelectedGenre(null);
                    setSelectedAuthor(null);
                    setSelectedPublisher(null);
                    setSelectedYear(null);
                    setSortOrder(null);
                    setMinStock(null);
                  }} 
                  className={cn("text-sm font-medium transition-colors hover:text-black", view === 'catalog' ? "text-black" : "text-[#6B7280]")}
                >
                  Каталог
                </button>
                <button onClick={() => setView('promotions')} className={cn("text-sm font-medium transition-colors hover:text-black", view === 'promotions' ? "text-black" : "text-[#6B7280]")}>Акции</button>
                <button onClick={() => setView('about')} className={cn("text-sm font-medium transition-colors hover:text-black", view === 'about' ? "text-black" : "text-[#6B7280]")}>О нас</button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden sm:block">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input 
                  type="text" 
                  placeholder="Поиск книг..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (view !== 'catalog') setView('catalog');
                  }}
                  className="pl-10 pr-4 py-2 bg-[#F3F4F6] border-none rounded-full text-sm w-48 lg:w-64 focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all"
                />
              </div>
              <button 
                onClick={() => setView('cart')}
                className="p-2 hover:bg-[#F3F4F6] rounded-full relative transition-all"
              >
                <ShoppingCart className="w-5 h-5" />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#1A1A1A] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                    {cart.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setView('profile')}
                className="p-2 hover:bg-[#F3F4F6] rounded-full transition-all"
              >
                <UserIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-24"
            >
              {/* Hero Section */}
              <section className="relative h-[600px] rounded-[48px] overflow-hidden bg-[#1A1A1A] text-white">
                <div className="absolute inset-0">
                  <img 
                    src="https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&q=80&w=2000" 
                    alt="Library" 
                    className="w-full h-full object-cover opacity-50 scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
                </div>
                <div className="relative h-full flex flex-col justify-center px-12 md:px-20 max-w-3xl space-y-8">
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <span className="inline-block px-4 py-1.5 bg-indigo-600 text-white rounded-full text-xs font-bold uppercase tracking-widest mb-4">
                      Новое поступление
                    </span>
                    <h1 className="text-6xl md:text-8xl font-bold leading-[0.85] tracking-tighter">
                      Открой <br />
                      <span className="text-indigo-400">свою историю</span>
                    </h1>
                  </motion.div>
                  <p className="text-xl text-gray-300 max-w-lg leading-relaxed">
                    Тысячи книг ждут вас. От классики до современных бестселлеров с доставкой прямо к вашей двери.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <button 
                      onClick={() => {
                        setView('catalog');
                        setFilterType('all');
                      }} 
                      className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-700 hover:scale-105 transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2"
                    >
                      В каталог <ArrowRight className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setView('about')} 
                      className="bg-white/10 backdrop-blur-md text-white border border-white/20 px-10 py-4 rounded-2xl font-bold hover:bg-white/20 transition-all"
                    >
                      Узнать больше
                    </button>
                  </div>
                </div>
              </section>

              {/* Features Grid */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { title: 'Быстрая доставка', desc: 'Доставляем по всей стране за 2-3 дня', icon: Truck, color: 'bg-blue-50 text-blue-600' },
                  { title: 'Лучшие цены', desc: 'Гарантируем лучшую стоимость на рынке', icon: Zap, color: 'bg-amber-50 text-amber-600' },
                  { title: 'Программа лояльности', desc: 'Накапливайте бонусы с каждой покупки', icon: Heart, color: 'bg-rose-50 text-rose-600' },
                ].map((feature, i) => (
                  <div key={i} className="p-8 bg-white border border-[#E5E7EB] rounded-[32px] space-y-4 hover:shadow-xl transition-shadow">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", feature.color)}>
                      <feature.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold">{feature.title}</h3>
                    <p className="text-[#6B7280]">{feature.desc}</p>
                  </div>
                ))}
              </section>

              {/* Featured Genres */}
              <section>
                <div className="flex items-center justify-between mb-10">
                  <h2 className="text-3xl font-bold tracking-tight">Популярные жанры</h2>
                  <button onClick={() => { setView('catalog'); setFilterType('all'); }} className="text-indigo-600 font-bold flex items-center gap-1 hover:gap-2 transition-all">
                    Все жанры <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {genres.slice(0, 6).map((genre, idx) => {
                    const colors = [
                      'bg-indigo-600', 'bg-violet-600', 'bg-blue-600', 
                      'bg-emerald-600', 'bg-amber-600', 'bg-rose-600'
                    ];
                    return (
                      <button 
                        key={genre.genre_id}
                        onClick={() => {
                          setSelectedGenre(genre.genre_id);
                          setView('catalog');
                          setFilterType('all');
                        }}
                        className={cn(
                          "group relative aspect-square rounded-[32px] overflow-hidden transition-all hover:-translate-y-2 hover:shadow-2xl",
                          colors[idx % colors.length]
                        )}
                      >
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="h-full flex flex-col justify-end p-8">
                          <BookOpen className="w-8 h-8 text-white/40 mb-4 group-hover:scale-110 transition-transform" />
                          <span className="text-white font-bold text-xl text-left leading-tight">{genre.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* New Arrivals */}
              <section>
                <div className="flex items-center justify-between mb-10">
                  <h2 className="text-3xl font-bold tracking-tight">Новинки</h2>
                  <button onClick={() => { setView('catalog'); setFilterType('all'); }} className="text-indigo-600 font-bold flex items-center gap-1 hover:gap-2 transition-all">
                    Смотреть все <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {books.slice(0, 4).map((book) => (
                    <BookCard 
                      key={book.book_id} 
                      book={book} 
                      onAddToCart={addToCart} 
                      onPublisherClick={setSelectedPublisher}
                      onAuthorClick={setSelectedAuthor}
                    />
                  ))}
                </div>
              </section>

              {/* Newsletter/CTA Section */}
              <section className="relative py-20 px-12 rounded-[48px] bg-indigo-600 text-white overflow-hidden text-center space-y-8">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
                </div>
                <div className="relative z-10 max-w-2xl mx-auto space-y-6">
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Готовы начать свое следующее приключение?</h2>
                  <p className="text-lg text-indigo-100">Присоединяйтесь к тысячам читателей и откройте для себя лучшие книги со всего мира.</p>
                  <button 
                    onClick={() => { setView('catalog'); setFilterType('all'); }}
                    className="bg-white text-indigo-600 px-12 py-4 rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-2xl"
                  >
                    Перейти в каталог
                  </button>
                </div>
              </section>
            </motion.div>
          )}

          {view === 'catalog' && (
            <motion.div 
              key="catalog"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col lg:flex-row gap-8"
            >
            {/* Filters Sidebar */}
            <aside className="w-full lg:w-64 shrink-0 space-y-8">
              <div>
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Сортировка
                </h3>
                <select 
                  value={sortOrder || ''} 
                  onChange={(e) => setSortOrder(e.target.value as any || null)}
                  className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1A1A1A]/10 outline-none"
                >
                  <option value="">По умолчанию</option>
                  <option value="price_asc">Цена: по возрастанию</option>
                  <option value="price_desc">Цена: по убыванию</option>
                  <option value="newest">Сначала новые</option>
                </select>
              </div>

              <div>
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  Поиск автора
                </h3>
                <input 
                  type="text" 
                  placeholder="Имя автора"
                  value={authorNameSearch}
                  onChange={(e) => setAuthorNameSearch(e.target.value)}
                  className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1A1A1A]/10 outline-none"
                />
              </div>

              <div>
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Поиск изд-ва
                </h3>
                <input 
                  type="text" 
                  placeholder="Название изд-ва"
                  value={publisherNameSearch}
                  onChange={(e) => setPublisherNameSearch(e.target.value)}
                  className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1A1A1A]/10 outline-none"
                />
              </div>

              <div>
                <h3 className="font-bold mb-4">Жанры</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  <button 
                    onClick={() => setSelectedGenre(null)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                      selectedGenre === null ? "bg-[#1A1A1A] text-white font-bold" : "hover:bg-[#F3F4F6] text-[#6B7280]"
                    )}
                  >
                    Все жанры
                  </button>
                  {genres.map((genre) => (
                    <button 
                      key={genre.genre_id}
                      onClick={() => setSelectedGenre(genre.genre_id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                        selectedGenre === genre.genre_id ? "bg-[#1A1A1A] text-white font-bold" : "hover:bg-[#F3F4F6] text-[#6B7280]"
                      )}
                    >
                      {genre.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold mb-4">Авторы</h3>
                <select 
                  value={selectedAuthor?.author_id || ''} 
                  onChange={(e) => {
                    const author = authors.find(a => a.author_id === parseInt(e.target.value));
                    setSelectedAuthor(author || null);
                  }}
                  className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1A1A1A]/10 outline-none"
                >
                  <option value="">Все авторы</option>
                  {authors.map(author => (
                    <option key={author.author_id} value={author.author_id}>{author.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <h3 className="font-bold mb-4">Издательства</h3>
                <select 
                  value={selectedPublisher?.publisher_id || ''} 
                  onChange={(e) => {
                    const pub = publishers.find(p => p.publisher_id === parseInt(e.target.value));
                    setSelectedPublisher(pub || null);
                  }}
                  className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1A1A1A]/10 outline-none"
                >
                  <option value="">Все издательства</option>
                  {publishers.map(pub => (
                    <option key={pub.publisher_id} value={pub.publisher_id}>{pub.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <h3 className="font-bold mb-4">Год издания</h3>
                <input 
                  type="number" 
                  placeholder="Напр. 2023"
                  value={selectedYear || ''}
                  onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1A1A1A]/10 outline-none"
                />
              </div>

              <div>
                <h3 className="font-bold mb-4">В наличии (мин.)</h3>
                <input 
                  type="number" 
                  placeholder="Мин. кол-во"
                  value={minStock || ''}
                  onChange={(e) => setMinStock(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1A1A1A]/10 outline-none"
                />
              </div>

              <button 
                onClick={() => {
                  setSelectedGenre(null);
                  setSelectedAuthor(null);
                  setSelectedPublisher(null);
                  setSelectedYear(null);
                  setSortOrder(null);
                  setMinStock(null);
                  setAuthorNameSearch('');
                  setPublisherNameSearch('');
                }}
                className="w-full py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all"
              >
                Сбросить фильтры
              </button>
            </aside>

            {/* Catalog Grid */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">Каталог книг</h2>
                <p className="text-sm text-[#6B7280]">{filteredBooks.length} книг найдено</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredBooks.map((book) => (
                  <BookCard 
                    key={book.book_id} 
                    book={book} 
                    onAddToCart={addToCart} 
                    onPublisherClick={setSelectedPublisher}
                    onAuthorClick={setSelectedAuthor}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

          {view === 'cart' && (
            <motion.div 
              key="cart"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
            <h2 className="text-3xl font-bold mb-8">Корзина</h2>
            {cart.length === 0 ? (
              <div className="text-center py-20 bg-[#F9FAFB] rounded-3xl">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-[#D1D5DB]" />
                <h3 className="text-xl font-bold mb-2">Ваша корзина пуста</h3>
                <p className="text-[#6B7280] mb-8">Самое время добавить в неё что-нибудь интересное!</p>
                <button onClick={() => { setView('catalog'); setFilterType('all'); }} className="bg-[#1A1A1A] text-white px-8 py-3 rounded-full font-bold hover:shadow-lg transition-all">
                  Перейти в каталог
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  {cart.map((item, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-white border border-[#E5E7EB] rounded-2xl">
                      <div className="w-24 h-32 bg-[#F3F4F6] rounded-xl overflow-hidden shrink-0">
                        <img 
                          src={getImageUrl(item.book.cover_image_url)} 
                          alt={item.book.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold">{item.book.title}</h4>
                            <button onClick={() => removeFromCart(item.book.book_id, item.type)} className="p-1 hover:bg-red-50 text-red-500 rounded-lg transition-all">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-sm text-[#6B7280]">{item.book.author_name}</p>
                          <span className={cn(
                            "inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            item.type === 'sale' ? "bg-emerald-50 text-emerald-600" :
                            item.type === 'booking' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                          )}>
                            {item.type === 'sale' ? 'Покупка' : item.type === 'booking' ? 'Бронь' : 'Предзаказ'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3 bg-[#F3F4F6] rounded-lg px-2 py-1">
                            <button onClick={() => updateQuantity(item.book.book_id, item.type, -1)} className="p-1 hover:bg-white rounded-md transition-all"><Minus className="w-3 h-3" /></button>
                            <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.book.book_id, item.type, 1)} className="p-1 hover:bg-white rounded-md transition-all"><Plus className="w-3 h-3" /></button>
                          </div>
                          <p className="font-bold">{item.book.price * item.quantity} ₽</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-[#F9FAFB] p-8 rounded-3xl h-fit space-y-6">
                  <h3 className="font-bold text-xl">Итого</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between text-[#6B7280]">
                      <span>Товары ({cart.length})</span>
                      <span>{totalAmount} ₽</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Скидка ({appliedPromotion.name})</span>
                        <span>-{discountAmount} ₽</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#6B7280]">
                      <span>Доставка</span>
                      <span className="text-emerald-600 font-bold uppercase text-xs">Бесплатно</span>
                    </div>
                    <div className="pt-4 border-t border-[#E5E7EB] flex justify-between font-bold text-lg">
                      <span>К оплате</span>
                      <span>{netAmount} ₽</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#E5E7EB]">
                    <p className="text-sm font-bold mb-2">Промокод</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Введите код"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="flex-1 bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1A1A1A]/10"
                      />
                      <button 
                        onClick={handleApplyPromo}
                        className="bg-[#1A1A1A] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-black transition-all"
                      >
                        Применить
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={handleCheckout}
                    className="w-full bg-[#1A1A1A] text-white py-4 rounded-2xl font-bold hover:shadow-xl transition-all"
                  >
                    Оформить заказ
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Author Modal */}
        {selectedAuthor && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-8 border-b border-[#E5E7EB] flex justify-between items-center bg-[#F9FAFB]">
                <div>
                  <h2 className="text-3xl font-bold text-[#1A1A1A]">{selectedAuthor.name}</h2>
                  <p className="text-indigo-600 font-medium mt-1">Все книги автора</p>
                </div>
                <button onClick={() => setSelectedAuthor(null)} className="p-3 hover:bg-white rounded-2xl transition-colors shadow-sm">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Книги автора
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {authorBooks.map(book => (
                    <BookCard 
                      key={book.book_id} 
                      book={book} 
                      onAddToCart={addToCart} 
                      onPublisherClick={setSelectedPublisher} 
                      onAuthorClick={setSelectedAuthor}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

          {view === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              {!user ? (
                <div className="text-center py-20">
                  <h2 className="text-3xl font-bold mb-4">Личный кабинет</h2>
                  <p className="text-[#6B7280] mb-8">Войдите, чтобы просматривать свои заказы и управлять профилем.</p>
                  <div className="flex justify-center gap-4">
                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('auth-request'))} 
                      className="bg-[#1A1A1A] text-white px-8 py-3 rounded-full font-bold hover:shadow-lg transition-all"
                    >
                      Войти в аккаунт
                    </button>
                  </div>
                </div>
              ) : (
              <div className="space-y-8">
                <div className="flex items-center justify-between p-8 bg-[#F9FAFB] rounded-3xl">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center border border-[#E5E7EB]">
                      <UserIcon className="w-10 h-10 text-[#6B7280]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{user.first_name} {user.last_name}</h2>
                      <p className="text-[#6B7280]">{user.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      localStorage.removeItem('user');
                      window.location.reload();
                    }}
                    className="px-6 py-2 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all"
                  >
                    Выйти
                  </button>
                </div>

                <div className="space-y-12">
                  <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900">Моя библиотека</h3>
                          <p className="text-sm text-gray-500">Все ваши купленные книги</p>
                        </div>
                      </div>
                    </div>
                    <PurchasedBooks customerId={user.customer_id || user.id} />
                  </section>

                  <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                          <Clock className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900">История заказов</h3>
                          <p className="text-sm text-gray-500">Ваши недавние покупки и бронирования</p>
                        </div>
                      </div>
                    </div>
                    <OrdersList customerId={user.customer_id || user.id} />
                  </section>
                </div>
              </div>
            )}
          </motion.div>
        )}
          {view === 'about' && (
            <motion.div 
              key="about"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AboutSection />
            </motion.div>
          )}

          {view === 'promotions' && (
            <motion.div 
              key="promotions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PromotionsSection />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* Publisher Modal */}
      {selectedPublisher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-8 border-b border-[#E5E7EB] flex justify-between items-center bg-[#F9FAFB]">
              <div>
                <h2 className="text-3xl font-bold text-[#1A1A1A]">{selectedPublisher.name}</h2>
                <div className="flex gap-4 mt-2 text-sm text-[#6B7280]">
                  {selectedPublisher.email && <span>Email: {selectedPublisher.email}</span>}
                  {selectedPublisher.phone && <span>Тел: {selectedPublisher.phone}</span>}
                </div>
              </div>
              <button onClick={() => setSelectedPublisher(null)} className="p-3 hover:bg-white rounded-2xl transition-colors shadow-sm">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Книги издательства
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {publisherBooks.map(book => (
                  <BookCard key={book.book_id} book={book} onAddToCart={addToCart} onPublisherClick={setSelectedPublisher} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Author Modal */}
      {selectedAuthor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-8 border-b border-[#E5E7EB] flex justify-between items-center bg-[#F9FAFB]">
              <div>
                <h2 className="text-3xl font-bold text-[#1A1A1A]">{selectedAuthor.name}</h2>
                <p className="text-indigo-600 font-medium mt-1">Все книги автора</p>
              </div>
              <button onClick={() => setSelectedAuthor(null)} className="p-3 hover:bg-white rounded-2xl transition-colors shadow-sm">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Книги автора
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {authorBooks.map(book => (
                  <BookCard 
                    key={book.book_id} 
                    book={book} 
                    onAddToCart={addToCart} 
                    onPublisherClick={setSelectedPublisher} 
                    onAuthorClick={setSelectedAuthor}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-white py-20 mt-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">К</div>
                <span className="font-bold text-2xl tracking-tight">Книга24</span>
              </div>
              <p className="text-gray-400 text-base leading-relaxed max-w-sm">
                Ваш надежный проводник в мире литературы. Лучшие книги со всего мира собраны в одном месте для вашего вдохновения.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-8">Каталог</h4>
              <ul className="space-y-4">
                {[
                  { label: 'Все книги', action: () => { setView('catalog'); setFilterType('all'); } },
                  { label: 'Новинки', action: () => { setView('catalog'); setFilterType('newest'); } },
                  { label: 'Бестселлеры', action: () => { setView('catalog'); setFilterType('bestsellers'); } },
                  { label: 'Акции', action: () => setView('promotions') },
                ].map((item, i) => (
                  <li key={i}>
                    <button 
                      onClick={item.action} 
                      className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-8">Компания</h4>
              <ul className="space-y-4">
                {[
                  { label: 'О нас', action: () => setView('about') },
                  { label: 'Контакты', action: () => setShowContactsModal(true) },
                ].map((item, i) => (
                  <li key={i}>
                    <button 
                      onClick={item.action} 
                      className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
            <p>© 2026 Книга24. Все права защищены.</p>
          </div>
        </div>
      </footer>

      {/* Contacts Modal */}
      {showContactsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl space-y-8">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold">Контакты</h3>
              <button onClick={() => setShowContactsModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">Адрес</p>
                  <p className="text-gray-600">г. Красноярск, пер. Тихий, д. 13/2, цокольный этаж</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">Режим работы</p>
                  <p className="text-gray-600">Ежедневно: 10:00 — 22:00</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">Телефон</p>
                  <p className="text-gray-600">+7 (495) 123-45-67</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">Email</p>
                  <p className="text-gray-600">info@kniga24.ru</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowContactsModal(false)}
              className="w-full bg-[#1A1A1A] text-white py-4 rounded-2xl font-bold hover:shadow-xl transition-all"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Book Detail Modal */}
      {selectedBook && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[250] flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedBook(null)}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[48px] w-full max-w-4xl overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedBook(null)}
              className="absolute top-6 right-6 p-3 bg-white/80 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-xl hover:bg-gray-50 transition-all z-10"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex flex-col md:flex-row h-full">
              <div className="md:w-2/5 aspect-[3/4] md:aspect-auto bg-gray-100 relative group overflow-hidden">
                <img 
                  src={getImageUrl(selectedBook.cover_image_url, selectedBook.book_id)} 
                  alt={selectedBook.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
              <div className="md:w-3/5 p-8 md:p-12 overflow-y-auto max-h-[90vh]">
                <div className="space-y-8">
                  <div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {selectedBook?.genres_list?.map(g => (
                        <span key={g.genre_id} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full uppercase tracking-widest">{g.name}</span>
                      ))}
                    </div>
                    <h2 className="text-4xl font-bold tracking-tight text-[#1A1A1A] leading-[1.1] mb-2">{selectedBook.title}</h2>
                    <p className="text-xl text-indigo-600 font-medium">
                      {selectedBook.authors_list?.map(a => a.name).join(', ')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-8 border-y border-gray-100 py-8">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#9CA3AF] mb-1 tracking-widest">Издательство</p>
                      <p className="font-bold text-[#1A1A1A]">{selectedBook.publisher_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#9CA3AF] mb-1 tracking-widest">Год издания</p>
                      <p className="font-bold text-[#1A1A1A]">{selectedBook.publication_year}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#9CA3AF] mb-1 tracking-widest">ISBN</p>
                      <p className="font-mono font-bold text-[#1A1A1A]">{selectedBook.isbn}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#9CA3AF] mb-1 tracking-widest">На складе</p>
                      <p className={cn("font-bold", selectedBook.quantity_in_stock < 5 ? "text-amber-600" : "text-emerald-600")}>
                        {selectedBook.quantity_in_stock > 0 ? `${selectedBook.quantity_in_stock} шт.` : 'Нет в наличии'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] uppercase font-bold text-[#9CA3AF] tracking-widest">Аннотация</p>
                    <p className="text-[#6B7280] leading-relaxed">
                      {selectedBook.description || 'Описание отсутствует.'}
                    </p>
                  </div>

                  <div className="pt-8 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#9CA3AF] mb-1 tracking-widest">Стоимость</p>
                      <p className="text-4xl font-bold text-[#1A1A1A]">{selectedBook.price} ₽</p>
                    </div>
                    <div className="flex gap-3">
                      {selectedBook.quantity_in_stock > 0 ? (
                        <button 
                          onClick={() => { addToCart(selectedBook); setSelectedBook(null); }}
                          className="px-10 py-5 bg-[#1A1A1A] text-white rounded-2xl font-bold flex items-center gap-3 hover:shadow-2xl hover:shadow-black/20 active:scale-95 transition-all"
                        >
                          <ShoppingCart className="w-5 h-5" />
                          В корзину
                        </button>
                      ) : (
                        <button 
                          onClick={() => { addToCart(selectedBook, 'preorder'); setSelectedBook(null); }}
                          className="px-10 py-5 bg-amber-500 text-white rounded-2xl font-bold flex items-center gap-3 hover:shadow-2xl hover:shadow-amber-500/20 active:scale-95 transition-all"
                        >
                          <Clock className="w-5 h-5" />
                          Предзаказать
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <Modal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        type={modalConfig.type}
        title={modalConfig.title}
        onConfirm={modalConfig.onConfirm}
      >
        <p>{modalConfig.message}</p>
      </Modal>
    </div>
  );
}

interface BookCardProps {
  book: Book;
  onAddToCart: (book: Book, type?: 'sale' | 'booking' | 'preorder') => void;
  onPublisherClick?: (publisher: any) => void;
  onAuthorClick?: (author: any) => void;
}

const BookCard: React.FC<BookCardProps> = ({ book, onAddToCart, onPublisherClick, onAuthorClick }) => {
  const isOutOfStock = book.quantity_in_stock === 0;

  return (
    <div 
      className="group bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden hover:shadow-xl transition-all h-full flex flex-col cursor-pointer"
      onClick={() => (window as any).setSelectedBookGlobal?.(book)}
    >
      <div className="aspect-[3/4] bg-[#F3F4F6] relative overflow-hidden">
        <img 
          src={getImageUrl(book.cover_image_url, book.book_id)} 
          alt={book.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {book.quantity_in_stock > 0 && book.quantity_in_stock < 5 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">Осталось мало</span>
          )}
          {isOutOfStock && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">Нет в наличии</span>
          )}
        </div>
      </div>
      <div className="p-6">
        <h3 className="font-bold text-lg mb-1 line-clamp-1">{book.title}</h3>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (book.authors_list?.[0]) {
              onAuthorClick?.(book.authors_list[0]);
            }
          }}
          className="text-sm text-[#6B7280] mb-4 hover:text-blue-600 hover:underline text-left block w-full"
        >
          {book.authors_list?.[0]?.name || 'Неизвестный автор'}
        </button>
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold">{book.price} ₽</span>
          <div className="flex gap-2">
            {!isOutOfStock ? (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); onAddToCart(book, 'sale'); }}
                  className="p-2 bg-[#1A1A1A] text-white rounded-lg hover:shadow-lg transition-all"
                  title="Купить"
                >
                  <ShoppingCart className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onAddToCart(book, 'booking'); }}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:shadow-lg transition-all"
                  title="Забронировать"
                >
                  <Clock className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onAddToCart(book, 'preorder'); }}
                  className="p-2 bg-amber-600 text-white rounded-lg hover:shadow-lg transition-all"
                  title="Предзаказ"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button 
                onClick={(e) => { e.stopPropagation(); onAddToCart(book, 'preorder'); }}
                className="p-2 bg-amber-600 text-white rounded-lg hover:shadow-lg transition-all"
                title="Предзаказ"
              >
                <Calendar className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onPublisherClick?.({
              publisher_id: book.publisher_id,
              name: book.publisher_name,
              email: book.publisher_email,
              phone: book.publisher_phone
            });
          }}
          className="mt-4 text-[10px] text-blue-600 hover:underline font-bold uppercase tracking-wider"
        >
          Издательство: {book.publisher_name}
        </button>
      </div>
    </div>
  );
};

function PurchasedBooks({ customerId }: { customerId: number }) {
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    fetch(`/api/books/purchased/${customerId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setBooks(data);
      });
  }, [customerId]);

  if (books.length === 0) {
    return (
      <div className="text-center py-12 bg-[#F9FAFB] rounded-3xl">
        <p className="text-[#6B7280]">Вы еще не купили ни одной книги.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {books.map((book) => (
        <div key={book.book_id} className="flex gap-4 p-4 bg-white border border-[#E5E7EB] rounded-2xl">
          <div className="w-16 h-24 bg-[#F3F4F6] rounded-lg overflow-hidden shrink-0">
            <img 
              src={getImageUrl(book.cover_image_url)} 
              alt={book.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col justify-center">
            <h4 className="font-bold text-sm line-clamp-2">{book.title}</h4>
            <p className="text-xs text-[#6B7280]">{book.authors_list?.[0]?.name}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AboutSection() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-32">
      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest">
            Наша история
          </div>
          <h2 className="text-6xl md:text-8xl font-bold tracking-tighter leading-[0.9]">
            Книги — это <br />
            <span className="text-indigo-600">наша страсть.</span>
          </h2>
          <p className="text-xl text-[#6B7280] max-w-lg leading-relaxed">
            С 2010 года Книга24 является вашим надежным проводником в мире литературы. Мы не просто продаем книги, мы помогаем находить новые миры.
          </p>
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="w-12 h-12 rounded-full border border-[#E5E7EB] flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="relative">
          <div className="aspect-[4/5] rounded-[48px] overflow-hidden shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-700">
            <img 
              src="https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&q=80&w=2000" 
              alt="Our Bookstore"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute -bottom-10 -left-10 bg-white p-8 rounded-3xl shadow-xl max-w-[240px] -rotate-3">
            <p className="text-4xl font-bold text-indigo-600">12+</p>
            <p className="text-sm font-medium text-[#6B7280]">Лет успешной работы на книжном рынке</p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Книг в наличии', value: '15к+', icon: BookOpen },
          { label: 'Довольных клиентов', value: '50к+', icon: UserIcon },
          { label: 'Городов доставки', value: '100+', icon: Truck },
        ].map((stat, idx) => (
          <div key={idx} className="p-10 bg-white border border-[#E5E7EB] rounded-[40px] space-y-4 hover:border-indigo-600 transition-colors group">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <stat.icon className="w-7 h-7" />
            </div>
            <div>
              <p className="text-5xl font-bold tracking-tighter">{stat.value}</p>
              <p className="text-[#6B7280] font-medium uppercase tracking-wider text-xs mt-2">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Mission Section */}
      <div className="bg-[#1A1A1A] text-white rounded-[64px] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="p-16 md:p-24 space-y-8">
            <h3 className="text-4xl md:text-5xl font-bold leading-tight">
              Наша миссия — сделать чтение <span className="text-indigo-400">доступным</span> для каждого.
            </h3>
            <p className="text-lg text-gray-400 leading-relaxed">
              Мы верим, что книги способны менять жизни. Наша цель — сделать чтение доступным и увлекательным для каждого. Мы тщательно отбираем каждую книгу в нашем каталоге, чтобы вы могли найти именно то, что ищете.
            </p>
            <div className="space-y-4">
              {['Тщательный отбор изданий', 'Поддержка молодых авторов', 'Экологичная упаковка'].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative h-[400px] lg:h-auto">
            <img 
              src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=1000" 
              alt="Library"
              className="absolute inset-0 w-full h-full object-cover opacity-60"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1A1A1A] to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PromotionsSection() {
  const [promotions, setPromotions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/promotions')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPromotions(data.filter((p: any) => p.is_active));
      });
  }, []);

  return (
    <div className="max-w-5xl mx-auto py-12 space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold tracking-tight">Акции и предложения</h2>
        <p className="text-xl text-[#6B7280]">Покупайте любимые книги с выгодой.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {promotions.map((promo) => (
          <div key={promo.promotion_id} className="relative overflow-hidden group rounded-[32px] border border-[#E5E7EB] bg-white hover:shadow-2xl transition-all duration-500">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-[#1A1A1A] text-white rounded-2xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full uppercase tracking-wider">
                  Активно
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">{promo.name}</h3>
                <p className="text-[#6B7280] text-sm leading-relaxed">Используйте промокод ниже при оформлении заказа, чтобы получить скидку.</p>
              </div>
              <div className="flex items-center gap-4 p-4 bg-[#F9FAFB] rounded-2xl border border-dashed border-[#D1D5DB]">
                <div className="flex-1">
                  <p className="text-[10px] uppercase font-bold text-[#9CA3AF] mb-1">Ваш промокод</p>
                  <p className="text-xl font-mono font-bold tracking-widest text-[#1A1A1A]">{promo.code_word}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-[#9CA3AF] mb-1">Скидка</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `${promo.discount_value} ₽`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                <Calendar className="w-3.5 h-3.5" />
                <span>До {new Date(promo.end_date).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>
          </div>
        ))}
        {promotions.length === 0 && (
          <div className="col-span-full py-20 text-center bg-[#F9FAFB] rounded-[40px]">
            <p className="text-[#6B7280]">На данный момент активных акций нет. Следите за обновлениями!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OrdersList({ customerId }: { customerId: number }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/orders?client_id=${customerId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setOrders(data);
      });
  }, [customerId]);

  const viewInvoice = async (orderId: number) => {
    try {
      const res = await fetch(`/api/invoices?order_id=${orderId}`);
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : []);
      setSelectedOrder(orders.find(o => o.order_id === orderId));
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setInvoices([]);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 bg-[#F9FAFB] rounded-3xl">
        <p className="text-[#6B7280]">У вас пока нет заказов.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.order_id} className="p-6 bg-white border border-[#E5E7EB] rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-xl",
              order.order_type === 'sale' ? "bg-emerald-50 text-emerald-600" :
              order.order_type === 'booking' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
            )}>
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold">Заказ #{order.order_id}</p>
              <p className="text-xs text-[#6B7280]">{new Date(order.order_date).toLocaleDateString('ru-RU')}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="font-bold text-lg">{order.net_amount} ₽</p>
              {order.discount_amount > 0 && (
                <p className="text-[10px] text-emerald-600 font-bold">Скидка: -{order.discount_amount} ₽</p>
              )}
              <span className={cn(
                "text-[10px] font-bold uppercase",
                order.status === 'completed' ? "text-emerald-600" :
                order.status === 'cancelled' ? "text-red-600" :
                order.status === 'pending' ? "text-amber-600" : "text-blue-600"
              )}>
                {order.status === 'completed' ? 'Выполнен' : 
                 order.status === 'cancelled' ? 'Отменен' :
                 order.status === 'pending' ? 'В обработке' : order.status}
              </span>
            </div>
            <button 
              onClick={() => viewInvoice(order.order_id)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Посмотреть накладную"
            >
              <Truck className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      ))}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold">Накладная к заказу #{selectedOrder.order_id}</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-6">
              {invoices.map(inv => (
                <div key={inv.invoice_id} className="p-6 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB]">
                  <div className="flex justify-between mb-4">
                    <span className="text-[#6B7280]">Номер накладной:</span>
                    <span className="font-mono font-bold">{inv.invoice_number}</span>
                  </div>
                  <div className="flex justify-between mb-4">
                    <span className="text-[#6B7280]">Дата:</span>
                    <span className="font-bold">{new Date(inv.created_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                  {inv.items && inv.items.length > 0 && (
                    <div className="mb-4 space-y-2">
                       <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">Товары:</p>
                       {inv.items.map((item: any, idx: number) => (
                         <div key={idx} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                            <span className="font-medium max-w-[70%]">{item.title}</span>
                            <span className="text-[#6B7280]">x{item.quantity}</span>
                         </div>
                       ))}
                    </div>
                  )}
                  <div className="flex justify-between pt-4 border-t border-[#E5E7EB]">
                    <span className="font-bold">Сумма:</span>
                    <span className="text-xl font-bold">{inv.total_amount} ₽</span>
                  </div>
                </div>
              ))}
              {invoices.length === 0 && (
                <p className="text-center text-[#6B7280] py-8">Накладные для этого заказа еще не сформированы.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
