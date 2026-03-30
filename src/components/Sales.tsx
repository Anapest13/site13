import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ShoppingCart, 
  Package, 
  Clock, 
  CheckCircle2, 
  Search,
  User,
  BookOpen,
  ArrowRight,
  FileText,
  X,
  MoreVertical
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Book, Client, Promotion, Order } from '../types';
import Modal from './Modal';

export default function Sales() {
  const [books, setBooks] = useState<Book[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSale, setNewSale] = useState<Partial<Order & { book_id: number, quantity: number, client_id: number, sale_type: string }>>({
    sale_type: 'sale',
    quantity: 1
  });

  const [orders, setOrders] = useState<any[]>([]);
  const [viewAll, setViewAll] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

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

  const fetchOrders = () => {
    fetch(`/api/orders${viewAll ? '?all=true' : ''}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setOrders(data);
        } else {
          console.error('Expected array for orders, got:', data);
          setOrders([]);
        }
      })
      .catch(err => {
        console.error('Error fetching orders:', err);
        setOrders([]);
      });
  };

  useEffect(() => {
    fetchBooks();
    fetchClients();
    fetchPromotions();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [viewAll]);

  const fetchBooks = () => {
    fetch('/api/books')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBooks(data);
        } else {
          setBooks([]);
        }
      })
      .catch(err => {
        console.error('Error fetching books:', err);
        setBooks([]);
      });
  };

  const fetchClients = () => {
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setClients(data);
        } else {
          setClients([]);
        }
      })
      .catch(err => {
        console.error('Error fetching clients:', err);
        setClients([]);
      });
  };

  const fetchPromotions = () => {
    fetch('/api/promotions')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPromotions(data);
        } else {
          setPromotions([]);
        }
      })
      .catch(err => {
        console.error('Error fetching promotions:', err);
        setPromotions([]);
      });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!newSale.book_id || !newSale.client_id || (newSale.quantity || 0) <= 0) {
      alert('Пожалуйста, выберите книгу, клиента и укажите количество (> 0)');
      return;
    }

    const book = books.find(b => b.book_id === newSale.book_id);
    if (!book) return;

    const subtotal = book.price * (newSale.quantity || 1);
    const promo = promotions.find(p => p.promotion_id === newSale.promotion_id);
    let discount = 0;
    if (promo) {
      discount = promo.discount_type === 'percentage' 
        ? (subtotal * promo.discount_value / 100)
        : promo.discount_value;
    }
    const netAmount = Math.max(0, subtotal - discount);
    
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        customer_id: newSale.client_id,
        order_type: newSale.sale_type,
        items: [{ book_id: book.book_id, quantity: newSale.quantity || 1, unit_price: book.price, order_type: newSale.sale_type }],
        total_amount: subtotal,
        net_amount: netAmount,
        discount_amount: discount,
        promotion_id: newSale.promotion_id || null
      })
    });
    
    if (res.ok) {
      setIsModalOpen(false);
      setNewSale({ sale_type: 'sale', quantity: 1 });
      fetchOrders();
      showAlert('Успех', 'Операция успешно завершена');
    } else {
      const err = await res.json();
      showAlert('Ошибка', err.error || 'Не удалось выполнить операцию', 'error');
    }
  };

  const getSaleTypeBadge = (type: string) => {
    const styles = {
      sale: 'bg-emerald-50 text-emerald-600',
      booking: 'bg-blue-50 text-blue-600',
      preorder: 'bg-amber-50 text-amber-600'
    };
    return styles[type as keyof typeof styles] || 'bg-gray-50 text-gray-600';
  };

  const getSaleTypeText = (type: string) => {
    const texts = {
      sale: 'Продажа',
      booking: 'Бронь',
      preorder: 'Предзаказ'
    };
    return texts[type as keyof typeof texts] || type;
  };

  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  const handleUpdateStatus = async (orderId: number, status: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchOrders();
        setActiveMenu(null);
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот заказ?')) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchOrders();
        setActiveMenu(null);
      }
    } catch (err) {
      console.error('Error deleting order:', err);
    }
  };

  const viewInvoice = async (orderId: number) => {
    const res = await fetch(`/api/invoices?order_id=${orderId}`);
    const data = await res.json();
    setInvoices(data);
    setSelectedOrder(orders.find(o => o.order_id === orderId));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">Продажи и заказы</h1>
          <p className="text-[#6B7280] mt-1">Управление транзакциями, бронированием и предзаказами.</p>
        </div>
        <button 
          onClick={() => { setNewSale({ ...newSale, sale_type: 'sale' }); setIsModalOpen(true); }}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Новая операция
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Прямая продажа', id: 'sale', icon: ShoppingCart, color: 'emerald', desc: 'Продажа из наличия' },
          { label: 'Бронирование', id: 'booking', icon: Clock, color: 'blue', desc: 'Резерв для клиента' },
          { label: 'Предзаказ', id: 'preorder', icon: Package, color: 'amber', desc: 'Заказ отсутствующей книги' },
        ].map((action, i) => (
          <button 
            key={i}
            onClick={() => { 
              setNewSale({ ...newSale, sale_type: action.id as any }); 
              setIsModalOpen(true); 
            }}
            className={cn(
              "p-8 rounded-[32px] border text-left transition-all group relative overflow-hidden",
              action.color === 'emerald' ? "bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50 hover:shadow-xl hover:shadow-emerald-100/50" :
              action.color === 'blue' ? "bg-blue-50/30 border-blue-100 hover:bg-blue-50 hover:shadow-xl hover:shadow-blue-100/50" :
              "bg-amber-50/30 border-amber-100 hover:bg-amber-50 hover:shadow-xl hover:shadow-amber-100/50"
            )}
          >
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm transition-all group-hover:scale-110",
              action.color === 'emerald' ? "bg-emerald-100 text-emerald-600" :
              action.color === 'blue' ? "bg-blue-100 text-blue-600" :
              "bg-amber-100 text-amber-600"
            )}>
              <action.icon className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-[#1A1A1A]">{action.label}</h3>
            <p className="text-sm text-[#6B7280] mt-2 font-medium">{action.desc}</p>
            <ArrowRight className="w-5 h-5 absolute bottom-8 right-8 text-[#9CA3AF] group-hover:text-[#1A1A1A] group-hover:translate-x-1 transition-all" />
          </button>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-[32px] border border-[#F1F1F4] shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-[#F1F1F4] flex items-center justify-between bg-gray-50/30">
          <h2 className="text-xl font-bold text-[#1A1A1A]">{viewAll ? 'Все операции' : 'Последние операции'}</h2>
          <button 
            onClick={() => setViewAll(!viewAll)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-xl transition-all"
          >
            {viewAll ? 'Свернуть' : 'Смотреть все'}
          </button>
        </div>
        <div className="divide-y divide-[#F1F1F4]">
          {orders.map((order, i) => (
            <div key={order.order_id || i} className="px-8 py-5 flex items-center justify-between hover:bg-[#F9FAFB] transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-[#6B7280] group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1A1A1A]">ORD-{order.order_id} · {order.customer_name || 'Гость'}</p>
                  <p className="text-xs text-[#6B7280] font-medium mt-0.5">
                    {new Date(order.order_date).toLocaleDateString('ru-RU')} · {new Date(order.order_date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-[#1A1A1A]">{order.net_amount} ₽</p>
                    {order.discount_amount > 0 && (
                      <p className="text-[10px] text-emerald-600 font-bold">-{order.discount_amount} ₽</p>
                    )}
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider mt-1 inline-block",
                      getSaleTypeBadge(order.order_type)
                    )}>
                      {getSaleTypeText(order.order_type)}
                    </span>
                  </div>
                  {order.status === 'pending' && (
                    <button 
                      onClick={async () => {
                        await fetch(`/api/orders/${order.order_id}/status`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: 'completed', order_type: 'sale' })
                        });
                        fetchOrders();
                      }}
                      className="px-4 py-2 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-xl hover:bg-emerald-100 transition-all shadow-sm"
                    >
                      Завершить
                    </button>
                  )}
                  <div className="relative">
                    <div className="flex gap-2">
                      {order.order_type === 'sale' && (
                        <button 
                          onClick={() => viewInvoice(order.order_id)}
                          className="p-2.5 bg-white border border-[#F1F1F4] rounded-xl text-[#9CA3AF] hover:text-indigo-600 hover:border-indigo-100 shadow-sm transition-all"
                          title="Посмотреть накладную"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => setActiveMenu(activeMenu === order.order_id ? null : order.order_id)}
                        className="p-2.5 bg-white border border-[#F1F1F4] rounded-xl text-[#9CA3AF] hover:text-[#1A1A1A] hover:border-[#F1F1F4] shadow-sm transition-all"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    {activeMenu === order.order_id && (
                      <div className="absolute right-0 mt-3 w-56 bg-white rounded-[24px] shadow-2xl border border-[#F1F1F4] z-50 py-2 animate-in fade-in zoom-in duration-200">
                        {order.status === 'reserved' ? (
                          <>
                            <button 
                              onClick={() => handleUpdateStatus(order.order_id, 'completed')}
                              className="w-full text-left px-5 py-3 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-all"
                            >
                              Подтвердить бронь
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(order.order_id, 'cancelled')}
                              className="w-full text-left px-5 py-3 text-xs font-bold text-red-600 hover:bg-red-50 transition-all"
                            >
                              Отменить бронь
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => handleUpdateStatus(order.order_id, 'completed')}
                              className="w-full text-left px-5 py-3 text-xs font-bold text-[#1A1A1A] hover:bg-[#F9FAFB] transition-all"
                            >
                              Отметить выполненным
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(order.order_id, 'cancelled')}
                              className="w-full text-left px-5 py-3 text-xs font-bold text-red-600 hover:bg-red-50 transition-all"
                            >
                              Отменить заказ
                            </button>
                          </>
                        )}
                        <div className="h-px bg-[#F1F1F4] my-2" />
                        <button 
                          onClick={() => handleDeleteOrder(order.order_id)}
                          className="w-full text-left px-5 py-3 text-xs font-bold text-red-600 hover:bg-red-50 transition-all"
                        >
                          Удалить запись
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="px-8 py-20 text-center text-[#6B7280]">
              <FileText size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-medium">Операций пока нет</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden border border-[#F1F1F4]">
            <div className="px-10 py-8 border-b border-[#F1F1F4] flex items-center justify-between bg-gray-50/30">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1A1A]">
                  {newSale.sale_type === 'sale' ? 'Новая продажа' : newSale.sale_type === 'booking' ? 'Новая бронь' : 'Новый предзаказ'}
                </h2>
                <p className="text-sm text-[#6B7280] mt-1 font-medium">Заполните данные для оформления операции</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all text-[#9CA3AF] hover:text-[#1A1A1A] border border-transparent hover:border-[#F1F1F4]"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-2 px-1">
                    <BookOpen className="w-4 h-4 text-indigo-600" /> Книга
                  </label>
                  <select 
                    required
                    value={newSale.book_id || ''}
                    onChange={(e) => setNewSale({ ...newSale, book_id: parseInt(e.target.value) })}
                    className="w-full px-5 py-4 bg-gray-50 border border-[#F1F1F4] rounded-2xl focus:ring-2 focus:ring-indigo-600/20 focus:bg-white focus:border-indigo-600 outline-none transition-all font-medium"
                  >
                    <option value="">Выберите книгу</option>
                    {books.map(b => <option key={b.book_id} value={b.book_id}>{b.title} ({b.price} ₽)</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-2 px-1">
                    <User className="w-4 h-4 text-indigo-600" /> Клиент
                  </label>
                  <select 
                    required
                    value={newSale.client_id || ''}
                    onChange={(e) => setNewSale({ ...newSale, client_id: parseInt(e.target.value) })}
                    className="w-full px-5 py-4 bg-gray-50 border border-[#F1F1F4] rounded-2xl focus:ring-2 focus:ring-indigo-600/20 focus:bg-white focus:border-indigo-600 outline-none transition-all font-medium"
                  >
                    <option value="">Выберите клиента</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div className="space-y-3 md:col-span-2">
                  <label className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider px-1">Тип операции</label>
                  <div className="flex gap-3 p-1.5 bg-gray-50 rounded-2xl border border-[#F1F1F4]">
                    {[
                      { id: 'sale', label: 'Продажа' },
                      { id: 'booking', label: 'Бронь' },
                      { id: 'preorder', label: 'Предзаказ' }
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewSale({ ...newSale, sale_type: type.id as any })}
                        className={cn(
                          "flex-1 py-3 text-xs font-bold rounded-xl transition-all",
                          newSale.sale_type === type.id 
                            ? "bg-white text-indigo-600 shadow-sm border border-[#F1F1F4]" 
                            : "text-[#6B7280] hover:text-[#1A1A1A]"
                        )}
                      >
                        {type.label.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider px-1">Количество</label>
                  <input 
                    type="number"
                    min="1"
                    required
                    value={newSale.quantity || 1}
                    onChange={(e) => setNewSale({ ...newSale, quantity: parseInt(e.target.value) })}
                    className="w-full px-5 py-4 bg-gray-50 border border-[#F1F1F4] rounded-2xl focus:ring-2 focus:ring-indigo-600/20 focus:bg-white focus:border-indigo-600 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider px-1">Промокод</label>
                  <select 
                    value={newSale.promotion_id || ''}
                    onChange={(e) => setNewSale({ ...newSale, promotion_id: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-5 py-4 bg-gray-50 border border-[#F1F1F4] rounded-2xl focus:ring-2 focus:ring-indigo-600/20 focus:bg-white focus:border-indigo-600 outline-none transition-all font-medium"
                  >
                    <option value="">Без промокода</option>
                    {promotions.filter(p => p.is_active).map(p => (
                      <option key={p.promotion_id} value={p.promotion_id}>{p.code_word} ({p.discount_type === 'percentage' ? `-${p.discount_value}%` : `-${p.discount_value} ₽`})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-indigo-50/50 p-8 rounded-[32px] border border-indigo-100/50 space-y-4">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-[#6B7280]">Подытог</span>
                  <span className="text-[#1A1A1A]">
                    {((books.find(b => b.book_id === newSale.book_id)?.price || 0) * (newSale.quantity || 1)).toFixed(2)} ₽
                  </span>
                </div>
                {newSale.promotion_id && (
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-emerald-600">Скидка</span>
                    <span className="text-emerald-600">
                      -{(() => {
                        const promo = promotions.find(p => p.promotion_id === newSale.promotion_id);
                        const subtotal = (books.find(b => b.book_id === newSale.book_id)?.price || 0) * (newSale.quantity || 1);
                        if (!promo) return '0.00';
                        return promo.discount_type === 'percentage' 
                          ? (subtotal * promo.discount_value / 100).toFixed(2)
                          : promo.discount_value.toFixed(2);
                      })()} ₽
                    </span>
                  </div>
                )}
                <div className="pt-4 border-t border-indigo-100 flex justify-between items-center">
                  <span className="font-bold text-[#1A1A1A]">Итоговая сумма</span>
                  <span className="text-3xl font-bold text-indigo-600 tracking-tight">
                    {(() => {
                      const subtotal = (books.find(b => b.book_id === newSale.book_id)?.price || 0) * (newSale.quantity || 1);
                      const promo = promotions.find(p => p.promotion_id === newSale.promotion_id);
                      if (!promo) return subtotal.toFixed(2);
                      const discount = promo.discount_type === 'percentage' 
                        ? (subtotal * promo.discount_value / 100)
                        : promo.discount_value;
                      return Math.max(0, subtotal - discount).toFixed(2);
                    })()} ₽
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-4 text-sm font-bold text-[#6B7280] hover:bg-gray-100 rounded-2xl transition-all"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  className="px-10 py-4 bg-indigo-600 text-white text-sm font-bold rounded-2xl hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-100 transition-all"
                >
                  Подтвердить операцию
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Global Alert/Confirm Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-2xl p-10 shadow-2xl border border-[#F1F1F4]">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="text-2xl font-bold text-[#1A1A1A]">Накладная к заказу #{selectedOrder.order_id}</h3>
                <p className="text-sm text-[#6B7280] mt-1 font-medium">Детализация платежных документов</p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-[#9CA3AF] hover:text-[#1A1A1A]"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-6">
              {invoices.map(inv => (
                <div key={inv.invoice_id} className="p-8 bg-gray-50/50 rounded-[32px] border border-[#F1F1F4] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-110" />
                  <div className="flex justify-between mb-6 relative z-10">
                    <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Номер накладной</span>
                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">{inv.invoice_number}</span>
                  </div>
                  <div className="flex justify-between mb-6 relative z-10">
                    <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Дата формирования</span>
                    <span className="font-bold text-[#1A1A1A]">{new Date(inv.invoice_date).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <div className="flex justify-between pt-6 border-t border-[#F1F1F4] relative z-10 items-center">
                    <span className="font-bold text-[#1A1A1A]">Сумма к оплате</span>
                    <span className="text-3xl font-bold text-indigo-600 tracking-tight">{inv.total_amount} ₽</span>
                  </div>
                </div>
              ))}
              {invoices.length === 0 && (
                <div className="text-center py-16 bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
                  <FileText size={48} className="mx-auto mb-4 opacity-10" />
                  <p className="text-[#6B7280] font-medium">Накладные для этого заказа еще не сформированы.</p>
                </div>
              )}
            </div>
            <div className="mt-10 flex justify-end">
              <button 
                onClick={() => setSelectedOrder(null)}
                className="px-10 py-4 bg-[#1A1A1A] text-white text-sm font-bold rounded-2xl hover:shadow-xl transition-all"
              >
                Закрыть
              </button>
            </div>
          </div>
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
