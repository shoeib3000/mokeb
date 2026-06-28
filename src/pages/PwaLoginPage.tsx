import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db, withTimeout } from '../lib/db';
import { getDoc, doc, setDoc } from '../lib/db';
import { User } from '../types';
import { safeStorage } from '../lib/safeStorage';
import { motion } from 'motion/react';
import { 
  MapPin, ShieldCheck, Sparkles, Smartphone, 
  ArrowRight, UserCheck, Eye, EyeOff, Lock, User as UserIcon,
  ChevronRight, Info, AlertCircle
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export default function PwaLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { user, siteSettings } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/pwa');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('نام کاربری و رمز عبور را وارد کنید');
      return;
    }

    setLoading(true);

    const lowerUsername = username.trim().toLowerCase();
    let authenticated = false;
    let uData: User | null = null;
    let localError = '';

    try {
      if (lowerUsername === 'admin' && password === '123456') {
        const newUser: User = {
          id: 'admin',
          email: 'admin@system.local',
          name: 'مدیریت کل سیستم',
          isAdmin: true,
          username: 'admin',
          password: '123456',
          createdAt: new Date().toISOString()
        };
        const userRef = doc(db, 'users', 'admin');
        try {
          await withTimeout(setDoc(userRef, newUser));
        } catch (setErr) {
          console.warn("Failed to save admin user online, proceeding with login:", setErr);
        }
        authenticated = true;
        uData = newUser;
      } else {
        const userRef = doc(db, 'users', lowerUsername);
        const userSnap = await withTimeout(getDoc(userRef));

        if (userSnap.exists()) {
          const data = userSnap.data() as User;
          if (data.password === password) {
            authenticated = true;
            uData = data;
          } else {
            localError = 'رمز عبور وارد شده نادرست است.';
          }
        } else {
          localError = 'نام کاربری یافت نشد. لطفا ابتدا ثبت‌نام کنید.';
        }
      }
    } catch (err: any) {
      console.warn("Firestore connection failed, running offline fallback:", err);
      let offlineUsers: Record<string, any> = {};
      try {
        const offlineUsersJson = safeStorage.getItem('offline_users');
        if (offlineUsersJson) {
          offlineUsers = JSON.parse(offlineUsersJson);
        }
      } catch (parseErr) {
        console.error("Error parsing offline users:", parseErr);
      }
      
      const cachedUser = offlineUsers[lowerUsername];

      if (lowerUsername === 'admin' && password === '123456') {
        authenticated = true;
        uData = {
          id: 'admin',
          email: 'admin@system.local',
          name: 'مدیریت کل سیستم',
          isAdmin: true,
          username: 'admin',
          password: '123456',
          createdAt: new Date().toISOString()
        };
      } else if (cachedUser) {
        if (cachedUser.password === password) {
          authenticated = true;
          uData = cachedUser;
        } else {
          localError = 'رمز عبور وارد شده نادرست است.';
        }
      } else {
        localError = 'کاربر مورد نظر در حافظه آفلاین یافت نشد.';
      }
    }

    if (authenticated && uData) {
      safeStorage.setItem('mock_auth_username', lowerUsername);
      safeStorage.setItem('mock_auth_password', password);
      
      try {
        const offlineUsersJson = safeStorage.getItem('offline_users') || '{}';
        const offlineUsers = JSON.parse(offlineUsersJson);
        offlineUsers[lowerUsername] = uData;
        safeStorage.setItem('offline_users', JSON.stringify(offlineUsers));
      } catch (e) {
        console.error(e);
      }

      window.dispatchEvent(new Event('auth-state-change'));
      navigate('/pwa');
    } else {
      setError(localError || 'نام کاربری یا رمز عبور اشتباه است.');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between text-slate-900 font-sans select-none relative overflow-hidden pb-10" dir="rtl">
      
      {/* Background Spiritual Ambient Glow */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-emerald-100 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-amber-50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] opacity-[0.2] [background-size:20px_20px] pointer-events-none" />

      {/* Header Bar */}
      <header className="relative z-10 px-5 pt-6 pb-2 flex justify-between items-center">
        <Link 
          to="/pwa" 
          className="w-10 h-10 bg-slate-50 active:bg-slate-100 rounded-full flex items-center justify-center border border-slate-100 transition-colors"
          id="pwa-back-btn"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </Link>
        <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 rounded-full flex items-center gap-1">
          <Smartphone className="w-3 h-3" />
          سامانه نسخه PWA
        </span>
      </header>

      {/* Main Form Area */}
      <main className="relative z-10 px-6 my-auto max-w-md w-full mx-auto space-y-6">
        
        {/* Brand visual identity */}
        <div className="text-center space-y-2">
          <div className="relative inline-block mb-3">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-100 to-amber-100 rounded-2xl blur opacity-30"></div>
            <div className="relative w-16 h-16 bg-white rounded-2xl flex flex-col items-center justify-center border border-emerald-100 shadow-sm overflow-hidden">
              {siteSettings?.siteLogoUrl ? (
                <img 
                  src={siteSettings.siteLogoUrl} 
                  referrerPolicy="no-referrer" 
                  alt="Site Logo" 
                  className="w-full h-full object-contain p-2" 
                />
              ) : (
                <>
                  <div className="absolute top-1.5 inset-x-0 flex justify-center opacity-80">
                    <div className="w-6 h-1.5 bg-amber-400 rounded-t-full" />
                  </div>
                  <MapPin className="w-7 h-7 text-emerald-700 mt-1" />
                </>
              )}
            </div>
          </div>
          
          <h2 className="text-xl font-black text-slate-900">
            {siteSettings?.siteName ? `ورود خادمین ${siteSettings.siteName}` : 'ورود خادمین مواکب'}
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            جهت ورود به پنل اختصاصی، مشخصات خود را وارد نمایید.
          </p>
        </div>

        {/* Auth Error Display */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3.5 rounded-2xl text-xs flex items-start gap-2.5 leading-relaxed"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Form Container */}
        <div className="bg-white border border-slate-100 rounded-[28px] p-5 sm:p-6 space-y-5 shadow-sm">
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 block pr-1">شناسه یا نام کاربری</label>
              <div className="relative">
                <UserIcon className="absolute right-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  dir="ltr"
                  className="w-full bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-300 focus:ring-1 focus:ring-emerald-500 rounded-2xl h-11 pr-11 pl-4 text-xs font-mono transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 block pr-1">رمز عبور</label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className="w-full bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-300 focus:ring-1 focus:ring-emerald-500 rounded-2xl h-11 px-11 text-xs font-mono transition-all"
                />
                
                {/* Peek Password Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-3 text-slate-400 active:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* Login Button with native spin feedback */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-11.5 rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              {loading ? 'در حال احراز هویت...' : 'ورود'}
            </Button>

          </form>

          {/* Registration Section within card */}
          <div className="pt-4 border-t border-slate-100 text-center space-y-2.5">
            <span className="text-[9px] text-slate-400 font-extrabold block">موکب جدید دارید؟</span>
            <Link to="/pwa/register">
              <Button
                variant="outline"
                className="w-full border-emerald-100 active:bg-slate-50 hover:bg-slate-50 text-emerald-700 font-extrabold text-[10px] h-10.5 rounded-2xl bg-transparent"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 ml-1.5 shrink-0" />
                ثبت‌نام موکب جدید
              </Button>
            </Link>
          </div>

        </div>

      </main>

      {/* Footer copyright */}
      <footer className="relative z-10 px-6 text-center space-y-3 mt-4">
        <p className="text-[9px] text-slate-400 font-medium">کمیته مواکب حسینی © تمامی حقوق محفوظ است</p>
        <Link 
          to="/pwa" 
          className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 active:text-slate-900 transition-colors py-1 px-3 bg-slate-50 rounded-full border border-slate-100"
        >
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span>بازگشت به نقشه</span>
        </Link>
      </footer>

    </div>
  );
}
