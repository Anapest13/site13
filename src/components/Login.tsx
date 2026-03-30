import React, { useState } from 'react';
import { Mail, Lock, User, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/login' : '/api/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Что-то пошло не так');

      if (isLogin) {
        onLogin(data);
      } else {
        setIsLogin(true);
        alert('Регистрация успешна! Теперь вы можете войти.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#1A1A1A] rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 shadow-2xl shadow-black/20">
            К
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Книга24</h1>
          <p className="text-[#6B7280] mt-2">
            {isLogin ? 'С возвращением! Пожалуйста, войдите в свой аккаунт.' : 'Создайте аккаунт, чтобы начать покупки.'}
          </p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl border border-[#E5E7EB]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase ml-1">Имя</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    <input 
                      required
                      type="text"
                      placeholder="Иван"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-[#F3F4F6] border-none rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase ml-1">Фамилия</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    <input 
                      required
                      type="text"
                      placeholder="Иванов"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-[#F3F4F6] border-none rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-[#6B7280] uppercase ml-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input 
                  required
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-[#F3F4F6] border-none rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all text-sm"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#6B7280] uppercase ml-1">Телефон</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input 
                    required
                    type="tel"
                    placeholder="+7 (999) 000-00-00"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-[#F3F4F6] border-none rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-[#6B7280] uppercase ml-1">Пароль</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input 
                  required
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-[#F3F4F6] border-none rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/10 transition-all text-sm"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs font-bold text-red-500 ml-1">{error}</p>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A1A1A] text-white py-4 rounded-2xl font-bold hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Войти' : 'Зарегистрироваться'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-[#F3F4F6] text-center">
            <p className="text-sm text-[#6B7280]">
              {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 font-bold text-[#1A1A1A] hover:underline"
              >
                {isLogin ? 'Создать аккаунт' : 'Войти'}
              </button>
            </p>
          </div>
        </div>
        
        <p className="text-center text-xs text-[#9CA3AF] mt-8">
          © 2026 Книга24. Все права защищены.
        </p>
      </div>
    </div>
  );
}
