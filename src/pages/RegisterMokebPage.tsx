import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, doc, getDoc, setDoc, serverTimestamp, query, orderBy, getDocs } from '../lib/db';
import { db, handleFirestoreError, OperationType } from '../lib/db';
import { safeStorage } from '../lib/safeStorage';
import { resizeImage } from '../lib/imageResizer';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { 
  Sparkles, 
  ArrowLeft, 
  CheckCircle2, 
  UserCheck, 
  ShieldCheck, 
  ClipboardCheck, 
  Plus, 
  Trash2, 
  UploadCloud, 
  HelpCircle, 
  MapPin, 
  Lock, 
  User, 
  Phone, 
  Building, 
  Info, 
  FileCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Smartphone
} from 'lucide-react';



export default function RegisterMokebPage() {
  const navigate = useNavigate();

  // Screen layout detection logic for PWA/Mobile optimizations
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

// Form states matching user requested inputs
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

  // Dynamic lists with addition/removal states
  const [selectedServices, setSelectedServices] = useState<string[]>(draft?.selectedServices || []);
  const [customService, setCustomService] = useState('');
  
  // Staff / Responsible persons
  const [staffList, setStaffList] = useState<string[]>(draft?.staffList || []);
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffShowContact, setStaffShowContact] = useState(false);

  // Permit document uploader state
  const [permitDoc, setPermitDoc] = useState<string | null>(draft?.permitDoc || null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFileName, setUploadFileName] = useState(draft?.uploadFileName || '');

  // Status and error/success wrappers
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

  // Guide helper for UTM positioning
  const [showUtmGuide, setShowUtmGuide] = useState(false);

  // New fields
  const [routeId, setRouteId] = useState(draft?.routeId || '');
  const [showContactInfoPublicly, setShowContactInfoPublicly] = useState(draft?.showContactInfoPublicly ?? false);
  const [walkRoutes, setWalkRoutes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState(draft?.categoryId || '');

  // Validation touch error triggers
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
          className="text-[10px] text-rose-600 font-extrabold flex items-center gap-1.5 mt-1.5 bg-rose-50 p-2 rounded-lg border border-rose-100 leading-relaxed"
        >
          <Sparkles className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span>{customMessage}</span>
        </motion.p>
      );
    }
    return null;
  };

  // Fetch walk routes
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

  // Fetch categories
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const catSnap = await getDocs(collection(db, 'categories'));
        const cats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCategories(cats);
        // If no category selected and categories exist, pick the first one as default
        if (!categoryId && cats.length > 0) {
          setCategoryId(cats[0].id);
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };
    fetchCats();
  }, []);

  // 🌟 Save draft to safeStorage on change
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

  // Prevent Enter key from submitting the form unexpectedly
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };

  // Validation function for each step prior to unlocking the next step
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

  // Add custom service to string[]
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

  // Add staff with specific name & phone to staffList string[] formatted "Name | Phone | ShowContact"
  const handleAddStaff = () => {
    const name = staffName.trim();
    const ph = staffPhone.trim();
    if (!name || !ph) {
      setErrorMsg('لطفا مشخصات کامل شامل نام و شماره تماس مسئول را وارد کنید.');
      return;
    }
    const formatStr = `${name} | ${ph} | ${staffShowContact ? 'نمایش عمومی' : 'عدم نمایش'}`;
    // simple includes check might be too strict if they just change the visibility checkbox, but we will leave it as is for simplicity, maybe check if name already exists?
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

  // File reader converter for permit verification
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
    // Inject a professional mockup permit image if they came without physical document file
    const mockBase64 = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="%23059669" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
    setUploadFileName('Mokeb_Official_Permit_Sample.png');
    setPermitDoc(mockBase64);
  };

  // Main submission and validation logic
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setAttemptedNext(true);
    setSubmitting(true);

    const cleanUsername = username.trim().toLowerCase();

    // Run all validations
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
      // 2. Database validation (Availability of username)
      const userRef = doc(db, 'users', cleanUsername);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setErrorMsg('این نام کاربری از پیش ثبت شده است. لطفا نام کاربری دیگری انتخاب کنید.');
        setSubmitting(false);
        return;
      }

      // 3. Setup coordinates from UTM if provided
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

      // 4. Create User security entity
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

      // 5. Create Mokeb request entity (Pending status - goes to admin queue)
      const mokebData = {
        id: mokebId,
        trackingCode,
        ownerId: cleanUsername,
        name: mokebName.trim(),
        managerName: managerName.trim(),
        phone: phone.trim(),
        province: province.trim(),
        county: county.trim(),
        city: county.trim(), // Dual support for seamless filter queries
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
        status: 'pending_stage1', // This launches the review inbox
        categoryId: categoryId || 'general-service',
        createdAt: new Date() // Fallback to safe date format
      };

      // Atomic transactions
      try {
        const userRef = doc(db, 'users', cleanUsername);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          throw new Error('نام کاربری از قبل وجود دارد.');
        }

        // Save user profile directly in Firestore
        await setDoc(userRef, userData);

        // Save Mokeb directly in Firestore
        await setDoc(doc(db, 'mokebs', mokebId), {
          ...mokebData,
          createdAt: serverTimestamp()
        });

        // Also ping backend API for any external logging/sync
        try {
          await fetch('/api/register-mokeb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userData, mokebData })
          });
        } catch (e) {
          console.warn("API logging ping failed, but data saved to Firestore successfully.", e);
        }
      } catch (dbErr: any) {
        console.warn("Firestore registration failed, falling back to local/offline storage:", dbErr);
        if (dbErr.message === 'نام کاربری از قبل وجود دارد.') {
          throw dbErr;
        }
        // Save user profile locally in safe storage
        const offlineUsersJson = safeStorage.getItem('offline_users') || '{}';
        const offlineUsers = JSON.parse(offlineUsersJson);
        offlineUsers[cleanUsername] = userData;
        safeStorage.setItem('offline_users', JSON.stringify(offlineUsers));

        // Save mock mokeb locally
        const cachedMokebsJson = safeStorage.getItem('offline_mokebs') || '[]';
        const cachedMokebs = JSON.parse(cachedMokebsJson);
        cachedMokebs.push(mokebData);
        safeStorage.setItem('offline_mokebs', JSON.stringify(cachedMokebs));
      }

      // 6. Force Local Authentication
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
      <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[80vh] overscroll-none touch-pan-y" dir="rtl">
        <Card className="max-w-xl w-full bg-white rounded-3xl border border-emerald-100 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#007f5f] via-amber-400 to-[#1a1c2c]" />
          <CardContent className="p-6 sm:p-10 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-emerald-700 font-bold text-xs bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full font-mono">
                صلی‌الله علیک یا اباعبدالله
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight pt-2">
                پروفایل شما در حال بررسی و تایید است!
              </h2>
            </div>

            <p className="text-xs text-slate-500 font-semibold font-sans max-w-sm mx-auto leading-relaxed">
              پرونده دیجیتال هویتی موکب شما در سامانه ثبت گردید. پس از تایید مدیریت، پنل کاربری شما باز شده و می‌توانید اطلاعات خود را ویرایش کنید، آواتار و اطلاعیه بگذارید، استوری منتشر کنید و امتیازات زائرین را مشاهده نمایید.
            </p>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-right space-y-3 font-sans max-w-md mx-auto">
              <h3 className="text-xs font-black text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-[#007f5f]" />
                مایملک اطلاعات ثبت شده:
              </h3>
              <div className="grid grid-cols-2 gap-3.5 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 block pb-0.5">نام موکب:</span>
                  <span className="font-bold text-slate-800">{newMokeb.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block pb-0.5">کد رهگیری پرونده:</span>
                  <span className="font-mono font-black text-rose-600 block">{newMokeb.trackingCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block pb-0.5">موکب‌دار گرامی:</span>
                  <span className="font-bold text-slate-800">{registeredUser.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block pb-0.5">حساب کاربری:</span>
                  <span className="font-mono font-bold text-slate-800">{registeredUser.username}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 max-w-sm mx-auto">
              <Button 
                onClick={() => navigate('/pwa?tab=dashboard')} 
                className="w-full bg-[#1a1c2c] hover:bg-slate-800 text-white font-black h-12 rounded-xl text-xs gap-2 shadow-lg hover:shadow-xl transition-all"
              >
                <span>ورود به پرتال یکپارچه خادمین</span>
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 pb-24 relative flex flex-col font-sans px-4 py-8" dir="rtl">
      
      <div className="max-w-6xl w-full mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8 bg-white p-5 rounded-2xl border border-slate-150 shadow-sm justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/login" 
              className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all text-slate-600 shrink-0 border border-slate-200/60"
              id="back-to-login"
            >
              <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                ثبت اطلاعات موکب در سامانه موکب‌یاب
              </h1>
              <p className="text-slate-500 text-xs mt-1 font-medium font-sans">
                طراحی یکپارچه ویژه ثبت مشخصات مکانی و معرفی خدمات موکب الحسین (ع)
              </p>
            </div>
          </div>
          
          <Link
            to="/pwa/register"
            className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-xl text-xs font-black transition-all border border-emerald-200/60 self-stretch sm:self-auto justify-center"
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>انتقال به نسخه PWA مخصوص موبایل</span>
          </Link>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl text-xs mb-6 font-bold border border-red-100 flex items-center gap-2.5 shadow-sm animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="flex-1 leading-relaxed">{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Column 1: Sidebar Guidelines (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Stepper Header (Vertical list on Desktop) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-5">
              <h3 className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2.5">وضعیت مراحل پیشرفت:</h3>
              <div className="flex flex-col gap-4">
                {[
                  { num: 1, name: 'حساب کاربری امن', desc: 'تعیین نام کاربری و رمز ورود' },
                  { num: 2, name: 'اطلاعات متولی موکب', desc: 'نام متولی و شماره تماس هماهنگی' },
                  { num: 3, name: 'اطلاعات استقرار موکب', desc: 'نشانی دقیق، جاده و مختصات' },
                  { num: 4, name: 'خدمات رفاهی و خادمین', desc: 'خدمات صلواتی و چارت همکاران' },
                  { num: 5, name: 'بارگذاری مدارک و ثبت', desc: 'ارسال جواز فعالیت موکب حسینی' }
                ].map((step) => (
                  <div key={step.num} className="flex items-center gap-3">
                    <div 
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 shrink-0 ${
                        currentStep === step.num 
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-md scale-105' 
                          : currentStep > step.num 
                          ? 'bg-emerald-500 text-white border border-emerald-600' 
                          : 'bg-white text-slate-400 border border-slate-200'
                      }`}
                    >
                      {currentStep > step.num ? <Check className="w-4 h-4" /> : step.num}
                    </div>
                    <div>
                      <p className={`text-[11px] font-black leading-none ${currentStep === step.num ? 'text-emerald-700 font-extrabold' : 'text-slate-500'}`}>
                        {step.name}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Spiritual Tip / Guiding Info */}
            <div className="bg-emerald-950 text-emerald-100 p-6 rounded-2xl border border-emerald-900/40 shadow-sm space-y-3 relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-800/10 rounded-full" />
              <div className="text-amber-400 font-extrabold text-[10px] bg-emerald-900/50 px-2.5 py-1 rounded-full w-max border border-emerald-800 font-mono">
                بسم رب الشهداء و الصدیقین
              </div>
              <h4 className="text-sm font-black text-white pt-1">پرتال جامع راهنمای مراسم تشییع رهبر شهید</h4>
              <p className="text-[10px] leading-relaxed text-emerald-200 font-sans">
                خادم گرامی، ثبت اطلاعات دقیق استقرار مکانی و خدمات موکب در پرتال، گامی بزرگ در جهت راهنمایی دقیق‌تر زائرین و تشییع‌کنندگان در مسیرهای پیاده‌روی و جاده‌های منتهی به مراسم تشییع رهبر شهید است.
              </p>
              <ul className="text-[10px] space-y-1.5 text-emerald-300 pt-2 border-t border-emerald-900/60 font-sans">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>نمایش لحظه‌ای روی نقشه عمومی زائران</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>اعلام وضعیت ظرفیت خالی اسکان</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>امکان تغییر اطلاعات خادمین و خدمات به صورت آفلاین</span>
                </li>
              </ul>
            </div>
            
          </div>

          {/* Column 2: Step-by-step Form (8 cols) */}
          <div className="lg:col-span-8">
            <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
            
            {/* Step 1: Security credentials */}
            {currentStep === 1 && (
              <Card className="rounded-2xl border border-slate-150 shadow-sm bg-white overflow-hidden animate-fade-in relative">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600" />
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                  <CardTitle className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    مرحله اول: ایجاد گذرگاه و حساب کاربری امن
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/50">
                    خادم گرامی، جهت ایجاد دسترسی به پنل مدیریت اختصاصی مواکب و ثبت ویرایش اطلاعات در آینده، یک حساب کاربری امن تنظیم نمایید. اطلاعات حساب خود را یادداشت فرمایید.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-slate-700 block">شناسه کاربری دلخواه (فقط حروف انگلیسی) *</label>
                      <div className="relative">
                        <User className="absolute right-3 top-3.5 w-4 h-4 text-slate-400" />
                        <Input 
                          required 
                          type="text" 
                          value={username} 
                          onChange={(e) => setUsername(e.target.value)} 
                          dir="ltr" 
                          placeholder="مثال: ali_karbalai" 
                          className={`bg-white pr-9 text-xs rounded-xl focus:border-emerald-500 font-mono h-11 transition-all ${
                            attemptedNext && isFieldEmpty('username') 
                              ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10' 
                              : usernameStatus === 'taken'
                              ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10'
                              : 'border-slate-200'
                          }`}
                          id="reg-username"
                        />
                        <div className="absolute left-3 top-3.5">
                          {usernameStatus === 'checking' && <span className="text-[10px] text-slate-400">در حال بررسی...</span>}
                          {usernameStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          {usernameStatus === 'taken' && <span className="text-[10px] text-rose-600 font-black">نام کاربری رزرو است</span>}
                        </div>
                      </div>
                      {renderFieldError('username', 'خادم گرامی، لطفا یک نام کاربری انگلیسی دلخواه (حداقل ۳ کاراکتر بدون @) وارد کنید تا پرتال شما ساخته شود.')}
                      {usernameStatus === 'taken' && (
                        <motion.p 
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[10px] text-rose-600 font-extrabold flex items-center gap-1.5 mt-1.5 bg-rose-50 p-2 rounded-lg border border-rose-100 leading-relaxed"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>این نام کاربری از پیش ثبت شده است. لطفا نام دیگری انتخاب کنید.</span>
                        </motion.p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-slate-700 block">گذرواژه امن (رمز ورود به پرتال) *</label>
                      <div className="relative">
                        <Lock className="absolute right-3 top-3.5 w-4 h-4 text-slate-400" />
                        <Input 
                          required 
                          type="password" 
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)} 
                          dir="ltr" 
                          placeholder="حداقل ۶ کاراکتر انگلیسی" 
                          className={`bg-white pr-9 text-xs rounded-xl focus:border-emerald-500 h-11 transition-all ${
                            attemptedNext && isFieldEmpty('password') 
                              ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10' 
                              : 'border-slate-200'
                          }`}
                          id="reg-password"
                        />
                      </div>
                      {renderFieldError('password', 'گذرواژه شما کلید امنیت اطلاعات موکب است؛ درج رمز عبور معتبر با حداقل ۶ کاراکتر الزامی است.')}
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6 pt-6">
                    <Button 
                      type="button" 
                      onClick={handleNextStep}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 h-11 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                    >
                      مرحله بعدی
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Owner profile */}
            {currentStep === 2 && (
              <Card className="rounded-2xl border border-slate-150 shadow-sm bg-white overflow-hidden animate-fade-in relative">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600" />
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                  <CardTitle className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                    مرحله دوم: شناسنامه هویتی و مشخصات مسئول اصلی موکب
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/50">
                    مشخصات هویتی و شماره تماس مستقیم خود را به عنوان مدیر یا متولی اصلی ثبت نمایید. این اطلاعات برای صدور مجوز الکترونیکی و مکاتبات رسمی استفاده خواهد شد.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-slate-700 block">نام و نام‌خانوادگی کامل متولی موکب *</label>
                      <Input 
                        required 
                        type="text"
                        value={managerName}
                        onChange={(e) => setManagerName(e.target.value)}
                        placeholder="مانند: علی محمدی کربلایی" 
                        className={`bg-white text-xs rounded-xl focus:border-emerald-500 h-11 transition-all ${
                          attemptedNext && isFieldEmpty('managerName') 
                            ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10' 
                            : 'border-slate-200'
                        }`}
                        id="reg-manager-name"
                      />
                      {renderFieldError('managerName', 'نام و نشان کامل متولی موکب الحسین برای امور صدور تاییدیه و هماهنگی رسمی الزامی است.')}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-slate-700 block">شماره تلفن همراه متولی (فعال و در دسترس) *</label>
                      <div className="relative">
                        <Phone className="absolute right-3 top-3.5 w-4 h-4 text-slate-400" />
                        <Input 
                          required 
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          dir="ltr"
                          placeholder="مثال: 09121234567" 
                          className={`bg-white pr-9 text-xs rounded-xl focus:border-emerald-500 font-mono h-11 transition-all ${
                            attemptedNext && isFieldEmpty('phone') 
                              ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10' 
                              : 'border-slate-200'
                          }`}
                          id="reg-phone"
                        />
                      </div>
                      {renderFieldError('phone', 'ثبت شماره تماس مستقیم متولی جهت ارسال کدهای پیگیری و هماهنگی‌های اضطراری الزامی است.')}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-250/60">
                    <input 
                      type="checkbox" 
                      id="showContactInfo" 
                      checked={showContactInfoPublicly}
                      onChange={(e) => setShowContactInfoPublicly(e.target.checked)}
                      className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <label htmlFor="showContactInfo" className="text-[10px] text-slate-700 font-extrabold leading-relaxed cursor-pointer select-none">
                      موافقم مشخصات تماس من (نام متولی و تلفن همراه) جهت راهنمایی زائرین و امور رفاهی در درگاه عمومی موکب یاب نمایش داده شود.
                    </label>
                  </div>

                  <div className="pt-4 flex justify-between gap-3 border-t border-slate-100 mt-6 pt-6">
                    <Button 
                      type="button" 
                      onClick={handlePrevStep}
                      variant="outline"
                      className="text-slate-500 font-bold px-6 h-11 rounded-xl text-xs flex items-center gap-2 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                      مرحله قبلی
                    </Button>
                    <Button 
                      type="button" 
                      onClick={handleNextStep}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 h-11 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                    >
                      مرحله بعدی
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Mokeb basics */}
            {currentStep === 3 && (
              <Card className="rounded-2xl border border-slate-150 shadow-sm bg-white overflow-hidden animate-fade-in relative">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600" />
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                  <CardTitle className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                    <Building className="w-5 h-5 text-emerald-600" />
                    مرحله سوم: مشخصات استقرار مکانی و نام موکب
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/50">
                    نام مبارک موکب خود و استان/شهرستان محل استقرار آن را وارد کنید. این مشخصات در جستجوی مستقیم زائران نمایش داده خواهد شد.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5 md:col-span-1">
                      <label className="text-[10px] font-extrabold text-slate-700 block">نام مبارک موکب *</label>
                      <Input 
                        required 
                        type="text"
                        value={mokebName}
                        onChange={(e) => setMokebName(e.target.value)}
                        placeholder="مثال: موکب امام رضا (ع)" 
                        className={`bg-white text-xs rounded-xl focus:border-emerald-500 h-11 font-black text-slate-800 transition-all ${
                          attemptedNext && isFieldEmpty('mokebName') 
                            ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10' 
                            : 'border-slate-200'
                        }`}
                        id="reg-mokeb-name"
                      />
                      {renderFieldError('mokebName', 'نام مبارک موکب، نشانی و هویت معنوی شماست. لطفا نام آن را وارد کنید.')}
                    </div>
                    <div className="space-y-1.5 md:col-span-1">
                      <label className="text-[10px] font-extrabold text-slate-700 block">دسته‌بندی فعالیت موکب *</label>
                      <select 
                        className={`w-full text-xs bg-white border rounded-xl h-11 px-3 text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none transition-all ${
                          attemptedNext && !categoryId ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10' : 'border-slate-200'
                        }`}
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        id="reg-category"
                      >
                        <option value="">-- انتخاب دسته‌بندی --</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      {renderFieldError('categoryId', 'انتخاب دسته‌بندی جهت تسهیل در جستجوی زائرین الزامی است.')}
                    </div>
                    <div className="space-y-1.5 md:col-span-1">
                      <label className="text-[10px] font-extrabold text-slate-700 block">استان محل برپایی موکب *</label>
                      <Input 
                        required 
                        type="text"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        placeholder="مثال: خوزستان / کربلا" 
                        className={`bg-white text-xs rounded-xl focus:border-emerald-500 h-11 transition-all ${
                          attemptedNext && isFieldEmpty('province') 
                            ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10' 
                            : 'border-slate-200'
                        }`}
                        id="reg-province"
                      />
                      {renderFieldError('province', 'مشخص کردن استان محل استقرار جهت هماهنگی و تخصیص سهمیه‌ها الزامی است.')}
                    </div>
                    <div className="space-y-1.5 md:col-span-1">
                      <label className="text-[10px] font-extrabold text-slate-700 block">شهرستان محل برپایی موکب *</label>
                      <Input 
                        required 
                        type="text"
                        value={county}
                        onChange={(e) => setCounty(e.target.value)}
                        placeholder="مثال: خرمشهر / مسیر نجف به کربلا" 
                        className={`bg-white text-xs rounded-xl focus:border-emerald-500 h-11 transition-all ${
                          attemptedNext && isFieldEmpty('county') 
                            ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10' 
                            : 'border-slate-200'
                        }`}
                        id="reg-county"
                      />
                      {renderFieldError('county', 'تعیین شهرستان یا بخش مربوطه برای دسته‌بندی و نقشه‌برداری الزامی است.')}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] font-extrabold text-slate-700 block">انتخاب مسیر رسمی پیاده‌روی (اختیاری)</label>
                      <select 
                        className="w-full text-xs font-sans bg-white border border-slate-200 rounded-xl h-11 px-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        value={routeId}
                        onChange={(e) => setRouteId(e.target.value)}
                      >
                        <option value="">-- انتخاب مسیر (اختیاری) --</option>
                        {walkRoutes.map(r => (
                          <option key={r.id} value={r.id}>{r.name} - {r.description}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-700 block" id="address-label">آدرس دقیق و کروکی محل استقرار *</label>
                    <Textarea 
                      required 
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="مثال: مرز شلمچه، پل نو، بعد از گمرک، عمود ۳۲۴" 
                      className={`bg-white text-xs rounded-xl border focus:border-emerald-500 h-16 resize-none p-3 font-sans leading-relaxed transition-all ${
                        attemptedNext && isFieldEmpty('address') 
                          ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10' 
                          : 'border-slate-200'
                      }`}
                      id="reg-address"
                    />
                    {renderFieldError('address', 'آدرس دقیق، راهنمای حقیقی زائران مشتاق به سمت موکب شماست. لطفا با ذکر جزئیات یا شماره عمود بنویسید.')}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-700 block">توضیحات تکمیلی و معرفی موکب *</label>
                    <Textarea 
                      required 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="نوشتاری کوتاه از معرفی موکب، سوابق برپایی، و ظرفیت‌های پذیرایی روزانه از زوار الحسین..." 
                      className={`bg-white text-xs rounded-xl border focus:border-emerald-500 h-24 p-3 font-sans leading-relaxed transition-all ${
                        attemptedNext && isFieldEmpty('description') 
                          ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10' 
                          : 'border-slate-200'
                      }`}
                      id="reg-description"
                    />
                    {renderFieldError('description', 'توضیحات معرفی به زائرین کمک می‌کند تا با ظرفیت‌های اسکان و خدمات پربرکت موکب شما بهتر آشنا شوند.')}
                  </div>

                  {/* UTM Position */}
                  <div className="space-y-1.5 border-t border-slate-100 pt-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-extrabold text-slate-700">موقعیت نقشه UTM (طول و عرض جغرافیایی جدا شده با کاما - اختیاری)</label>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        className="h-6 text-[10px] text-blue-600 font-bold hover:bg-blue-50 px-2 rounded-lg"
                        onClick={() => setShowUtmGuide(!showUtmGuide)}
                      >
                        <HelpCircle className="w-3.5 h-3.5 ml-1" />
                        کجا پیدا کنم؟
                      </Button>
                    </div>
                    <Input 
                      type="text"
                      value={utm}
                      onChange={(e) => setUtm(e.target.value)}
                      dir="ltr"
                      placeholder="مثال: 32.4279, 48.2435" 
                      className="bg-white text-xs rounded-xl focus:border-emerald-500 font-mono h-11 text-center border border-slate-200"
                      id="reg-utm"
                    />
                    {showUtmGuide && (
                      <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-xl text-[10px] leading-relaxed font-sans space-y-1.5">
                        <p className="font-bold text-[11px]">🗺️ راهنمای بسیار ساده کپی نقشه از گوگل مپ (Google Maps):</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>نرم‌افزار گوگل مپ موبایل یا سایت آن را باز کنید.</li>
                          <li>انگشت خود را روی نقطه دقیق موکبتان نگه دارید تا پین قرمز ظاهر شود.</li>
                          <li>یک کادر کوچک با مختصات (مانند <b className="font-mono">32.4279, 48.2435</b>) پدیدار خواهد شد.</li>
                          <li>آن را کپی کرده و در کادربالا قرار دهید. (این فیلد اختیاری است)</li>
                        </ol>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex justify-between gap-3 border-t border-slate-100 mt-6 pt-6">
                    <Button 
                      type="button" 
                      onClick={handlePrevStep}
                      variant="outline"
                      className="text-slate-500 font-bold px-6 h-11 rounded-xl text-xs flex items-center gap-2 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                      مرحله قبلی
                    </Button>
                    <Button 
                      type="button" 
                      onClick={handleNextStep}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 h-11 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                    >
                      مرحله بعدی
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Services and staff */}
            {currentStep === 4 && (
              <Card className="rounded-2xl border border-slate-150 shadow-sm bg-white overflow-hidden animate-fade-in relative">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600" />
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                  <CardTitle className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-600 animate-pulse" />
                    مرحله چهارم: ثبت خدمات صلواتی و ساختار خادمین موکب
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-6">
                  
                  {/* Dynamic Services Addition */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2">ثبت خدمات موکب الحسین:</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-3 space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-700 block">خدمت صلواتی یا رفاهی ارائه شده را تایپ کنید:</label>
                        <Input 
                          type="text"
                          value={customService}
                          onChange={(e) => setCustomService(e.target.value)}
                          placeholder="مانند: اسکان خواهران، ایستگاه چای صلواتی، پیرایشگری زوار، ماساژ" 
                          className="bg-white text-xs rounded-xl focus:border-emerald-500 h-11 border border-slate-200"
                        />
                      </div>
                      <div className="md:col-span-1 flex items-end">
                        <Button
                          type="button"
                          onClick={() => {
                            handleAddService(customService);
                            setCustomService('');
                          }}
                          className="w-full bg-[#1a1c2c] hover:bg-slate-800 text-white h-11 rounded-xl text-xs font-black gap-1.5 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          افزودن خدمت
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-500 font-extrabold">برچسب خدمات ثبت شده:</span>
                      {selectedServices.length === 0 ? (
                        <div className={`p-3 rounded-xl text-center text-[10px] font-extrabold leading-relaxed transition-all ${
                          attemptedNext && isFieldEmpty('selectedServices') 
                            ? 'bg-rose-50 border-2 border-rose-300 text-rose-800 ring-4 ring-rose-50 animate-bounce' 
                            : 'bg-amber-50 border border-amber-100 text-amber-800'
                        }`}>
                          {attemptedNext && isFieldEmpty('selectedServices') ? (
                            <span>خادم گرامی، ثبت حداقل یک خدمت صلواتی یا رفاهی الزامی است! لطفا یک مورد در کادر بالا تایپ نموده و دکمه اضافه کردن را بفشارید.</span>
                          ) : (
                            <span>⚠️ هیچ خدمتی ثبت نشده است. لطفا بالاتر بنویسید و روی دکمه + اضافه کلیک کنید تا در جدول موکبتان نمایش یابد.</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {selectedServices.map((srv, index) => (
                            <div key={index} className="bg-emerald-50 text-emerald-800 border border-emerald-150 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                              <span>{srv}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveService(srv)}
                                className="text-red-500 hover:text-red-700 font-bold"
                                title="حذف خدمت"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dynanmic Staff Addition */}
                  <div className="space-y-3 border-t border-slate-100 pt-5">
                    <h4 className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2">ثبت مسئولین و خادمین الحسین (ع):</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-700 block">نام کامل مسئول / خادم متولی *</label>
                        <Input 
                          type="text"
                          value={staffName}
                          onChange={(e) => setStaffName(e.target.value)}
                          placeholder="مثال: عباس علیزاده" 
                          className="bg-white text-xs rounded-xl focus:border-emerald-500 h-11 border border-slate-200"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-700 block">تلفن تماس مستقیم مسئول *</label>
                        <Input 
                          type="tel"
                          value={staffPhone}
                          onChange={(e) => setStaffPhone(e.target.value)}
                          dir="ltr"
                          placeholder="مثال: 09129876543" 
                          className="bg-white text-xs rounded-xl focus:border-emerald-500 font-mono h-11 border border-slate-200"
                        />
                      </div>
                      <div className="flex items-center pt-5">
                        <div className="flex items-start gap-2">
                          <input 
                            type="checkbox" 
                            id="staffShowContact" 
                            checked={staffShowContact}
                            onChange={(e) => setStaffShowContact(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                          />
                          <label htmlFor="staffShowContact" className="text-[9px] text-slate-700 font-extrabold cursor-pointer select-none">
                            نمایش عمومی شماره در سایت
                          </label>
                        </div>
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          onClick={handleAddStaff}
                          className="w-full bg-[#007f5f] hover:bg-[#005c44] text-white h-11 rounded-xl text-xs font-black gap-1.5 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          درج در چارت خادمین
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-500 font-extrabold">ساختار و خادمین ثبت شده:</span>
                      {staffList.length === 0 ? (
                        <div className={`p-3 rounded-xl text-center text-[10px] font-extrabold leading-relaxed transition-all ${
                          attemptedNext && isFieldEmpty('staffList') 
                            ? 'bg-rose-50 border-2 border-rose-300 text-rose-800 ring-4 ring-rose-50 animate-bounce' 
                            : 'bg-amber-50 border border-amber-100 text-amber-800'
                        }`}>
                          {attemptedNext && isFieldEmpty('staffList') ? (
                            <span>خادم گرامی، ثبت حداقل یک همکار یا مسئول پشتیبانی علاوه بر مدیر اصلی برای رسمیت موکب الزامی است!</span>
                          ) : (
                            <span>⚠️ مسئولین غیر از مدیر اصلی موکب را با ذکر شماره به همراه + اضافه کنید. صندلی خالی مجاز نیست.</span>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {staffList.map((stf, index) => {
                            const parts = stf.split('|').map(s => s.trim());
                            return (
                              <div key={index} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-sm">
                                <div className="flex-1 min-w-0">
                                  <h5 className="text-xs font-bold text-slate-800 truncate">{parts[0]}</h5>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[10px] text-slate-500 font-mono">{parts[1]}</p>
                                    {parts[2] && (
                                      <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold ${parts[2] === 'نمایش عمومی' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {parts[2]}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStaff(index)}
                                  className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-extrabold shrink-0"
                                >
                                  حذف خادم
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 flex justify-between gap-3 border-t border-slate-100 mt-6 pt-6">
                    <Button 
                      type="button" 
                      onClick={handlePrevStep}
                      variant="outline"
                      className="text-slate-500 font-bold px-6 h-11 rounded-xl text-xs flex items-center gap-2 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                      مرحله قبلی
                    </Button>
                    <Button 
                      type="button" 
                      onClick={handleNextStep}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 h-11 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                    >
                      مرحله بعدی
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 5: Document Upload & submit */}
            {currentStep === 5 && (
              <Card className="rounded-2xl border border-slate-150 shadow-sm bg-white overflow-hidden animate-fade-in relative">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600" />
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                  <CardTitle className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-600" />
                    مرحله پنجم: مدارک، مجوز صادر شده و ثبت نهایی موکب
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/50">
                    خادم گرامی، جهت تایید رسمیت موکب در سامانه جامع موکب‌یاب، بارگذاری تصویر مجوز موکب صادر شده از ستاد بازسازی عتبات عالیات یا ارگان‌های ذیربط الزامی است.
                  </p>
                  
                  {/* Drag and Drop Zone */}
                  <div 
                    className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                      attemptedNext && isFieldEmpty('permitDoc')
                        ? 'border-rose-400 bg-rose-50/20 ring-4 ring-rose-50 animate-bounce'
                        : isDragging 
                        ? 'border-emerald-500 bg-emerald-50/20' 
                        : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    id="drag-license-zone"
                  >
                    <UploadCloud className={`w-10 h-10 mb-3 transition-colors ${
                      attemptedNext && isFieldEmpty('permitDoc') ? 'text-rose-500' : 'text-slate-400'
                    }`} />
                    
                    {permitDoc ? (
                      <div className="space-y-2">
                        <p className="text-xs font-black text-emerald-700">✓ جواز موکب‌ با موفقیت بارگذاری شد!</p>
                        <p className="text-[10px] text-slate-500 font-mono max-w-sm truncate mx-auto">{uploadFileName || 'سند_رسمی_مجوز.pdf'}</p>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPermitDoc(null);
                            setUploadFileName('');
                          }}
                          className="text-[10px] text-red-600 font-extrabold hover:underline"
                        >
                          تغییر و بارگذاری مجدد پرونده
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-slate-700">تصویر یا فایل PDF مجوز موکب را در این جعبه رها کنید</p>
                        <p className="text-[10px] text-slate-400 leading-relaxed font-sans">حداکثر ابعاد فایل ۳ مگابایت (فرمت مجاز: JPG, PNG, PDF)</p>
                        
                        <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
                          <label className="bg-[#1a1c2c] hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-bold cursor-pointer shadow-sm transition-all inline-block">
                            انتخاب دستی فایل از سیستم
                            <input 
                              type="file"
                              accept=".jpg,.jpeg,.png,.pdf" 
                              className="hidden" 
                              onChange={handleFileChange}
                            />
                          </label>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={triggerMockUpload}
                            className="bg-white border-dashed border-emerald-500/80 text-emerald-800 hover:bg-emerald-50 text-[10px] font-bold py-2 px-4 rounded-xl h-auto transition-all"
                          >
                            ✨ استفاده از مجوز موکب‌یار پیش‌فرض
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  {renderFieldError('permitDoc', 'جهت تایید هویت موکب، آپلود کردن سند مجوز الزامی است. در صورتی که فایل دم دست ندارید، روی دکمه "استفاده از مجوز پیش‌فرض" کلیک کنید.')}

                  <div className="pt-4 flex justify-between gap-3 border-t border-slate-100 mt-6 pt-6">
                    <Button 
                      type="button" 
                      onClick={handlePrevStep}
                      variant="outline"
                      className="text-slate-500 font-bold px-6 h-11 rounded-xl text-xs flex items-center gap-2 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                      مرحله قبلی
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 h-11 rounded-xl text-xs gap-1.5 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                      disabled={submitting}
                    >
                      {submitting ? 'در حال ثبت اطلاعات...' : 'ثبت قطعی در سامانه موکب‌یاب'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          </form>
          </div>
        </div>
      </div>
    </div>
  );
}
