import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  MoreVertical,
  History,
  X,
  CreditCard,
  Trash2,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Client } from '../types';
import Modal from './Modal';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState<Partial<Client>>({});

  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<any[]>([]);

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

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm,
    });
  };

  const fetchClients = () => {
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        console.log('Fetched clients:', data);
        if (Array.isArray(data)) {
          setClients(data.map(c => ({
            ...c,
            full_name: c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Без имени'
          })));
        } else {
          console.error('Expected array for clients, got:', data);
          setClients([]);
        }
      })
      .catch(err => {
        console.error('Error fetching clients:', err);
        setClients([]);
      });
  };

  const fetchClientHistory = async (clientId: number) => {
    const res = await fetch(`/api/orders?client_id=${clientId}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      setClientHistory(data);
    }
  };

  const handleShowHistory = (client: Client) => {
    setHistoryClient(client);
    fetchClientHistory(client.id);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingClient?.id ? 'PUT' : 'POST';
    const url = editingClient?.id ? `/api/clients/${editingClient.id}` : '/api/clients';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingClient)
    });
    setIsModalOpen(false);
    setEditingClient(null);
    fetchClients();
  };

  const handleDelete = async (id: number) => {
    showConfirm(
      'Удаление клиента',
      'Вы уверены, что хотите удалить этого клиента?',
      async () => {
        await fetch(`/api/clients/${id}`, { method: 'DELETE' });
        fetchClients();
      }
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">Клиенты</h1>
          <p className="text-[#6B7280] mt-1">Управление базой клиентов и программой лояльности.</p>
        </div>
        <button 
          onClick={() => { setEditingClient({}); setIsModalOpen(true); }}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Добавить клиента
        </button>
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-[#F1F1F4] shadow-sm">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input 
            type="text" 
            placeholder="Поиск клиентов по имени, email или телефону..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.filter(c => (
          (c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.phone || '').toLowerCase().includes(search.toLowerCase())
        )).length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-[32px] border border-[#F1F1F4]">
            <p className="text-[#6B7280] text-lg">Клиенты не найдены</p>
          </div>
        ) : (
          clients.filter(c => (
            (c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.phone || '').toLowerCase().includes(search.toLowerCase())
          )).map((client) => (
            <div key={client.id} className="bg-white p-8 rounded-[32px] border border-[#F1F1F4] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
            
            <div className="relative">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                  <User className="w-7 h-7" />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setEditingClient(client); setIsModalOpen(true); }}
                    className="p-2.5 bg-white border border-[#F1F1F4] rounded-xl text-[#9CA3AF] hover:text-indigo-600 hover:border-indigo-100 shadow-sm transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(client.id)}
                    className="p-2.5 bg-white border border-[#F1F1F4] rounded-xl text-[#9CA3AF] hover:text-red-600 hover:border-red-100 shadow-sm transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-[#1A1A1A]">{client.full_name}</h3>
              <p className="text-[10px] font-bold text-[#9CA3AF] mt-1 uppercase tracking-widest">ID Клиента: #{client.id?.toString().padStart(4, '0') || 'N/A'}</p>
              
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3 text-sm font-medium text-[#4B5563]">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-[#9CA3AF]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <span>{client.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-[#4B5563]">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-[#9CA3AF]">
                    <Phone className="w-4 h-4" />
                  </div>
                  <span>{client.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-[#4B5563]">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-[#9CA3AF]">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span>Регистрация: {new Date(client.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#F1F1F4]">
                <button 
                  onClick={() => handleShowHistory(client)}
                  className="w-full py-3 bg-[#F9FAFB] text-[#1A1A1A] text-xs font-bold rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 border border-transparent hover:border-indigo-100"
                >
                  <History className="w-4 h-4" />
                  История заказов
                </button>
              </div>
            </div>
          </div>
        )))}
      </div>

      {historyClient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20">
            <div className="px-10 py-8 border-b border-[#F1F1F4] flex items-center justify-between bg-gray-50/30">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1A1A]">История заказов</h2>
                <p className="text-sm text-[#6B7280] mt-1">{historyClient.full_name}</p>
              </div>
              <button onClick={() => setHistoryClient(null)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-10 max-h-[60vh] overflow-y-auto space-y-4">
              {clientHistory.length === 0 ? (
                <div className="text-center py-16 text-[#6B7280]">
                  <History size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-medium">У этого клиента пока нет заказов.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {clientHistory.map((order) => (
                    <div key={order.id} className="p-6 bg-[#F9FAFB] border border-[#F1F1F4] rounded-[24px] hover:bg-white hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-bold text-[#1A1A1A]">Заказ #{order.id}</p>
                          <p className="text-xs text-[#9CA3AF] font-medium mt-1">{new Date(order.order_date).toLocaleString('ru-RU')}</p>
                        </div>
                        <span className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider",
                          order.order_type === 'sale' ? "bg-emerald-50 text-emerald-600" :
                          order.order_type === 'booking' ? "bg-blue-50 text-blue-600" :
                          order.order_type === 'preorder' ? "bg-amber-50 text-amber-600" :
                          "bg-violet-50 text-violet-600"
                        )}>
                          {order.order_type === 'sale' ? 'Продажа' :
                           order.order_type === 'booking' ? 'Бронь' :
                           order.order_type === 'preorder' ? 'Предзаказ' : 'Резерв'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-4 border-t border-[#F1F1F4]/50">
                        <span className="text-sm font-bold text-[#6B7280]">Сумма заказа</span>
                        <span className="text-lg font-bold text-indigo-600">{order.total_amount} ₽</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden border border-white/20">
            <div className="px-10 py-8 border-b border-[#F1F1F4] flex items-center justify-between bg-gray-50/30">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1A1A]">
                  {editingClient?.id ? 'Редактировать' : 'Новый клиент'}
                </h2>
                <p className="text-sm text-[#6B7280] mt-1">Заполните данные профиля.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Имя</label>
                    <input 
                      required
                      value={editingClient?.first_name || ''}
                      onChange={(e) => setEditingClient({ ...editingClient, first_name: e.target.value })}
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Фамилия</label>
                    <input 
                      required
                      value={editingClient?.last_name || ''}
                      onChange={(e) => setEditingClient({ ...editingClient, last_name: e.target.value })}
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Email</label>
                  <input 
                    type="email"
                    required
                    value={editingClient?.email || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                    className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Телефон</label>
                  <input 
                    required
                    value={editingClient?.phone || ''}
                    maxLength={12}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val.length > 0 && !val.startsWith('+7')) {
                        if (val.startsWith('7') || val.startsWith('8')) val = '+7' + val.substring(1);
                        else if (!val.startsWith('+')) val = '+7' + val;
                        else val = '+7';
                      }
                      if (val.length > 2) {
                        const numbers = val.substring(2).replace(/\D/g, '');
                        val = '+7' + numbers;
                      }
                      if (val.length <= 12) {
                        setEditingClient({ ...editingClient, phone: val });
                      }
                    }}
                    onFocus={() => {
                      if (!editingClient?.phone) setEditingClient({ ...editingClient, phone: '+7' });
                    }}
                    className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                  />
                </div>
                {!editingClient?.id && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Пароль</label>
                    <input 
                      type="password"
                      required
                      value={editingClient?.password || ''}
                      onChange={(e) => setEditingClient({ ...editingClient, password: e.target.value })}
                      className="w-full px-5 py-3.5 bg-[#F9FAFB] border border-[#F1F1F4] rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all font-medium"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 text-sm font-bold text-[#6B7280] hover:bg-gray-50 rounded-2xl transition-all border border-[#F1F1F4]"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-indigo-600 text-white text-sm font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  {editingClient?.id ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Alert/Confirm Modal */}
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        type={modalConfig.type}
        title={modalConfig.title}
        onConfirm={modalConfig.onConfirm}
      >
        <p className="text-[#4B5563] leading-relaxed">{modalConfig.message}</p>
      </Modal>
    </div>
  );
}
