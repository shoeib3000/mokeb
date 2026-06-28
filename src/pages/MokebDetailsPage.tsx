import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from '../lib/db';
import { db } from '../lib/db';
import { Mokeb, MokebStory, MokebReview, Category } from '../types';
import { 
  MapPin, ArrowLeft, Star, Play, Megaphone, Users, CheckCircle, 
  Info, Phone, ShieldCheck, Compass, Heart, Share2, Award, Calendar, ChevronLeft,
  User, Send, MessageSquare
} from 'lucide-react';
import StoryViewer from '../components/StoryViewer';

export default function MokebDetailsPage() {
  const { mokebId } = useParams<{ mokebId: string }>();
  const { siteSettings } = useAuth();
  const [mokeb, setMokeb] = useState<Mokeb | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingStory, setViewingStory] = useState<{stories: MokebStory[], mokebName: string, index: number} | null>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'announcements' | 'gallery' | 'contact'>('about');
  const [liked, setLiked] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Ratings & Reviews State
  const [reviews, setReviews] = useState<MokebReview[]>([]);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewerName, setReviewerName] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewSuccess, setReviewSuccess] = useState<string>('');
  
  // Visitor rating registration popup states
  const [showRatingPopup, setShowRatingPopup] = useState<boolean>(false);
  const [visitorName, setVisitorName] = useState<string>('');
  const [visitorPhone, setVisitorPhone] = useState<string>('');

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const catSnap = await getDocs(collection(db, 'categories'));
        const cats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        setCategories(cats);
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };
    fetchCats();
  }, []);

  useEffect(() => {
    const fetchMokebAndReviews = async () => {
      if (!mokebId) return;
      try {
        // 1. Fetch Mokeb Info
        const ref = doc(db, 'mokebs', mokebId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setMokeb({ id: snap.id, ...snap.data() } as Mokeb);
        }

        // 2. Fetch Reviews from Firestore
        const reviewsQuery = query(collection(db, 'reviews'), where('mokebId', '==', mokebId));
        const reviewsSnap = await getDocs(reviewsQuery);
        const fetchedReviews: MokebReview[] = [];
        reviewsSnap.forEach((d) => {
          fetchedReviews.push({ id: d.id, ...d.data() } as MokebReview);
        });
        
        // Sort reviews by date descending if available
        fetchedReviews.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

        setReviews(fetchedReviews);
      } catch (err) {
        console.warn("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMokebAndReviews();
  }, [mokebId]);

  const handleSubmitReviewTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) {
      alert('لطفاً متن نظر و پیشنهاد خود را بنویسید.');
      return;
    }
    // Pre-fill visitorName with reviewerName if filled
    setVisitorName(reviewerName.trim() || '');
    setShowRatingPopup(true);
  };

  const handleConfirmAndSubmitRating = async () => {
    if (!visitorName.trim()) {
      alert('لطفاً نام و نام خانوادگی خود را وارد کنید.');
      return;
    }
    if (!visitorPhone.trim() || visitorPhone.trim().length < 10) {
      alert('لطفاً شماره تماس معتبر همراه خود را وارد کنید.');
      return;
    }

    setSubmittingReview(true);
    setReviewSuccess('');

    const newReviewData = {
      mokebId: mokebId || '',
      userId: 'anonymous_' + Math.random().toString(36).substring(2, 11),
      userName: visitorName.trim(),
      rating: reviewRating,
      comment: reviewComment.trim(),
      createdAt: new Date().toISOString()
    };

    const registrantData = {
      mokebId: mokebId || '',
      fullName: visitorName.trim(),
      phoneNumber: visitorPhone.trim(),
      rating: reviewRating,
      comment: reviewComment.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Submit review
      const reviewDoc = await addDoc(collection(db, 'reviews'), newReviewData);
      
      // 2. Submit registrant record
      await addDoc(collection(db, 'registrants'), registrantData);

      const savedReview: MokebReview = {
        id: reviewDoc.id,
        ...newReviewData
      };

      // Update local state
      setReviews((prev) => [savedReview, ...prev]);
      setReviewComment('');
      setReviewerName('');
      setVisitorName('');
      setVisitorPhone('');
      setReviewRating(5);
      setShowRatingPopup(false);
      setReviewSuccess('امتیاز ارزشمند و اطلاعات حضور شما به عنوان زائر ثبت‌نام کننده با موفقیت ثبت گردید.');
      
      // Auto-clear message
      setTimeout(() => setReviewSuccess(''), 5000);
    } catch (err) {
      console.error("Error submitting review and registration:", err);
      alert('متأسفانه خطایی در ذخیره‌سازی اطلاعات رخ داد. مجدداً تلاش کنید.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f6]">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-t-[#c5a059] border-slate-200 rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-500 font-bold font-sans">در حال دریافت اطلاعات رسمی موکب...</p>
      </div>
    </div>
  );

  if (!mokeb) return (
    <div className="container mx-auto px-4 py-12 text-center" dir="rtl">
      <div className="max-w-md mx-auto bg-white p-8 rounded-[32px] shadow-lg border border-slate-100">
        <span className="text-5xl">⚠️</span>
        <h2 className="text-xl font-bold text-slate-800 mt-4">موکب یافت نشد!</h2>
        <p className="text-slate-500 mt-2 text-sm">ممکن است مسئول یا مدیر موکب آدرس آن را تغییر داده باشند.</p>
        <Link to="/pwa" className="inline-flex mt-6 bg-[#1a1c2c] text-white px-6 py-2 rounded-xl text-sm font-bold" id="fallback-to-pwa">بازگشت به موکب‌ها</Link>
      </div>
    </div>
  );

  const hasStories = mokeb.stories && mokeb.stories.length > 0;
  const activeAnnouncements = mokeb.announcements ? mokeb.announcements.filter(a => a.active) : [];

  // Calculations for average stars
  const totalReviewsCount = reviews.length;
  const averageRating = totalReviewsCount > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviewsCount).toFixed(1)
    : '۵.۰';

  return (
    <div className="min-h-screen bg-[#fafaf8]" dir="rtl">
      
      {/* Background Spiritual Ornament Cover */}
      <div className="relative h-[240px] bg-gradient-to-tr from-[#122b22] via-[#1a382e] to-[#254d3f] overflow-hidden">
        {/* Subtle geometric pattern placeholder */}
        <div className="absolute inset-0 opacity-15 mix-blend-overlay bg-[radial-gradient(#c5a059_1px,transparent_1px)] [background-size:24px_24px]"></div>
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#c5a059]/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>

        <div className="container mx-auto px-4 h-full flex flex-col justify-between py-6 max-w-6xl relative z-10">
          <Link to="/pwa" className="inline-flex items-center gap-2 text-slate-300 hover:text-[#c5a059] transition-colors font-bold text-xs bg-black/30 backdrop-blur-md px-4 py-2 rounded-full self-start" id="back-to-pwa">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> بازگشت به سامانه زائران
          </Link>

          {/* Quick Stats on Banner */}
          <div className="flex justify-between items-end text-white pb-2">
            <span className="bg-[#c5a059]/20 border border-[#c5a059]/40 text-[#f6e1b9] text-[10px] px-3 py-1.5 rounded-full font-bold">
              🕌 پروانه رسمی موکب ثبت شده است
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setLiked(!liked)} 
                className={`p-2.5 rounded-full transition-all duration-300 ${liked ? 'bg-rose-500/90 text-white' : 'bg-white/10 hover:bg-white/20 text-white backdrop-blur-md'}`}
              >
                <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
              </button>
              <button className="p-2.5 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md rounded-full transition">
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="container mx-auto px-4 -mt-16 pb-20 max-w-6xl relative z-20">
        
        {/* Profile Card Overlay */}
        <div className="bg-white rounded-[28px] p-6 shadow-lg border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-right">
            {/* Story Ring or Avatar */}
            <div className="relative">
              <div 
                onClick={() => hasStories && setViewingStory({ stories: mokeb.stories!, mokebName: mokeb.name, index: 0 })}
                className={`w-20 h-20 rounded-full flex items-center justify-center overflow-hidden bg-emerald-50 border-2 border-white shadow-md cursor-pointer group ${hasStories ? 'ring-4 ring-[#007f5f] ring-offset-4 animate-pulse' : ''}`}
              >
                {mokeb.avatarUrl ? (
                  <img src={mokeb.avatarUrl} alt={mokeb.name} className="w-full h-full object-cover" />
                ) : siteSettings?.siteLogoUrl ? (
                  <img src={siteSettings.siteLogoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <span className="text-4xl select-none">🕋</span>
                )}
                {hasStories && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center text-white">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                )}
              </div>
              {hasStories && (
                <span className="absolute -bottom-1 inset-x-0 mx-auto w-max bg-[#007f5f] text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full border border-white">
                  استوری فعال
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black text-slate-900">{mokeb.name}</h1>
                <span className="bg-[#007f5f]/10 text-[#007f5f] text-[10px] px-2.5 py-1 rounded-full font-bold">
                  {categories.find(c => c.id === mokeb.categoryId)?.name || 'دسته متداول'}
                </span>
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-slate-500 font-medium">
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#007f5f]" /> 
                  {mokeb.address || mokeb.city || 'مسیرهای تردد'}
                </p>
                
                {mokeb.lat && mokeb.lng && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${mokeb.lat},${mokeb.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 bg-emerald-50 text-[#007f5f] px-2.5 py-1 rounded-lg border border-emerald-200/50 font-bold hover:bg-emerald-100 transition-colors"
                    title="مسیریابی در گوگل مپ"
                  >
                    <Compass className="w-3.5 h-3.5" /> مسیریابی در نقشه
                  </a>
                )}
                
                {/* Visual score display */}
                <div className="flex items-center gap-1 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200/50">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span className="font-bold font-mono">{averageRating}</span>
                  <span className="text-[10px] text-slate-400">({totalReviewsCount} امتیاز)</span>
                </div>
              </div>

              {/* Unique Spiritual Stamp / Tracking Code */}
              {mokeb.trackingCode && (
                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] px-2.5 py-1 rounded-lg font-bold">
                  <Award className="w-3.5 h-3.5 text-emerald-600" />
                  شناسه رسمی موکب: <span className="font-mono text-slate-900 font-black">{mokeb.trackingCode}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            {hasStories ? (
              <button 
                onClick={() => setViewingStory({ stories: mokeb.stories!, mokebName: mokeb.name, index: 0 })} 
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#007f5f] text-white px-6 py-3.5 rounded-2xl font-black text-xs shadow-lg shadow-emerald-950/20 hover:brightness-110 active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-current animate-bounce" /> مشاهده آنلاین استوری‌های خادمین
              </button>
            ) : (
              <div className="text-slate-400 text-xs font-semibold px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100 w-full text-center">
                فاقد استوری ۲۴ ساعته فعال
              </div>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px mb-8 scrollbar-none">
          <button 
            onClick={() => setActiveTab('about')}
            className={`px-5 py-3.5 font-bold text-sm whitespace-nowrap transition-all duration-300 relative ${activeTab === 'about' ? 'text-[#007f5f] border-b-2 border-[#007f5f]' : 'text-slate-500 hover:text-slate-800'}`}
          >
            درباره موکب
          </button>
          
          <button 
            onClick={() => setActiveTab('announcements')}
            className={`px-5 py-3.5 font-bold text-sm whitespace-nowrap transition-all duration-300 relative flex items-center gap-2 ${activeTab === 'announcements' ? 'text-[#007f5f] border-b-2 border-[#007f5f]' : 'text-slate-500 hover:text-slate-800'}`}
          >
            اطلاعیه‌ها
            {activeAnnouncements.length > 0 && (
              <span className="bg-[#007f5f] text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold">{activeAnnouncements.length}</span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab('gallery')}
            className={`px-5 py-3.5 font-bold text-sm whitespace-nowrap transition-all duration-300 relative ${activeTab === 'gallery' ? 'text-[#007f5f] border-b-2 border-[#007f5f]' : 'text-slate-500 hover:text-slate-800'}`}
          >
            تصاویر و رسانه خاطرات
          </button>

          <button 
            onClick={() => setActiveTab('contact')}
            className={`px-5 py-3.5 font-bold text-sm whitespace-nowrap transition-all duration-300 relative ${activeTab === 'contact' ? 'text-[#007f5f] border-b-2 border-[#007f5f]' : 'text-slate-500 hover:text-slate-800'}`}
          >
            ارتباط و مسئولین
          </button>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Left Side Content column (Spans 2 columns) */}
          <div className="lg:col-span-2 space-y-8">
            
            {activeTab === 'about' && (
              <div className="space-y-8">
                {/* Spiritual description */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Info className="text-[#007f5f] w-5 h-5" /> معرفی و رسالت موکب
                  </h3>
                  <p className="text-slate-600 leading-relaxed text-justify whitespace-pre-line text-sm md:text-base font-sans">
                    {mokeb.detailedDescription || mokeb.description || ''}
                  </p>
                </div>

                {/* Services Grid with Custom design */}
                {mokeb.selectedServices && mokeb.selectedServices.length > 0 && (
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
                      <CheckCircle className="text-emerald-500 w-5 h-5" /> سبد خدمات رسانی زائرین
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {mokeb.selectedServices.map((service, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
                          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">✓</div>
                          <span className="text-slate-700 font-bold text-xs">{service}</span>
                        </div>
                      ))}
                    </div>
                    {mokeb.exactServices && (
                      <div className="mt-5 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h4 className="font-bold text-slate-700 text-xs mb-2">توضیحات تکمیلی خدمات:</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">{mokeb.exactServices}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'announcements' && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
                    <Megaphone className="text-[#007f5f] w-5 h-5" /> کانال اطلاعیه‌ها و پیام‌های موکب دار
                  </h3>

                  {activeAnnouncements.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 space-y-3">
                      <span className="text-5xl block">🔔</span>
                      <p className="font-bold text-xs">در حال حاضر هیچ اطلاعیه فعالی یافت نشد.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeAnnouncements.map((ann) => (
                        <div key={ann.id} className="relative overflow-hidden bg-gradient-to-l from-amber-50 to-amber-50/20 p-5 rounded-2xl border border-amber-200/60 shadow-sm transition hover:scale-[1.01]">
                          <div className="absolute top-0 right-0 w-1.5 h-full bg-[#007f5f]"></div>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                              {ann.title}
                            </h4>
                            <span className="text-slate-400 text-[9px] font-mono flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString('fa-IR') : 'به‌تازگی'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed text-justify">{ann.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'gallery' && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Compass className="text-[#007f5f] w-5 h-5" /> تصاویر و حال و هوای موکب
                </h3>
                <p className="text-slate-500 text-xs mb-5">آلبوم خاطرات و قاب‌های ثبت شده خادمین موکب</p>
                
                {mokeb.galleryUrls && mokeb.galleryUrls.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mokeb.galleryUrls.map((url, index) => (
                      <div key={index} className="overflow-hidden rounded-xl relative group aspect-[4/3] border border-slate-100 shadow-sm bg-slate-50">
                        <img 
                          src={url} 
                          alt={`${mokeb.name} gallery image`} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400 space-y-3">
                    <span className="text-5xl block">🖼️</span>
                    <p className="font-bold text-xs">هنوز تصویری بارگذاری نشده است</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="space-y-6">
                {/* Responsibles card */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
                    <Users className="text-[#007f5f] w-5 h-5" /> خادمین و مسئولین سازمان‌دهی
                  </h3>
                  
                  {mokeb.showContactInfoPublicly ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold">👤</div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{mokeb.managerName}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">مسئول کل و مدیر ارشد موکب</p>
                        </div>
                      </div>

                      {mokeb.responsiblePersons && (
                        <div className="bg-emerald-50/20 p-4 rounded-xl border border-emerald-100/40">
                          <p className="text-[10px] font-bold text-emerald-950 mb-1.5">اسامی سایر متولیان مذهبی و اجرایی:</p>
                          <p className="text-xs text-slate-700 leading-relaxed">{mokeb.responsiblePersons}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
                      <p className="text-xs font-bold text-amber-800">بنا به درخواست موکب‌دار، اطلاعات مدیریت خصوصی است.</p>
                    </div>
                  )}
                </div>

                {/* Emergency Contact */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
                    <Phone className="text-emerald-600 w-5 h-5" /> پل‌های ارتباطی و اضطراری
                  </h3>
                  
                  {mokeb.showContactInfoPublicly ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <a href={`tel:${mokeb.phone}`} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition group">
                        <div className="flex items-center gap-3">
                          <Phone className="w-5 h-5 text-[#007f5f] group-hover:rotate-12 transition-transform" />
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold">تلفن هماهنگی موکب</p>
                            <p className="font-mono text-xs text-slate-850 font-bold mt-0.5">{mokeb.phone}</p>
                          </div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                      </a>

                      {mokeb.emergencyPhone && (
                        <a href={`tel:${mokeb.emergencyPhone}`} className="flex items-center justify-between p-4 bg-rose-50 hover:bg-rose-100/50 rounded-xl border border-rose-100 transition group">
                          <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-rose-600 group-hover:animate-shake" />
                            <div>
                              <p className="text-[10px] text-rose-450 font-bold">تلفن تماس اضطراری</p>
                              <p className="font-mono text-xs text-rose-900 font-bold mt-0.5">{mokeb.emergencyPhone}</p>
                            </div>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-rose-300" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
                      <p className="text-xs font-bold text-amber-800">بنا به درخواست موکب‌دار، اطلاعات تماس مخفی شده است.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
          </div>

          {/* Right Side Sidebar (Spans 1 column) */}
          <div className="space-y-6">
            
            {/* Quick map coordinates viewer card */}
            {mokeb.lat && mokeb.lng && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 text-center space-y-3.5">
                <div className="w-10 h-10 rounded-full bg-[#007f5f]/10 text-[#007f5f] flex items-center justify-center mx-auto">
                  <Compass className="w-5.5 h-5.5 animate-spin-slow" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">مسیریابی و موقعیت مکانی موکب</h4>
                  <p className="text-[10px] text-slate-550 mt-1 leading-normal">برای سهولت دسترسی و مسیریابی ماهواره‌ای از دکمه‌های زیر استفاده کنید:</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${mokeb.lat},${mokeb.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#1a1c2c] text-white hover:bg-slate-800 font-bold text-[10px] py-2 px-2.5 rounded-xl transition text-center"
                  >
                    نقشه گوگل
                  </a>
                  <a 
                    href={`https://nshn.ir/?lat=${mokeb.lat}&lng=${mokeb.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-[10px] py-2 px-2.5 rounded-xl transition text-center"
                  >
                    نقشه نشان
                  </a>
                </div>
              </div>
            )}

            {/* INTERACTIVE REVIEW AND RATING SYSTEM (امتیاز به موکب دار) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Star className="w-4.5 h-4.5 fill-current" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-xs">ارزیابی و امتیاز به موکب‌دار</h4>
                  <p className="text-[9px] text-slate-400 font-medium">ثبت بازخورد زوار گرامی و ارائه ستاره رضایت</p>
                </div>
              </div>

              {reviewSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] p-3 rounded-xl font-bold leading-normal">
                  {reviewSuccess}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmitReviewTrigger} className="space-y-3 pt-1">
                {/* Stars choice */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">امتیاز خود را انتخاب کنید:</span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="focus:outline-none transition-transform active:scale-90"
                      >
                        <Star 
                          className={`w-6 h-6 ${star <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">نام شما (اختیاری):</span>
                  <input 
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="مثال: کربلایی امیرحسین"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-[#007f5f] rounded-xl outline-none font-sans"
                  />
                </div>

                {/* Comment */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">متن نظر و پیشنهاد شما:</span>
                  <textarea 
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="خاطره، نقد یا تشکر از میزبانی خادمان بزرگوار این موکب را ثبت کنید..."
                    required
                    rows={3}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-[#007f5f] rounded-xl outline-none resize-none font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full bg-[#007f5f] hover:bg-[#00664c] disabled:opacity-50 text-white font-black text-xs py-2.5 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submittingReview ? 'در حال ثبت...' : 'ثبت امتیاز صلواتی'}
                </button>
              </form>

              {/* Reviews List */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h5 className="font-black text-slate-700 text-[10px] flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  آخرین نظرات ثبت شده ({reviews.length})
                </h5>

                {reviews.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-4">هنوز بازخوردی برای این موکب ثبت نشده است. اولین نفری باشید که امتیاز می‌دهد!</p>
                ) : (
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto scrollbar-none pr-0.5">
                    {reviews.map((r) => (
                      <div key={r.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                        <div className="flex justify-between items-center text-[9px]">
                          <span className="font-extrabold text-slate-700">{r.userName}</span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: r.rating }).map((_, idx) => (
                              <Star key={idx} className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
                            ))}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-600 leading-normal font-sans">{r.comment}</p>
                        {r.createdAt && (
                          <span className="text-[8px] text-slate-450 block text-left font-mono">
                            {new Date(r.createdAt).toLocaleDateString('fa-IR')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {viewingStory && (
          <StoryViewer 
            stories={viewingStory.stories} 
            mokebName={viewingStory.mokebName}
            mokebId={mokebId!}
            initialIndex={viewingStory.index}
            onClose={() => setViewingStory(null)} 
          />
        )}

        {/* 🎫 Visitor Rating Registration Popup Modal */}
        {showRatingPopup && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" dir="rtl">
            <div className="bg-white rounded-3xl max-w-md w-full border border-slate-100 shadow-2xl p-6 sm:p-8 space-y-5 text-right relative">
              <button 
                onClick={() => setShowRatingPopup(false)}
                className="absolute top-4 left-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all"
              >
                ✕
              </button>

              <div className="space-y-1.5 border-b border-slate-100 pb-3">
                <h4 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <span className="p-1 bg-[#007f5f]/10 text-[#007f5f] rounded-lg text-sm">🎫</span>
                  <span>فرم ثبت‌نام زائر و تایید ارزیابی</span>
                </h4>
                <p className="text-[10px] text-slate-500 font-medium">
                  زائر گرامی، برای جلوگیری از تقلب و تایید صحت بازخورد، لطفاً مشخصات خود را وارد کنید. این اطلاعات به عنوان ثبت‌نام‌کننده زائر در بانک اطلاعاتی ذخیره می‌شود. (فاقد پنل کاربری)
                </p>
              </div>

              <div className="space-y-4 font-sans text-xs">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-700 block">نام و نام خانوادگی:</label>
                  <input 
                    type="text"
                    required
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    placeholder="مثال: سید رضا حسینی"
                    className="w-full p-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-[#007f5f] rounded-xl outline-none text-xs"
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-700 block">شماره تماس همراه (تلفن):</label>
                  <input 
                    type="tel"
                    required
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    placeholder="مثال: 09123456789"
                    className="w-full p-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-[#007f5f] rounded-xl outline-none font-mono text-left tracking-widest text-xs"
                  />
                  <span className="text-[9px] text-slate-400 block font-medium">شماره تماس شما صرفاً جهت راستی‌آزمایی توسط ستاد کل نظارت مواکب استفاده خواهد شد.</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmAndSubmitRating}
                  disabled={submittingReview}
                  className="flex-1 bg-[#007f5f] hover:bg-[#00664c] disabled:opacity-50 text-white font-black text-xs py-3 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  {submittingReview ? 'در حال ثبت...' : 'تایید و ثبت نهایی امتیاز صلواتی'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRatingPopup(false)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
