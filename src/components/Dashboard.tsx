import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { 
  TrendingUp, 
  Users, 
  BookOpen, 
  CreditCard,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { SalesReport } from '../types';

export default function Dashboard() {
  const [salesData, setSalesData] = useState<SalesReport[]>([]);
  const [topCategories, setTopCategories] = useState<{label: string, value: number, color: string}[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalRevenueTrend: 0,
    totalSales: 0,
    totalSalesTrend: 0,
    activeClients: 0,
    activeClientsTrend: 0,
    inventoryCount: 0,
    inventoryTrend: 0
  });

  useEffect(() => {
    fetch('/api/reports/sales?period=day')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSalesData(data);
      });

    fetch('/api/reports/top-categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTopCategories(data);
      });

    // Fetch other stats (simplified for now)
    fetch('/api/books')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setStats(prev => ({ ...prev, inventoryCount: data.reduce((acc: number, b: any) => acc + (b.quantity_in_stock || 0), 0) }));
        } else {
          console.error('Expected array for books, got:', data);
        }
      })
      .catch(err => {
        console.error('Error fetching books:', err);
      });

    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setStats(prev => ({ ...prev, activeClients: data.length }));
        } else {
          console.error('Expected array for clients, got:', data);
        }
      })
      .catch(err => {
        console.error('Error fetching clients:', err);
      });
  }, []);

  useEffect(() => {
    if (Array.isArray(salesData) && salesData.length > 0) {
      const totalRevenue = salesData.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
      
      // Calculate trend based on last two data points
      let revenueTrend = 0;
      let salesTrend = 0;
      if (salesData.length >= 2) {
        const last = Number(salesData[salesData.length - 1].total) || 0;
        const prev = Number(salesData[salesData.length - 2].total) || 0;
        if (prev > 0) {
          revenueTrend = ((last - prev) / prev) * 100;
        } else if (last > 0) {
          revenueTrend = 100;
        }
      }

      setStats(prev => ({ 
        ...prev, 
        totalRevenue, 
        totalRevenueTrend: revenueTrend,
        totalSales: salesData.length,
        totalSalesTrend: 5.2 // Mocking sales count trend for now as we don't have separate count per day easily
      }));
    }
  }, [salesData]);

  const cards = [
    { 
      label: 'Общая выручка', 
      value: `${stats.totalRevenue.toLocaleString()} ₽`, 
      icon: CreditCard, 
      trend: `${stats.totalRevenueTrend >= 0 ? '+' : ''}${stats.totalRevenueTrend.toFixed(1)}%`, 
      trendUp: stats.totalRevenueTrend >= 0, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50' 
    },
    { 
      label: 'Всего продаж', 
      value: (stats.totalSales || 0).toString(), 
      icon: TrendingUp, 
      trend: `${stats.totalSalesTrend >= 0 ? '+' : ''}${stats.totalSalesTrend.toFixed(1)}%`, 
      trendUp: stats.totalSalesTrend >= 0, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50' 
    },
    { 
      label: 'Активные клиенты', 
      value: (stats.activeClients || 0).toString(), 
      icon: Users, 
      trend: '+2.4%', 
      trendUp: true, 
      color: 'text-violet-600', 
      bg: 'bg-violet-50' 
    },
    { 
      label: 'Книг в наличии', 
      value: (stats.inventoryCount || 0).toString(), 
      icon: BookOpen, 
      trend: '-1.2%', 
      trendUp: false, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50' 
    },
  ];

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">Обзор</h1>
          <p className="text-[#6B7280] mt-2 text-lg font-medium">Добро пожаловать в панель управления Книга24.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-5 py-2.5 bg-white border border-[#F1F1F4] rounded-[20px] shadow-sm text-sm font-bold flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-200" />
            <span className="text-[#1A1A1A]">Система активна</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-10 rounded-[40px] border border-[#F1F1F4] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-110" />
            <div className="flex items-start justify-between relative z-10">
              <div className={cn("p-5 rounded-2xl transition-all group-hover:scale-110 duration-500 shadow-sm", card.bg)}>
                <card.icon className={cn("w-8 h-8", card.color)} />
              </div>
              <div className={cn(
                "flex items-center gap-1.5 text-[10px] font-bold px-4 py-2 rounded-xl uppercase tracking-wider shadow-sm",
                card.trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {card.trendUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {card.trend}
              </div>
            </div>
            <div className="mt-10 relative z-10">
              <p className="text-xs font-bold text-[#6B7280] uppercase tracking-[0.15em]">{card.label}</p>
              <h3 className="text-4xl font-bold mt-3 text-[#1A1A1A] tracking-tight">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white p-12 rounded-[48px] border border-[#F1F1F4] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full -mr-48 -mt-48 blur-3xl" />
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6 relative z-10">
            <div>
              <h3 className="text-2xl font-bold text-[#1A1A1A]">Рост выручки</h3>
              <p className="text-sm text-[#6B7280] mt-1 font-medium">Динамика продаж за выбранный период</p>
            </div>
            <select className="bg-gray-50 border border-[#F1F1F4] rounded-2xl text-xs font-bold px-6 py-3.5 outline-none hover:bg-white transition-all cursor-pointer shadow-sm focus:ring-2 focus:ring-indigo-600/20">
              <option>Последние 7 дней</option>
              <option>Последние 30 дней</option>
            </select>
          </div>
          <div className="h-[400px] relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F1F4" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 600 }}
                  dy={20}
                  tickFormatter={(value) => {
                    if (!value) return '';
                    try {
                      return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                    } catch (e) {
                      return value;
                    }
                  }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 600 }}
                  tickFormatter={(value) => `${value} ₽`}
                  dx={-15}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: '1px solid #F1F1F4', 
                    boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                    padding: '20px'
                  }}
                  itemStyle={{ fontWeight: 800, color: '#4F46E5', fontSize: '16px' }}
                  labelStyle={{ fontWeight: 800, color: '#1A1A1A', marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#4F46E5" 
                  strokeWidth={5}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-12 rounded-[48px] border border-[#F1F1F4] shadow-sm flex flex-col relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-600/5 rounded-full -ml-32 -mb-32 blur-3xl" />
          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Топ категорий</h3>
            <p className="text-sm text-[#6B7280] mt-1 font-medium">Распределение продаж по жанрам</p>
          </div>
          <div className="space-y-10 flex-1 mt-12 relative z-10">
            {topCategories.length > 0 ? topCategories.map((cat, i) => (
              <div key={i} className="group cursor-default">
                <div className="flex justify-between text-sm mb-4">
                  <span className="font-bold text-[#1A1A1A] group-hover:text-indigo-600 transition-colors text-ellipsis overflow-hidden whitespace-nowrap mr-2">{cat.label}</span>
                  <span className="text-[#6B7280] font-bold shrink-0">{cat.value}%</span>
                </div>
                <div className="h-4 bg-gray-50 rounded-full overflow-hidden border border-[#F1F1F4] p-0.5">
                  <div 
                    className={cn("h-full rounded-full shadow-sm transition-all duration-1000 ease-out", cat.color)} 
                    style={{ width: `${cat.value}%` }}
                  />
                </div>
              </div>
            )) : (
              <div className="flex-1 flex items-center justify-center text-[#6B7280] text-sm font-medium italic">
                Нет данных о продажах
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
