/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Tag, 
  ShoppingCart, 
  BarChart3, 
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Components
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Clients from './components/Clients';
import Promotions from './components/Promotions';
import Sales from './components/Sales';
import Reports from './components/Reports';
import UserSite from './components/UserSite';
import Login from './components/Login';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type View = 'dashboard' | 'inventory' | 'clients' | 'promotions' | 'sales' | 'reports';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border border-red-100">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Что-то пошло не так</h2>
            <p className="text-gray-600 mb-6">Приложение столкнулось с ошибкой. Пожалуйста, попробуйте перезагрузить страницу.</p>
            <div className="bg-gray-50 p-4 rounded-xl overflow-auto max-h-40 text-xs font-mono text-red-500 mb-6">
              {this.state.error?.toString()}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [mode, setMode] = useState<'admin' | 'user'>('user');

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      if (parsedUser.isAdmin) {
        setMode('admin');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    window.location.reload();
  };

  const navItems = [
    { id: 'dashboard', label: 'Обзор', icon: LayoutDashboard },
    { id: 'inventory', label: 'Склад', icon: BookOpen },
    { id: 'clients', label: 'Клиенты', icon: Users },
    { id: 'promotions', label: 'Акции', icon: Tag },
    { id: 'sales', label: 'Продажи и Заказы', icon: ShoppingCart },
    { id: 'reports', label: 'Отчеты', icon: BarChart3 },
  ];

  const renderView = () => {
    const view = (() => {
      switch (activeView) {
        case 'dashboard': return <Dashboard />;
        case 'inventory': return <Inventory />;
        case 'clients': return <Clients />;
        case 'promotions': return <Promotions />;
        case 'sales': return <Sales />;
        case 'reports': return <Reports />;
        default: return <Dashboard />;
      }
    })();

    return (
      <ErrorBoundary>
        {view}
      </ErrorBoundary>
    );
  };

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const markNotificationsAsRead = () => {
    fetch('/api/notifications/read', { method: 'POST' })
      .then(() => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        setShowNotifications(false);
      });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) {
    return <Login onLogin={(u) => { setUser(u); if (u.isAdmin) setMode('admin'); localStorage.setItem('user', JSON.stringify(u)); }} />;
  }

  if (mode === 'user') {
    return (
      <div className="relative">
        {user?.isAdmin && (
          <button 
            onClick={() => setMode('admin')}
            className="fixed bottom-8 right-8 z-[100] bg-[#1A1A1A] text-white px-6 py-3 rounded-full font-bold shadow-2xl hover:scale-105 transition-all"
          >
            Вернуться в админку
          </button>
        )}
        <UserSite />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex text-[#1A1A1A] font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-[#F1F1F4] transition-all duration-700 ease-[0.23,1,0.32,1] flex flex-col z-50 shadow-[8px_0_32px_rgba(0,0,0,0.02)] relative",
          isSidebarOpen ? "w-80" : "w-28"
        )}
      >
        <div className="p-10 flex items-center gap-5 border-b border-[#F1F1F4] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600" />
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[18px] flex items-center justify-center text-white font-black text-xl shadow-xl shadow-indigo-200 shrink-0">
            К
          </div>
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-black text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-700"
            >
              Книга24
            </motion.span>
          )}
        </div>

        <nav className="flex-1 p-8 space-y-4 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={cn(
                "w-full flex items-center gap-5 px-5 py-4.5 rounded-[24px] transition-all group relative overflow-hidden",
                activeView === item.id 
                  ? "bg-indigo-600 text-white shadow-2xl shadow-indigo-200/50" 
                  : "text-[#6B7280] hover:bg-indigo-50/60 hover:text-indigo-600"
              )}
            >
              <item.icon className={cn("w-6 h-6 transition-all duration-500 group-hover:scale-110", activeView === item.id ? "text-white" : "text-[#9CA3AF] group-hover:text-indigo-600")} />
              {isSidebarOpen && <span className="font-bold tracking-tight">{item.label}</span>}
              {activeView === item.id && (
                <motion.div 
                  layoutId="activeNav"
                  className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-700 -z-10"
                />
              )}
              {activeView === item.id && !isSidebarOpen && (
                <div className="absolute left-full ml-6 px-4 py-2 bg-[#1A1A1A] text-white text-[11px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap z-[100] shadow-2xl translate-x-[-10px] group-hover:translate-x-0">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-8 border-t border-[#F1F1F4] bg-gray-50/30">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-5 px-5 py-4.5 text-[#EF4444] hover:bg-[#FEF2F2] rounded-[24px] transition-all group font-bold"
          >
            <LogOut className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
            {isSidebarOpen && <span className="tracking-tight">Выйти</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-24 bg-white/90 backdrop-blur-xl border-b border-[#F1F1F4] flex items-center justify-between px-12 shrink-0 z-40 sticky top-0">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-3 hover:bg-indigo-50 text-indigo-600 rounded-2xl transition-all border-2 border-transparent hover:border-indigo-100 shadow-sm"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:flex items-center gap-3 text-sm font-medium">
              <span className="text-[#9CA3AF]">Панель управления</span>
              <div className="w-1.5 h-1.5 bg-[#D1D5DB] rounded-full" />
              <span className="font-bold text-[#1A1A1A] text-base">{navItems.find(i => i.id === activeView)?.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-3 hover:bg-indigo-50 text-[#6B7280] hover:text-indigo-600 rounded-2xl relative transition-all border-2 border-transparent hover:border-indigo-100 shadow-sm"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-3 right-3 w-3 h-3 bg-[#EF4444] rounded-full border-[3px] border-white shadow-sm animate-pulse"></span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    className="absolute right-0 mt-6 w-[420px] bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-[#F1F1F4] z-[60] overflow-hidden"
                  >
                    <div className="p-8 border-b border-[#F1F1F4] flex items-center justify-between bg-indigo-50/20">
                      <h3 className="font-black text-xl text-[#1A1A1A]">Уведомления</h3>
                      {unreadCount > 0 && (
                        <button 
                          onClick={markNotificationsAsRead}
                          className="text-xs text-indigo-600 font-black hover:bg-white px-4 py-2 bg-white/50 rounded-full shadow-sm transition-all"
                        >
                          Прочитать все
                        </button>
                      )}
                    </div>
                    <div className="max-h-[520px] overflow-y-auto p-4 scrollbar-hide">
                      {notifications.length === 0 ? (
                        <div className="p-16 text-center">
                          <div className="w-20 h-20 bg-gray-50 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                            <Bell className="w-10 h-10 text-gray-300" />
                          </div>
                          <p className="text-[#6B7280] font-bold text-lg">Нет новых уведомлений</p>
                          <p className="text-[#9CA3AF] text-sm mt-2">Мы сообщим вам, когда что-то произойдет</p>
                        </div>
                      ) : (
                        notifications.map((n, i) => (
                          <div 
                            key={i} 
                            className={cn(
                              "p-6 rounded-[28px] mb-2 last:mb-0 transition-all cursor-pointer group",
                              !n.is_read ? "bg-indigo-50/40 hover:bg-indigo-50" : "hover:bg-gray-50"
                            )}
                          >
                            <div className="flex gap-4">
                              <div className={cn("w-2.5 h-2.5 rounded-full mt-2 shrink-0 transition-all", !n.is_read ? "bg-indigo-600 scale-110" : "bg-transparent")} />
                              <div className="flex-1">
                                <p className="text-base font-bold text-[#1A1A1A] group-hover:text-indigo-600 transition-colors">{n.title}</p>
                                <p className="text-sm text-[#6B7280] mt-1.5 leading-relaxed font-medium">{n.message}</p>
                                <div className="flex items-center gap-2 mt-4">
                                  <div className="w-1 h-1 bg-[#D1D5DB] rounded-full" />
                                  <p className="text-[11px] text-[#9CA3AF] font-bold uppercase tracking-wider">
                                    {new Date(n.created_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="flex items-center gap-6 pl-8 border-l border-[#F1F1F4]">
              <button 
                onClick={() => setMode('user')}
                className="px-6 py-3 text-xs font-black text-indigo-600 hover:bg-indigo-50 rounded-full transition-all border-2 border-indigo-100/50 hover:border-indigo-200 shadow-sm"
              >
                На сайт
              </button>
              <div className="flex items-center gap-4">
                <div className="text-right hidden xl:block">
                  <p className="text-sm font-black text-[#1A1A1A] leading-none">Администратор</p>
                  <p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.1em] mt-2 opacity-80">Менеджер магазина</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-700 rounded-[22px] flex items-center justify-center text-white shadow-xl shadow-indigo-100 border-4 border-white relative group cursor-pointer">
                  <UserIcon className="w-6 h-6 transition-transform group-hover:scale-110" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-white rounded-full shadow-sm" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* View Container */}
        <div className="flex-1 overflow-y-auto p-12 bg-[#FDFDFF] scrollbar-hide">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="max-w-[1600px] mx-auto"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

