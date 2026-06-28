import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from '../lib/db';
import { db, withTimeout } from '../lib/db';
import { safeStorage } from '../lib/safeStorage';
import { getMillis } from '../lib/dateUtils';
import { Mokeb, Category, AppSlider, MokebStory, WalkRoute } from '../types';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  MapPin, Phone, User as UserIcon, Tag, Search, Bell, Map as MapIcon, 
  ChevronLeft, ChevronRight, Award, Compass, ShieldCheck, Plus,
  ShieldAlert, Megaphone, Smartphone, Home, Play, Star, AlertCircle, LogOut, UserCheck, 
  Settings, Info, Calendar, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import StoryViewer from '../components/StoryViewer';
import StoryManagerModal from '../components/StoryManagerModal';
import AnnouncementManagerModal from '../components/AnnouncementManagerModal';
import MokebPopupCard from '../components/MokebPopupCard';
import QuickRatingModal from '../components/QuickRatingModal';
import { incrementVisit, trackSiteVisit } from '../lib/analytics';

const demoStories = [
  {
    mokebId: 'demo-1',
    mokebName: 'موکب علی بن موسی الرضا',
    story: {
      id: 'story-demo-1',
      mediaUrl: 'https://images.unsplash.com/photo-1542856391-010fb87dcfed?auto=format&fit=crop&q=80&w=400',
      caption: 'توزیع چای حضرتی و شربت خنک بین زائران',
      createdAt: new Date().toISOString()
    }
  },
  {
    mokebId: 'demo-2',
    mokebName: 'موکب هلال احمر',
    story: {
      id: 'story-demo-2',
      mediaUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=400',
      caption: 'پزشکان داوطلب در حال ارائه خدمات درمانی صلواتی زوار گرامی',
      createdAt: new Date().toISOString()
    }
  },
  {
    mokebId: 'demo-3',
    mokebName: 'خادمان کوی محبت',
    story: {
      id: 'story-demo-3',
      mediaUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=400',
      caption: 'شستشوی البسه و خدمات خیاطی صلواتی زائران',
      createdAt: new Date().toISOString()
    }
  }
];

const defaultSlides = [
  { id: 's1', title: 'راهنمای زائران اربعین حسینی', imageUrl: 'https://images.unsplash.com/photo-1590076175572-e40cf761aef4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8fHx8fHx1c2VyfHx8fHx8MTY5MDExNTAyMA&ixlib=rb-4.0.3&q=80&w=1280' },
  { id: 's2', title: 'خادمین صلواتی و خدمات جهادی', imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0Njc1ODd8MHwxfHNlYXJjaHw0fHxzaHJpbmV8ZW58MHx8fHwxNjk0NTUzMzUxfDA&ixlib=rb-4.0.3&q=80&w=1280' },
  { id: 's3', title: 'نقشه راه عشق و عمودها', imageUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0Njc1ODd8MHwxfHNlYXJjaHwyfHxpc2xhbWljfGVufDB8fHx8MTY5NDU1MzI5M3ww&ixlib=rb-4.0.3&q=80&w=1280' }
];

const DEFAULT_NEWS_CATEGORIES: any[] = [];

export default function PwaPage() {
  const navigate = useNavigate();
  const { user, profile, siteSettings } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Real Firestore Data
  const [mokebs, setMokebs] = useState<Mokeb[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sliders, setSliders] = useState<AppSlider[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<{ story: MokebStory; mokebName: string; mokebId: string }[]>([]);
  const [viewingStory, setViewingStory] = useState<{stories: MokebStory[], mokebName: string, index: number} | null>(null);

  // States for Active Filters and Tab Views (We now have: 'home', 'map', 'notices', 'dashboard')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedNoticeTab, setSelectedNoticeTab] = useState<string>('همه');
  const [selectedRoute, setSelectedRoute] = useState<WalkRoute | null>(null);
  const [walkRoutes, setWalkRoutes] = useState<WalkRoute[]>([]);
  const [mobileTab, setMobileTab] = useState<'home' | 'map' | 'notices' | 'dashboard'>('home');

  // User-specific owned mokebs stats
  const [userMokebs, setUserMokebs] = useState<Mokeb[]>([]);
  const [fetchingUserMokebs, setFetchingUserMokebs] = useState(false);
  const [selectedMokebForStory, setSelectedMokebForStory] = useState<Mokeb | null>(null);
  const [selectedMokebForAnnouncement, setSelectedMokebForAnnouncement] = useState<Mokeb | null>(null);
  const [expandedDossierID, setExpandedDossierID] = useState<string | null>(null);
  const [reactivatingMokebId, setReactivatingMokebId] = useState<string | null>(null);
  const [popupMokeb, setPopupMokeb] = useState<Mokeb | null>(null);
  const [ratingMokeb, setRatingMokeb] = useState<Mokeb | null>(null);
  const [dbBulletins, setDbBulletins] = useState<any[]>([]);
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [mokebStatsList, setMokebStatsList] = useState<any[]>([]);
  const [newsCategories, setNewsCategories] = useState<any[]>([]);

  const getNewsCategoryName = (id: string) => {
    if (id === 'general') return 'عمومی';
    const foundCustom = newsCategories.find(c => c.id === id);
    if (foundCustom) return foundCustom.name;
    const foundDefault = DEFAULT_NEWS_CATEGORIES.find(c => c.id === id);
    return foundDefault ? foundDefault.name : id;
  };

  // Subscriptions to reviews and stats for priority sorting
  useEffect(() => {
    const unsubReviews = onSnapshot(collection(db, 'reviews'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setAllReviews(list);
    });

    const unsubStats = onSnapshot(collection(db, 'mokeb_stats'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setMokebStatsList(list);
    });

    return () => {
      unsubReviews();
      unsubStats();
    };
  }, []);

  // Track page load / site visits
  useEffect(() => {
    trackSiteVisit();
  }, []);

  // Real-time synchronization of official notifications
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'official_notices'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          tag: data.authorityName || (data.authority === 'faraja' ? 'پلیس فراجا' : (data.authority === 'setad' ? 'ستاد اربعین' : 'سازمان هلال احمر')),
          theme: data.category === 'critical' ? 'red' : (data.category === 'warning' ? 'amber' : 'emerald'),
          title: data.title || '',
          text: data.content || '',
          category: data.category || 'general',
          createdAt: data.createdAt
        });
      });
      // Sort by semi-chronological order or raw creation
      list.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setDbBulletins(list);
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

  // Fetch logged in user's own mokebs
  useEffect(() => {
    if (!user || !profile) {
      setUserMokebs([]);
      return;
    }
    const fetchUserMokebs = async () => {
      setFetchingUserMokebs(true);
      try {
        const q = query(collection(db, 'mokebs'), where('ownerId', '==', profile.id));
        const snap = await getDocs(q);
        const list: Mokeb[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as Mokeb);
        });

        // Merge offline local mokebs registered by this user
        try {
          const cachedMokebsJson = safeStorage.getItem('offline_mokebs');
          if (cachedMokebsJson) {
            const cachedMokebs: Mokeb[] = JSON.parse(cachedMokebsJson);
            cachedMokebs.forEach(cm => {
              if (cm.ownerId === profile.id && !list.some(lm => lm.id === cm.id)) {
                list.push(cm);
              }
            });
          }
        } catch (localErr) {
          console.warn("Failed to merge user offline mokebs cache:", localErr);
        }

        setUserMokebs(list);
      } catch (err) {
        console.error("Error fetching user mokebs in PWA:", err);
      } finally {
        setFetchingUserMokebs(false);
      }
    };
    fetchUserMokebs();
  }, [user, profile]);

  const handleModalUpdate = async () => {
    // Refresh general active data (stories & mokebs)
    try {
      const mokebsRef = collection(db, 'mokebs');
      const mokebsSnap = await getDocs(mokebsRef);
      const fetchedMokebs: Mokeb[] = [];
      const allApprovedStories: { story: MokebStory; mokebName: string; mokebId: string }[] = [];
      const now = Date.now();

      mokebsSnap.forEach(doc => {
        const data = { id: doc.id, ...(doc.data() as any) } as Mokeb;
        fetchedMokebs.push(data);
        
        if (data.stories) {
          data.stories.forEach(s => {
            const exp = getMillis(s.expiresAt);
            if (exp > now) {
              allApprovedStories.push({ story: s, mokebName: data.name, mokebId: data.id });
            }
          });
        }
      });

      // Merge local offline-registered/pending mokebs from safeStorage
      try {
        const cachedMokebsJson = safeStorage.getItem('offline_mokebs');
        if (cachedMokebsJson) {
          const cachedMokebs: Mokeb[] = JSON.parse(cachedMokebsJson);
          cachedMokebs.forEach(cm => {
            if (!fetchedMokebs.some(fm => fm.id === cm.id)) {
              fetchedMokebs.push(cm);
              if (cm.stories) {
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
        console.warn("Failed to merge offline local mokebs cache in modal update:", localErr);
      }
      
      allApprovedStories.sort((a, b) => getMillis(b.story.createdAt) - getMillis(a.story.createdAt));
      setStories(allApprovedStories);

      fetchedMokebs.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      setMokebs(fetchedMokebs);
    } catch (e) {
      console.warn("Modal update fetch general error:", e);
    }

    // Refresh user-specific mokeb data for dashboard
    if (user && profile) {
      try {
        const q = query(collection(db, 'mokebs'), where('ownerId', '==', profile.id));
        const snap = await getDocs(q);
        const list: Mokeb[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as Mokeb);
        });

        // Merge offline local
        try {
          const cachedMokebsJson = safeStorage.getItem('offline_mokebs');
          if (cachedMokebsJson) {
            const cachedMokebs: Mokeb[] = JSON.parse(cachedMokebsJson);
            cachedMokebs.forEach(cm => {
              if (cm.ownerId === profile.id && !list.some(lm => lm.id === cm.id)) {
                list.push(cm);
              }
            });
          }
        } catch (localErr) {}

        setUserMokebs(list);
      } catch (err) {
        console.error("Error refreshing user mokebs in PWA:", err);
      }
    }
  };

  const handleRequestReactivation = async (mokebId: string) => {
    setReactivatingMokebId(mokebId);
    try {
      await updateDoc(doc(db, 'mokebs', mokebId), {
        status: 'pending_stage1',
        rejectionReason: ''
      });
      await handleModalUpdate();
    } catch (err) {
      console.error("Error requesting reactivation:", err);
    } finally {
      setReactivatingMokebId(null);
    }
  };

  const searchQuery = searchParams.get('q') || '';

  // Synchronize Tab state from URL search parameters if present on load or change
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'dashboard' || tabParam === 'map' || tabParam === 'notices' || tabParam === 'home') {
      setMobileTab(tabParam as any);
    }
  }, [searchParams]);

  const setSearchQuery = (val: string) => {
    setSearchParams(prev => {
      if (val) {
        prev.set('q', val);
      } else {
        prev.delete('q');
      }
      return prev;
    });
  };

  // Use only database sliders as requested
  const currentSlidersArray = sliders;

  // Auto transition slider without infinite loops
  useEffect(() => {
    if (sliders.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % sliders.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [sliders]);

  // Real-time synchronization of Mokebs and Stories
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'mokebs'), (snapshot) => {
      const fetchedMokebs: Mokeb[] = [];
      const allApprovedStories: { story: MokebStory; mokebName: string; mokebId: string }[] = [];
      const now = Date.now();

      snapshot.forEach(docSnap => {
        const data = { id: docSnap.id, ...(docSnap.data() as any) } as Mokeb;
        fetchedMokebs.push(data);
        
        if (data.stories) {
          data.stories.forEach(s => {
            const exp = getMillis(s.expiresAt);
            if (exp > now) {
              allApprovedStories.push({ story: s, mokebName: data.name, mokebId: data.id });
            }
          });
        }
      });

      // Merge local offline-registered/pending mokebs from safeStorage
      try {
        const cachedMokebsJson = safeStorage.getItem('offline_mokebs');
        if (cachedMokebsJson) {
          const cachedMokebs: Mokeb[] = JSON.parse(cachedMokebsJson);
          cachedMokebs.forEach(cm => {
            if (!fetchedMokebs.some(fm => fm.id === cm.id)) {
              fetchedMokebs.push(cm);
              if (cm.stories) {
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
        console.warn("Failed to merge offline local mokebs cache in PWA:", localErr);
      }
      
      allApprovedStories.sort((a, b) => getMillis(b.story.createdAt) - getMillis(a.story.createdAt));
      setStories(allApprovedStories);

      fetchedMokebs.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      setMokebs(fetchedMokebs);
    }, (error) => {
      console.warn("Firestore PWA Mokebs sync failed:", error);
      const cachedMokebsJson = safeStorage.getItem('offline_mokebs');
      if (cachedMokebsJson) {
        try {
          setMokebs(JSON.parse(cachedMokebsJson));
        } catch (e) {}
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch Firestore Database
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Categories
        const catSnap = await getDocs(collection(db, 'categories'));
        const cats: Category[] = [];
        catSnap.forEach(doc => cats.push({ id: doc.id, ...(doc.data() as any) } as Category));
        setCategories(cats.length > 0 ? cats : [
          { id: 'cat-1', name: 'خدمات اسکان', icon: 'home', order: 1 },
          { id: 'cat-2', name: 'توزیع غذا و چای', icon: 'coffee', order: 2 },
          { id: 'cat-3', name: 'پزشکی و هلال‌احمر', icon: 'heart', order: 3 },
          { id: 'cat-4', name: 'فرهنگی و مذهبی', icon: 'book', order: 4 },
          { id: 'cat-5', name: 'اینترنت و دیجیتال', icon: 'wifi', order: 5 }
        ]);

        // 3. Fetch Sliders
        const sliderSnap = await getDocs(collection(db, 'sliders'));
        const fetchedSliders: AppSlider[] = [];
        sliderSnap.forEach(doc => {
          fetchedSliders.push({ id: doc.id, ...(doc.data() as any) } as AppSlider);
        });
        setSliders(fetchedSliders);

        // 4. Fetch Walk Routes
        try {
          const routesSnap = await withTimeout(getDocs(collection(db, 'routes')));
          const rts: WalkRoute[] = [];
          routesSnap.forEach(doc => {
            rts.push({ id: doc.id, ...(doc.data() as any) } as WalkRoute);
          });
          rts.sort((a, b) => (a.order || 0) - (b.order || 0));
          setWalkRoutes(rts.length > 0 ? rts : [
            { id: 'route-1', name: 'مسیر تردد شماره ۱ (شمالی)', description: 'مسیر اصلی تردد و ورود زائران گرامی', order: 1, color: '#007f5f' },
            { id: 'route-2', name: 'مسیر تردد شماره ۲ (مرکزی)', description: 'بزرگراه اصلی همراه با مواکب خدماتی متعدد', order: 2, color: '#f59e0b' },
            { id: 'route-3', name: 'مسیر تردد شماره ۳ (جنوبی)', description: 'مسیر ساحلی فرعی مجهز به ایستگاه‌های امدادی', order: 3, color: '#ef4444' }
          ]);
        } catch (routeErr) {
          console.warn("Error fetching routes:", routeErr);
          setWalkRoutes([
            { id: 'route-1', name: 'مسیر تردد شماره ۱ (شمالی)', description: 'مسیر اصلی تردد و ورود زائران گرامی', order: 1, color: '#007f5f' },
            { id: 'route-2', name: 'مسیر تردد شماره ۲ (مرکزی)', description: 'بزرگراه اصلی همراه با مواکب خدماتی متعدد', order: 2, color: '#f59e0b' },
            { id: 'route-3', name: 'مسیر تردد شماره ۳ (جنوبی)', description: 'مسیر ساحلی فرعی مجهز به ایستگاه‌های امدادی', order: 3, color: '#ef4444' }
          ]);
        }
      } catch (err) {
        console.warn("PWA fetch fallback:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'دسته متداول';

  const getMokebStories = (mokebId: string) => {
    return stories.filter(s => s.mokebId === mokebId).map(s => s.story).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));
  };

  const getMokebAmood = (m: Mokeb) => {
    if (m.address) {
      const match = m.address.match(/(?:عمود)\s*(\d+)/i);
      if (match) return parseInt(match[1]);
    }
    if (m.exactServices) {
      const match = m.exactServices.match(/(?:عمود)\s*(\d+)/i);
      if (match) return parseInt(match[1]);
    }
    let sum = 0;
    for (let i = 0; i < m.id.length; i++) sum += m.id.charCodeAt(i);
    return 50 + (sum % 1380);
  };

  // Announcements list from various active Mokebs
  const announcementsList: { id: string; title: string; mName: string; mId: string; time: string; text: string }[] = [];
  mokebs.forEach(m => {
    if (m.announcements) {
      m.announcements.forEach((a, i) => {
        if (a.active) {
          announcementsList.push({
            id: a.id || `${m.id}-ann-${i}`,
            title: a.title,
            mName: m.name,
            mId: m.id,
            time: 'لحظاتی پیش',
            text: a.content
          });
        }
      });
    }
  });

  const finalBulletins = dbBulletins;

  // Search/Filters matching
  const filteredMokebs = mokebs.filter(m => {
    // Only show approved/active mokebs publicly in the PWA listing
    if (m.status !== 'active') return false;

    const queryStr = searchQuery.trim().toLowerCase();
    
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
    const categoryMatches = selectedCategory ? m.categoryId === selectedCategory : true;
    
    let routeMatches = true;
    if (selectedRoute) {
      routeMatches = m.routeId === selectedRoute.id;
    }

    return textMatches && categoryMatches && routeMatches;
  });

  // Priority sorting: highest rating first, then highest visits (hits) first
  const sortedFilteredMokebs = [...filteredMokebs].sort((a, b) => {
    const aStats = mokebStatsList.find(s => s.id === a.id);
    const bStats = mokebStatsList.find(s => s.id === b.id);
    const aVisits = aStats?.count || 0;
    const bVisits = bStats?.count || 0;

    const aReviews = allReviews.filter(r => r.mokebId === a.id);
    const bReviews = allReviews.filter(r => r.mokebId === b.id);

    const aAvgRating = aReviews.length > 0 
      ? (aReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / aReviews.length) 
      : 0;
    const bAvgRating = bReviews.length > 0 
      ? (bReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / bReviews.length) 
      : 0;

    if (bAvgRating !== aAvgRating) {
      return bAvgRating - aAvgRating;
    }
    return bVisits - aVisits;
  });

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-800 pb-24 relative flex flex-col justify-between selection:bg-emerald-100" dir="rtl">
      
      {/* 1. Elegant Premium Header with Registration Inside Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 py-3.5 px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          {siteSettings?.siteLogoUrl ? (
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden shrink-0">
              <img 
                src={siteSettings.siteLogoUrl} 
                referrerPolicy="no-referrer" 
                alt="Site Logo" 
                className="w-full h-full object-contain p-0.5" 
              />
            </div>
          ) : (
            <div className="w-9 h-9 bg-[#007f5f] rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-700/10 animate-pulse shrink-0">
              <span className="text-base select-none">🕌</span>
            </div>
          )}
          <div>
            <h1 className="text-xs font-black text-black tracking-tight">
              {siteSettings?.siteName ? (
                siteSettings.siteName.includes('شهید') ? (
                  <>
                    {siteSettings.siteName.split('شهید')[0]}
                    <span className="text-red-600">شهید</span>
                    {siteSettings.siteName.split('شهید')[1]}
                  </>
                ) : (
                  siteSettings.siteName
                )
              ) : (
                <>
                  کمیته مواکب قائد <span className="text-red-600">شهید</span> امت
                </>
              )}
            </h1>
            {/* Subtitle removed */}
          </div>
        </div>

        {/* Dynamic Header actions containing Register & Panel */}
        <div className="flex items-center gap-1.5">
          {user ? (
            <Link 
              to="/dashboard" 
              className="text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all border border-emerald-200/50"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>پنل من</span>
            </Link>
          ) : (
            <>
              <Link 
                to="/pwa/register" 
                className="text-[10px] bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-850 text-white font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm hover:shadow transition-all"
                id="header-register"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ثبت‌نام موکب</span>
              </Link>
              <Link 
                to="/pwa/login" 
                className="text-[10px] text-slate-500 hover:text-slate-800 font-bold px-2 py-1.5 rounded-lg transition-all"
              >
                ورود
              </Link>
            </>
          )}

          {/* Minimalist Desktop view link */}
          <Link to="/?desktop=true" className="p-1 px-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-400 transition" title="نسخه دسکتاپ">
            <Home className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Content Space with Clean Micro-Breathing Margins */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: HOME (Simple, clean, completely decluttered list + category tags) */}
          {mobileTab === 'home' && (
            <motion.div 
              key="home-tab-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              
              {/* Premium Search input + Route Selector */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-4 top-3 text-slate-400 w-4 h-4" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجوی موکب، عمود، خدمت یا شهر..."
                    className="w-full pr-10 pl-4 py-3 bg-white border border-slate-200/80 focus:outline-none focus:border-[#007f5f] rounded-2xl text-xs font-bold leading-none shadow-sm placeholder:text-slate-400 transition"
                  />
                </div>
                <select
                  value={selectedRoute?.id || ''}
                  onChange={(e) => {
                    const route = walkRoutes.find(r => r.id === e.target.value) || null;
                    setSelectedRoute(route);
                  }}
                  className="w-24 bg-white border border-slate-200/80 text-[10px] font-bold text-slate-600 rounded-2xl px-2 focus:outline-none focus:border-[#007f5f] shadow-sm transition"
                >
                  <option value="">همه مسیرها</option>
                  {walkRoutes.map(route => (
                    <option key={route.id} value={route.id}>{route.name}</option>
                  ))}
                </select>
              </div>

              {/* Stories: Clean round avatar layout with horizontal scrolling */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-700 font-black flex items-center gap-1">
                    <Play className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
                    روایت زنده خادمین و زوار
                  </span>
                  <span className="text-[8px] text-slate-400 font-mono">استوری ۲۴ ساعته</span>
                </div>
                
                <div className="flex gap-4 overflow-x-auto pb-1.5 pt-1 scrollbar-none scroll-smooth">
                  {Array.from(new Map(stories.map(item => [item.mokebId, item as any])).values()).map((item: any, idx) => (
                    <button
                      key={item.mokebId}
                      onClick={() => setViewingStory({ 
                        stories: getMokebStories(item.mokebId), 
                        mokebName: item.mokebName, 
                        index: 0 
                      })}
                      className="flex flex-col items-center gap-1.5 shrink-0 focus:outline-none group"
                    >
                      <div className="w-[52px] h-[52px] rounded-full p-[2px] bg-gradient-to-tr from-[#007f5f] via-amber-400 to-rose-500 ring-2 ring-white shadow transition-transform group-active:scale-95">
                        <div className="w-full h-full rounded-full bg-slate-100 overflow-hidden border border-white">
                          <img 
                            src={item.story.mediaUrl || `https://api.dicebear.com/9.x/identicon/svg?seed=${item.mokebName}&backgroundColor=f1f5f9`} 
                            referrerPolicy="no-referrer"
                            alt="story bubble"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-slate-600 max-w-[65px] truncate">{item.mokebName}</span>
                    </button>
                  ))}
                  {stories.length === 0 && (
                      <div className="text-[10px] text-slate-400 p-2 italic">هنوز استوری ثبت نشده است.</div>
                  )}
                </div>
              </div>

              {/* Clean elegant Banner card */}
              {currentSlidersArray.length > 0 && (
                <div className="relative h-32 rounded-3xl overflow-hidden shadow-inner border border-slate-150/70 bg-emerald-950">
                  <AnimatePresence mode="wait">
                    <motion.img 
                      key={currentSlide}
                      src={currentSlidersArray[currentSlide]?.imageUrl || ''}
                      alt="Current Banner slider"
                      className="w-full h-full object-cover opacity-85"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6 }}
                    />
                  </AnimatePresence>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-3 flex flex-col justify-end z-10">
                    {/* Subtitle removed */}
                    <div className="flex justify-between items-center mt-0.5">
                      <p className="text-[10px] text-white font-extrabold truncate max-w-[180px]">{currentSlidersArray[currentSlide]?.title || siteSettings?.siteName || 'سامانه راهنمای زوار'}</p>
                      <div className="flex gap-1">
                        {currentSlidersArray.map((_, idx) => (
                          <div 
                            key={idx}
                            className={`h-1 rounded-full transition-all ${idx === currentSlide ? 'bg-amber-400 w-3' : 'bg-white/40 w-1'}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 🕌 Mokeb Registration Banner below the slider (Admin Toggleable) */}
              {siteSettings?.pwaRegistrationBannerEnabled !== false && (
                <Link 
                  to="/pwa/register"
                  className="block relative overflow-hidden bg-gradient-to-r from-emerald-50 via-emerald-100/30 to-amber-50/50 rounded-2xl border border-emerald-200/60 p-3 shadow-xs hover:shadow-md hover:border-emerald-300 active:scale-[0.99] transition-all group"
                  id="pwa-reg-notice-bar"
                >
                  <div className="absolute -left-6 -bottom-6 w-20 h-20 bg-emerald-600/5 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#007f5f] text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-700/20 group-hover:scale-105 transition-transform">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                        <h4 className="text-[10.5px] font-black text-slate-900">ثبت‌نام و معرفی موکب جدید (رسمی)</h4>
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold leading-normal mt-0.5">خادمین گرامی، جهت ثبت موقعیت مکانی و معرفی خدمات موکب خود ضربه بزنید.</p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-emerald-700 shrink-0 group-hover:translate-x-[-2px] transition-transform" />
                  </div>
                </Link>
              )}

              {/* 📢 Creative Visitor Announcement below the slider (Admin Triggered) */}
              {siteSettings?.pwaVisitorAnnouncement && siteSettings.pwaVisitorAnnouncement.trim() !== '' && (
                <div className="relative overflow-hidden bg-gradient-to-r from-rose-50 to-amber-50/60 rounded-2xl border border-rose-150 p-3 shadow-xs" id="pwa-visitor-announcement-bar">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-bounce">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-right">
                      <div className="flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-rose-500 animate-ping" />
                        <span className="text-[8.5px] font-black text-rose-700 bg-rose-100/60 px-2 py-0.5 rounded-full border border-rose-200/50 inline-block">
                          اعلان مهم ستاد برای زوار
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-800 font-black leading-relaxed font-sans mt-1.5">{siteSettings.pwaVisitorAnnouncement}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Horizontal Category Pill buttons */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 font-bold block pr-1">نیازمندی خود را انتخاب کنید:</span>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black shrink-0 transition-all ${selectedCategory === null ? 'bg-[#007f5f] text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-150'}`}
                  >
                    همه دسته‌ها
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-4 py-1.5 rounded-full text-[10px] font-black shrink-0 transition-all ${selectedCategory === cat.id ? 'bg-[#007f5f] text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-150'}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic list layout representation */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pr-1 border-b border-slate-100 pb-1.5">
                  <span className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#007f5f]" />
                    مواکب برپا شده و تایید شده ({sortedFilteredMokebs.length})
                  </span>
                  
                  {selectedRoute && (
                    <button 
                      onClick={() => setSelectedRoute(null)}
                      className="text-[9px] bg-red-50 text-red-650 px-2.5 py-1 rounded-lg font-bold hover:bg-red-100 border border-red-100/40"
                    >
                      حذف فیلتر {selectedRoute.name}
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
                    <span className="text-[10px] text-slate-400 font-bold">دریافت آخرین اطلاعات از ستاد برگزاری مراسم...</span>
                  </div>
                ) : sortedFilteredMokebs.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 p-4">
                    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-[11px] text-slate-500 font-bold leading-normal">هیچ موکب فعالی در این محدوده انتخاب شما وجود ندارد.</p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {sortedFilteredMokebs.map(m => {
                      const amood = m.amoodNumber || getMokebAmood(m);
                      
                      // Calculate real-time visits and ratings for badge
                      const stat = mokebStatsList.find(s => s.id === m.id);
                      const visits = stat?.count || 0;
                      const mReviews = allReviews.filter(r => r.mokebId === m.id);
                      const avgRating = mReviews.length > 0 
                        ? (mReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / mReviews.length) 
                        : 0;

                      return (
                        <div 
                          key={m.id} 
                          className="bg-white rounded-3xl border border-slate-150 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_15px_40px_rgba(0,127,95,0.07)] hover:border-emerald-300 active:scale-[0.99] transition-all duration-350 relative flex flex-col justify-between overflow-hidden group"
                        >
                          {/* Top Official Banner Ribbons / Stamps */}
                          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-emerald-600 to-teal-500"></div>
                          
                          {/* Officiality Header Indicator */}
                          <div className="flex items-center justify-between border-b border-slate-50 pb-2.5 mb-3 text-[9px] font-bold text-slate-400">
                            <span className="flex items-center gap-1 text-[#007f5f] font-black bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              شناسنامه تایید شده مواکب مردمی
                            </span>
                            <span className="font-mono text-slate-350">کد: {m.trackingCode || 'رسمی'}</span>
                          </div>

                          <div className="flex justify-between items-start gap-3 mb-3.5">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[8.5px] font-black px-2 py-0.5 bg-slate-50 text-slate-600 rounded-lg border border-slate-200 shrink-0">
                                  {getCategoryName(m.categoryId)}
                                </span>
                                
                                {avgRating > 0 && (
                                  <span className="text-[8.5px] font-black px-2 py-0.5 bg-amber-500/10 text-amber-700 rounded-lg border border-amber-500/20 flex items-center gap-0.5 shrink-0">
                                    ★ {Number(avgRating.toFixed(1)).toLocaleString('fa-IR')}
                                  </span>
                                )}

                                {visits > 0 && (
                                  <span className="text-[8.5px] font-bold px-2 py-0.5 bg-indigo-50/70 text-indigo-700 rounded-lg border border-indigo-100 flex items-center gap-0.5 shrink-0">
                                    👁 {visits.toLocaleString('fa-IR')}
                                  </span>
                                )}

                                {m.province && (
                                  <span className="text-[8.5px] font-bold text-slate-400 bg-slate-100/50 px-1.5 py-0.5 rounded-md shrink-0">
                                    {m.province}
                                  </span>
                                )}

                                {(() => {
                                  const routeOfMokeb = walkRoutes.find(r => r.id === m.routeId);
                                  return routeOfMokeb ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedRoute(routeOfMokeb);
                                      }}
                                      className="text-[8.5px] font-black px-2 py-0.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all flex items-center gap-1 shrink-0"
                                      title="فیلتر بر اساس این مسیر"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: routeOfMokeb.color || '#007f5f' }} />
                                      {routeOfMokeb.name}
                                    </button>
                                  ) : null;
                                })()}
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRatingMokeb(m);
                                  }}
                                  className="text-[8.5px] font-black px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg border border-amber-200 hover:bg-amber-200 active:scale-95 transition-all flex items-center gap-1 shrink-0"
                                  title="ثبت امتیاز به موکب"
                                >
                                  <Star className="w-2 h-2 fill-amber-500 text-amber-500" />
                                  امتیاز
                                </button>
                              </div>
                              
                              <h4 className="font-black text-slate-900 text-xs sm:text-sm leading-tight pt-1 group-hover:text-[#007f5f] transition-colors flex items-center gap-1">
                                <span>{m.name}</span>
                                <span className="w-4 h-4 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center text-[8px] font-black" title="مورد تایید ستاد">✓</span>
                              </h4>
                            </div>
                            
                            {/* Amood Badge - Premium Traditional Golden Seal */}
                            <div className="relative shrink-0 w-12 h-12 bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 text-slate-950 rounded-2xl shadow-md border-2 border-white flex flex-col items-center justify-center group-hover:scale-105 transition-transform">
                              {/* Inner decorative dashed border */}
                              <div className="absolute inset-0.5 border border-dashed border-amber-950/20 rounded-xl pointer-events-none" />
                              <span className="text-[7px] leading-none uppercase tracking-wider text-amber-950/60 font-sans font-black">عمود</span>
                              <span className="text-xs sm:text-sm font-sans font-black leading-none pt-0.5">{amood}</span>
                            </div>
                          </div>

                          {/* Quick details & services checklist */}
                          {m.selectedServices && m.selectedServices.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3.5">
                              {m.selectedServices.slice(0, 3).map((srv, idx) => (
                                <span key={idx} className="text-[8.5px] font-bold text-slate-600 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-lg flex items-center gap-0.5 shadow-2xs">
                                  ⚡ {srv}
                                </span>
                              ))}
                              {m.selectedServices.length > 3 && (
                                <span className="text-[8.5px] font-black text-emerald-800 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-lg">
                                  +{m.selectedServices.length - 3} خدمت دیگر
                                </span>
                              )}
                            </div>
                          )}

                          {/* Location details */}
                          <div className="text-[9.5px] text-slate-500 font-medium flex items-start gap-1.5 mb-4 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                            <span className="leading-relaxed line-clamp-1">{m.address || 'آدرس ثبت نشده'}</span>
                          </div>

                          {/* Actions */}
                          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100/70">
                            <button
                              onClick={() => {
                                setPopupMokeb(m);
                                incrementVisit(m.id, m.categoryId);
                              }}
                              className="text-[10.5px] font-black text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 border border-slate-200 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 shadow-2xs"
                            >
                              <span>ℹ️ جزئیات خدمات</span>
                            </button>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}&travelmode=walking`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10.5px] font-black text-white bg-[#007f5f] hover:bg-[#00664c] active:scale-95 py-2.5 rounded-xl transition-all duration-200 text-center shadow-sm shadow-emerald-700/10 flex items-center justify-center gap-1"
                            >
                              <span>🧭 مسیریابی زائر</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </motion.div>
          )}

          {/* TAB 2: visual schematic map Milestones */}
          {mobileTab === 'map' && (
            <motion.div 
              key="map-tab-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                <div className="border-b border-slate-50 pb-2 mb-2 flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-50 text-[#007f5f] rounded-xl flex items-center justify-center">
                    <MapIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-xs text-slate-900">مسیرهای تردد فعال</h3>
                    <p className="text-[9px] text-slate-400 font-medium mt-0.5">برای مشاهده موکب‌های مستقر در هر مسیر، روی آن ضربه بزنید</p>
                  </div>
                </div>

                <div className="relative border-r-2 border-dashed border-emerald-500/30 pr-4 mr-2.5 py-1 space-y-4">
                  {walkRoutes.map((route) => {
                    const isSelected = selectedRoute?.id === route.id;
                    const countNear = mokebs.filter(m => m.routeId === route.id).length;

                    return (
                      <button
                        key={route.id}
                        onClick={() => {
                          setSelectedRoute(isSelected ? null : route);
                          setMobileTab('home'); // Send directly to list view
                        }}
                        className={`w-full relative flex items-start justify-between p-3.5 rounded-2xl border text-right transition-all text-xs ${
                          isSelected 
                            ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-50' 
                            : 'bg-white border-slate-150 hover:bg-slate-50 active:bg-slate-100'
                        }`}
                      >
                        {/* Dot Anchor on the dashed timeline */}
                        <div className="absolute -right-[23px] top-5 w-3 h-3 rounded-full border-2 border-white shadow" style={{ backgroundColor: route.color || '#007f5f' }} />

                        <div className="flex-1 pl-3 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-extrabold text-slate-900 text-xs lines-1">{route.name}</h4>
                          </div>
                          {route.description && <p className="text-[10px] text-slate-400 font-medium font-sans mt-0.5 leading-relaxed">{route.description}</p>}
                        </div>

                        <div className="shrink-0 flex flex-col items-end justify-center">
                          <span className={`text-[9px] font-black px-2 py-1 rounded-xl border ${
                            countNear > 0 
                              ? 'bg-emerald-500/10 border-emerald-200/50 text-[#007f5f]' 
                              : 'bg-slate-50 border-slate-100 text-slate-400'
                          }`}>
                            {countNear} موکب
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: NOTICES (Unified Alerts/Announcements space in single beautiful page) */}
          {mobileTab === 'notices' && (
            <motion.div 
              key="notices-tab-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              
              {/* Dynamic live announcements sent by active mokeb khademin */}
              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-rose-500 animate-bounce" />
                    پیام فوری و آخرین وضعیت جاده (مواکب مردمی)
                  </span>
                  <span className="text-[8px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-black">لحظه‌ای</span>
                </div>

                {announcementsList.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-[10px] leading-relaxed font-sans bg-slate-50 rounded-2xl">
                    🔔 هنوز پیام و اطلاعیه اضطراری از سوی مدیران موکب‌ها ارسال نشده است. خدمات در مسیر طبیعی جریان دارد.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcementsList.map((ann, idx) => (
                      <div 
                        key={ann.id || idx}
                        className="bg-amber-500/5 border border-amber-300/30 rounded-2xl p-4 flex items-start gap-3 shadow-inner"
                      >
                        <Megaphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1 text-right">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-extrabold text-[10px] text-[#007f5f]">{ann.mName}</span>
                            <span className="text-[8px] text-slate-400 font-mono font-bold">{ann.time}</span>
                          </div>
                          <h6 className="text-[10px] font-black text-slate-900 mb-0.5">{ann.title}</h6>
                          <p className="text-[10px] text-slate-600 leading-relaxed font-sans text-justify">{ann.text}</p>
                          <div className="mt-2 text-left">
                            <button 
                              onClick={() => {
                                const matched = mokebs.find(mk => mk.id === ann.mId);
                                if (matched) setPopupMokeb(matched);
                              }} 
                              className="text-[9px] text-[#007f5f] font-black hover:underline"
                            >
                              مشاهده پروفایل موکب ←
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Official Bulletins from headquarters / police / red crescent */}
              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3 animate-fade-in">
                <div className="border-b border-slate-105 pb-2 mb-2 flex items-center gap-1.5 font-sans">
                  <ShieldAlert className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-slate-900">آیین‌نامه‌ها و ابلاغیه‌های رسمی ستاد راهبری</span>
                </div>

                {/* Dynamic Category Tabs */}
                <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none border-b border-slate-100">
                  {['همه', ...newsCategories.map(c => c.id)].map(catId => {
                    const isSelected = selectedNoticeTab === catId;
                    const displayName = catId === 'همه' ? 'همه' : getNewsCategoryName(catId);
                    return (
                      <button
                        key={catId}
                        onClick={() => setSelectedNoticeTab(catId)}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-bold shrink-0 transition-all ${
                          isSelected 
                            ? 'bg-[#007f5f] text-white shadow-sm' 
                            : 'bg-slate-50 text-slate-500 border border-slate-150 hover:bg-slate-100'
                        }`}
                      >
                        {displayName}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3 pt-1">
                  {finalBulletins.filter(bulletin => selectedNoticeTab === 'همه' || bulletin.category === selectedNoticeTab).length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-[10px] bg-slate-50 rounded-2xl">
                      🔔 در حال حاضر هیچ ابلاغیه فعالی در این دسته‌بندی وجود ندارد.
                    </div>
                  ) : (
                    finalBulletins
                      .filter(bulletin => selectedNoticeTab === 'همه' || bulletin.category === selectedNoticeTab)
                      .map((bulletin) => (
                        <div 
                          key={bulletin.id}
                          className="p-3.5 bg-emerald-50/20 border border-emerald-100/70 rounded-2xl text-right relative font-sans hover:border-emerald-200 transition-all shadow-sm"
                        >
                          <span className="absolute top-2.5 left-3 text-[8px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                            {bulletin.authorityName || bulletin.tag}
                          </span>
                          <span className="text-[8px] text-slate-400 block mb-1.5">
                            دسته‌بندی: {getNewsCategoryName(bulletin.category)}
                          </span>
                          <h5 className="font-extrabold text-[11px] text-slate-800 mb-1">{bulletin.title}</h5>
                          <p className="text-[10px] text-slate-600 leading-relaxed text-justify font-medium">{bulletin.content || bulletin.text}</p>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 4: MOKEB-DAR DASHBOARD (Extremely tailored PWA Mobile Standard) */}
          {mobileTab === 'dashboard' && profile && (
            <motion.div 
              key="dashboard-tab-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 text-right"
              dir="rtl"
            >
              
              {/* Profile Greeting Section - Simple & Non-Fantasy */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#007f5f] animate-pulse"></span>
                    <span className="text-[9px] font-black text-slate-500">
                      {profile.isAdmin ? '👑 مدیر ارشد سامانه' : '🕌 خادم محترم موکب'}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-xs">{profile.name || 'خادم گرامی'}؛ خوش آمدید</h3>
                </div>
                <div className="text-[9px] font-bold text-slate-500 font-sans bg-white px-2.5 py-1 rounded-xl border border-slate-150">
                  کاربر: {profile.username}
                </div>
              </div>

              {/* Loader during user mokebs fetch */}
              {fetchingUserMokebs ? (
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
                  <div className="w-6 h-6 border-2 border-t-[#007f5f] border-slate-220 rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-slate-400 text-[9px] font-bold">در حال دریافت اطلاعات موکب...</p>
                </div>
              ) : userMokebs.length === 0 ? (
                /* SECTION: User owns no Mokebs */
                <div className="bg-white rounded-2xl p-5 border border-slate-150 text-center space-y-3">
                  <span className="text-2xl block">📜</span>
                  <p className="text-slate-700 font-extrabold text-[10px]">هیچ موکبی به نام این حساب کاربری یافت نشد.</p>
                  <p className="text-slate-400 text-[9px] leading-relaxed max-w-xs mx-auto">
                    شناسنامه خادم شما فعال است اما فاقد موکب ثبت شده هستید. لطفا ابتدا درخواست موکب را ثبت کنید.
                  </p>
                  <Link to="/pwa/register" className="inline-block w-full bg-[#007f5f] text-white font-extrabold text-[9px] py-2.5 rounded-xl transition text-center shadow-sm">
                    ثبت درخواست موکب جدید
                  </Link>
                </div>
              ) : (
                /* SECTION: User has Mokebs! Display standard tracker & actions */
                <div className="space-y-4">
                  {userMokebs.map(mokeb => {
                    const isActive = mokeb.status === 'active';
                    const isRejected = mokeb.status === 'rejected';
                    const isPending1 = mokeb.status === 'pending_stage1';
                    const isPending2 = mokeb.status === 'pending_stage2';
                    const isApproved1 = mokeb.status === 'approved_stage1';

                    return (
                      <div key={mokeb.id} className="space-y-3">
                        
                        {/* 1. STATUS NOTIFICATION BANNER (Active / Rejected / Pending) */}
                        {isActive && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-emerald-800 text-[10px] space-y-1">
                            <div className="flex items-center gap-1.5 font-extrabold text-[#005f43]">
                              <span>✅</span>
                              <span>پروانه خدمت شما فعال و تأیید نهایی شده است</span>
                            </div>
                            <p className="text-slate-600 leading-relaxed text-[9px]">
                              موکب «{mokeb.name}» با موفقیت ارزیابی شده و جزییات مسیر، عمود و خدمات صلواتی شما اکنون در نقشه‌ی اربعین حسینی برای عموم زوار کشور منتشر شده است.
                            </p>
                          </div>
                        )}

                        {isRejected && (
                          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-rose-900 text-[10px] space-y-2">
                            <div className="flex items-center gap-1.5 font-extrabold text-rose-800">
                              <span>⚠️</span>
                              <span>پرونده فعال‌سازی موکب شما رد شده است</span>
                            </div>
                            {mokeb.rejectionReason && (
                              <div className="bg-white/80 p-2.5 rounded-xl text-[9px] text-slate-700 leading-relaxed border border-rose-100">
                                <strong>دلیل رد پرونده:</strong> <span className="text-rose-700 font-extrabold">{mokeb.rejectionReason}</span>
                              </div>
                            )}
                            <p className="text-slate-500 leading-relaxed text-[8.5px]">
                              لطفاً اطلاعات پرونده اولیه را ارزیابی نموده یا با زدن گزینه «ویرایش شناسنامه، خدمات و نقشه»، نقایص اعلام شده کارشناسان را برطرف سازید و سپس دکمه زیر را لمس نمایید تا بررسی مجدد فعال گردد.
                            </p>
                            
                            {/* Reactivation Request Handler */}
                            <button
                              onClick={() => handleRequestReactivation(mokeb.id)}
                              disabled={reactivatingMokebId === mokeb.id}
                              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] py-3 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-40"
                            >
                              {reactivatingMokebId === mokeb.id ? (
                                <span className="w-3.5 h-3.5 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                              ) : (
                                <span>🔄 ارسال مجدد پرونده جهت بررسی و فعال‌سازی نقشه</span>
                              )}
                            </button>
                          </div>
                        )}

                        {!isActive && !isRejected && (
                          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-amber-800 text-[10px] space-y-1">
                            <div className="flex items-center gap-1.5 font-extrabold text-amber-900">
                              <span>⏳</span>
                              <span>پرونده موکب در انتظار بررسی است</span>
                            </div>
                            <p className="text-slate-600 leading-relaxed text-[9px]">
                              اطلاعات ارسال شده بر اساس تصاویر مجوزها و تعهدات صلواتی موکب توسط کارمندان ستاد پیاده‌روی اربعین در حال پایش است. به محض تغییر وضعیت، اطلاع‌رسانی می‌گردد.
                            </p>
                          </div>
                        )}

                        {/* 2. PIPELINE STEPPER TRACKER */}
                        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm shadow-slate-100 space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <h4 className="font-extrabold text-slate-900 text-sm">{mokeb.name}</h4>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-full">شناسه: {mokeb.trackingCode || 'ثبت‌نام'}</span>
                                {mokeb.routeId && <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">مسیر: {mokeb.routeId}</span>}
                              </div>
                            </div>
                            <span className={`text-[9px] font-black px-3 py-1 rounded-full border ${
                              isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              isRejected ? 'bg-rose-50 border-rose-200 text-rose-700' :
                              'bg-amber-50 border-amber-200 text-amber-700'
                            }`}>
                              {isActive ? 'فعال و منتشر شده' : isRejected ? 'رد شده / نیازمند اصلاح' : 'در دست بررسی'}
                            </span>
                          </div>

                          {/* Stepper Pipeline - Flow from Initial Register details */}
                          <div className="grid grid-cols-3 items-center text-center gap-1.5 pt-1">
                            <div className="flex flex-col items-center">
                              <span className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-400 text-emerald-800 text-[10px] font-black flex items-center justify-center">✓</span>
                              <span className="text-[8px] font-bold text-slate-700 mt-1">تکمیل فرم</span>
                            </div>
                            
                            <div className="flex flex-col items-center">
                              <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center border ${
                                (isPending2 || isActive) ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-slate-100 border-slate-300 text-slate-400'
                              }`}>
                                {(isPending2 || isActive) ? '✓' : '۲'}
                              </span>
                              <span className="text-[8px] font-bold text-slate-700 mt-1">بررسی مدارک</span>
                            </div>

                            <div className="flex flex-col items-center">
                              <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center border ${
                                isActive ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-slate-100 border-slate-300 text-slate-400'
                              }`}>
                                {isActive ? '✓' : '۳'}
                              </span>
                              <span className="text-[8px] font-bold text-slate-700 mt-1">انتشار عمومی</span>
                            </div>
                          </div>
                        </div>

                        {/* 3. DEDICATED MANAGEMENT OPTIONS - MOBILE ROW LIST */}
                        <div className="bg-white rounded-2xl border border-slate-150 divide-y divide-slate-100 overflow-hidden shadow-sm">
                          
                          {/* Live Story */}
                          <button 
                            onClick={() => setSelectedMokebForStory(mokeb)}
                            className="w-full p-3.5 hover:bg-slate-50 flex items-center justify-between transition text-right"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                <Play className="w-3.5 h-3.5 fill-current text-rose-600" />
                              </div>
                              <div className="space-y-0.5">
                                <span className="font-extrabold text-[10.5px] text-slate-800 block">ارسال و مدیریت روایت زنده (استوری)</span>
                                <span className="text-[8.5px] text-slate-400 block font-sans">انتشار عکس، ویدیو و خاطرات ۲۴ ساعته خادمان اربعین</span>
                              </div>
                            </div>
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                          </button>

                          {/* Notices */}
                          <button 
                            onClick={() => setSelectedMokebForAnnouncement(mokeb)}
                            className="w-full p-3.5 hover:bg-slate-50 flex items-center justify-between transition text-right"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                <Megaphone className="w-3.5 h-3.5 text-amber-600" />
                              </div>
                              <div className="space-y-0.5">
                                <span className="font-extrabold text-[10.5px] text-slate-800 block">ثبت اطلاعیه فوری و گنجایش</span>
                                <span className="text-[8.5px] text-slate-400 block font-sans">اعلام آنلاین وضعیت اسکان، تغذیه یا پذیرش زائران</span>
                              </div>
                            </div>
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                          </button>

                          {/* Complete Profile */}
                          <Link 
                            to={`/dashboard/mokeb/${mokeb.id}/complete?from=pwa`}
                            className="p-3.5 hover:bg-slate-50 flex items-center justify-between transition text-right"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#007f5f] flex items-center justify-center shrink-0">
                                <Compass className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                              <div className="space-y-0.5">
                                <span className="font-extrabold text-[10.5px] text-slate-800 block">ویرایش شناسنامه، خدمات و نقشه</span>
                                <span className="text-[8.5px] text-slate-400 block font-sans">تصحیح نقطه GPS، خدمات صلواتی و جزییات موکب</span>
                              </div>
                            </div>
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                          </Link>

                          {/* Support Tickets & pilgrims feedback */}
                          <Link 
                            to="/dashboard/tickets"
                            className="p-3.5 hover:bg-slate-50 flex items-center justify-between transition text-right"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                              </div>
                              <div className="space-y-0.5">
                                <span className="font-extrabold text-[10.5px] text-slate-800 block">ثبت تیکت و پیام زوار</span>
                                <span className="text-[8.5px] text-slate-400 block font-sans">مشاهده نظرات، مکاتبه با پشتیبان و تقدیرهای مردمی</span>
                              </div>
                            </div>
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                          </Link>

                          {/* Dossier inspect panel */}
                          <button 
                            onClick={() => setExpandedDossierID(expandedDossierID === mokeb.id ? null : mokeb.id)}
                            className="w-full p-3.5 hover:bg-slate-50 flex items-center justify-between transition text-right"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                <Info className="w-3.5 h-3.5 text-slate-600" />
                              </div>
                              <div className="space-y-0.5">
                                <span className="font-extrabold text-[10.5px] text-slate-800 block">مشاهده اطلاعات پرونده اولیه ثبت نام</span>
                                <span className="text-[8.5px] text-slate-400 block font-sans">پایش و استعلام تمام پارامترهای هویتی ارسالی</span>
                              </div>
                            </div>
                            <ChevronLeft className={`w-4 h-4 text-slate-400 transition-transform ${expandedDossierID === mokeb.id ? '-rotate-90' : ''}`} />
                          </button>

                        </div>

                        {/* Interactive Expandable Dossier View */}
                        {expandedDossierID === mokeb.id && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-50 rounded-2xl p-4 border border-slate-150 space-y-3 font-sans text-[9.5px] text-slate-705 leading-relaxed overflow-hidden"
                          >
                            <div className="border-b border-slate-200 pb-1.5 flex items-center justify-between">
                              <span className="font-black text-slate-800">📋 شناسنامه اولیه ثبت نام شده:</span>
                              <span className="text-[8.5px] text-slate-400">بررسی براساس اطلاعات زیر صورت می‌پذیرد</span>
                            </div>

                            <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-right">
                              <div>
                                <span className="text-slate-400 font-bold block">نام موکب:</span>
                                <span className="font-black text-slate-800">{mokeb.name || 'ـ'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold block">نام مدیر موکب:</span>
                                <span className="font-black text-slate-800">{mokeb.managerName || 'ـ'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold block">تلفن همراه مسئول:</span>
                                <span className="font-black text-slate-800 font-mono" dir="ltr">{mokeb.phone || 'ـ'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold block">موقعیت استقرار (استان/شهر):</span>
                                <span className="font-black text-slate-800">{mokeb.province || 'ـ'} / {mokeb.county || 'ـ'}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-400 font-bold block">آدرس دقیق جغرافیایی:</span>
                                <span className="font-black text-slate-800">{mokeb.address || 'ـ'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold block">موقعیت طول و عرض جغرافیایی:</span>
                                <span className="font-black text-slate-800 font-mono">{mokeb.lat?.toFixed(5) || 'ـ'} , {mokeb.lng?.toFixed(5) || 'ـ'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold block">شناسه UTM / ثبت جهانی:</span>
                                <span className="font-black text-slate-805 font-mono">{mokeb.utm || 'ـ'}</span>
                              </div>
                            </div>

                            {mokeb.selectedServices && mokeb.selectedServices.length > 0 && (
                              <div className="pt-2 border-t border-slate-200">
                                <span className="text-slate-400 font-bold block mb-1">خدمات صلواتی متعهد شده:</span>
                                <div className="flex flex-wrap gap-1">
                                  {mokeb.selectedServices.map((srv, idx) => (
                                    <span key={idx} className="bg-emerald-100/75 text-[#007f5f] text-[8px] font-extrabold px-1.5 py-0.5 rounded">
                                      {srv}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {mokeb.staffList && mokeb.staffList.length > 0 && (
                              <div className="pt-2 border-t border-slate-200">
                                <span className="text-slate-400 font-bold block mb-1">لیست خادمین و کادر همراه:</span>
                                <div className="space-y-1 bg-white p-2 rounded-xl border border-slate-100">
                                  {mokeb.staffList.map((st, sIdx) => (
                                    <div key={sIdx} className="flex justify-between items-center text-[8.5px] border-b border-slate-50 last:border-0 pb-1 last:pb-0">
                                      <span className="font-extrabold text-slate-700">{st.name} ({st.role})</span>
                                      <span className="font-mono text-slate-400">کد ملی: {st.nationalId}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {mokeb.documentUrl && (
                              <div className="pt-2 border-t border-slate-200">
                                <span className="text-slate-400 font-bold block mb-1">مجوز بارگذاری شده:</span>
                                <a 
                                  href={mokeb.documentUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg font-black transition text-[8.5px]"
                                >
                                  <span>📂 مشاهده و دریافت سند اسکن‌شده</span>
                                </a>
                              </div>
                            )}

                          </motion.div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}

              {/* LOG OUT BUTTON styled minimal */}
              <button 
                onClick={() => {
                  safeStorage.clear();
                  window.dispatchEvent(new Event('auth-state-change'));
                  navigate('/pwa/login', { replace: true });
                }}
                className="w-full bg-slate-100/70 hover:bg-rose-50 text-slate-500 hover:text-rose-650 font-extrabold text-[10px] py-3 rounded-2xl border border-dashed border-slate-200 hover:border-rose-200 transition duration-150 flex items-center justify-center gap-1.5 mt-2"
                id="pwa-logout-action"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج از حساب خادم موکب</span>
              </button>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Floating Dynamic Sticky Bottom Tab Navigation Menu */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-100 py-2.5 px-6 flex items-center justify-between z-50 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] rounded-t-3xl">
        
        {/* Tab 1 button */}
        <button 
          onClick={() => setMobileTab('home')}
          className={`flex flex-col items-center gap-1.5 py-1 px-4 transition ${mobileTab === 'home' ? 'text-[#007f5f] scale-105' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[9px] font-black">خانه عشق</span>
        </button>

        {/* Tab 2 button */}
        <button 
          onClick={() => setMobileTab('map')}
          className={`flex flex-col items-center gap-1.5 py-1 px-4 transition ${mobileTab === 'map' ? 'text-[#007f5f] scale-105' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <MapIcon className="w-5 h-5" />
          <span className="text-[9px] font-black">نقشه و عمود</span>
        </button>

        {/* Tab 3 button */}
        <button 
          onClick={() => setMobileTab('notices')}
          className={`flex flex-col items-center gap-1.5 py-1 px-4 transition ${mobileTab === 'notices' ? 'text-[#007f5f] scale-105' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <div className="relative">
            <Bell className="w-5 h-5" />
            {announcementsList.length > 0 && (
              <span className="absolute -top-1 -left-1 bg-rose-500 text-white font-black rounded-full text-[8px] px-1 animate-pulse">
                {announcementsList.length}
              </span>
            )}
          </div>
          <span className="text-[9px] font-black">اعلانات زنده</span>
        </button>

        {/* Tab 4 button for logged in user */}
        {user && (
          <button 
            onClick={() => setMobileTab('dashboard')}
            className={`flex flex-col items-center gap-1.5 py-1 px-4 transition ${mobileTab === 'dashboard' ? 'text-[#007f5f] scale-105' : 'text-slate-400 hover:text-slate-600'}`}
            id="pwa-dashboard-tab"
          >
            <Settings className="w-5 h-5" />
            <span className="text-[9px] font-black">پنل خادمی</span>
          </button>
        )}

        {/* Tab 4 fallback for guests */}
        {!user && (
          <Link 
            to="/pwa/login"
            className="flex flex-col items-center gap-1.5 py-1 px-4 transition text-slate-400 hover:text-slate-600"
            id="pwa-login-tab"
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[9px] font-black">ورود خادمین</span>
          </Link>
        )}
      </nav>

      {/* Embedded Story Viewer Container */}
      <AnimatePresence>
        {viewingStory && (
          <StoryViewer 
            stories={viewingStory.stories}
            mokebName={viewingStory.mokebName}
            initialIndex={viewingStory.index}
            onClose={() => setViewingStory(null)}
          />
        )}
      </AnimatePresence>

      {/* Embedded Story Manager Modal */}
      {selectedMokebForStory && (
        <StoryManagerModal 
          mokeb={selectedMokebForStory}
          onClose={() => setSelectedMokebForStory(null)}
          onUpdate={handleModalUpdate}
        />
      )}

      {/* Embedded Announcement Manager Modal */}
      {selectedMokebForAnnouncement && (
        <AnnouncementManagerModal 
          mokeb={selectedMokebForAnnouncement}
          onClose={() => setSelectedMokebForAnnouncement(null)}
          onUpdate={handleModalUpdate}
        />
      )}

      {/* Mokeb Interactive Card Popup */}
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
