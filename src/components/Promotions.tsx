import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Tag, 
  Calendar, 
  Percent, 
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
  Download
} from 'lucide-react';
import { Promotion } from '../types';
import Modal from './Modal';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPromo, setNewPromo] = useState<Partial<Promotion>>({});

  const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);

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

  const fetchPromotions = () => {
    fetch('/api/promotions')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPromotions(data);
        } else {
          console.error('Expected array for promotions, got:', data);
          setPromotions([]);
        }
      })
      .catch(err => {
        console.error('Error fetching promotions:', err);
        setPromotions([]);
      });
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!editingPromo?.name || !editingPromo?.code_word || editingPromo?.discount_value <= 0) {
      alert('Пожалуйста, заполните название, промокод и значение скидки (> 0)');
      return;
    }
    if (new Date(editingPromo.start_date) > new Date(editingPromo.end_date)) {
      alert('Дата начала не может быть позже даты окончания');
      return;
    }

    const method = editingPromo?.promotion_id ? 'PUT' : 'POST';
    const url = editingPromo?.promotion_id ? `/api/promotions/${editingPromo.promotion_id}` : '/api/promotions';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingPromo)
    });
    setIsModalOpen(false);
    setEditingPromo(null);
    fetchPromotions();
  };

  const handleDelete = async (id: number) => {
    showConfirm(
      'Удаление акции',
      'Вы уверены, что хотите удалить эту акцию?',
      async () => {
        await fetch(`/api/promotions/${id}`, { method: 'DELETE' });
        fetchPromotions();
      }
    );
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Акции и скидки');

      const headers = [
        'Название акции', 'Промокод', 'Тип скидки', 'Значение', 
        'Дата начала', 'Дата окончания', 'Лимит', 'Использовано', 
        'Прогресс', 'Статус', 'Активна (переключатель)'
      ];
      
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4F46E5' } // Indigo-600
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'medium' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' }
        };
      });

      promotions.forEach(p => {
        const status = getStatus(p);
        const usageLimit = p.usage_limit || 'Безлимит';
        const usedCount = p.used_count || 0;
        const usagePercent = p.usage_limit ? (usedCount / p.usage_limit) : 0;
        
        const row = worksheet.addRow([
          p.name,
          p.code_word,
          p.discount_type === 'percentage' ? 'Процент (%)' : 'Фиксированная (₽)',
          p.discount_value,
          new Date(p.start_date),
          new Date(p.end_date),
          usageLimit,
          usedCount,
          usagePercent,
          status,
          p.is_active === 1 ? 'Да' : 'Нет'
        ]);

        // Format cells
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { vertical: 'middle' };

          if (colNumber === 4) { // Значение
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = p.discount_type === 'percentage' ? '0"%"' : '#,##0.00 "₽"';
          }
          if (colNumber === 5 || colNumber === 6) { // Даты
            cell.numFmt = 'dd.mm.yyyy';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
          if (colNumber === 9) { // Прогресс
            cell.numFmt = '0%';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });

        const statusCell = row.getCell(10);
        statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (status === 'Активна') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          statusCell.font = { color: { argb: 'FF065F46' }, bold: true };
        } else if (status === 'Завершена') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          statusCell.font = { color: { argb: 'FF991B1B' }, bold: true };
        } else {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          statusCell.font = { color: { argb: 'FFB45309' }, bold: true };
        }
      });

      worksheet.columns = [
        { width: 30 }, { width: 15 }, { width: 22 }, { width: 12 }, 
        { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
        { width: 12 }, { width: 18 }, { width: 22 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `promotions-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Error exporting promotions:', err);
      alert('Ошибка при экспорте данных');
    }
  };
  const isActive = (promo: Promotion) => {
    const now = new Date();
    const start = new Date(promo.start_date);
    const end = new Date(promo.end_date);
    // Set end to end of day
    end.setHours(23, 59, 59, 999);
    return now >= start && now <= end && promo.is_active === 1;
  };

  const getStatus = (promo: Promotion) => {
    const now = new Date();
    const start = new Date(promo.start_date);
    const end = new Date(promo.end_date);
    // Set end to end of day
    end.setHours(23, 59, 59, 999);
    
    if (now < start) return 'Запланирована';
    if (now > end) return 'Завершена';
    return promo.is_active === 1 ? 'Активна' : 'Приостановлена';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Акции</h1>
          <p className="text-[#6B7280] mt-1">Создавайте и управляйте маркетинговыми кампаниями и скидками.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportExcel}
            className="bg-white border border-[#E5E7EB] text-[#1A1A1A] px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#F3F4F6] transition-all"
          >
            <Download className="w-5 h-5" />
            Экспорт Excel
          </button>
          <button 
            onClick={() => { setEditingPromo({ discount_type: 'percentage' }); setIsModalOpen(true); }}
            className="bg-[#1A1A1A] text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Новая акция
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {promotions.map((promo) => (
          <div key={promo.promotion_id} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-violet-50 rounded-xl">
                  <Tag className="w-6 h-6 text-violet-600" />
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  getStatus(promo) === 'Активна' ? 'bg-emerald-50 text-emerald-600' : 
                  getStatus(promo) === 'Завершена' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {getStatus(promo) === 'Активна' ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
                   getStatus(promo) === 'Завершена' ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {getStatus(promo)}
                </div>
              </div>

              <h3 className="text-lg font-bold">{promo.name}</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                  <Percent className="w-4 h-4" />
                  <span className="font-bold text-[#1A1A1A]">Скидка {promo.discount_value}{promo.discount_type === 'percentage' ? '%' : ' ₽'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(promo.start_date).toLocaleDateString('ru-RU')} - {new Date(promo.end_date).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB] flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Промокод</span>
                <span className="text-sm font-mono font-bold text-[#1A1A1A]">{promo.code_word}</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setEditingPromo(promo); setIsModalOpen(true); }}
                  className="text-xs font-bold text-[#1A1A1A] hover:underline transition-all"
                >
                  Изменить
                </button>
                <button 
                  onClick={() => handleDelete(promo.promotion_id)}
                  className="text-xs font-bold text-red-600 hover:underline transition-all"
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB]">
              <h2 className="text-xl font-bold">{editingPromo?.promotion_id ? 'Редактировать акцию' : 'Новая акция'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-[#E5E7EB] rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase">Название кампании</label>
                  <input 
                    required
                    value={editingPromo?.name || ''}
                    onChange={(e) => setEditingPromo({ ...editingPromo, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[#F3F4F6] border-none rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase">Дата начала</label>
                    <input 
                      type="date"
                      required
                      value={editingPromo?.start_date?.split('T')[0] || ''}
                      onChange={(e) => setEditingPromo({ ...editingPromo, start_date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#F3F4F6] border-none rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase">Дата окончания</label>
                    <input 
                      type="date"
                      required
                      value={editingPromo?.end_date?.split('T')[0] || ''}
                      onChange={(e) => setEditingPromo({ ...editingPromo, end_date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#F3F4F6] border-none rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase">Тип скидки</label>
                    <select 
                      required
                      value={editingPromo?.discount_type || 'percentage'}
                      onChange={(e) => setEditingPromo({ ...editingPromo, discount_type: e.target.value as any })}
                      className="w-full px-4 py-2.5 bg-[#F3F4F6] border-none rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all"
                    >
                      <option value="percentage">Процент (%)</option>
                      <option value="fixed">Фиксированная сумма (₽)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#6B7280] uppercase">Значение</label>
                    <input 
                      type="number"
                      required
                      value={editingPromo?.discount_value || ''}
                      onChange={(e) => setEditingPromo({ ...editingPromo, discount_value: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-[#F3F4F6] border-none rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase">Промокод (кодовое слово)</label>
                  <input 
                    required
                    value={editingPromo?.code_word || ''}
                    onChange={(e) => setEditingPromo({ ...editingPromo, code_word: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 bg-[#F3F4F6] border-none rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase">Лимит использования (пусто = безлимит)</label>
                  <input 
                    type="number"
                    value={editingPromo?.usage_limit || ''}
                    onChange={(e) => setEditingPromo({ ...editingPromo, usage_limit: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-4 py-2.5 bg-[#F3F4F6] border-none rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all"
                  />
                </div>
                {editingPromo?.promotion_id && (
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      id="is_active"
                      checked={editingPromo?.is_active === 1}
                      onChange={(e) => setEditingPromo({ ...editingPromo, is_active: e.target.checked ? 1 : 0 })}
                    />
                    <label htmlFor="is_active" className="text-xs font-bold text-[#6B7280] uppercase">Активна</label>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-sm font-bold text-[#6B7280] hover:bg-[#F3F4F6] rounded-xl transition-all"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-[#1A1A1A] text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all"
                >
                  {editingPromo?.promotion_id ? 'Сохранить' : 'Создать'}
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
        <p>{modalConfig.message}</p>
      </Modal>
    </div>
  );
}
