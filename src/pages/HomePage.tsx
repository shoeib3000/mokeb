import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy as firestoreOrderBy, onSnapshot } from '../lib/db';
import { db, handleFirestoreError, OperationType, withTimeout } from '../lib/db';
import { getMillis } from '../lib/dateUtils';
import { safeStorage } from '../lib/safeStorage';
import { Mokeb, Category, AppSlider, MokebStory, WalkRoute } from '../types';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent } from '../components/ui/card';
import { 
  MapPin, Phone, User as UserIcon, Tag, Search, Bell, Map as MapIcon, 
  ChevronLeft, Hexagon, ChevronRight, Share2, Heart, Award, Calendar, 
  Compass, ShieldCheck, ChevronDown, AlignJustify, MessageSquare, Info, 
  ShieldAlert, Megaphone, Smartphone, Home, Layers, Play, Star, AlertCircle, LogOut, UserCheck 
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import StoryViewer from '../components/StoryViewer';
import MokebPopupCard from '../components/MokebPopupCard';
import QuickRatingModal from '../components/QuickRatingModal';

// Constant High-Fidelity Bulletins as fallbacks & live feeds
interface OfficialAnnouncement {
  id: string;
  title: string;
  content: string;
  category: 'critical' | 'info' | 'warning' | string;
  time: string;
  authority: string;
  authorityName?: string;
}

const defaultSlides = [
  {
    id: 'default1',
    imageUrl: "https://images.unsplash.com/photo-1590076275572-ac3f381005a4?auto=format&fit=crop&q=80&w=1200",
    title: "آغاز ثبت رسمی مواکب اربعین حسینی ۱۴۰۵",
    subtitle: "خادمین گرامی؛ با کلیک روی دکمه زیر می‌توانید مشخصات، خدمات، ظرفیت اسکان و نیازمندی‌های رفاهی موکب خود را ثبت کنید.",
    link: "/register",
    buttonText: "ثبت‌نام موکب",
    order: 1,
    active: true
  },
  {
    id: 'default2',
    imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=1200",
    title: "نقشه تعاملی و مسیریابی هوشمند عمودها",
    subtitle: "زائرین محترم اربعین حسینی؛ از طریق بخش جستجو می‌توانید بر اساس شماره عمود، استان و نوع خدمات مواکب خدمات مناسب را بیابید.",
    link: "#",
    buttonText: "بررسی خدمات مواکب",
    order: 2,
    active: true
  },
  {
    id: 'default3',
    imageUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=1200",
    title: "پشتیبانی و پاسخگویی آنلاین ۲۴ ساعته ستاد",
    subtitle: "در صورت بروز تداخل یا ابهام در مستندات ثبت مواکب، از بخش تیکت اقدام به برقراری ارتباط مداوم و سریع با پشتیبانان نمایید.",
    link: "/dashboard",
    buttonText: "ارسال بلیت پشتیبانی",
    order: 3,
    active: true
  }
];

const DEFAULT_NEWS_CATEGORIES: any[] = [];

export default function HomePage() {
  const navigate = useNavigate();
  const { user, profile, siteSettings } = useAuth();
  
  // States
  const [mokebs, setMokebs] = useState<Mokeb[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sliders, setSliders] = useState<AppSlider[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [stories, setStories] = useState<{ story: MokebStory; mokebName: string; mokebId: string }[]>([]);
  const [viewingStory, setViewingStory] = useState<{stories: MokebStory[], mokebName: string, index: number} | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Custom Filter states
  const [searchParams, setSearchParams] = useSearchParams();
  const searchCity = searchParams.get('q') || '';
  const setSearchCity = (val: string) => {
    setSearchParams(prev => {
      if (val) {
        prev.set('q', val);
      } else {
        prev.delete('q');
      }
      return prev;
    }, { replace: true });
  };
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<WalkRoute | null>(null);
  const [walkRoutes, setWalkRoutes] = useState<WalkRoute[]>([]);
  
  // Responsive PWA control
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobileTab, setMobileTab] = useState<'home' | 'map' | 'notices' | 'support'>('home');
  const [likedMokebs, setLikedMokebs] = useState<string[]>([]);
  const [noticeCategory, setNoticeCategory] = useState<string>('all');
  const [popupMokeb, setPopupMokeb] = useState<Mokeb | null>(null);
  const [ratingMokeb, setRatingMokeb] = useState<Mokeb | null>(null);
  const [officialNotices, setOfficialNotices] = useState<OfficialAnnouncement[]>([]);
  const [newsCategories, setNewsCategories] = useState<any[]>([]);

  const getNewsCategoryName = (id: string) => {
    if (id === 'general') return 'عمومی';
    const foundCustom = newsCategories.find(c => c.id === id);
    if (foundCustom) return foundCustom.name;
    const foundDefault = DEFAULT_NEWS_CATEGORIES.find(c => c.id === id);
    return foundDefault ? foundDefault.name : id;
  };

  // Real-time synchronization of official notifications
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'official_notices'), (snapshot) => {
      const list: OfficialAnnouncement[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          title: data.title || '',
          content: data.content || '',
          category: data.category || 'general',
          time: data.time || 'هم‌اکنون',
          authority: data.authority || 'setad',
          authorityName: data.authorityName || ''
        });
      });
      // Sort by creation time descending
      list.sort((a, b) => {
        // We can sort using ID or createdAt, or simple reverse
        return b.id.localeCompare(a.id);
      });
      setOfficialNotices(list);
    }, (error) => {
      console.warn("Error reading official notices in real-time:", error);
    });
    return () => unsubscribe();
  }, []);

  // Real-time synchronization of news categories
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'news_categories'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setNewsCategories(list);
    }, (error) => {
      console.warn("Error reading news categories in real-time:", error);
    });
    return () => unsubscribe();
  }, []);

  // Listen to screen resolution for standard/PWA mobile simulation
  useEffect(() => {
    // Check if device is mobile and redirect to PWA
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = '/pwa';
    }
  }, []);

  const filteredOfficialNotices = officialNotices.filter(n => {
    if (noticeCategory === 'all') return true;
    return n.category === noticeCategory;
  });

  // Real-time synchronization of Mokebs and Stories
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'mokebs'), (snapshot) => {
      const fetchedMokebs: Mokeb[] = [];
      const allApprovedStories: { story: MokebStory; mokebName: string; mokebId: string }[] = [];
      const now = Date.now();

      snapshot.forEach(docSnap => {
        const data = { id: docSnap.id, ...(docSnap.data() as any) } as Mokeb;
        fetchedMokebs.push(data);
        
        // Collect approved stories for active or pending mokebs
        if (data.storyRequestStatus === 'approved' && data.stories) {
          data.stories.forEach(s => {
            const exp = getMillis(s.expiresAt);
            if (exp > now) {
              allApprovedStories.push({ story: s, mokebName: data.name, mokebId: data.id });
            }
          });
        }
      });

      // Merge local offline-registered/pending mokebs from safeStorage (client-side registrations)
      try {
        const cachedMokebsJson = safeStorage.getItem('offline_mokebs');
        if (cachedMokebsJson) {
          const cachedMokebs: Mokeb[] = JSON.parse(cachedMokebsJson);
          cachedMokebs.forEach(cm => {
            if (!fetchedMokebs.some(fm => fm.id === cm.id)) {
              fetchedMokebs.push(cm);
              
              // Collect approved stories if any
              if (cm.storyRequestStatus === 'approved' && cm.stories) {
                cm.stories.forEach(s => {
                  const exp = getMillis(s.expiresAt);
                  if (exp > now) {
                    allApprovedStories.push({ story: s, mokebName: cm.name, mokebId: cm.id });
                  }
                });
              }
            }
          });
        }
      } catch (localErr) {
        console.warn("Failed to merge offline local mokebs cache:", localErr);
      }
      
      allApprovedStories.sort((a, b) => getMillis(b.story.createdAt) - getMillis(a.story.createdAt));
      setStories(allApprovedStories);
      
      fetchedMokebs.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      setMokebs(fetchedMokebs);
    }, (error) => {
      console.warn("Firestore Mokebs sync failed, leveraging cached/offline content:", error);
      const cachedMokebsJson = safeStorage.getItem('offline_mokebs');
      if (cachedMokebsJson) {
        try {
          setMokebs(JSON.parse(cachedMokebsJson));
        } catch (e) {}
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch categories
      try {
        const catSnap = await getDocs(collection(db, 'categories'));
        const cats: Category[] = [];
        catSnap.forEach(doc => cats.push({ id: doc.id, ...(doc.data() as any) } as Category));
        if (cats.length > 0) {
          setCategories(cats);
          safeStorage.setItem('offline_categories', JSON.stringify(cats));
        } else {
          // Try loading from safeStorage
          const cachedCats = safeStorage.getItem('offline_categories');
          if (cachedCats) {
            setCategories(JSON.parse(cachedCats));
          } else {
            setCategories([
              { id: 'cat-1', name: 'خدمات اسکان', icon: 'home', order: 1 },
              { id: 'cat-2', name: 'توزیع غذا و چای', icon: 'coffee', order: 2 },
              { id: 'cat-3', name: 'پزشکی و هلال‌احمر', icon: 'heart', order: 3 },
              { id: 'cat-4', name: 'فرهنگی و مذهبی', icon: 'book', order: 4 },
              { id: 'cat-5', name: 'اینترنت و دیجیتال', icon: 'wifi', order: 5 }
            ]);
          }
        }
      } catch (err) {
        console.warn("Firestore Category fetch failed, utilizing local cache or defaults:", err);
        const cachedCats = safeStorage.getItem('offline_categories');
        if (cachedCats) {
          setCategories(JSON.parse(cachedCats));
        } else {
          setCategories([
            { id: 'cat-1', name: 'خدمات اسکان', icon: 'home', order: 1 },
            { id: 'cat-2', name: 'توزیع غذا و چای', icon: 'coffee', order: 2 },
            { id: 'cat-3', name: 'پزشکی و هلال‌احمر', icon: 'heart', order: 3 },
            { id: 'cat-4', name: 'فرهنگی و مذهبی', icon: 'book', order: 4 },
            { id: 'cat-5', name: 'اینترنت و دیجیتال', icon: 'wifi', order: 5 }
          ]);
        }
      }

      // 3. Fetch Sliders
      try {
        const sliderSnap = await getDocs(query(collection(db, 'sliders'), firestoreOrderBy('order')));
        const fetchedSliders: AppSlider[] = [];
        sliderSnap.forEach(doc => {
            const data = { id: doc.id, ...(doc.data() as any) } as AppSlider;
            if (data.active) fetchedSliders.push(data);
        });
        setSliders(fetchedSliders);
      } catch (err) {
        console.warn("Firestore Sliders fetch failed:", err);
      }

      // 4. Fetch WalkRoutes
      try {
        const routesSnap = await withTimeout(getDocs(query(collection(db, 'routes'), firestoreOrderBy('order'))));
        const fetchedRoutes: WalkRoute[] = [];
        routesSnap.forEach(doc => {
            fetchedRoutes.push({ id: doc.id, ...doc.data() } as WalkRoute);
        });
        setWalkRoutes(fetchedRoutes);
      } catch (err) {
        console.warn("Firestore WalkRoutes fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Slider auto-rotate
  useEffect(() => {
    if (sliders.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliders.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [sliders]);

  // Use only database sliders as requested
  const currentSlidersArray = sliders;

  // Retrieve category display name
  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'دسته متداول';

  // Get all stories for a targeted mokeb to open in viewer
  const getMokebStories = (mokebId: string) => {
    return mokebs.find(m => m.id === mokebId)?.stories || [];
  };

// Extract a deterministic عمود number for each mokeb (for schematic mapping & interactive filtering)
  const getMokebAmood = (m: Mokeb) => {
    // Return real amoodNumber if set
    if (m.amoodNumber) return m.amoodNumber;
    
    // Else extract from address
    if (m.address) {
      const match = m.address.match(/(?:عمود)\s*(\d+)/i);
      if (match) return parseInt(match[1]);
    }
    if (m.exactServices) {
      const match = m.exactServices.match(/(?:عمود)\s*(\d+)/i);
      if (match) return parseInt(match[1]);
    }
    // Deterministic hash based on ID as last resort
    let sum = 0;
    for (let i = 0; i < m.id.length; i++) sum += m.id.charCodeAt(i);
    return 50 + (sum % 1380);
  };

  // Consolidate live mokeb announcements
  const liveMokebAnnouncements: { id: string; title: string; content: string; createdAt: number; mokebName: string; mokebId: string }[] = [];
  mokebs.forEach(m => {
    if (m.announcements) {
      m.announcements.forEach(a => {
        if (a.active) {
          liveMokebAnnouncements.push({
            id: a.id,
            title: a.title,
            content: a.content,
            createdAt: getMillis(a.createdAt) || Date.now(),
            mokebName: m.name,
            mokebId: m.id
          });
        }
      });
    }
  });
  liveMokebAnnouncements.sort((a, b) => b.createdAt - a.createdAt);

  // Filters logic
  const filteredMokebs = mokebs.filter(m => {
    const queryStr = searchCity.trim().toLowerCase();
    
    // Comprehensive search across all Mokeb attributes
    const catName = categories.find(c => c.id === m.categoryId)?.name || '';
    const routeName = walkRoutes.find(r => r.id === m.routeId)?.name || '';
    
    const fieldsToSearch = [
      m.name,
      m.managerName,
      m.phone,
      m.emergencyPhone,
      m.nationalId,
      m.fatherName,
      m.description,
      m.detailedDescription,
      m.address,
      m.exactServices,
      m.responsiblePersons,
      m.province,
      m.city,
      m.trackingCode,
      m.amoodNumber ? m.amoodNumber.toString() : '',
      catName,
      routeName,
      ...(m.selectedServices || []),
      ...(m.staffList || [])
    ].map(val => (val || '').toString().toLowerCase());

    const textMatches = queryStr === '' || fieldsToSearch.some(field => field.includes(queryStr));
    
    // Check Category
    const categoryMatches = selectedCategory ? m.categoryId === selectedCategory : true;
    
    // Check Schematic map milestone filter
    let routeMatches = true;
    if (selectedRoute) {
      routeMatches = m.routeId === selectedRoute.id;
    }

    return textMatches && categoryMatches && routeMatches;
  });

  const handleToggleLike = (mokebId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (likedMokebs.includes(mokebId)) {
      setLikedMokebs(likedMokebs.filter(id => id !== mokebId));
    } else {
      setLikedMokebs([...likedMokebs, mokebId]);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-slate-800" dir="rtl">
      
      {/* ---------------------------------------------------- */}
      {/* 1. DESKTOP VIEW CONTAINER (lg and larger screens)     */}
      {/* ---------------------------------------------------- */}
      {!isMobileView ? (
        <div className="hidden lg:block pb-16">
          
          {/* Slider Banner Carousel (اسلایدر با عرض کامل، بدون متن) */}
          {currentSlidersArray.length > 0 && (
            <div className="w-full max-w-[1720px] mx-auto px-4 md:px-8 mb-8 relative z-10">
              <div className="relative bg-[#007f5f] h-[360px] md:h-[420px] rounded-[32px] overflow-hidden shadow-lg border-2 border-slate-100">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.0 }}
                    className="absolute inset-0"
                  >
                    <img 
                      src={currentSlidersArray[currentSlide]?.imageUrl || ''} 
                      alt="Official Showcase Banner" 
                      className="w-full h-full object-cover transition-all"
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Left/Right Control Buttons */}
                <div className="absolute inset-y-0 inset-x-4 flex items-center justify-between pointer-events-none z-25">
                  <button 
                    onClick={() => setCurrentSlide(prev => (prev - 1 + currentSlidersArray.length) % currentSlidersArray.length)}
                    className="w-10 h-10 rounded-full bg-black/40 hover:bg-[#007f5f] text-white flex items-center justify-center backdrop-blur-sm transition-all pointer-events-auto shadow-md"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => setCurrentSlide(prev => (prev + 1) % currentSlidersArray.length)}
                    className="w-10 h-10 rounded-full bg-black/40 hover:bg-[#007f5f] text-white flex items-center justify-center backdrop-blur-sm transition-all pointer-events-auto shadow-md"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                </div>

                {/* Bullet Indicators (دکمه‌های نقطه گذاری پایین اسلایدر) */}
                <div className="absolute bottom-4 inset-x-0 flex justify-center gap-2 z-25">
                  {currentSlidersArray.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`h-2 rounded-full transition-all duration-300 ${idx === currentSlide ? 'bg-[#fcc21b] w-6' : 'bg-white/50 w-2'}`}
                    />
                  ))}
                </div>

                {/* Tiny index bar */}
                <div className="absolute bottom-4 left-4 text-[10px] font-bold text-white font-sans z-25 bg-black/40 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                  {currentSlide + 1} / {currentSlidersArray.length}
                </div>
              </div>
            </div>
          )}

          {/* Categories scroll row (دسته بندی ها با شمارنده پویا) */}
          <div className="w-full max-w-[1720px] mx-auto px-4 md:px-8 mb-8">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#007f5f]/10">
              <span className="text-xs text-slate-400 font-black tracking-wide block mb-3">دسته‌بندی موضوعی خدمات رفاهی:</span>
              <div className="flex flex-wrap gap-2.5">
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className={`px-5 py-2.5 rounded-full text-xs font-black transition-all ${selectedCategory === null ? 'bg-[#007f5f] text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  نمایش همه مواکب ({mokebs.length})
                </button>
                {categories.map((cat) => {
                  const count = mokebs.filter(m => m.categoryId === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-5 py-2.5 rounded-full text-xs font-black transition-all ${selectedCategory === cat.id ? 'bg-[#007f5f] text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                    >
                      {cat.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CTA Banner: ثبت نام رسمی موکب داران */}
          <div className="w-full max-w-[1720px] mx-auto px-4 md:px-8 mb-8">
            <div className="bg-gradient-to-r from-[#007f5f] via-[#006a4e] to-[#00503c] text-white p-6 shadow-md rounded-[24px] border border-[#007f5f]/20 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(#fcc21b_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none"></div>
              
              <div className="flex items-center gap-4 relative z-10 text-right">
                <div className="w-14 h-14 bg-[#fcc21b] rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shrink-0">
                  <UserCheck className="w-8 h-8 text-[#007f5f]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-lg text-white">آیا شما هم خادم یا موکب‌دار زائرین سیدالشهداء هستید؟</h4>
                  <p className="text-xs text-emerald-100 font-bold mt-1">با ثبت رسمی اطلاعات موکب خود، در نقشه سراسری و لیست خدمات مردمی بدرخشید.</p>
                </div>
              </div>

              <div className="flex gap-3 shrink-0 relative z-10 w-full md:w-auto justify-end">
                <Link 
                  to="/register" 
                  className="bg-[#fcc21b] hover:bg-[#e0a000] text-slate-950 font-black text-xs px-6 py-3.5 rounded-xl transition duration-300 shadow-md text-center flex-1 md:flex-none"
                >
                  ثبت نام و ایجاد موکب جدید
                </Link>
                <Link 
                  to="/login" 
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs px-5 py-3.5 rounded-xl transition text-center flex-1 md:flex-none"
                >
                  ورود به پنل خادمین
                </Link>
              </div>
            </div>
          </div>

          {/* Core Multi-Column Bento Page Layout (موکب ها و اطلاعیه ها در چپ و راست) */}
          <div className="w-full max-w-[1720px] mx-auto px-4 md:px-8">
            
            {/* Core Grid */}
            <div className="grid grid-cols-12 gap-8">
              
              {/* Row: Registered/Active Mokebs Feed (8 cols on lg) */}
              <div className="col-span-8 space-y-6">
                
                {/* 🔍 Desktop Search & Route Filter block */}
                <div className="bg-white rounded-[24px] border border-slate-150 p-5 shadow-sm flex gap-4 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute right-4 top-3.5 text-slate-400 w-4 h-4" />
                    <input 
                      type="text"
                      value={searchCity}
                      onChange={(e) => setSearchCity(e.target.value)}
                      placeholder="جستجوی هوشمند موکب، استان، شهر، شماره عمود، نوع خدمت..."
                      className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#007f5f] focus:bg-white rounded-2xl text-xs font-bold shadow-2xs transition"
                    />
                    {searchCity && (
                      <button 
                        onClick={() => setSearchCity('')}
                        className="absolute left-4 top-3.5 text-xs text-red-500 font-extrabold hover:underline"
                      >
                        پاک کردن
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-500 shrink-0">مسیر تردد:</span>
                    <select
                      value={selectedRoute?.id || ''}
                      onChange={(e) => {
                        const route = walkRoutes.find(r => r.id === e.target.value) || null;
                        setSelectedRoute(route);
                      }}
                      className="bg-slate-50 border border-slate-200 text-xs font-black text-slate-750 rounded-2xl py-3 px-4 focus:outline-none focus:border-[#007f5f] focus:bg-white shadow-2xs transition min-w-[200px] cursor-pointer"
                    >
                      <option value="">همه مسیرهای پیاده‌روی</option>
                      {walkRoutes.map(route => (
                        <option key={route.id} value={route.id}>{route.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#007f5f]" />
                    موکب‌های جهادی فعال مسیر عشق
                    {selectedRoute && (
                      <span className="text-xs bg-emerald-50 text-[#007f5f] px-2.5 py-1 rounded-md font-bold">مسیر {selectedRoute.name}</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">تعداد مواکب:</span>
                    <span className="bg-[#007f5f] text-white text-xs font-black px-3 py-1 rounded-full">{filteredMokebs.length}</span>
                    {selectedRoute && (
                      <button 
                        onClick={() => setSelectedRoute(null)}
                        className="text-xs font-bold text-red-600 hover:underline border-r pr-2 border-slate-200"
                      >
                        لغو فیلتر مسیر
                      </button>
                    )}
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-24 bg-white rounded-3xl border border-slate-100">
                    <div className="w-10 h-10 border-4 border-[#007f5f] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-xs text-slate-400 font-bold">در حال بازیابی مواکب تاییدشده...</p>
                  </div>
                ) : filteredMokebs.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
                    <span className="text-5xl block">🕌</span>
                    <h4 className="font-bold text-slate-700 mt-4 text-sm">هیچ موکب فعالی یافت نشد!</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      کاربر گرامی، هیچ موکب فعالی منطبق بر فیلتر یا کلمات جستجو شده شما وجود ندارد. فیلتر خود را لغو کنید یا موقعیت دیگری را جستجو کنید.
                    </p>
                    <button 
                      onClick={() => { setSearchCity(''); setSelectedCategory(null); setSelectedRoute(null); }}
                      className="mt-6 bg-[#007f5f] text-white text-xs font-bold px-6 py-2.5 rounded-xl transition"
                    >
                      پاک کردن همه فیلترها
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-6">
                    {filteredMokebs.map((m) => (
                      <div 
                        key={m.id} 
                        onClick={() => setPopupMokeb(m)}
                        className="bg-white rounded-3xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-100/90 cursor-pointer flex flex-col justify-between group h-[380px]"
                      >
                        <div>
                          {/* Banner background - Green official */}
                          <div className="h-20 bg-gradient-to-l from-[#007f5f] to-[#00503c] relative p-4 flex justify-between items-start">
                            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]"></div>
                            
                            <span className="bg-white/10 text-white border border-white/20 text-[10px] px-2.5 py-1 rounded-full font-bold backdrop-blur-sm relative z-10">
                              عمود {getMokebAmood(m)}
                            </span>

                            <button 
                              onClick={(e) => handleToggleLike(m.id, e)}
                              className={`p-2 rounded-full transition relative z-10 backdrop-blur-sm ${likedMokebs.includes(m.id) ? 'bg-red-500/95 text-white' : 'bg-black/20 hover:bg-black/40 text-slate-300'}`}
                            >
                              <Heart className="w-4 h-4 fill-current" />
                            </button>
                          </div>

                          {/* Detail fields */}
                          <div className="px-5 pt-8 pb-4 relative">
                            {/* Float icon */}
                            <div className="absolute -top-7 right-5 w-12 h-12 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center overflow-hidden">
                              {m.avatarUrl ? (
                                <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                              ) : siteSettings?.siteLogoUrl ? (
                                <img src={siteSettings.siteLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                              ) : (
                                <span className="text-2xl select-none">🕋</span>
                              )}
                            </div>

                            <h4 className="font-extrabold text-slate-800 text-base group-hover:text-[#007f5f] transition-colors line-clamp-1">
                              {m.name}
                            </h4>
                            
                            <div className="flex flex-wrap gap-1.5 items-center mt-2.5">
                              <span className="bg-emerald-50 text-[#007f5f] text-[10px] font-black px-2.5 py-0.5 rounded shrink-0">
                                {getCategoryName(m.categoryId)}
                              </span>
                              {m.trackingCode && (
                                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-0.5 rounded font-mono shrink-0">
                                  کد {m.trackingCode}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRatingMokeb(m);
                                }}
                                className="text-[9px] font-black px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg border border-amber-200 hover:bg-amber-200 active:scale-95 transition-all flex items-center gap-1 shrink-0"
                                title="ثبت امتیاز به موکب"
                              >
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                امتیاز دهید
                              </button>
                              {(() => {
                                const routeOfMokeb = walkRoutes.find(r => r.id === m.routeId);
                                return routeOfMokeb ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRoute(routeOfMokeb);
                                    }}
                                    className="text-[9px] font-black px-2 py-0.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200/60 hover:bg-amber-100 active:scale-95 transition-all flex items-center gap-1 shrink-0"
                                    title="فیلتر بر اساس این مسیر تردد"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: routeOfMokeb.color || '#007f5f' }} />
                                    {routeOfMokeb.name}
                                  </button>
                                ) : null;
                              })()}
                            </div>

                            <p className="text-slate-500 text-xs mt-3.5 leading-relaxed line-clamp-2 min-h-[32px]">
                              {m.description || 'آماده اکرام و خدمت‌رسانی شبانه‌روزی به خیل مشتاقان اباعبدالله الحسین ع.'}
                            </p>
                          </div>
                        </div>

                        <div className="px-5 pb-5">
                          {/* Info tags list */}
                          <div className="space-y-2 text-xs font-semibold text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-150 mb-4">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-[#007f5f]" />
                              <span className="truncate">{m.city || 'مسیر عتبات'}، {m.address || 'فاقد آدرس مشخص'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <UserIcon className="w-3.5 h-3.5 text-[#007f5f]" />
                              <span>خادم ارشد: {m.showContactInfoPublicly ? m.managerName : 'محفوظ'}</span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                            <div className="flex gap-2 items-center">
                              {m.status === 'active' ? (
                                <span className="text-[10px] text-emerald-700 font-black flex items-center gap-1 bg-emerald-50 border border-emerald-200/50 px-2.5 py-0.5 rounded-full">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> تایید شده و فعال
                                </span>
                              ) : m.status?.startsWith('pending') ? (
                                <span className="text-[10px] text-amber-700 font-black flex items-center gap-1 bg-amber-50 border border-amber-200/50 px-2.5 py-0.5 rounded-full">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> در انتظار تایید مدارک
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-650 font-black flex items-center gap-1 bg-slate-50 border border-slate-200/50 px-2.5 py-0.5 rounded-full">
                                  <Info className="w-3.5 h-3.5 text-slate-400" /> ثبت اولیه موکب
                                </span>
                              )}

                              {m.lat && m.lng && (
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] text-[#007f5f] font-black flex items-center gap-1 bg-emerald-50 border border-emerald-200/50 px-2.5 py-0.5 rounded-full hover:bg-emerald-100 transition-colors"
                                  title="مسیریابی در گوگل مپ"
                                >
                                  <Compass className="w-3.5 h-3.5" /> مسیریابی
                                </a>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-xs text-[#007f5f] font-black group-hover:translate-x-[-4px] transition-transform">
                              📂 مشاهده شناسنامه و خدمات
                              <ChevronLeft className="w-4 h-4 text-[#fcc21b]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* Row Left: Interactive Map & Double Notification Desk (4 cols on lg) */}
              <div className="col-span-4 space-y-8">
                
                {/* 1. Interactive Schematic Route Map Card */}
                <Card className="rounded-[32px] border-slate-100 shadow-md overflow-hidden bg-white">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-l from-slate-50 to-white">
                    <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                      <MapIcon className="w-4.5 h-4.5 text-[#007f5f]" />
                      شماتیک نقشه مرزی تا عتبات مذهبی
                    </h4>
                    <span className="text-[9px] bg-red-100 text-red-600 font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                      پویای زنده
                    </span>
                  </div>

                    <div className="p-5">
                    <p className="text-[11px] text-slate-500 font-bold mb-4 leading-relaxed">
                      جهت فیلتر مواکب مستقر در هر مسیر پیاده‌روی، روی نقشه شماتیک انتخاب کنید:
                    </p>

                    {/* Highly stylized road container */}
                    <div className="relative border border-slate-100 rounded-2xl p-4 bg-slate-50/50 flex flex-col gap-3">
                      {walkRoutes.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-4">مسیری تعریف نشده است.</p>
                      ) : (
                        walkRoutes.map((rt) => {
                          const isSelected = selectedRoute?.id === rt.id;
                          const countNear = mokebs.filter(m => m.routeId === rt.id).length;

                          return (
                            <button
                              key={rt.id}
                              onClick={() => setSelectedRoute(isSelected ? null : rt)}
                              className={`flex justify-between items-center p-3 rounded-xl border text-right transition-all group ${isSelected ? 'shadow-sm scale-[1.02]' : 'bg-white hover:border-slate-300'}`}
                              style={{ 
                                borderColor: isSelected ? rt.color : '#f1f5f9',
                                backgroundColor: isSelected ? `${rt.color}15` : '#ffffff' 
                              }}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow" style={{ backgroundColor: rt.color || '#007f5f' }}>
                                  <MapPin className="w-4 h-4" />
                                </div>
                                
                                <div>
                                  <h5 className="font-black text-xs text-slate-800 line-clamp-1 group-hover:text-[#007f5f] transition-colors">{rt.name}</h5>
                                  {rt.description && <span className="text-[10px] text-slate-400 font-medium">{rt.description}</span>}
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${countNear > 0 ? 'bg-[#007f5f]/10 text-[#007f5f]' : 'bg-slate-100 text-slate-400'}`}>
                                  {countNear} موکب فعال
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {selectedRoute && (
                      <button 
                        onClick={() => setSelectedRoute(null)}
                        className="w-full mt-4 text-[11px] font-black bg-rose-50 text-rose-700 hover:bg-rose-100 py-2.5 rounded-xl transition text-center"
                      >
                        ❌ لغو فیلتر و بازگشت به لیست کامل مواکب
                      </button>
                    )}
                  </div>
                </Card>

                {/* 2. Official Central Bulletins & Announcements Desks (Tabs for Faraja & Setad) */}
                <Card className="rounded-[32px] border-slate-100 shadow-md overflow-hidden bg-white">
                  <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-slate-50 to-white flex items-center justify-between">
                    <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                      <Bell className="w-4.5 h-4.5 text-[#007f5f]" />
                      تابلو اعلانات و ابلاغیه‌های رسمی راهنمای زائر
                    </h4>
                  </div>

                  {/* Toggle Category */}
                  <div className="flex gap-1.5 overflow-x-auto p-2.5 bg-slate-50 border-b border-slate-100 scrollbar-none">
                    {['all', ...newsCategories.map(c => c.id)].map(catId => {
                      const isSelected = noticeCategory === catId;
                      const displayName = catId === 'all' ? 'همه ابلاغیه‌ها' : getNewsCategoryName(catId);
                      return (
                        <button
                          key={catId}
                          onClick={() => setNoticeCategory(catId)}
                          className={`px-3.5 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 border ${
                            isSelected 
                              ? 'bg-[#007f5f] text-white border-[#007f5f] shadow-sm' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {displayName}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-4 max-h-[500px] overflow-y-auto space-y-4">
                    
                    {filteredOfficialNotices.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-[11px] bg-slate-50 rounded-2xl flex flex-col items-center justify-center gap-2 border border-dashed border-slate-200">
                        <Bell className="w-6 h-6 text-slate-300" />
                        <span>🔔 در حال حاضر هیچ ابلاغیه رسمی فعالی در این دسته‌بندی وجود ندارد.</span>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {filteredOfficialNotices.map((n) => {
                          const isCritical = n.category === 'critical' || n.category === 'warning';
                          const bgClass = isCritical ? 'bg-red-50/40 border-red-100/60 hover:bg-red-50/80' : 'bg-emerald-50/20 border-emerald-100/60 hover:bg-emerald-50/40';
                          const textClass = isCritical ? 'text-red-950 font-black' : 'text-slate-800 font-extrabold';
                          const titleColorClass = isCritical ? 'text-red-900' : 'text-[#007f5f]';
                          const tagBg = isCritical ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800';

                          return (
                            <div key={n.id} className={`p-4 rounded-2xl border transition relative ${bgClass}`}>
                              <span className="absolute top-3 left-4 text-[9px] font-bold text-slate-500 bg-white/90 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-slate-100">{n.time}</span>
                              <div className="flex items-center gap-1.5 mb-2 ml-14">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${tagBg}`}>
                                  {n.authorityName || (n.authority === 'faraja' ? 'پلیس فراجا' : (n.authority === 'setad' ? 'ستاد اربعین' : 'سازمان هلال احمر'))}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold">
                                  دسته‌بندی: {getNewsCategoryName(n.category)}
                                </span>
                              </div>
                              <h5 className={`font-black text-xs mb-1.5 ${titleColorClass}`}>{n.title}</h5>
                              <p className="text-[11px] text-slate-650 leading-relaxed text-justify font-medium">{n.content}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Consolidated Live Mokeb Announcements Section always appended underneath "All" or as distinct view */}
                    {noticeCategory === 'all' && liveMokebAnnouncements.length > 0 && (
                      <div className="space-y-3 mt-4 pt-4 border-t border-slate-100">
                        <div className="text-[10px] font-black text-slate-400 flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-emerald-600" />
                          ندای خدمت (اطلاعیه‌های در لحظه خادمین مواکب)
                        </div>
                        {liveMokebAnnouncements.slice(0, 5).map((n) => (
                          <div 
                            key={n.id} 
                            onClick={() => {
                              const m = mokebs.find(mk => mk.id === n.mokebId);
                              if (m) setPopupMokeb(m);
                            }}
                            className="p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100/40 hover:bg-emerald-50/60 transition relative cursor-pointer group"
                          >
                            <span className="absolute top-3 left-4 text-[9px] font-bold text-emerald-600 bg-emerald-55 px-2 py-0.5 rounded-full">معتبر</span>
                            <h5 className="font-extrabold text-emerald-950 text-xs mb-1 group-hover:text-amber-800 transition-colors ml-14">{n.mokebName}</h5>
                            <h6 className="font-extrabold text-[11px] text-slate-800 mb-1">{n.title}</h6>
                            <p className="text-[11px] text-slate-500 leading-relaxed text-justify line-clamp-2">{n.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                </Card>

              </div>

            </div>

          </div>

        </div>
      ) : (
        /* ---------------------------------------------------- */
        /* 2. PWA MOBILE VIEW SHIELD FRAME & SHELL ENGINE        */
        /* ---------------------------------------------------- */
        <div className="block lg:hidden min-h-screen bg-[#faf9f6] flex flex-col justify-between pb-24">
          
          {/* PWA High-Impact App Header */}
          <header className="sticky top-0 z-40 bg-white text-[#007f5f] px-4 py-3 shadow-md flex items-center justify-between border-b-2 border-[#007f5f]/15">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center text-white shadow-lg">
                <MapPin className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#fcc21b] bg-black px-1.5 py-0.5 rounded block tracking-wide font-mono w-fit">PWA PORTAL</span>
                <span className="text-xs font-black text-black">کمیته مواکب قائد <span className="text-red-600">شهید</span> امت</span>
              </div>
            </div>

            {/* Quick Profile/Dashboard direct access */}
            <div className="flex items-center gap-2">
              {profile?.isAdmin ? (
                <span className="bg-amber-500 text-black text-[9px] font-black px-2 py-1 rounded-md">مدیر</span>
              ) : null}
              {user ? (
                <Link to="/dashboard" className="w-8.5 h-8.5 rounded-full bg-slate-150 hover:bg-slate-200 flex items-center justify-center transition border border-slate-200">
                  <UserIcon className="w-4 h-4 text-[#007f5f]" />
                </Link>
              ) : (
                <Link to="/login" className="bg-[#fcc21b] hover:bg-[#e0a000] text-slate-950 text-[10px] font-black px-4 py-1.5 rounded-xl transition shadow">
                  ورود
                </Link>
              )}
            </div>
          </header>

          {/* ACTIVE CONTENT VIEW REGISTRY DEPENDING ON SECURED BOTTOM TABS */}
          <main className="flex-1 p-4">
            
            {/* ----------------- MOBILE TAB: HOME ----------------- */}
            {mobileTab === 'home' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                
                {/* Search Box + Route filter PWA optimized */}
                <div className="flex gap-2">
                  <div className="flex-1 bg-white p-3 border-2 border-[#007f5f]/35 flex items-center gap-1.5 rounded-2xl shadow-sm">
                    <Search className="text-[#007f5f] w-4 h-4 shrink-0" />
                    <Input 
                      type="text"
                      value={searchCity}
                      onChange={(e) => setSearchCity(e.target.value)}
                      placeholder="جستجو موکب، استان، شهر یا عمود..."
                      className="w-full bg-transparent border-none p-0 focus-visible:ring-0 text-xs font-semibold placeholder-slate-400"
                    />
                    {searchCity && (
                       <button onClick={() => setSearchCity('')} className="text-xs text-red-500 font-bold px-1 shrink-0">حذف</button>
                    )}
                  </div>
                  <select
                    value={selectedRoute?.id || ''}
                    onChange={(e) => {
                      const route = walkRoutes.find(r => r.id === e.target.value) || null;
                      setSelectedRoute(route);
                    }}
                    className="bg-white border-2 border-[#007f5f]/35 text-[10px] font-bold text-slate-750 rounded-2xl px-2 focus:outline-none focus:border-[#007f5f] shadow-sm transition max-w-[120px]"
                  >
                    <option value="">همه مسیرها</option>
                    {walkRoutes.map(route => (
                      <option key={route.id} value={route.id}>{route.name}</option>
                    ))}
                  </select>
                </div>

                {/* Slider (PWA swipe lookalike) - customized green */}
                {currentSlidersArray.length > 0 && (
                  <div className="relative rounded-2xl overflow-hidden aspect-[16/9] shadow-md bg-[#00503c] border-2 border-white">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0"
                      >
                        <img src={currentSlidersArray[currentSlide]?.imageUrl || ''} alt="banner" className="w-full h-full object-cover opacity-50" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent"></div>
                        
                        <div className="absolute bottom-3 inset-x-3 text-right flex flex-col items-start justify-end h-full">
                          <span className="bg-[#fcc21b] text-slate-950 text-[9px] font-black px-2.5 py-0.5 rounded-full mb-1.5 inline-block select-none shadow">
                            {currentSlidersArray[currentSlide]?.buttonText || "اطلاعیه ویژه"}
                          </span>
                          
                          <h4 className="text-white font-extrabold text-xs drop-shadow-sm leading-snug line-clamp-1">{currentSlidersArray[currentSlide]?.title}</h4>
                          {currentSlidersArray[currentSlide]?.subtitle && (
                            <p className="text-emerald-50 text-[9px] line-clamp-2 mt-0.5 leading-normal font-sans text-right">
                              {currentSlidersArray[currentSlide]?.subtitle}
                            </p>
                          )}
                          
                          {currentSlidersArray[currentSlide]?.link && (
                            <div className="mt-1.5">
                              {currentSlidersArray[currentSlide]?.link.startsWith('http') ? (
                                <a 
                                  href={currentSlidersArray[currentSlide]?.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[9px] font-black text-[#fcc21b] hover:underline"
                                >
                                  <span>{currentSlidersArray[currentSlide]?.buttonText || "ورود به لینک ارتباطی"}</span>
                                  <span className="font-sans">←</span>
                                </a>
                              ) : (
                                <Link 
                                  to={currentSlidersArray[currentSlide]?.link}
                                  className="inline-flex items-center gap-1 text-[9px] font-black text-[#fcc21b] hover:underline"
                                >
                                  <span>{currentSlidersArray[currentSlide]?.buttonText || "مشاهده جزئیات بیشتر"}</span>
                                  <span className="font-sans">←</span>
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>

                    <div className="absolute top-3 left-3 bg-black/40 text-[9px] font-bold text-slate-200 px-2 py-0.5 rounded-full backdrop-blur-md z-15">
                      {currentSlide + 1} / {currentSlidersArray.length}
                    </div>

                    {/* Mobile Dots navigation overlay */}
                    <div className="absolute top-[14px] right-3 flex gap-1 z-15">
                      {currentSlidersArray.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentSlide(idx);
                          }}
                          className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'bg-[#fcc21b] w-4' : 'bg-white/30 w-1.5'}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA registration banner for PWA mobile */}
                <div className="bg-gradient-to-l from-[#007f5f] to-[#00503c] p-4 rounded-2xl text-white shadow relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1/4 bg-[radial-gradient(#fcc21b_1px,transparent_1px)] [background-size:12px_12px] opacity-10 pointer-events-none"></div>
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-11 h-11 bg-[#fcc21b] rounded-xl flex items-center justify-center text-slate-950 shadow-md shrink-0">
                      <UserCheck className="w-6 h-6 text-[#007f5f]" />
                    </div>
                    <div>
                      <h5 className="font-extrabold text-xs text-white">ثبت رسمی موکب صلواتی</h5>
                      <p className="text-[10px] text-emerald-100 font-bold mt-0.5">ثبت‌نام خادمین و نمایش موقعیت در نقشه</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3.5 relative z-10">
                    <Link 
                      to="/register" 
                      className="bg-[#fcc21b] text-slate-950 font-black text-[10px] py-2 px-3 rounded-lg text-center shadow"
                    >
                      ثبت نام خادم جدید
                    </Link>
                    <Link 
                      to="/login" 
                      className="bg-white/10 border border-white/25 text-white font-bold text-[10px] py-2 px-3 rounded-lg text-center"
                    >
                      ورود به پنل خادمین
                    </Link>
                  </div>
                </div>

                {/* Categories filter layout for PWA chips */}
                <div className="space-y-2">
                  <span className="text-[11px] font-black text-slate-400 block px-0.5">دسته‌بندی موضوعی خدمات ({categories.length})</span>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    <button 
                      onClick={() => setSelectedCategory(null)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all ${selectedCategory === null ? 'bg-[#007f5f] text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}
                    >
                      نمایش همه ({mokebs.length})
                    </button>
                    {categories.map((cat) => {
                      const count = mokebs.filter(m => m.categoryId === cat.id).length;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all ${selectedCategory === cat.id ? 'bg-[#007f5f] text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}
                        >
                          {cat.name} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Horizontal slider for Mokebs with small appropriately-sized cards */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[12px] font-black text-slate-800">موکب‌های فعال مسیرهای تردد ({filteredMokebs.length})</span>
                    {selectedCategory && (
                      <button onClick={() => setSelectedCategory(null)} className="text-[10px] font-bold text-[#007f5f]">نمایش همه</button>
                    )}
                  </div>

                  {filteredMokebs.length === 0 ? (
                    <div className="bg-white p-8 text-center rounded-2xl border border-slate-100 shadow-sm">
                      <span className="text-2xl block">🕌</span>
                      <p className="text-[11px] text-slate-500 font-bold mt-1">موکبی با این دسته بندی یافت نشد.</p>
                    </div>
                  ) : (
                    <div className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-none snap-x snap-mandatory font-sans">
                      {filteredMokebs.map((m) => (
                        <div 
                          key={m.id} 
                          onClick={() => setPopupMokeb(m)}
                          className="bg-white p-3.5 rounded-2xl border border-slate-100/95 shadow-sm active:scale-[0.98] transition-all shrink-0 w-[240px] snap-start flex flex-col justify-between h-[160px] relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 left-0 h-1 bg-[#007f5f]" />
                          
                          <div>
                            <div className="flex justify-between items-start gap-1 pb-1">
                              <h5 className="font-extrabold text-slate-800 text-[11px] line-clamp-1">{m.name}</h5>
                              <span className="bg-[#007f5f]/10 text-[#007f5f] text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 font-mono">
                                ایستگاه {getMokebAmood(m)}
                              </span>
                            </div>

                             <div className="flex gap-1 items-center mt-1 mb-1.5 flex-wrap">
                              <span className="inline-block text-[8px] bg-slate-50 text-[#007f5f] border border-[#007f5f]/10 px-2 py-0.5 rounded font-black shrink-0">
                                {getCategoryName(m.categoryId)}
                              </span>
                              {m.status === 'active' ? (
                                <span className="inline-block text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-150 px-2 py-0.5 rounded font-black shrink-0">
                                  فعال
                                </span>
                              ) : m.status?.startsWith('pending') ? (
                                <span className="inline-block text-[8px] bg-amber-50 text-amber-700 border border-amber-150 px-2 py-0.5 rounded font-black animate-pulse shrink-0">
                                  در انتظار تایید
                                </span>
                              ) : (
                                <span className="inline-block text-[8px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-black shrink-0">
                                  ثبت اولیه
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRatingMokeb(m);
                                }}
                                className="text-[8px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200 hover:bg-amber-200 active:scale-95 transition-all flex items-center gap-0.5 shrink-0"
                                title="ثبت امتیاز"
                              >
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                امتیاز
                              </button>
                              {(() => {
                                const routeOfMokeb = walkRoutes.find(r => r.id === m.routeId);
                                return routeOfMokeb ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRoute(routeOfMokeb);
                                    }}
                                    className="text-[8px] font-black px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all flex items-center gap-0.5 shrink-0"
                                    title="فیلتر بر اساس این مسیر"
                                  >
                                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: routeOfMokeb.color || '#007f5f' }} />
                                    {routeOfMokeb.name}
                                  </button>
                                ) : null;
                              })()}
                            </div>
                            
                            <p className="text-[10px] text-slate-500 leading-normal line-clamp-2 text-justify font-sans">
                              {m.description || 'آماده استقبال معنوی صلواتی با نهایت کرامت مذهبی و انسانی.'}
                            </p>
                          </div>

                          <div className="flex justify-between items-center text-[9px] border-t border-slate-50 pt-2 shrink-0">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="text-slate-400 font-bold flex items-center gap-1 truncate max-w-[80px]">
                                <MapPin className="w-3 h-3 text-[#007f5f]" /> {m.city || 'مسیرها'}
                              </span>
                              {m.lat && m.lng && (
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[#007f5f] font-black flex items-center gap-1 bg-emerald-50 border border-emerald-200/50 px-1.5 py-0.5 rounded-full shrink-0"
                                >
                                  <Compass className="w-2.5 h-2.5" /> مسیر
                                </a>
                              )}
                            </div>
                            <span className="text-slate-950 font-black bg-[#fcc21b] px-2.5 py-0.5 rounded-lg text-[8px] hover:bg-[#e0a000] shadow-sm transition-all duration-300">
                              شناسنامه ←
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notification/Alert structure for Announcements (اطلاعیه ها به صورت اعلانی) */}
                <div className="space-y-3 pt-2">
                  <span className="text-[12px] font-black text-slate-800 flex items-center gap-1.5 px-1">
                    <Bell className="w-4 h-4 text-[#007f5f] animate-pulse" />
                    تابلو اعلانی زنده (اطلاعیه‌های در لحظه ستاد و فراجا)
                  </span>

                  <div className="space-y-3">
                     {/* Real Dynamic officialNotices cards */}
                     {officialNotices.slice(0, 3).map((n) => {
                       const isCritical = n.category === 'critical' || n.category === 'warning';
                       const bgClass = isCritical ? 'bg-red-50/85 border-red-500' : 'bg-emerald-50/80 border-[#007f5f]';
                       const tagClass = isCritical ? 'text-red-700 bg-red-100' : 'text-emerald-800 bg-emerald-100';
                       const emoji = isCritical ? '🚨' : '🔔';

                       return (
                         <div key={n.id} className={`p-3.5 border-r-4 rounded-xl shadow-sm flex items-start gap-2.5 ${bgClass}`}>
                           <span className="text-lg mt-0.5 shrink-0">{emoji}</span>
                           <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-center mb-1">
                               <span className={`text-[9px] font-black px-2 py-0.5 rounded ${tagClass}`}>
                                 {n.authorityName || (n.authority === 'faraja' ? 'پلیس فراجا' : (n.authority === 'setad' ? 'ستاد اربعین' : 'سازمان هلال احمر'))}
                               </span>
                               <span className="text-[8px] text-slate-400 font-medium">{n.time}</span>
                             </div>
                             <h6 className="font-extrabold text-[#007f5f] text-xs mb-1">{n.title}</h6>
                             <p className="text-[10px] text-slate-600 leading-normal text-justify leading-5">{n.content}</p>
                           </div>
                         </div>
                       );
                     })}
                     {officialNotices.length === 0 && (
                       <div className="p-4 text-center text-slate-400 text-[10px] bg-slate-50 rounded-xl">
                         🔔 هیچ ابلاغیه فعالی ثبت نشده است.
                       </div>
                     )}
                    
                    {/* Live Mokeb Notification alerts */}
                    {liveMokebAnnouncements.slice(0, 2).map((n) => (
                      <div 
                        key={n.id}
                        onClick={() => {
                          const m = mokebs.find(mk => mk.id === n.mokebId);
                          if (m) setPopupMokeb(m);
                        }}
                        className="p-3.5 bg-emerald-50/80 border-r-4 border-[#007f5f] rounded-xl shadow-sm flex items-start gap-2.5 cursor-pointer active:scale-95 transition-all"
                      >
                        <span className="text-lg mt-0.5 shrink-0">🕌</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">{n.mokebName}</span>
                            <span className="text-[8px] text-slate-400 font-medium">معتبر</span>
                          </div>
                          <h6 className="font-extrabold text-[#007f5f] text-xs mb-1">{n.title}</h6>
                          <p className="text-[10px] text-slate-600 leading-normal text-justify line-clamp-2 leading-5">{n.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </motion.div>
            )}

            {/* ----------------- MOBILE TAB: MAP ----------------- */}
            {mobileTab === 'map' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-2 mb-2">
                    <MapIcon className="w-4 h-4 text-[#007f5f]" /> راهنمای زنده نقشه و مسیرها
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-normal mb-4">
                    جهت بررسی سریع وضعیت مواکب در هر مسیر، مسیر مورد نظر را انتخاب کنید:
                  </p>

                  <div className="space-y-2.5">
                    {walkRoutes.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-4">مسیری تعریف نشده است.</p>
                    ) : (
                      walkRoutes.map((rt) => {
                        const isSelected = selectedRoute?.id === rt.id;
                        const countNear = mokebs.filter(m => m.routeId === rt.id).length;

                        return (
                          <button
                            key={rt.id}
                            onClick={() => {
                              setSelectedRoute(isSelected ? null : rt);
                              setMobileTab('home'); // Instantly go back to home feed with filter active
                            }}
                            className="w-full flex justify-between items-center p-3 rounded-xl border text-right transition-all bg-white relative"
                            style={{ 
                              borderColor: isSelected ? rt.color : '#f1f5f9',
                              backgroundColor: isSelected ? `${rt.color}10` : '#ffffff' 
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg text-white flex items-center justify-center text-[10px] font-black shrink-0" style={{ backgroundColor: rt.color || '#007f5f' }}>
                                <MapPin className="w-3 h-3" />
                              </div>
                              <div>
                                <h5 className="font-extrabold text-[11px] text-slate-800">{rt.name}</h5>
                                {rt.description && <p className="text-[9px] text-slate-400 leading-normal line-clamp-1">{rt.description}</p>}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-0.5 shrink-0 ml-1">
                              <span className="text-[9px] font-black bg-[#007f5f]/15 text-[#007f5f] px-2 py-0.5 rounded-full">
                                {countNear} موکب
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="bg-[#007f5f] text-[#fcc21b] p-5 rounded-2xl relative overflow-hidden shadow-md">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
                  <span className="text-2xl">🕊️</span>
                  <h4 className="font-bold text-xs text-white mt-2">نذر صلواتی زائرین</h4>
                  <p className="text-[10px] text-emerald-50 leading-normal mt-1 leading-6">
                    ما تمام مواکب رسمی کشور را با همکاری ستاد بازسازی عتبات عالیات ثبت و استعلام نموده‌ایم تا سفری ایمن و سرشار از آرامش معنوی را تجربه نمایید.
                  </p>
                </div>
              </motion.div>
            )}

          </main>

          {/* Persistent PWA Mobile Bottom Navigation bar (به خواست کاربر: ثبت نام ورود، بازگشت به نخست، نقشه) */}
          <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-lg border-t-2 border-[#007f5f]/25 px-2 py-2 flex items-center justify-around z-50 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
            {/* بازگشت به نخست (خانه) */}
            <button 
              onClick={() => {
                setMobileTab('home');
                setSearchCity('');
                setSelectedCategory(null);
                setSelectedRoute(null);
              }}
              className={`flex flex-col items-center gap-1.5 py-1 px-4 transition-all ${mobileTab === 'home' && !selectedRoute ? 'text-[#007f5f] scale-105 font-black' : 'text-slate-400 font-bold'}`}
            >
              <Home className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-black">بازگشت به نخست</span>
            </button>

            {/* نقشه */}
            <button 
              onClick={() => setMobileTab('map')}
              className={`flex flex-col items-center gap-1.5 py-1 px-4 transition-all ${mobileTab === 'map' ? 'text-[#007f5f] scale-105 font-black' : 'text-slate-400 font-bold'}`}
            >
              <MapIcon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-black">نقشه</span>
            </button>

            {/* ثبت نام ورود */}
            {user ? (
              <Link
                to="/dashboard"
                className="flex flex-col items-center gap-1.5 py-1 px-4 text-slate-400 hover:text-[#007f5f] transition-all"
              >
                <UserIcon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-black">پنل من</span>
              </Link>
            ) : (
              <Link 
                to="/login"
                className="flex flex-col items-center gap-1.5 py-1 px-4 text-slate-400 hover:text-[#007f5f] transition-all"
              >
                <Smartphone className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-black">ثبت‌نام / ورود</span>
              </Link>
            )}
          </nav>

        </div>
      )}

      {/* Story Viewer Overlay (Active fullscreen slider) */}
      {viewingStory && (
        <StoryViewer 
          stories={viewingStory.stories} 
          mokebName={viewingStory.mokebName}
          initialIndex={viewingStory.index}
          onClose={() => setViewingStory(null)} 
        />
      )}

      {/* Desktop & PWA Interactive Popup */}
      {popupMokeb && (
        <MokebPopupCard 
          mokeb={popupMokeb} 
          onClose={() => setPopupMokeb(null)} 
          getMokebAmood={getMokebAmood} 
          getCategoryName={getCategoryName} 
        />
      )}

      {/* Quick Rating Modal */}
      {ratingMokeb && (
        <QuickRatingModal 
          mokeb={ratingMokeb}
          onClose={() => setRatingMokeb(null)}
        />
      )}

    </div>
  );
}
