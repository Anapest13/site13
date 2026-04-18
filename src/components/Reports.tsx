import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  Calendar, 
  Download, 
  Filter,
  ArrowRight,
  User as UserIcon,
  Clock,
  DollarSign
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { cn } from '../lib/utils';
import { UserActivityReport, SalesReport } from '../types';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function Reports() {
  const [userActivity, setUserActivity] = useState<UserActivityReport[]>([]);
  const [salesHistory, setSalesHistory] = useState<SalesReport[]>([]);
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('day');
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchReports = () => {
    fetch('/api/reports/user-activity')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUserActivity(data);
        } else {
          setUserActivity([]);
        }
      })
      .catch(err => {
        console.error('Error fetching user activity:', err);
        setUserActivity([]);
      });
    
    const queryParams = new URLSearchParams({ period });
    if (startDate) queryParams.append('start_date', startDate);
    if (endDate) queryParams.append('end_date', endDate);

    fetch(`/api/reports/sales?${queryParams.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSalesHistory(data.map(item => ({
            ...item,
            total: Number(item.total) || 0
          })));
        } else {
          setSalesHistory([]);
        }
      })
      .catch(err => {
        console.error('Error fetching sales history:', err);
        setSalesHistory([]);
      });
  };

  const handleExportExcel = async () => {
    try {
      const periods = ['day', 'month', 'year'];
      const workbook = new ExcelJS.Workbook();

      for (const p of periods) {
        const queryParams = new URLSearchParams();
        queryParams.append('period', p);
        if (startDate) queryParams.append('start_date', startDate);
        if (endDate) queryParams.append('end_date', endDate);

        const res = await fetch(`/api/reports/detailed-sales?${queryParams.toString()}`);
        const detailedData = await res.json();

        if (Array.isArray(detailedData) && detailedData.length > 0) {
          const sheetName = p === 'day' ? 'День' : (p === 'month' ? 'Месяц' : 'Год');
          const worksheet = workbook.addWorksheet(sheetName);

          // Add Title
          worksheet.mergeCells('A1:Q1');
          const titleCell = worksheet.getCell('A1');
          titleCell.value = `Отчет по продажам (${sheetName}) - ${new Date().toLocaleDateString('ru-RU')}`;
          titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
          titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
          titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F46E5' } // Indigo-600
          };

          // Define headers
          const headers = [
            'ID Заказа', 'Дата', 'Тип', 'Статус', 'Клиент', 'Email', 'Книга', 'ISBN', 
            'Издательство', 'Кол-во', 'Цена (₽)', 'Итого (поз.)', 'Сумма (заказ)', 
            'Скидка', 'Итого (оплата)', 'Акция', 'Промокод'
          ];
          
          const headerRow = worksheet.addRow(headers);
          headerRow.height = 25;
          headerRow.eachCell((cell) => {
            cell.font = { bold: true, size: 11, color: { argb: 'FF1A1A1A' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE5E7EB' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
              top: { style: 'medium' },
              left: { style: 'thin' },
              bottom: { style: 'medium' },
              right: { style: 'thin' }
            };
          });

          // Add data
          detailedData.forEach(item => {
            const rowValue = [
              item.order_id,
              new Date(item.order_date).toLocaleString('ru-RU'),
              item.order_type === 'sale' ? 'Продажа' : (item.order_type === 'preorder' ? 'Предзаказ' : 'Бронь'),
              item.status === 'completed' ? 'Завершено' : (item.status === 'pending' ? 'В ожидании' : 'Активно'),
              item.customer_name || 'Гость',
              item.customer_email || '-',
              item.book_title,
              item.book_isbn,
              item.publisher_name || '-',
              item.quantity,
              Number(item.unit_price),
              Number(item.item_total),
              Number(item.order_total),
              Number(item.order_discount),
              Number(item.order_net),
              item.promotion_name || '-',
              item.promotion_code || '-'
            ];
            const row = worksheet.addRow(rowValue);
            
            // Format cells
            row.eachCell((cell, colNumber) => {
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
              cell.alignment = { vertical: 'middle' };
              
              // Align numbers
              if (colNumber >= 10 && colNumber <= 15) {
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.numFmt = '#,##0.00';
              }
            });

            // Add color to status column (Index 4 is 'Статус')
            const statusCell = row.getCell(4);
            statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
            const statusValue = item.status?.toLowerCase();
            
            if (statusValue === 'completed' || statusValue === 'завершено' || statusValue === 'выполнен') {
              statusCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD1FAE5' } // emerald-100
              };
              statusCell.font = { color: { argb: 'FF065F46' }, bold: true }; // emerald-600
            } else if (statusValue === 'pending' || statusValue === 'в ожидании') {
              statusCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFEF3C7' } // amber-100
              };
              statusCell.font = { color: { argb: 'FFB45309' }, bold: true }; // amber-600
            } else {
              statusCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFDBEAFE' } // blue-100
              };
              statusCell.font = { color: { argb: 'FF1E40AF' }, bold: true }; // blue-600
            }
          });

          // Set column widths
          worksheet.columns = [
            { width: 10 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 25 },
            { width: 25 }, { width: 40 }, { width: 15 }, { width: 20 }, { width: 10 },
            { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
            { width: 25 }, { width: 15 }
          ];
        }
      }

      if (workbook.worksheets.length === 0) {
        alert('Нет данных для экспорта');
        return;
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `detailed-sales-full-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Error exporting detailed sales:', err);
      alert('Ошибка при экспорте данных');
    }
  };

  useEffect(() => {
    fetchReports();
  }, [period, startDate, endDate]);

  return (
    <div className="space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">Отчеты и Аналитика</h1>
          <p className="text-[#6B7280] mt-2 text-lg font-medium">Глубокий анализ продаж и активности пользователей.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl shadow-inner">
            {(['day', 'month', 'year'] as const).map((p) => (
              <button 
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-5 py-2 text-xs font-bold rounded-xl transition-all",
                  period === p ? "bg-white text-indigo-600 shadow-sm" : "text-[#6B7280] hover:text-[#1A1A1A]"
                )}
              >
                {p === 'day' ? 'День' : p === 'month' ? 'Месяц' : 'Год'}
              </button>
            ))}
          </div>
          <button 
            onClick={handleExportExcel}
            className="px-6 py-3 bg-white border border-[#F1F1F4] rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-gray-50 hover:shadow-md transition-all text-[#1A1A1A]"
          >
            <Download className="w-5 h-5 text-indigo-600" />
            Экспорт
          </button>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg",
              showFilters ? "bg-indigo-600 text-white shadow-indigo-100" : "bg-[#1A1A1A] text-white hover:bg-black"
            )}
          >
            <Filter className="w-5 h-5" />
            Фильтры
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-8 rounded-[32px] border border-[#F1F1F4] shadow-xl shadow-gray-100/50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider px-1">Дата начала</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-5 py-3.5 bg-gray-50 border border-[#F1F1F4] rounded-2xl focus:ring-2 focus:ring-indigo-600/20 focus:bg-white focus:border-indigo-600 outline-none transition-all font-medium"
              />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider px-1">Дата окончания</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-5 py-3.5 bg-gray-50 border border-[#F1F1F4] rounded-2xl focus:ring-2 focus:ring-indigo-600/20 focus:bg-white focus:border-indigo-600 outline-none transition-all font-medium"
              />
            </div>
            <div className="flex items-end pb-1">
              <button 
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-6 py-3.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-2xl transition-all w-full md:w-auto"
              >
                Сбросить все фильтры
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Period Chart */}
      <div className="bg-white p-10 rounded-[40px] border border-[#F1F1F4] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4 relative z-10">
          <div>
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Эффективность продаж</h3>
            <p className="text-sm text-[#6B7280] mt-1 font-medium">Динамика выручки за выбранный период.</p>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-[#F1F1F4]">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl shadow-sm border border-[#F1F1F4]">
              <div className="w-3 h-3 bg-indigo-600 rounded-full" />
              <span className="text-xs font-bold text-[#1A1A1A]">Выручка (₽)</span>
            </div>
          </div>
        </div>
        <div className="h-[400px] relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesHistory} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F46E5" stopOpacity={1} />
                  <stop offset="100%" stopColor="#818CF8" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F1F4" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 600 }}
                dy={15}
                tickFormatter={(value) => {
                  if (!value) return '';
                  if (period === 'month') {
                    const [year, month] = value.split('-');
                    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
                    return month ? `${months[parseInt(month) - 1]} ${year}` : value;
                  }
                  if (period === 'year') return value;
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
                dx={-10}
              />
              <Tooltip 
                cursor={{ fill: '#F9FAFB', radius: 12 }}
                contentStyle={{ 
                  borderRadius: '24px', 
                  border: '1px solid #F1F1F4', 
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                  padding: '16px 20px'
                }}
                itemStyle={{ fontWeight: 700, fontSize: '14px' }}
                labelStyle={{ fontWeight: 800, color: '#1A1A1A', marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                formatter={(value: any) => [`${value.toLocaleString('ru-RU')} ₽`, 'Выручка']}
              />
              <Bar 
                dataKey="total" 
                fill="url(#barGradient)" 
                radius={[12, 12, 4, 4]} 
                barSize={period === 'day' ? 40 : period === 'month' ? 30 : 60}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* User Activity Table */}
      <div className="bg-white rounded-[40px] border border-[#F1F1F4] shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-[#F1F1F4] bg-gray-50/30">
          <h3 className="text-2xl font-bold text-[#1A1A1A]">Активность пользователей</h3>
          <p className="text-sm text-[#6B7280] mt-1 font-medium">Метрики поведения клиентов и финансовые показатели.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-[#F1F1F4]">
                <th className="px-10 py-5 text-[10px] font-bold text-[#1A1A1A] uppercase tracking-[0.1em]">Клиент</th>
                <th className="px-10 py-5 text-[10px] font-bold text-[#1A1A1A] uppercase tracking-[0.1em]">Последний вход</th>
                <th className="px-10 py-5 text-[10px] font-bold text-[#1A1A1A] uppercase tracking-[0.1em] text-center">Транзакции</th>
                <th className="px-10 py-5 text-[10px] font-bold text-[#1A1A1A] uppercase tracking-[0.1em]">Потрачено</th>
                <th className="px-10 py-5 text-[10px] font-bold text-[#1A1A1A] uppercase tracking-[0.1em]">Средний чек</th>
                <th className="px-10 py-5 text-[10px] font-bold text-[#1A1A1A] uppercase tracking-[0.1em]">Последняя покупка</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F1F4]">
              {userActivity.map((user, i) => (
                <tr key={i} className="hover:bg-[#F9FAFB] transition-all group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                        <UserIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="font-bold text-[#1A1A1A] block">{user.full_name}</span>
                        <span className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">ID: {user.customer_id || '---'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-2.5 text-xs text-[#6B7280] font-medium">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      {user.last_login ? new Date(user.last_login).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Никогда'}
                    </div>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 text-[#1A1A1A] font-bold text-sm border border-[#F1F1F4]">
                      {user.total_transactions}
                    </span>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-1.5 font-bold text-[#1A1A1A]">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      {(Number(user.total_spent) || 0).toLocaleString('ru-RU')} ₽
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <span className="text-sm font-bold text-[#6B7280]">
                      {(Number(user.avg_check) || 0).toLocaleString('ru-RU')} ₽
                    </span>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl w-fit">
                      <Calendar className="w-3.5 h-3.5" />
                      {user.last_purchase ? new Date(user.last_purchase).toLocaleDateString('ru-RU') : 'Н/Д'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
