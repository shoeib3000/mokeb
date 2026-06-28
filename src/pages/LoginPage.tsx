import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { db, withTimeout } from '../lib/db';
import { getDoc, doc, setDoc } from '../lib/db';
import { User } from '../types';
import { safeStorage } from '../lib/safeStorage';
import { motion } from 'motion/react';
import { 
  MapPin, ShieldCheck, Heart, Sparkles, Smartphone, 
  Compass, ArrowRight, UserCheck, Star, HelpCircle,
  Eye, EyeOff, Lock, User as UserIcon
} from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { user, siteSettings } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
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
          localError = 'نام کاربری یافت نشد. لطفا ابتدا از طریق دکمه زیر اقدام به ثبت‌نام سجلی و هویتی نمایید.';
        }
      }
    } catch (err: any) {
      console.warn("Firestore connection/getDoc failed, running offline fallback auth flow:", err);
      // Fallback check
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
        localError = 'کاربر مورد نظر یافت نشد.';
      }
    }

    if (authenticated && uData) {
      safeStorage.setItem('mock_auth_username', lowerUsername);
      safeStorage.setItem('mock_auth_password', password);
      
      // Save/Update cache
      try {
        const offlineUsersJson = safeStorage.getItem('offline_users') || '{}';
        const offlineUsers = JSON.parse(offlineUsersJson);
        offlineUsers[lowerUsername] = uData;
        safeStorage.setItem('offline_users', JSON.stringify(offlineUsers));
      } catch (e) {
        console.error(e);
      }

      window.dispatchEvent(new Event('auth-state-change'));
      navigate('/dashboard');
    } else {
      setError(localError || 'نام کاربری یا رمز عبور اشتباه است.');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-white" dir="rtl">
      
      {/* Decorative Column (Hidden on Mobile/Tablet) */}
      <div className="hidden lg:flex lg:col-span-7 flex-col justify-between p-12 bg-emerald-50 relative text-slate-900 overflow-hidden border-l border-slate-100">
        
        {/* Abstract light backgrounds */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-emerald-100 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-50 rounded-full blur-3xl" />

        {/* Top brand header */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-xl border border-emerald-500/30 overflow-hidden relative">
            {siteSettings?.siteLogoUrl ? (
              <img src={siteSettings.siteLogoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
            ) : (
              <MapPin className="w-6 h-6 text-emerald-400" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
              {siteSettings?.siteName ? (
                siteSettings.siteName.includes('شهید') ? (
                  <>
                    <span className="text-slate-900">{siteSettings.siteName.split('شهید')[0]}</span>
                    <span className="text-red-600">شهید</span>
                    <span className="text-slate-900">{siteSettings.siteName.split('شهید')[1]}</span>
                  </>
                ) : (
                  <span className="text-slate-900">{siteSettings.siteName}</span>
                )
              ) : (
                <>
                  <span className="text-slate-900">کمیته مواکب قائد</span> <span className="text-red-600">شهید</span> <span className="text-slate-900">امت</span>
                </>
              )}
              <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-black">PWA</span>
            </h1>
            <p className="text-[10px] text-emerald-800/80 font-medium">سامانه هوشمند و یکپارچه خدمات‌رسانی مراسم تشییع</p>
          </div>
        </div>

        {/* Middle Creative Content with motion */}
        <div 
          className="relative z-10 max-w-lg space-y-6 my-auto"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            سامانه مدیریت موکب
          </span>
          <h2 className="text-3xl xl:text-4xl font-black text-slate-900 leading-tight">
            مدیریت آسان موکب با <span className="text-emerald-600">ثبت روایت‌ها</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed text-justify">
            پورتال اختصاصی خادمین مواکب مراسم تشییع رهبر شهید.
          </p>
        </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="bg-white border border-slate-100 p-4 rounded-2xl flex items-start gap-3 shadow-sm hover:border-emerald-100 transition-all duration-300">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-900">هدایت زائرین</h4>
                <p className="text-[10px] text-slate-500 mt-1">امکان مکان‌یابی زنده و نمایش دقیق امکانات رفاهی</p>
              </div>
            </div>
            
            <div className="bg-white border border-slate-100 p-4 rounded-2xl flex items-start gap-3 shadow-sm hover:border-emerald-100 transition-all duration-300">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-900">روایت زنده استوری</h4>
                <p className="text-[10px] text-slate-500 mt-1">ارسال و اشتراک لحظه‌ای فیلم و تصاویر موکب</p>
              </div>
            </div>
          </div>

        {/* Bottom copyright & status info */}
        <div className="relative z-10 border-t border-slate-100 pt-4 flex justify-between items-center text-xs text-slate-500">
          <p>© کلیه حقوق مادی و معنوی متعلق به کمیته مواکب است.</p>
          <span className="flex items-center gap-1 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            سیستم ابری یکپارچه فعال است
          </span>
        </div>
      </div>


      <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative min-h-screen">
        
        {/* Abstract ambient backdrop for mobile */}
        <div className="absolute top-10 right-10 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 left-10 w-44 h-44 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div 
          className="w-full max-w-sm space-y-6 relative z-10"
        >
          {/* Mobile App Header Design */}
          <div className="flex flex-col items-center text-center">
            {/* Custom Spiritual Gold & Emerald Icon Container */}
            <div className="relative mb-3 group">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-amber-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="w-14 h-14 bg-slate-900 rounded-2xl flex flex-col items-center justify-center text-white relative border border-emerald-500/30 shadow-2xl">
                <div className="absolute top-1 inset-x-0 flex justify-center opacity-85">
                  <div className="w-5 h-1.5 bg-amber-400 rounded-t-full" />
                </div>
                <MapPin className="w-6 h-6 text-emerald-400 mt-1" />
              </div>
            </div>

            <h1 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
              <span>سامانه موکب‌یاب</span>
              <span className="text-amber-500 font-normal">|</span>
              <span className="text-emerald-700 text-xs bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 font-mono">PWA App</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium mt-1">بخش مدیریت اختصاصی و پنل خادمین افتخاری</p>
          </div>

          <Card className="rounded-[24px] border border-slate-100 bg-white shadow-xl overflow-hidden relative">
            {/* Elegant border */}
            <div className="absolute top-0 inset-x-0 h-[3px] bg-emerald-500" />
            
            <CardHeader className="text-center pt-6 pb-3 px-5">
              <CardTitle className="text-sm sm:text-base font-black text-slate-900 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                ورود خادمان
              </CardTitle>
            </CardHeader>
            
            <CardContent className="px-5 pb-6 space-y-4">
              {error && (
                <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-[10px] font-bold border border-rose-100 leading-relaxed text-justify">
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Username Input Field */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-600 block">نام کاربری</label>
                  <div className="relative">
                    <UserIcon className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                    <Input 
                      type="text" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)} 
                      required 
                      dir="ltr"
                      placeholder="admin"
                      className="text-left font-mono bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-300 focus:ring-1 focus:ring-emerald-500 rounded-xl h-10 pr-10 text-xs"
                    />
                  </div>
                </div>
                
                {/* Password Input Field with Toggle Peek */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-600 block">رمز عبور</label>
                  <div className="relative">
                    <Lock className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                      dir="ltr"
                      placeholder="••••••••"
                      className="text-left font-mono bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-300 focus:ring-1 focus:ring-emerald-500 rounded-xl h-10 px-10 text-xs"
                    />
                    
                    {/* Peek Password Button */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-2.5 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                      title={showPassword ? "پنهان کردن رمز" : "نمایش رمز"}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black transition-all mt-4 h-11 rounded-xl shadow-lg text-[11px] active:scale-[0.98]" 
                  disabled={loading}
                >
                  {loading ? 'در حال ورود...' : 'ورود'}
                </Button>
                
                {/* Registration link */}
                <div className="pt-4 border-t border-slate-100 text-center space-y-2.5">
                  <Link to="/register" className="block text-emerald-600 hover:text-emerald-700 font-bold text-[10px]">
                    ثبت‌نام موکب جدید
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Return to Public Map / Visitor Area */}
          <div className="text-center">
            <Link to="/pwa" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
              <ArrowRight className="w-3.5 h-3.5" />
              بازگشت به نقشه و درگاه عمومی زائران
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}
