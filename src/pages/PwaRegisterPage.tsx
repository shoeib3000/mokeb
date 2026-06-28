import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, doc, getDoc, setDoc, serverTimestamp, query, orderBy, getDocs } from '../lib/db';
import { db } from '../lib/db';
import { safeStorage } from '../lib/safeStorage';
import { resizeImage } from '../lib/imageResizer';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { 
  Sparkles, 
  CheckCircle2, 
  UserCheck, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  UploadCloud, 
  HelpCircle, 
  MapPin, 
  Lock, 
  User, 
  Phone, 
  Building, 
  FileCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  AlertCircle
} from 'lucide-react';



export default function PwaRegisterPage() {
  const navigate = useNavigate();

  const getDraftValue = () => {
    try {
      const savedDraft = safeStorage.getItem('register_mokeb_draft');
      if (savedDraft) {
        return JSON.parse(savedDraft);
      }
    } catch (e) {
      console.warn("Failed to parse draft:", e);
    }
    return null;
  };

  const draft = getDraftValue();

  const [currentStep, setCurrentStep] = useState(draft?.currentStep || 1);
  const [username, setUsername] = useState(draft?.username || '');
  const [password, setPassword] = useState(draft?.password || '');
  const [managerName, setManagerName] = useState(draft?.managerName || '');
  const [phone, setPhone] = useState(draft?.phone || '');
  const [mokebName, setMokebName] = useState(draft?.mokebName || '');
  const [province, setProvince] = useState(draft?.province || '');
  const [county, setCounty] = useState(draft?.county || '');
  const [address, setAddress] = useState(draft?.address || '');
  const [utm, setUtm] = useState(draft?.utm || '');
  const [description, setDescription] = useState(draft?.description || '');

  const [selectedServices, setSelectedServices] = useState<string[]>(draft?.selectedServices || []);
  const [customService, setCustomService] = useState('');
  
  const [staffList, setStaffList] = useState<string[]>(draft?.staffList || []);
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffShowContact, setStaffShowContact] = useState(false);

  const [permitDoc, setPermitDoc] = useState<string | null>(draft?.permitDoc || null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFileName, setUploadFileName] = useState(draft?.uploadFileName || '');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [showWelcome, setShowWelcome] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<any>(null);
  const [newMokeb, setNewMokeb] = useState<any>(null);

  // Check username availability
  const checkUsername = async (u: string) => {
    const cleanUsername = u.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const userRef = doc(db, 'users', cleanUsername);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUsernameStatus('taken');
      } else {
        setUsernameStatus('available');
      }
    } catch (err) {
      console.error("Error checking username:", err);
      setUsernameStatus('idle');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (username) checkUsername(username);
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const [showUtmGuide, setShowUtmGuide] = useState(false);
  const [routeId, setRouteId] = useState(draft?.routeId || '');
  const [showContactInfoPublicly, setShowContactInfoPublicly] = useState(draft?.showContactInfoPublicly ?? false);
  const [walkRoutes, setWalkRoutes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState(draft?.categoryId || '');

  const [attemptedNext, setAttemptedNext] = useState(false);

  const isFieldEmpty = (fieldName: string): boolean => {
    switch (fieldName) {
      case 'username': return !username.trim();
      case 'password': return password.length < 6;
      case 'managerName': return !managerName.trim();
      case 'phone': return !phone.trim();
      case 'mokebName': return !mokebName.trim();
      case 'province': return !province.trim();
      case 'county': return !county.trim();
      case 'address': return !address.trim();
      case 'description': return !description.trim();
      case 'selectedServices': return selectedServices.length === 0;
      case 'staffList': return staffList.length === 0;
      case 'permitDoc': return !permitDoc;
      default: return false;
    }
  };

  const renderFieldError = (fieldName: string, customMessage: string) => {
    if (attemptedNext && isFieldEmpty(fieldName)) {
      return (
        <motion.p 
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] text-rose-300 font-extrabold flex items-center gap-1.5 mt-1.5 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20 leading-relaxed"
        >
          <Sparkles className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{customMessage}</span>
        </motion.p>
      );
    }
    return null;
  };

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const routesRef = collection(db, 'routes');
        const q = query(routesRef, orderBy('order', 'asc'));
        const querySnapshot = await getDocs(q);
        const routes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWalkRoutes(routes);
      } catch (err) {
        console.error("Error fetching walk routes:", err);
      }
    };
    fetchRoutes();
  }, []);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const catSnap = await getDocs(collection(db, 'categories'));
        const cats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCategories(cats);
        if (!categoryId && cats.length > 0) {
          setCategoryId(cats[0].id);
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };
    fetchCats();
  }, []);

  useEffect(() => {
    try {
      const draftData = {
        username,
        password,
        managerName,
        phone,
        mokebName,
        province,
        county,
        address,
        utm,
        description,
        selectedServices,
        staffList,
        currentStep,
        permitDoc,
        uploadFileName,
        routeId,
        categoryId,
        showContactInfoPublicly
      };
      safeStorage.setItem('register_mokeb_draft', JSON.stringify(draftData));
    } catch (e) {
      console.warn("Failed to save registration draft:", e);
    }
  }, [
    username, password, managerName, phone, mokebName, 
    province, county, address, utm, description, 
    selectedServices, staffList, currentStep, permitDoc, uploadFileName,
    routeId, showContactInfoPublicly
  ]);

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };

  const validateStep = (step: number): boolean => {
    setErrorMsg('');
    const cleanUsername = username.trim().toLowerCase();

    if (step === 1) {
      if (!cleanUsername) {
        setErrorMsg('نام کاربری نمی‌تواند خالی باشد.');
        return false;
      }
      if (usernameStatus === 'taken') {
        setErrorMsg('این نام کاربری از پیش ثبت شده است. لطفا نام دیگری انتخاب کنید.');
        return false;
      }
      if (cleanUsername.includes('@')) {
        setErrorMsg('نام کاربری نباید شامل کاراکتر @ یا ساختار ایمیل باشد.');
        return false;
      }
      if (cleanUsername.length < 3) {
        setErrorMsg('نام کاربری انتخابی حداقل باید ۳ کاراکتر انگلیسی باشد.');
        return false;
      }
      if (password.length < 6) {
        setErrorMsg('کلمه عبور امن باید حداقل ۶ کاراکتر باشد.');
        return false;
      }
    }

    if (step === 2) {
      if (!managerName.trim()) {
        setErrorMsg('لطفا نام و نام‌خانوادگی کامل موکب‌دار را وارد کنید.');
        return false;
      }
      if (!phone.trim()) {
        setErrorMsg('شماره تماس جهت هماهنگی‌های اضطراری الزامی است.');
        return false;
      }
    }

    if (step === 3) {
      if (!mokebName.trim()) {
        setErrorMsg('نام موکب الحسین (ع) الزامی است.');
        return false;
      }
      if (!categoryId) {
        setErrorMsg('لطفا دسته‌بندی فعالیت موکب را انتخاب کنید.');
        return false;
      }
      if (!province.trim() || !county.trim()) {
        setErrorMsg('لطفا استان و شهرستان محل استقراری موکب را تعیین نمایید.');
        return false;
      }
      if (!address.trim()) {
        setErrorMsg('آدرس دقیق استقرار و مجرای تردد زائرین الزامی است.');
        return false;
      }
      if (!description.trim()) {
        setErrorMsg('توضیحات معرفی موکب جهت اطلاع عموم زائرین محترم گرامی الزامی است.');
        return false;
      }
    }

    if (step === 4) {
      if (selectedServices.length === 0) {
        setErrorMsg('لطفا حداقل یک خدمت صلواتی یا رفاهی اختصاصی در کادر زیر تایپ و اضافه کنید.');
        return false;
      }
      if (staffList.length === 0) {
        setErrorMsg('ثبت حداقل یک نفر به عنوان مسئول فرعی یا چارت اجرایی خادمین الزامی است.');
        return false;
      }
    }

    return true;
  };

  const handleNextStep = () => {
    setAttemptedNext(true);
    if (validateStep(currentStep)) {
      setAttemptedNext(false);
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    setAttemptedNext(false);
    setCurrentStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddService = (srv: string) => {
    const trimmed = srv.trim();
    if (!trimmed) return;
    if (selectedServices.includes(trimmed)) {
      setErrorMsg('این خدمت پیش‌تر به لیست خدمات موکب افزوده شده است.');
      return;
    }
    setErrorMsg('');
    setSelectedServices(prev => [...prev, trimmed]);
  };

  const handleRemoveService = (srv: string) => {
    setSelectedServices(prev => prev.filter(x => x !== srv));
  };

  const handleAddStaff = () => {
    const name = staffName.trim();
    const ph = staffPhone.trim();
    if (!name || !ph) {
      setErrorMsg('لطفا مشخصات کامل شامل نام و شماره تماس مسئول را وارد کنید.');
      return;
    }
    const formatStr = `${name} | ${ph} | ${staffShowContact ? 'نمایش عمومی' : 'عدم نمایش'}`;
    const nameExists = staffList.some(s => s.split('|')[0].trim() === name);
    if (nameExists) {
      setErrorMsg('مسئولی با این نام قبلاً در لیست خادمان ثبت شده است.');
      return;
    }
    setErrorMsg('');
    setStaffList(prev => [...prev, formatStr]);
    setStaffName('');
    setStaffPhone('');
    setStaffShowContact(false);
  };

  const handleRemoveStaff = (index: number) => {
    setStaffList(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('اندازه پرونده جواز تفویضی نباید از ۵ مگابایت تجاوز نماید.');
      return;
    }
    setUploadFileName(file.name);
    setErrorMsg('');
    try {
      const resizedBase64 = await resizeImage(file, 1024, 1024, 0.7);
      setPermitDoc(resizedBase64);
    } catch (err) {
      console.error(err);
      setErrorMsg('خطایی در خوانش فایل جواز رخ داد. لطفا مجددا تلاش کنید.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const triggerMockUpload = () => {
    const mockBase64 = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="%23059669" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
    setUploadFileName('Mokeb_Official_Permit_Sample.png');
    setPermitDoc(mockBase64);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setAttemptedNext(true);
    setSubmitting(true);

    const cleanUsername = username.trim().toLowerCase();

    if (!validateStep(1)) {
      setAttemptedNext(true);
      setCurrentStep(1);
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!validateStep(2)) {
      setAttemptedNext(true);
      setCurrentStep(2);
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!validateStep(3)) {
      setAttemptedNext(true);
      setCurrentStep(3);
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!validateStep(4)) {
      setAttemptedNext(true);
      setCurrentStep(4);
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!permitDoc) {
      setAttemptedNext(true);
      setCurrentStep(5);
      setErrorMsg('بارگذاری مدرک یا تصویر مجوز جهت بررسی مسئولین ثبت الزامی است.');
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      const userRef = doc(db, 'users', cleanUsername);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setErrorMsg('این نام کاربری از پیش ثبت شده است. لطفا نام کاربری دیگری انتخاب کنید.');
        setSubmitting(false);
        return;
      }

      let lat: number | null = null;
      let lng: number | null = null;
      if (utm) {
        const parts = utm.split(',');
        if (parts.length === 2) {
          const parsedLat = parseFloat(parts[0].trim());
          const parsedLng = parseFloat(parts[1].trim());
          if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
            lat = parsedLat;
            lng = parsedLng;
          }
        }
      }

      const trackingCode = 'MKB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const mokebId = doc(collection(db, 'mokebs')).id;

      const userData = {
        id: cleanUsername,
        username: cleanUsername,
        password: password.trim(),
        name: managerName.trim(),
        phone: phone.trim(),
        email: `${cleanUsername}@system.local`,
        isAdmin: false,
        createdAt: new Date().toISOString()
      };

      const mokebData = {
        id: mokebId,
        trackingCode,
        ownerId: cleanUsername,
        name: mokebName.trim(),
        managerName: managerName.trim(),
        phone: phone.trim(),
        province: province.trim(),
        county: county.trim(),
        city: county.trim(),
        address: address.trim(),
        utm: utm.trim(),
        lat,
        lng,
        description: description.trim(),
        selectedServices,
        staffList,
        documentUrl: permitDoc,
        routeId: routeId || null,
        showContactInfoPublicly,
        status: 'pending_stage1',
        categoryId: categoryId || 'general-service',
        createdAt: new Date()
      };

      try {
        await setDoc(userRef, userData);
        await setDoc(doc(db, 'mokebs', mokebId), {
          ...mokebData,
          createdAt: serverTimestamp()
        });
      } catch (dbErr) {
        console.warn("Firestore registration failed, falling back to local/offline storage:", dbErr);
        const offlineUsersJson = safeStorage.getItem('offline_users') || '{}';
        const offlineUsers = JSON.parse(offlineUsersJson);
        offlineUsers[cleanUsername] = userData;
        safeStorage.setItem('offline_users', JSON.stringify(offlineUsers));

        const cachedMokebsJson = safeStorage.getItem('offline_mokebs') || '[]';
        const cachedMokebs = JSON.parse(cachedMokebsJson);
        cachedMokebs.push(mokebData);
        safeStorage.setItem('offline_mokebs', JSON.stringify(cachedMokebs));
      }

      safeStorage.setItem('mock_auth_username', cleanUsername);
      safeStorage.setItem('mock_auth_password', password.trim());
      window.dispatchEvent(new Event('auth-state-change'));

      setRegisteredUser(userData);
      setNewMokeb(mokebData);
      try {
        safeStorage.removeItem('register_mokeb_draft');
      } catch (e) {}
      setShowWelcome(true);
    } catch (err) {
      console.error("Critical registration error:", err);
      setErrorMsg('خطای حیاتی پایگاه ارتباط مرکزی روی داده است. مجددا تلاش کنید.');
    } finally {
      setSubmitting(false);
    }
  };

  if (showWelcome && registeredUser && newMokeb) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-6 py-12 text-slate-800 relative overflow-hidden" dir="rtl">
        {/* Decorative elements */}
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#007f5f_1px,transparent_1px)] opacity-[0.03] [background-size:20px_20px] pointer-events-none" />
        
        <Card className="max-w-md w-full bg-white border border-slate-200 rounded-[28px] p-6 sm:p-8 space-y-6 text-center shadow-2xl shadow-emerald-950/5 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500" />
          
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full border border-emerald-100 flex items-center justify-center text-[#007f5f] shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-emerald-800 font-extrabold text-[10px] bg-emerald-50 border border-emerald-150 px-3 py-1 rounded-full font-mono">
              صلی‌الله علیک یا اباعبدالله
            </span>
            <h2 className="text-xl font-black text-slate-950 pt-3">
              درخواست ثبت موکب ارسال شد
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              خادم گرامی جناب آقای <b className="text-slate-800">{managerName}</b>، اطلاعات موکب <b className="text-slate-800">{mokebName}</b> با موفقیت در سامانه PWA ثبت گردید.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-right space-y-2 font-sans text-xs">
            <p className="flex justify-between items-center text-slate-600">
              <span>کد رهگیری پرونده:</span>
              <strong className="text-amber-700 font-mono text-sm">{newMokeb.trackingCode}</strong>
            </p>
            <p className="flex justify-between items-center text-slate-600">
              <span>نام کاربری ورود:</span>
              <strong className="text-emerald-800 font-mono">{registeredUser.username}</strong>
            </p>
            <p className="flex justify-between items-center text-slate-600">
              <span>رمز عبور انتخابی:</span>
              <strong className="text-slate-500 font-mono">••••••</strong>
            </p>
            <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-400 leading-relaxed">
              * از منوی ورود موکب‌ها با همین نام کاربری و رمز عبور می‌توانید به پنل هدایت و مدیریت ظرفیت دسترسی داشته باشید.
            </div>
          </div>

          <Button 
            type="button" 
            onClick={() => navigate('/pwa')}
            className="w-full bg-gradient-to-r from-emerald-600 to-[#007f5f] hover:from-emerald-700 hover:to-[#00664c] active:scale-[0.98] text-white font-black text-xs h-11.5 rounded-2xl shadow-lg shadow-emerald-700/10 transition-all"
          >
            ورود به داشبورد PWA موکب‌داران
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans select-none relative overflow-hidden pb-10 animate-fade-in" dir="rtl">
      
      {/* Background Glows */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#007f5f_1px,transparent_1px)] opacity-[0.03] [background-size:20px_20px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 px-5 pt-6 pb-2 flex justify-between items-center">
        <Link 
          to="/pwa/login" 
          className="w-10 h-10 bg-white hover:bg-slate-100 active:bg-slate-200 rounded-full flex items-center justify-center border border-slate-200 shadow-sm transition-colors"
          id="pwa-reg-back-btn"
        >
          <ChevronRight className="w-5 h-5 text-slate-700" />
        </Link>
        <span className="text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-150 px-3 py-1 rounded-full flex items-center gap-1 shadow-xs">
          <Smartphone className="w-3.5 h-3.5 text-[#007f5f]" />
          ثبت‌نام موکب (PWA)
        </span>
      </header>

      {/* Main Content Form */}
      <main className="relative z-10 px-5 my-auto max-w-md w-full mx-auto space-y-5">
        
        {/* Title */}
        {currentStep === 1 && (
          <div className="text-center space-y-1.5">
            <h2 className="text-lg font-black text-slate-950">درخواست راه‌اندازی موکب جدید</h2>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed font-medium">
              برای معرفی موکب، ثبت موقعیت مکانی و ویرایش خدمات، مراحل ۵ گانه زیر را تکمیل کنید.
            </p>
          </div>
        )}

        {/* Stepper Header */}
        <div className="w-full">
          <div className="relative flex items-center justify-between px-2">
            <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-slate-200 -z-10 -translate-y-1/2" />
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex flex-col items-center gap-1.5">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${
                    currentStep === step 
                      ? 'bg-[#007f5f] text-white ring-4 ring-emerald-100 shadow-md scale-110' 
                      : currentStep > step 
                      ? 'bg-emerald-600/15 text-emerald-800 border border-emerald-250' 
                      : 'bg-white text-slate-400 border border-slate-200'
                  }`}
                >
                  {currentStep > step ? <Check className="w-4 h-4 text-emerald-800" /> : step}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-3">
            <span className="text-[9px] font-black bg-emerald-50 text-emerald-800 border border-emerald-150 px-3 py-1 rounded-full">
              {currentStep === 1 && 'مرحله ۱: ایجاد حساب کاربری'}
              {currentStep === 2 && 'مرحله ۲: مشخصات موکب‌دار'}
              {currentStep === 3 && 'مرحله ۳: مشخصات و نشانی موکب'}
              {currentStep === 4 && 'مرحله ۴: چارت خادمان و خدمات'}
              {currentStep === 5 && 'مرحله ۵: بارگذاری مجوز و ثبت'}
            </span>
          </div>
        </div>

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-50 border border-rose-150 text-rose-800 p-3.5 rounded-2xl text-[11px] flex items-start gap-2.5 leading-relaxed"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        {/* Dynamic Steps Container */}
        <div className="bg-white border border-slate-200 rounded-[28px] p-5 sm:p-6 space-y-4 shadow-xl shadow-slate-200/50">
          
          <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4">
            
            {/* Step 1: Credentials */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <p className="text-[10px] text-emerald-800 font-semibold leading-relaxed bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  خادم گرامی، جهت ایجاد دسترسی به پنل مدیریت اختصاصی مواکب و ویرایش اطلاعات، نام کاربری و رمز عبور امنی برای خود بسازید.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 block pr-1">شناسه کاربری دلخواه (حروف انگلیسی) *</label>
                    <div className="relative">
                      <User className="absolute right-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                      <Input 
                        required 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        dir="ltr" 
                        placeholder="e.g. ali_mokeb" 
                        className={`w-full bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded-2xl h-11 pr-11 pl-4 text-xs font-mono transition-all border-slate-200 ${
                          attemptedNext && isFieldEmpty('username') 
                            ? 'border-rose-400 ring-1 ring-rose-400/20' 
                            : usernameStatus === 'taken'
                            ? 'border-rose-400 ring-1 ring-rose-400/20'
                            : 'border-slate-200'
                        }`}
                      />
                      <div className="absolute left-3 top-3.5">
                        {usernameStatus === 'checking' && <span className="text-[10px] text-slate-400">در حال بررسی...</span>}
                        {usernameStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        {usernameStatus === 'taken' && <span className="text-[10px] text-rose-600 font-black">رزرو شده</span>}
                      </div>
                    </div>
                    {renderFieldError('username', 'لطفا شناسه کاربری انگلیسی دلخواه (حداقل ۳ کاراکتر بدون @) وارد کنید.')}
                    {usernameStatus === 'taken' && (
                      <motion.p 
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-rose-50 border border-rose-100 text-rose-800 p-2 rounded-xl text-[10px] flex items-center gap-1.5 leading-relaxed mt-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <span>این نام کاربری از پیش ثبت شده است. لطفا نام دیگری انتخاب کنید.</span>
                      </motion.p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 block pr-1">رمز عبور اختصاصی (حداقل ۶ کاراکتر) *</label>
                    <div className="relative">
                      <Lock className="absolute right-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                      <Input 
                        required 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        dir="ltr" 
                        placeholder="••••••••" 
                        className={`w-full bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded-2xl h-11 pr-11 pl-4 text-xs font-mono transition-all border-slate-200 ${
                          attemptedNext && isFieldEmpty('password') ? 'border-rose-400 ring-1 ring-rose-400/20' : 'border-slate-200'
                        }`}
                      />
                    </div>
                    {renderFieldError('password', 'درج رمز عبور با حداقل ۶ کاراکتر الزامی است.')}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <Button 
                    type="button" 
                    onClick={handleNextStep}
                    className="bg-[#007f5f] hover:bg-[#00664c] active:scale-95 text-white font-black px-6 h-11 rounded-2xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-700/15"
                  >
                    <span>مرحله بعدی</span>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Manager Profile */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <p className="text-[10px] text-emerald-800 font-semibold leading-relaxed bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  اطلاعات هویتی و شماره تلفن مسئول اصلی موکب را درج کنید. این اطلاعات جهت امور اداری و صدور تاییدیه الکترونیکی خواهد بود.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 block pr-1">نام و نام‌خانوادگی کامل متولی موکب *</label>
                    <Input 
                      required 
                      type="text"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      placeholder="مانند: علی محمدی کربلایی" 
                      className={`w-full bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded-2xl h-11 px-4 text-xs transition-all border-slate-200 ${
                        attemptedNext && isFieldEmpty('managerName') ? 'border-rose-400 ring-1 ring-rose-400/20' : 'border-slate-200'
                      }`}
                    />
                    {renderFieldError('managerName', 'نام و نشان کامل متولی موکب الزامی است.')}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 block pr-1">شماره تلفن همراه متولی موکب *</label>
                    <div className="relative">
                      <Phone className="absolute right-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                      <Input 
                        required 
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        dir="ltr"
                        placeholder="مثال: 09121234567" 
                        className={`w-full bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded-2xl h-11 pr-11 pl-4 text-xs font-mono transition-all border-slate-200 ${
                          attemptedNext && isFieldEmpty('phone') ? 'border-rose-400 ring-1 ring-rose-400/20' : 'border-slate-200'
                        }`}
                      />
                    </div>
                    {renderFieldError('phone', 'ثبت شماره تماس مستقیم متولی الزامی است.')}
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-emerald-50/40 p-3 rounded-2xl border border-emerald-100">
                  <input 
                    type="checkbox" 
                    id="showContactInfoPwa" 
                    checked={showContactInfoPublicly}
                    onChange={(e) => setShowContactInfoPublicly(e.target.checked)}
                    className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 bg-white"
                  />
                  <label htmlFor="showContactInfoPwa" className="text-[10px] text-slate-600 font-bold leading-relaxed cursor-pointer select-none">
                    موافقم اطلاعات تماس من (نام متولی و همراه) در درگاه نقشه زائران نمایش داده شود.
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between gap-3">
                  <Button 
                    type="button" 
                    onClick={handlePrevStep}
                    variant="outline"
                    className="border-slate-200 text-slate-500 hover:bg-slate-50 font-bold px-4 h-11 rounded-2xl text-xs flex items-center gap-1.5 transition-all"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                    <span>مرحله قبلی</span>
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleNextStep}
                    className="bg-[#007f5f] hover:bg-[#00664c] active:scale-95 text-white font-black px-5 h-11 rounded-2xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-700/15"
                  >
                    <span>مرحله بعدی</span>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Mokeb Details */}
            {currentStep === 3 && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-extrabold text-slate-500 block pr-1">نام مبارک موکب *</label>
                    <Input 
                      required 
                      type="text"
                      value={mokebName}
                      onChange={(e) => setMokebName(e.target.value)}
                      placeholder="مثال: موکب امام رضا (ع)" 
                      className={`w-full bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded-2xl h-11 px-4 text-xs font-black transition-all border-slate-200 ${
                        attemptedNext && isFieldEmpty('mokebName') ? 'border-rose-400 ring-1 ring-rose-400/20' : 'border-slate-200'
                      }`}
                    />
                    {renderFieldError('mokebName', 'نام مبارک موکب الزامی است.')}
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-extrabold text-slate-500 block pr-1">دسته‌بندی فعالیت موکب *</label>
                    <select 
                      className={`w-full text-xs bg-slate-50 border rounded-2xl h-11 px-3 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all border-slate-200 ${
                        attemptedNext && !categoryId ? 'border-rose-400 ring-1 ring-rose-400/20' : 'border-slate-200'
                      }`}
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      id="pwa-reg-category"
                    >
                      <option value="">-- انتخاب دسته‌بندی --</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    {renderFieldError('categoryId', 'انتخاب دسته‌بندی الزامی است.')}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 block pr-1">استان برپایی *</label>
                    <Input 
                      required 
                      type="text"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="مثال: کربلا" 
                      className={`w-full bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded-2xl h-11 px-3 text-xs transition-all border-slate-200 ${
                        attemptedNext && isFieldEmpty('province') ? 'border-rose-400 ring-1 ring-rose-400/20' : 'border-slate-200'
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 block pr-1">شهرستان / عمود *</label>
                    <Input 
                      required 
                      type="text"
                      value={county}
                      onChange={(e) => setCounty(e.target.value)}
                      placeholder="مثال: عمود ۳۴۰" 
                      className={`w-full bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded-2xl h-11 px-3 text-xs transition-all border-slate-200 ${
                        attemptedNext && isFieldEmpty('county') ? 'border-rose-400 ring-1 ring-rose-400/20' : 'border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 block pr-1">مسیر زائران (اختیاری)</label>
                  <select 
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-2xl h-11 px-3 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                    value={routeId}
                    onChange={(e) => setRouteId(e.target.value)}
                  >
                    <option value="">-- انتخاب مسیر پیاده‌روی (اختیاری) --</option>
                    {walkRoutes.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 block pr-1">نشانی دقیق استقرار موکب *</label>
                  <Textarea 
                    required 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="مثال: مسیر نجف به کربلا، عمود ۴۵۰، جنب هلال احمر" 
                    className={`w-full bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded-2xl h-16 resize-none p-3 text-xs leading-relaxed transition-all border-slate-200 ${
                      attemptedNext && isFieldEmpty('address') ? 'border-rose-400 ring-1 ring-rose-400/20' : 'border-slate-200'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 block pr-1">توضیحات و معرفی خدمات موکب *</label>
                  <Textarea 
                    required 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="خلاصه‌ای از ظرفیت‌های اسکان خواهران و برادران، خدمات تغذیه و رفاهی موکب..." 
                    className={`w-full bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded-2xl h-18 resize-none p-3 text-xs leading-relaxed transition-all border-slate-200 ${
                      attemptedNext && isFieldEmpty('description') ? 'border-rose-400 ring-1 ring-rose-400/20' : 'border-slate-200'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center pr-1">
                    <label className="text-[10px] font-extrabold text-slate-500">مختصات نقشه UTM (اختیاری)</label>
                    <button 
                      type="button" 
                      className="text-[9px] text-[#007f5f] font-bold hover:underline"
                      onClick={() => setShowUtmGuide(!showUtmGuide)}
                    >
                      راهنمای کپی مختصات
                    </button>
                  </div>
                  <Input 
                    type="text"
                    value={utm}
                    onChange={(e) => setUtm(e.target.value)}
                    dir="ltr"
                    placeholder="e.g. 32.6163, 44.0244" 
                    className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 border-slate-200 text-center focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded-2xl h-11 text-xs font-mono"
                  />
                  {showUtmGuide && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-emerald-50 border border-emerald-150 text-emerald-900 p-3 rounded-2xl text-[9px] leading-relaxed space-y-1"
                    >
                      <p className="font-black text-emerald-850">📍 راهنمای برداشت مختصات نقشه:</p>
                      <p>کافی است در گوگل‌مپ روی مکان دقیق موکب خود نگه دارید و عدد اعشاری ظاهر شده (مانند ۳۲.۶۱۶۳, ۴۴.۰۲۴۴) را کپی و اینجا درج کنید.</p>
                    </motion.div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between gap-3">
                  <Button 
                    type="button" 
                    onClick={handlePrevStep}
                    variant="outline"
                    className="border-slate-200 text-slate-500 hover:bg-slate-50 font-bold px-4 h-11 rounded-2xl text-xs flex items-center gap-1.5 transition-all"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                    <span>مرحله قبلی</span>
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleNextStep}
                    className="bg-[#007f5f] hover:bg-[#00664c] active:scale-95 text-white font-black px-5 h-11 rounded-2xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-700/15"
                  >
                    <span>مرحله بعدی</span>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Services and staff */}
            {currentStep === 4 && (
              <div className="space-y-4">
                
                {/* Services */}
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-slate-500 block pr-1">ثبت خدمات موکب الحسین:</label>
                  <div className="flex gap-2">
                    <Input 
                      type="text"
                      value={customService}
                      onChange={(e) => setCustomService(e.target.value)}
                      placeholder="مانند: توزیع آب خنک، اسکان خواهران" 
                      className="flex-1 bg-slate-50 text-slate-900 placeholder-slate-400 border-slate-200 focus:bg-white focus:ring-1 focus:ring-[#007f5f] rounded-2xl h-11 text-xs px-4"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        handleAddService(customService);
                        setCustomService('');
                      }}
                      className="bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-[#007f5f] h-11 rounded-2xl px-3 text-xs font-black shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Service list/chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedServices.map((srv, idx) => (
                      <span key={idx} className="bg-emerald-50 text-emerald-850 border border-emerald-150 px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-xs">
                        <span>{srv}</span>
                        <button type="button" onClick={() => handleRemoveService(srv)} className="text-rose-600 hover:text-rose-800 mr-0.5">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {selectedServices.length === 0 && (
                      <div className="text-[9px] text-amber-800 font-extrabold leading-relaxed p-2 bg-amber-50 rounded-xl border border-amber-150 w-full text-center">
                        ثبت حداقل یک خدمت صلواتی یا رفاهی الزامی است!
                      </div>
                    )}
                  </div>


                </div>

                {/* Staff list */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <label className="text-[10px] font-extrabold text-slate-500 block pr-1">ثبت خادمین و چارت اجرایی:</label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        type="text"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="نام کامل خادم" 
                        className="bg-slate-50 text-slate-900 placeholder-slate-400 border-slate-200 focus:bg-white focus:ring-1 focus:ring-[#007f5f] rounded-2xl h-11 text-xs px-3"
                      />
                      <Input 
                        type="tel"
                        value={staffPhone}
                        onChange={(e) => setStaffPhone(e.target.value)}
                        dir="ltr"
                        placeholder="تلفن تماس" 
                        className="bg-slate-50 text-slate-900 placeholder-slate-400 border-slate-200 focus:bg-white focus:ring-1 focus:ring-[#007f5f] rounded-2xl h-11 text-xs px-3 font-mono"
                      />
                    </div>
                    <div className="flex items-center pt-1 pb-1">
                      <div className="flex items-start gap-1.5">
                        <input 
                          type="checkbox" 
                          id="staffShowContactPwa" 
                          checked={staffShowContact}
                          onChange={(e) => setStaffShowContact(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                        />
                        <label htmlFor="staffShowContactPwa" className="text-[9px] text-slate-700 font-extrabold cursor-pointer select-none">
                          نمایش عمومی شماره در سایت
                        </label>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddStaff}
                      className="w-full bg-emerald-50 hover:bg-emerald-100/80 text-[#007f5f] border border-emerald-150 h-10 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>درج خادم در چارت موکب</span>
                    </Button>
                  </div>

                  {/* Staff chips */}
                  <div className="space-y-1.5 pt-1.5">
                    {staffList.map((stf, idx) => {
                      const p = stf.split('|').map(s => s.trim());
                      return (
                        <div key={idx} className="bg-slate-50 border border-slate-200 p-2 rounded-xl flex justify-between items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-black text-slate-900 block truncate">{p[0]}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-slate-500 font-mono block">{p[1]}</span>
                              {p[2] && (
                                <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold ${p[2] === 'نمایش عمومی' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                  {p[2]}
                                </span>
                              )}
                            </div>
                          </div>
                          <button type="button" onClick={() => handleRemoveStaff(idx)} className="p-1 text-rose-500 hover:text-rose-700 shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    {staffList.length === 0 && (
                      <div className="text-[9px] text-amber-800 font-extrabold leading-relaxed p-2 bg-amber-50 rounded-xl border border-amber-150 w-full text-center">
                        ثبت حداقل یک خادم جانشین یا کمکی الزامی است!
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between gap-3">
                  <Button 
                    type="button" 
                    onClick={handlePrevStep}
                    variant="outline"
                    className="border-slate-200 text-slate-500 hover:bg-slate-50 font-bold px-4 h-11 rounded-2xl text-xs flex items-center gap-1.5 transition-all"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                    <span>مرحله قبلی</span>
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleNextStep}
                    className="bg-[#007f5f] hover:bg-[#00664c] active:scale-95 text-white font-black px-5 h-11 rounded-2xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-700/15"
                  >
                    <span>مرحله بعدی</span>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Upload & Submit */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <p className="text-[10px] text-emerald-800 font-semibold leading-relaxed bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  خادم گرامی، جهت صدور تاییدیه رسمی و راستی‌آزمایی، لطفا تصویر یا فایل PDF مجوز ستاد بازسازی عتبات عالیات یا ارگان‌های ذیربط را ارسال نمایید.
                </p>

                <div 
                  className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <UploadCloud className="w-8 h-8 text-[#007f5f] mb-2" />
                  
                  {permitDoc ? (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-emerald-700">✓ جواز موکب با موفقیت بارگذاری شد!</p>
                      <p className="text-[8px] text-slate-500 font-mono truncate max-w-[200px] mx-auto">{uploadFileName}</p>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPermitDoc(null);
                          setUploadFileName('');
                        }}
                        className="text-[9px] text-rose-600 font-extrabold underline"
                      >
                        حذف و انتخاب مجدد
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-700">تصویر یا فایل مجوز را انتخاب یا در اینجا بکشید</p>
                      <p className="text-[8px] text-slate-400 font-medium">حداکثر حجم ۳ مگابایت (PDF , JPG , PNG)</p>
                      
                      <div className="pt-1.5 flex flex-col gap-1.5">
                        <label className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl text-[9px] font-black cursor-pointer shadow-xs inline-block">
                          انتخاب فایل از گوشی
                          <input 
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf" 
                            className="hidden" 
                            onChange={handleFileChange}
                          />
                        </label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          onClick={triggerMockUpload}
                          className="text-[#007f5f] hover:text-[#00664c] hover:bg-emerald-50/50 text-[9px] font-extrabold h-auto p-1"
                        >
                          ✨ استفاده از مجوز آزمایشی پیش‌فرض
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {renderFieldError('permitDoc', 'آپلود جواز موکب یا کلیک روی استفاده از مجوز پیش‌فرض الزامی است.')}

                <div className="pt-3 border-t border-slate-100 flex justify-between gap-3">
                  <Button 
                    type="button" 
                    onClick={handlePrevStep}
                    variant="outline"
                    className="border-slate-200 text-slate-500 hover:bg-slate-50 font-bold px-4 h-11 rounded-2xl text-xs flex items-center gap-1.5 transition-all"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                    <span>مرحله قبلی</span>
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={submitting}
                    className="bg-gradient-to-r from-emerald-600 to-[#007f5f] hover:from-emerald-700 hover:to-[#00664c] text-white font-black px-6 h-11 rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-700/10"
                  >
                    {submitting ? 'در حال ثبت...' : 'ثبت نهایی اطلاعات موکب'}
                  </Button>
                </div>
              </div>
            )}

          </form>

        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 px-5 text-center space-y-3 mt-4">
        <p className="text-[9px] text-slate-400 font-bold">کمیته مواکب حسینی © تمامی حقوق محفوظ است</p>
      </footer>

    </div>
  );
}
