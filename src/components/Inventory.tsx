import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Book as BookIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Book, Publisher, Author, Genre } from '../types';

export default function Inventory() {
  const [books, setBooks] = useState<Book[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('');
  const [selectedPublisher, setSelectedPublisher] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [minStock, setMinStock] = useState<string>('');
  const [authorNameFilter, setAuthorNameFilter] = useState<string>('');
  const [publisherNameFilter, setPublisherNameFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Autocomplete state
  const [publisherSearch, setPublisherSearch] = useState('');
  const [showPublisherSuggestions, setShowPublisherSuggestions] = useState(false);
  const [authorSearch, setAuthorSearch] = useState('');
  const [showAuthorSuggestions, setShowAuthorSuggestions] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    isbn: '',
    price: 0,
    quantity_in_stock: 0,
    publisher_id: 0,
    publisher_name: '', // For new publisher
    publication_year: new Date().getFullYear(),
    description: '',
    cover_image_url: '',
    pages_count: 0,
    cover_type: 'hard' as 'hard' | 'soft',
    author_ids: [] as number[],
    author_names: [] as string[], // For new authors
    genre_ids: [] as number[]
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const formDataUpload = new FormData();
      formDataUpload.append('image', file);
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formDataUpload
        });
        if (res.ok) {
          const data = await res.json();
          setFormData({ ...formData, cover_image_url: data.url });
          setImagePreview(`/${data.url}`);
        }
      } catch (error) {
        console.error('Error uploading image:', error);
      }
    }
  };

  const getImageUrl = (url: string | null) => {
    if (!url) return 'https://picsum.photos/seed/book/400/600';
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return url;
    if (url.startsWith('images/')) return `/${url}`;
    return `/images/${url}`;
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery, selectedGenre, selectedAuthor, selectedPublisher, selectedYear, minStock, sortBy, authorNameFilter, publisherNameFilter]);

  const fetchData = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append('search', searchQuery);
      if (selectedGenre) queryParams.append('genre_id', selectedGenre);
      if (selectedAuthor) queryParams.append('author_id', selectedAuthor);
      if (selectedPublisher) queryParams.append('publisher_id', selectedPublisher);
      if (selectedYear) queryParams.append('year', selectedYear);
      if (minStock) queryParams.append('min_stock', minStock);
      if (sortBy) queryParams.append('sort', sortBy);
      if (authorNameFilter) queryParams.append('author_name', authorNameFilter);
      if (publisherNameFilter) queryParams.append('publisher_name', publisherNameFilter);

      const [booksRes, pubRes, authRes, genRes] = await Promise.all([
        fetch(`/api/books?${queryParams.toString()}`),
        fetch('/api/publishers'),
        fetch('/api/authors'),
        fetch('/api/genres')
      ]);
      
      const booksData = booksRes.ok ? await booksRes.json() : [];
      const pubData = pubRes.ok ? await pubRes.json() : [];
      const authData = authRes.ok ? await authRes.json() : [];
      const genData = genRes.ok ? await genRes.json() : [];
      
      setBooks(Array.isArray(booksData) ? booksData : []);
      setPublishers(Array.isArray(pubData) ? pubData : []);
      setAuthors(Array.isArray(authData) ? authData : []);
      setGenres(Array.isArray(genData) ? genData : []);
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Final check for dynamic entities from search fields if IDs missing
    let finalPublisherId = 0;
    let finalPublisherName = '';
    
    // First, check if publisherSearch matches an existing one
    const matchingPub = publishers.find(p => p.name.toLowerCase() === publisherSearch.trim().toLowerCase());
    if (matchingPub) {
      finalPublisherId = matchingPub.publisher_id;
    } else if (publisherSearch.trim()) {
      finalPublisherName = publisherSearch.trim();
    }

    // Validation
    if (!formData.title || !formData.isbn || formData.price <= 0 || (finalPublisherId === 0 && !finalPublisherName) || (formData.author_ids.length === 0 && formData.author_names.length === 0)) {
      alert('Пожалуйста, заполните все обязательные поля корректно (название, ISBN, цена > 0, издательство, хотя бы один автор)');
      return;
    }

    const url = editingBook ? `/api/books/${editingBook.book_id}` : '/api/books';
    const method = editingBook ? 'PUT' : 'POST';

    const payload = {
      ...formData,
      publisher_id: finalPublisherId,
      publisher_name: finalPublisherName
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowModal(false);
        setEditingBook(null);
        setImagePreview(null);
        fetchData();
        setFormData({
          title: '',
          isbn: '',
          price: 0,
          quantity_in_stock: 0,
          publisher_id: 0,
          publisher_name: '',
          publication_year: new Date().getFullYear(),
          description: '',
          cover_image_url: '',
          pages_count: 0,
          cover_type: 'hard',
          author_ids: [],
          author_names: [],
          genre_ids: []
        });
      } else {
        const errorData = await res.json();
        alert(`Ошибка: ${errorData.error || 'Не удалось сохранить книгу'}`);
      }
    } catch (error) {
      console.error('Error saving book:', error);
      alert('Произошла сетевая ошибка при сохранении книги');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту книгу?')) return;
    try {
      const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (error) {
      console.error('Error deleting book:', error);
    }
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    setImagePreview(book.cover_image_url ? getImageUrl(book.cover_image_url) : null);
    setFormData({
      title: book.title,
      isbn: book.isbn,
      price: Number(book.price),
      quantity_in_stock: book.quantity_in_stock,
      publisher_id: book.publisher_id,
      publisher_name: '',
      publication_year: book.publication_year,
      description: book.description || '',
      cover_image_url: book.cover_image_url || '',
      pages_count: book.pages_count || 0,
      cover_type: book.cover_type || 'hard',
      author_ids: book.author_ids || [],
      author_names: [],
      genre_ids: book.genre_ids || []
    });
    
    const pub = publishers.find(p => p.publisher_id === book.publisher_id);
    setPublisherSearch(pub ? pub.name : '');
    setAuthorSearch('');
    
    setShowModal(true);
  };

  const toggleAuthor = (id: number) => {
    setFormData(prev => ({
      ...prev,
      author_ids: prev.author_ids.includes(id)
        ? prev.author_ids.filter(aid => aid !== id)
        : [...prev.author_ids, id]
    }));
  };

  const toggleGenre = (id: number) => {
    setFormData(prev => ({
      ...prev,
      genre_ids: prev.genre_ids.includes(id)
        ? prev.genre_ids.filter(gid => gid !== id)
        : [...prev.genre_ids, id]
    }));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">Склад</h1>
          <p className="text-[#6B7280] mt-1">Управление книжным фондом и запасами.</p>
        </div>
        <button 
          onClick={() => {
            setEditingBook(null);
            setPublisherSearch('');
            setAuthorSearch('');
            setFormData({
              title: '',
              isbn: '',
              price: 0,
              quantity_in_stock: 0,
              publisher_id: 0,
              publisher_name: '',
              publication_year: new Date().getFullYear(),
              description: '',
              cover_image_url: '',
              pages_count: 0,
              cover_type: 'hard',
              author_ids: [],
              author_names: [],
              genre_ids: []
            });
            setShowModal(true);
          }}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold"
        >
          <Plus size={20} />
          Добавить книгу
        </button>
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-[#F1F1F4] shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={20} />
          <input
            type="text"
            placeholder="Поиск по названию, ISBN..."
            className="w-full pl-12 pr-4 py-3 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "px-6 py-3 rounded-2xl flex items-center gap-2 transition-all font-bold border",
              showFilters 
                ? "bg-indigo-50 border-indigo-100 text-indigo-600" 
                : "bg-white border-[#F1F1F4] text-[#6B7280] hover:bg-gray-50"
            )}
          >
            <Filter size={20} />
            Фильтры
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-8 rounded-[32px] border border-[#F1F1F4] shadow-sm space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Поиск автора</label>
                  <input 
                    type="text"
                    placeholder="Имя автора..."
                    value={authorNameFilter}
                    onChange={(e) => setAuthorNameFilter(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#F1F1F4] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Поиск изд-ва</label>
                  <input 
                    type="text"
                    placeholder="Название..."
                    value={publisherNameFilter}
                    onChange={(e) => setPublisherNameFilter(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#F1F1F4] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Жанр</label>
                  <select 
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#F1F1F4] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Все жанры</option>
                    {genres.map(g => (
                      <option key={g.genre_id} value={g.genre_id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Автор (ID)</label>
                  <select 
                    value={selectedAuthor}
                    onChange={(e) => setSelectedAuthor(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#F1F1F4] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Все авторы</option>
                    {authors.map(a => (
                      <option key={a.author_id} value={a.author_id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Издательство (ID)</label>
                  <select 
                    value={selectedPublisher}
                    onChange={(e) => setSelectedPublisher(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#F1F1F4] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Все изд-ва</option>
                    {publishers.map(p => (
                      <option key={p.publisher_id} value={p.publisher_id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Год</label>
                  <input 
                    type="number"
                    placeholder="2024"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#F1F1F4] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Мин. склад</label>
                  <input 
                    type="number"
                    placeholder="0"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#F1F1F4] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Сортировка</label>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#F1F1F4] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="newest">Новинки</option>
                    <option value="price_asc">Цена (возр.)</option>
                    <option value="price_desc">Цена (убыв.)</option>
                    <option value="stock_asc">Склад (возр.)</option>
                    <option value="stock_desc">Склад (убыв.)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-[#F1F1F4]">
                <button 
                  onClick={() => {
                    setSelectedGenre('');
                    setSelectedAuthor('');
                    setSelectedPublisher('');
                    setSelectedYear('');
                    setMinStock('');
                    setSortBy('newest');
                    setSearchQuery('');
                  }}
                  className="px-6 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-xl font-bold transition-all"
                >
                  Сбросить все
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[32px] border border-[#F1F1F4] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-[#F1F1F4]">
                <th className="px-8 py-5 text-xs font-bold text-[#6B7280] uppercase tracking-widest">Книга</th>
                <th className="px-8 py-5 text-xs font-bold text-[#6B7280] uppercase tracking-widest">Жанры</th>
                <th className="px-8 py-5 text-xs font-bold text-[#6B7280] uppercase tracking-widest">Цена</th>
                <th className="px-8 py-5 text-xs font-bold text-[#6B7280] uppercase tracking-widest">Склад</th>
                <th className="px-8 py-5 text-xs font-bold text-[#6B7280] uppercase tracking-widest">Статус</th>
                <th className="px-8 py-5 text-xs font-bold text-[#6B7280] uppercase tracking-widest">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F1F4]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-[#6B7280] font-medium">Загрузка склада...</p>
                    </div>
                  </td>
                </tr>
              ) : books.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-[#6B7280]">Книги не найдены</td>
                </tr>
              ) : (
                books.map((book) => (
                  <tr key={book.book_id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-16 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden shadow-sm group-hover:shadow-md transition-all">
                          {book.cover_image_url ? (
                            <img src={getImageUrl(book.cover_image_url)} alt={book.title} className="w-full h-full object-cover" />
                          ) : (
                            <BookIcon size={20} className="text-[#9CA3AF]" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-[#1A1A1A] group-hover:text-indigo-600 transition-colors">{book.title}</div>
                          <div className="text-[10px] font-bold text-[#9CA3AF] mt-1 uppercase tracking-wider">ISBN: {book.isbn}</div>
                          <div className="text-xs font-semibold text-indigo-600 mt-1">
                            {book.authors_list?.map(a => a.name).join(', ')}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold uppercase">{book.cover_type === 'hard' ? 'Твердая' : 'Мягкая'}</span>
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold uppercase">{book.pages_count} стр.</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-wrap gap-1.5">
                        {book.genres_list?.map(g => (
                          <span key={g.genre_id} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                            {g.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-8 py-5 font-bold text-[#1A1A1A]">{book.price} ₽</td>
                    <td className="px-8 py-5 text-[#6B7280] font-medium">{book.quantity_in_stock} шт.</td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider",
                        book.quantity_in_stock > 10 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : book.quantity_in_stock > 0 
                            ? 'bg-amber-50 text-amber-600' 
                            : 'bg-red-50 text-red-600'
                      )}>
                        {book.quantity_in_stock > 10 ? 'В наличии' : book.quantity_in_stock > 0 ? 'Мало' : 'Нет'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => openEditModal(book)}
                          className="p-2.5 text-[#9CA3AF] hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md border border-transparent hover:border-indigo-100"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(book.book_id)}
                          className="p-2.5 text-[#9CA3AF] hover:text-red-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow-md border border-transparent hover:border-red-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20"
            >
                <div className="p-8 border-b border-[#F1F1F4] flex flex-col gap-4 bg-indigo-50/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-2xl font-bold text-[#1A1A1A]">
                        {editingBook ? 'Редактировать книгу' : 'Добавить книгу'}
                      </h2>
                      <p className="text-sm text-[#6B7280] mt-1">Заполните информацию о издании.</p>
                    </div>
                    <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                      <X size={24} />
                    </button>
                  </div>
                </div>
              
              <form onSubmit={handleSubmit} className="p-10 overflow-y-auto flex-1 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Название</label>
                    <input
                      required
                      type="text"
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">ISBN</label>
                    <input
                      required
                      type="text"
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                      value={formData.isbn}
                      onChange={e => setFormData({...formData, isbn: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Цена (₽)</label>
                    <input
                      required
                      type="number"
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                      value={formData.price}
                      onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Количество</label>
                    <input
                      required
                      type="number"
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                      value={formData.quantity_in_stock}
                      onChange={e => setFormData({...formData, quantity_in_stock: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2 relative">
                    <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Издательство</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Начните вводить название..."
                        className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                        value={publisherSearch}
                        onChange={(e) => {
                          setPublisherSearch(e.target.value);
                          setShowPublisherSuggestions(true);
                          // If cleared, reset ID
                          if (!e.target.value) setFormData({ ...formData, publisher_id: 0 });
                        }}
                        onFocus={() => setShowPublisherSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowPublisherSuggestions(false), 200)}
                      />
                      <AnimatePresence>
                        {showPublisherSuggestions && publisherSearch && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-[110] left-0 right-0 mt-2 bg-white border border-[#F1F1F4] rounded-2xl shadow-xl max-h-48 overflow-y-auto"
                          >
                            {publishers
                              .filter(p => p.name.toLowerCase().includes(publisherSearch.toLowerCase()))
                              .map(p => (
                                <button
                                  key={p.publisher_id}
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, publisher_id: p.publisher_id });
                                    setPublisherSearch(p.name);
                                    setShowPublisherSuggestions(false);
                                  }}
                                  className="w-full text-left px-5 py-3 hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                                >
                                  <span className="font-medium text-[#1A1A1A]">{p.name}</span>
                                  {formData.publisher_id === p.publisher_id && <Check size={16} className="text-indigo-600" />}
                                </button>
                              ))}
                            {publishers.filter(p => p.name.toLowerCase().includes(publisherSearch.toLowerCase())).length === 0 && (
                              <div className="px-5 py-3 flex flex-col gap-2">
                                <div className="text-sm text-[#9CA3AF]">Ничего не найдено</div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      publisher_id: 0,
                                      publisher_name: publisherSearch
                                    }));
                                    setShowPublisherSuggestions(false);
                                  }}
                                  className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl hover:bg-indigo-100 transition-all text-center"
                                >
                                  Добавить "{publisherSearch}" как новое изд-во
                                </button>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Год публикации</label>
                    <input
                      required
                      type="number"
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                      value={formData.publication_year}
                      onChange={e => setFormData({...formData, publication_year: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Кол-во страниц</label>
                    <input
                      type="number"
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                      value={formData.pages_count}
                      onChange={e => setFormData({...formData, pages_count: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Тип обложки</label>
                    <select
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                      value={formData.cover_type}
                      onChange={e => setFormData({...formData, cover_type: e.target.value as 'hard' | 'soft'})}
                    >
                      <option value="hard">Твердая</option>
                      <option value="soft">Мягкая</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3 relative">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Авторы</label>
                  
                  <div className="relative">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {formData.author_ids.map(id => {
                        const author = authors.find(a => a.author_id === id);
                        return (
                          <span key={`id-${id}`} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm">
                            {author?.name || 'Unknown'}
                            <button 
                              type="button" 
                              onClick={() => toggleAuthor(id)}
                              className="hover:text-red-200 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        );
                      })}
                      {formData.author_names.map(name => (
                        <span key={`name-${name}`} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm">
                          {name} (Новый)
                          <button 
                            type="button" 
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              author_names: prev.author_names.filter(n => n !== name)
                            }))}
                            className="hover:text-red-200 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                    
                    <input
                      type="text"
                      placeholder="Поиск авторов..."
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                      value={authorSearch}
                      onChange={(e) => {
                        setAuthorSearch(e.target.value);
                        setShowAuthorSuggestions(true);
                      }}
                      onFocus={() => setShowAuthorSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowAuthorSuggestions(false), 200)}
                    />
                    
                    <AnimatePresence>
                      {showAuthorSuggestions && authorSearch && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-[110] left-0 right-0 mt-2 bg-white border border-[#F1F1F4] rounded-2xl shadow-xl max-h-48 overflow-y-auto"
                        >
                          {authors
                            .filter(a => a.name.toLowerCase().includes(authorSearch.toLowerCase()))
                            .map(a => (
                              <button
                                key={a.author_id}
                                type="button"
                                onClick={() => {
                                  if (!formData.author_ids.includes(a.author_id)) {
                                    toggleAuthor(a.author_id);
                                  }
                                  setAuthorSearch('');
                                  setShowAuthorSuggestions(false);
                                }}
                                className="w-full text-left px-5 py-3 hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                              >
                                <span className="font-medium text-[#1A1A1A]">{a.name}</span>
                                {formData.author_ids.includes(a.author_id) && <Check size={16} className="text-indigo-600" />}
                              </button>
                            ))}
                          {authors.filter(a => a.name.toLowerCase().includes(authorSearch.toLowerCase())).length === 0 && (
                            <div className="px-5 py-3 flex flex-col gap-2">
                              <div className="text-sm text-[#9CA3AF]">Ничего не найдено</div>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    author_names: [...new Set([...prev.author_names, authorSearch])]
                                  }));
                                  setAuthorSearch('');
                                  setShowAuthorSuggestions(false);
                                }}
                                className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl hover:bg-indigo-100 transition-all text-center"
                              >
                                Добавить "{authorSearch}" как нового автора
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Жанры</label>
                  <div className="flex flex-wrap gap-2 p-5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-3xl max-h-40 overflow-y-auto">
                    {genres.map(genre => (
                      <button
                        key={genre.genre_id}
                        type="button"
                        onClick={() => toggleGenre(genre.genre_id)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border",
                          formData.genre_ids.includes(genre.genre_id)
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                            : 'bg-white border-[#F1F1F4] text-[#6B7280] hover:border-indigo-200 hover:text-indigo-600'
                        )}
                      >
                        {genre.name}
                        {formData.genre_ids.includes(genre.genre_id) && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Обложка книги</label>
                  <div className="flex flex-col sm:flex-row items-start gap-8">
                    <div className="w-32 h-48 bg-[#F9FAFB] rounded-3xl border-2 border-dashed border-[#F1F1F4] flex items-center justify-center overflow-hidden shrink-0 group hover:border-indigo-300 transition-colors">
                      {imagePreview || formData.cover_image_url ? (
                        <img 
                          src={imagePreview || getImageUrl(formData.cover_image_url)} 
                          alt="Preview" 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <BookIcon className="text-[#9CA3AF]" size={40} />
                      )}
                    </div>
                    <div className="flex-1 space-y-4 w-full">
                      <div className="flex flex-col gap-3">
                        <label className="cursor-pointer bg-white border border-[#F1F1F4] px-6 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 transition-all shadow-sm text-center">
                          Загрузить файл
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleImageChange}
                          />
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Или вставьте прямую ссылку на изображение"
                            className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                            value={formData.cover_image_url}
                            onChange={e => setFormData({...formData, cover_image_url: e.target.value})}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">
                        Рекомендуемый формат: 400x600px, PNG или JPG.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Описание</label>
                  <textarea
                    rows={4}
                    className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium resize-none"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="pt-6 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-8 py-4 border border-[#F1F1F4] text-[#6B7280] rounded-2xl font-bold hover:bg-gray-50 transition-all"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    {editingBook ? 'Сохранить изменения' : 'Добавить книгу'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
