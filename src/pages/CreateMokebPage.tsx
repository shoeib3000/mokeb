import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Navigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp, collection, getDocs } from '../lib/db';
import { db, handleFirestoreError, OperationType } from '../lib/db';
import { safeStorage } from '../lib/safeStorage';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { 
  Sparkles, CheckSquare, Plus, Trash2, Camera, MapPin,
  Users, Phone, Image, HeartHandshake, Info, ArrowLeft, UserCircle
} from 'lucide-react';

const PHOTO_PRESETS = [
  { id: 'tea', url: 'https://images.unsplash.com/photo-1542856391-010fb87dcfed?auto=format&fit=crop&q=80&w=600', caption: 'توزیع چای صلواتی' },
  { id: 'sleep', url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&q=80&w=600', caption: 'اسکان و استراحتگاه زائران' },
  { id: 'tents', url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=600', caption: 'موکب و بیرق‌های عزاداری' },
  { id: 'medical', url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=600', caption: 'فوریت‌های پزشکی و درمانی صلواتی' }
];

export default function CreateMokebPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  // Basic Details & Manager Assignment mode
  const [mokebName, setMokebName] = useState('');
  const [managerMode, setManagerMode] = useState<'self' | 'other'>('self');

  // Unified form state matching the five required groups
  const [formData, setFormData] = useState({
    // Group 1
    lat: '32.5855',
    lng: '44.0210',
    // Group 2
    orgChartDesc: '',
    orgChartImgUrl: '',
    // Group 3 (Managers)
    respFirstName: '',
    respLastName: '',
    respPhone: '',
    // Group 4
    address: '',
    detailedDescription: '',
    goalsDescription: '',
    // Group 5
    exactServices: 'ارائه دهنده خدمات رفاهی صلواتی به زوار سید الشهدا (ع)'
  });

  // Group 2: Lists
  const [staffList, setStaffList] = useState<string[]>([]);
  // Group 3: Lists
  const [responsibleList, setResponsibleList] = useState<{firstName: string, lastName: string, phone: string}[]>([]);
  // Group 5: Lists
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  // Group 1: Photos selected
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');

  // Local helper states
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('');
  const [newRespFirstName, setNewRespFirstName] = useState('');
  const [newRespLastName, setNewRespLastName] = useState('');
  const [newRespPhone, setNewRespPhone] = useState('');
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customServiceInput, setCustomServiceInput] = useState('');

  // If ManagerMode is 'self', use log-in profile details as primary manager
  useEffect(() => {
    if (profile && managerMode === 'self') {
      setFormData(prev => ({
        ...prev,
        respFirstName: profile.firstName || profile.name || '',
        respLastName: profile.lastName || '',
        respPhone: profile.phone || ''
      }));
    } else if (managerMode === 'other') {
      setFormData(prev => ({
        ...prev,
        respFirstName: '',
        respLastName: '',
        respPhone: ''
      }));
    }
  }, [profile, managerMode]);

  useEffect(() => {
    fetchCats();
  }, []);

  const fetchCats = async () => {
    try {
      const catSnap = await getDocs(collection(db, 'categories'));
      const cats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(cats);
      // Auto-select if empty
      if (!categoryId && cats.length > 0) {
        const savedDraft = safeStorage.getItem('create_mokeb_draft');
        const draft = savedDraft ? JSON.parse(savedDraft) : null;
        setCategoryId(draft?.categoryId || cats[0].id);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  // 🌟 Load draft from safeStorage on mount
  useEffect(() => {
    try {
      const savedDraft = safeStorage.getItem('create_mokeb_draft');
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft.mokebName) setMokebName(draft.mokebName);
        if (draft.managerMode) setManagerMode(draft.managerMode);
        if (draft.formData) setFormData(draft.formData);
        if (draft.staffList) setStaffList(draft.staffList);
        if (draft.responsibleList) setResponsibleList(draft.responsibleList);
        if (draft.selectedServices) setSelectedServices(draft.selectedServices);
        if (draft.selectedPhotos) setSelectedPhotos(draft.selectedPhotos);
        if (draft.categoryId) setCategoryId(draft.categoryId);
      }
    } catch (e) {
      console.warn("Failed to load create mokeb draft:", e);
    }
  }, []);

  // 🌟 Save draft to safeStorage on change
  useEffect(() => {
    try {
      const draft = {
        mokebName,
        managerMode,
        formData,
        staffList,
        responsibleList,
        selectedServices,
        selectedPhotos,
        categoryId
      };
      safeStorage.setItem('create_mokeb_draft', JSON.stringify(draft));
    } catch (e) {
      console.warn("Failed to save create mokeb draft:", e);
    }
  }, [mokebName, managerMode, formData, staffList, responsibleList, selectedServices, selectedPhotos]);

  // Prevent Enter key from submitting the form unexpectedly
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddCustomService = () => {
    const trimmed = customServiceInput.trim();
    if (!trimmed) return;
    if (!selectedServices.includes(trimmed)) {
      setSelectedServices(prev => [...prev, trimmed]);
    }
    setCustomServiceInput('');
  };

  const handleRemoveCustomService = (srv: string) => {
    setSelectedServices(prev => prev.filter(x => x !== srv));
  };

  const handleAddStaff = () => {
    if (!newStaffName.trim() || !newStaffRole.trim()) return;
    const entry = `${newStaffName.trim()} | ${newStaffRole.trim()}`;
    if (!staffList.includes(entry)) {
      setStaffList(prev => [...prev, entry]);
    }
    setNewStaffName('');
    setNewStaffRole('');
  };

  const handleRemoveStaff = (idx: number) => {
    setStaffList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddResponsible = () => {
    if (!newRespFirstName.trim() || !newRespLastName.trim() || !newRespPhone.trim()) return;
    setResponsibleList(prev => [
      ...prev,
      {
        firstName: newRespFirstName.trim(),
        lastName: newRespLastName.trim(),
        phone: newRespPhone.trim()
      }
    ]);
    setNewRespFirstName('');
    setNewRespLastName('');
    setNewRespPhone('');
  };

  const handleRemoveResponsible = (idx: number) => {
    setResponsibleList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleTogglePhotoPreset = (url: string) => {
    if (selectedPhotos.includes(url)) {
      setSelectedPhotos(prev => prev.filter(x => x !== url));
    } else {
      setSelectedPhotos(prev => [...prev, url]);
    }
  };

  const handleAddCustomPhoto = () => {
    if (!customPhotoUrl.trim()) return;
    if (!selectedPhotos.includes(customPhotoUrl)) {
      setSelectedPhotos(prev => [...prev, customPhotoUrl.trim()]);
    }
    setCustomPhotoUrl('');
  };

  const handleRemovePhoto = (url: string) => {
    setSelectedPhotos(prev => prev.filter(x => x !== url));
  };

  const generateTrackingCode = () => {
    return 'MKB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!mokebName.trim()) {
      alert("لطفا نام موکب را وارد کنید.");
      return;
    }
    if (!categoryId) {
      alert("لطفا دسته‌بندی فعالیت موکب را انتخاب کنید.");
      return;
    }
    setSubmitting(true);

    try {
      const trackingCode = generateTrackingCode();
      const newMokebId = doc(collection(db, 'mokebs')).id;
      const combinedManagerName = `${formData.respFirstName.trim()} ${formData.respLastName.trim()}`.trim();

      await setDoc(doc(db, 'mokebs', newMokebId), {
        ownerId: profile.id,
        name: mokebName.trim(),
        status: 'pending_stage1', // Goes to stage 1 review beautifully
        trackingCode,
        createdAt: serverTimestamp(),

        // Group 1: Map point and photos
        lat: formData.lat ? parseFloat(formData.lat) : null,
        lng: formData.lng ? parseFloat(formData.lng) : null,
        galleryUrls: selectedPhotos.length > 0 ? selectedPhotos : [PHOTO_PRESETS[0].url],

        // Group 2: Staff & Org structure 
        staffList,
        orgChartDesc: formData.orgChartDesc,
        orgChartImgUrl: formData.orgChartImgUrl,

        // Group 3: Primary Manager & Responsible list
        managerName: combinedManagerName,
        phone: formData.respPhone,
        respFirstName: formData.respFirstName,
        respLastName: formData.respLastName,
        respPhone: formData.respPhone,
        responsibleList,

        // Group 4: Address and Details
        address: formData.address,
        detailedDescription: formData.detailedDescription,
        goalsDescription: formData.goalsDescription,

        // Group 5: Facilities & Services selection
        selectedServices,
        exactServices: formData.exactServices,
        categoryId: categoryId || 'general-service'
      });

      alert(`درخواست ثبت موکب شما با موفقیت در سامانه ذخیره شد. کد رهگیری شما: ${trackingCode}`);
      try {
        safeStorage.removeItem('create_mokeb_draft');
      } catch (e) {}
      navigate('/dashboard');
    } catch (err) {
      console.error("Error creating mokeb request:", err);
      handleFirestoreError(err, OperationType.CREATE, 'mokebs');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]" dir="rtl">
        <span className="text-slate-500 font-bold">درحال بارگذاری...</span>
      </div>
    );
  }

  if (!user || !profile) return <Navigate to="/login" />;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl" dir="rtl">
      
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-950 text-white rounded-2xl shadow-md">
            <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">ثبت درخواست جدید تأسیس موکب</h1>
            <p className="text-slate-500 text-xs mt-1 font-medium font-sans">
              لطفا اطلاعات تفصیلی موکب خود را جهت ارسال به کارگروه بازرسی و دریافت پروانه فیلدهای زیر تکمیل نمایید.
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate('/dashboard')} 
          className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 text-xs font-bold gap-1.5 rounded-xl h-10 px-4 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          انصراف و بازگشت
        </Button>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-8">

        {/* 🌟 Basic Info */}
        <Card className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-[#1a1c2c] text-white p-5">
            <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-amber-400" />
              اطلاعات پایه و تعیین مسئول موکب
            </CardTitle>
            <p className="text-slate-400 text-[11px] mt-1 font-serif">
              تعیین نام رسمی موکب و شخص مسئول اصلی هماهنگ‌کننده.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">نام رسمی موکب الحسین (ع) *</label>
                <Input 
                  required
                  value={mokebName}
                  onChange={e => setMokebName(e.target.value)}
                  placeholder="مثال: موکب امام علی ابن ابیطالب (ع) شیراز"
                  className="text-xs bg-white border-slate-200 rounded-xl focus:border-amber-400 px-4 h-11"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">دسته‌بندی فعالیت موکب *</label>
                <select 
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl h-11 px-3 text-slate-800 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                >
                  <option value="">-- انتخاب دسته‌بندی --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">فرد مسئول موکب کیست؟ *</label>
                <div className="grid grid-cols-2 gap-3.5 pt-0.5">
                  <div 
                    onClick={() => setManagerMode('self')}
                    className={`flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      managerMode === 'self' 
                        ? 'bg-amber-500/10 border-amber-500 text-amber-900 font-bold' 
                        : 'border-slate-100 hover:border-slate-200 text-slate-600 bg-white'
                    }`}
                  >
                    <span className="text-xs">خودم هستم (ثبت‌نام شونده)</span>
                  </div>
                  <div 
                    onClick={() => setManagerMode('other')}
                    className={`flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      managerMode === 'other' 
                        ? 'bg-amber-500/10 border-amber-500 text-amber-900 font-bold' 
                        : 'border-slate-100 hover:border-slate-200 text-slate-600 bg-white'
                    }`}
                  >
                    <span className="text-xs">فرد دیگری است</span>
                  </div>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>


        {/* 🗺️ GROUP 1: موقعیت نقشه موکب، آلبوم تصاویر و جلوه خدمت‌رسانی */}
        <Card className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-[#1a1c2c] text-white p-5">
            <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-lg bg-amber-500/10 text-amber-400 items-center justify-center font-mono text-xs">۱</span>
              موقعیت نقشه موکب، آلبوم تصاویر و جلوه خدمت‌رسانی
            </CardTitle>
            <p className="text-slate-400 text-[11px] mt-1 font-sans">
              تعیین دقیق نقطه استقرار جغرافیایی بر روی نقشه به همراه عکاسی از آلبوم خدمت‌رسانی موکب.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-500 animate-bounce" />
                مختصات دقیق جغرافیایی بر روی نقشه آنلاین
              </h4>
              <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                مختصات جغرافیایی (عرض و طول جغرافیایی) را جهت ترسیم آیکن موکب بر روی نقشه تعاملی مسیرهای تردد در زیر وارد کنید.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 block">عرض جغرافیایی (Latitude) *</label>
                  <Input 
                    required
                    name="lat" 
                    value={formData.lat} 
                    onChange={handleChange} 
                    dir="ltr" 
                    className="font-mono text-xs bg-white border-slate-200 rounded-xl focus:border-amber-400"
                    placeholder="مثال: 32.5855" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 block">طول جغرافیایی (Longitude) *</label>
                  <Input 
                    required
                    name="lng" 
                    value={formData.lng} 
                    onChange={handleChange} 
                    dir="ltr" 
                    className="font-mono text-xs bg-white border-slate-200 rounded-xl focus:border-amber-400"
                    placeholder="مثال: 44.0210" 
                  />
                </div>
              </div>
            </div>

            {/* Photo selector preset */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Image className="w-4 h-4 text-blue-500" />
                نگارخانه مصور و آلبوم تصاویر خدمت‌رسانی موکب
              </h4>
              <p className="text-[11px] text-slate-500 font-sans">
                از میان آلبوم‌های نمونه جهت جلوه اول خدمت تفریحی گزینه‌ای انتخاب نموده یا لینک‌های اختصاصی الصاق کنید.
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {PHOTO_PRESETS.map((p) => {
                  const isChecked = selectedPhotos.includes(p.url);
                  return (
                    <div 
                      key={p.id}
                      type="button"
                      onClick={() => handleTogglePhotoPreset(p.url)}
                      className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all aspect-video group ${
                        isChecked ? 'border-amber-500 ring-2 ring-amber-100' : 'border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <img src={p.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt={p.caption} />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-[9px] text-white font-bold leading-tight line-clamp-1">{p.caption}</p>
                      </div>
                      <div className={`absolute top-1.5 left-1.5 w-4 h-4 rounded-full flex items-center justify-center border text-[9px] ${
                        isChecked ? 'bg-amber-500 text-white border-amber-500 font-black' : 'bg-black/40 text-transparent border-white/60'
                      }`}>
                        ✓
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add custom images by URL directly */}
              <div className="bg-slate-50/40 p-4 rounded-xl border border-slate-100 space-y-3">
                <label className="text-[11px] font-bold text-slate-600 block">افزودن آدرس تصویر دلخواه دیگر (URL مستقیم):</label>
                <div className="flex gap-2">
                  <Input 
                    value={customPhotoUrl}
                    onChange={e => setCustomPhotoUrl(e.target.value)}
                    placeholder="https://example.com/images/my-view.jpg"
                    dir="ltr"
                    className="bg-white border-slate-200 text-xs rounded-xl flex-1"
                  />
                  <Button 
                    type="button" 
                    onClick={handleAddCustomPhoto}
                    className="bg-[#1a1c2c] hover:bg-slate-800 text-white rounded-xl text-xs font-bold px-4 shrink-0 transition-transform hover:-translate-y-0.5"
                  >
                    <Camera className="w-3.5 h-3.5 ml-1.5" />
                    ذخیره در آلبوم
                  </Button>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>


        {/* 👥 GROUP 2: کادر خادمین و چارت سازمانی معرفی شده */}
        <Card className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-[#1a1c2c] text-white p-5">
            <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-lg bg-amber-500/10 text-amber-400 items-center justify-center font-mono text-xs">۲</span>
              کادر خادمین و چارت سازمانی معرفی شده
            </CardTitle>
            <p className="text-slate-400 text-[11px] mt-1 font-sans">
              جزئیات توصیف نقش‌ها، چارت سازمانی هدایت مذهبی و معرفی اسامی تیم خادم مستقر در موکب.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">چارت سازمانی و ساختار هدایت موکب:</label>
              <Textarea 
                name="orgChartDesc"
                value={formData.orgChartDesc}
                onChange={handleChange}
                rows={2}
                className="text-xs bg-white border-slate-200 rounded-xl leading-relaxed"
                placeholder="تشریحی از کارگروه‌های موکب (مثلاً تیم فنی، آشپزخانه، اسکان، فرهنگی) بنویسید..."
              />
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-600 block">آدرس تصویر چارت سازمانی تجسمی (اختیاری - URL):</label>
              <Input 
                name="orgChartImgUrl"
                value={formData.orgChartImgUrl}
                onChange={handleChange}
                dir="ltr"
                placeholder="https://example.com/charts/myorg.png"
                className="text-xs bg-white border-slate-200 rounded-xl"
              />
            </div>

            {/* Add Khadem dynamically and display */}
            <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                <Users className="w-4 h-4 text-purple-600" />
                معرفی اسامی کادر خادمین موکب
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">نام و نام خانوادگی خادم</label>
                  <Input 
                    value={newStaffName} 
                    onChange={e => setNewStaffName(e.target.value)}
                    placeholder="مثال: کربلایی حمید عباسی"
                    className="bg-white border-slate-200 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">مسئولیت او در موکب</label>
                  <div className="flex gap-2">
                    <Input 
                      value={newStaffRole} 
                      onChange={e => setNewStaffRole(e.target.value)}
                      placeholder="مثال: معاون بهداشت، کادر چایخانه صلواتی"
                      className="bg-white border-slate-200 text-xs rounded-xl"
                    />
                    <Button 
                      type="button" 
                      onClick={handleAddStaff}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shrink-0 px-4 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 ml-1" />
                      افزودن
                    </Button>
                  </div>
                </div>
              </div>

              {staffList.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {staffList.map((st, i) => {
                    const [name, role] = st.split('|').map(s => s.trim());
                    return (
                      <div key={i} className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1 text-xs shadow-sm">
                        <span className="font-bold text-slate-800">{name}</span>
                        <span className="text-[10px] bg-purple-5 text-purple-700 px-2 py-0.5 rounded-full font-semibold">{role || 'خادم موکب'}</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveStaff(i)}
                          className="text-red-400 hover:text-red-600 p-0.5 rounded-full transition-colors font-bold ml-1"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </CardContent>
        </Card>


        {/* 📞 GROUP 3: مشخصات فرد یا افراد مسئول (نام، نام خانوادگی، شماره تماس) */}
        <Card className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-[#1a1c2c] text-white p-5">
            <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-lg bg-amber-500/10 text-amber-400 items-center justify-center font-mono text-xs">۳</span>
              مشخصات فرد یا افراد مسئول موکب
            </CardTitle>
            <p className="text-slate-400 text-[11px] mt-1 font-sans">
              درج دقیق مشخصات فردی مسئول اصلی موکب به همراه معرفی مسئولین کمکی و فوریت‌های فنی.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">

            {/* Primary Responsible Person fields */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                مشخصات مسئول اصلی موکب
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600">نام مسئول *</label>
                  <Input 
                    required
                    name="respFirstName"
                    value={formData.respFirstName}
                    onChange={handleChange}
                    readOnly={managerMode === 'self'}
                    placeholder="مثال: علیرضا"
                    className="text-xs rounded-xl border-slate-200 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600">نام خانوادگی مسئول *</label>
                  <Input 
                    required
                    name="respLastName"
                    value={formData.respLastName}
                    onChange={handleChange}
                    readOnly={managerMode === 'self'}
                    placeholder="مثال: موسوی"
                    className="text-xs rounded-xl border-slate-200 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600">شماره مستقیم تماس مسئول *</label>
                  <Input 
                    required
                    name="respPhone"
                    value={formData.respPhone}
                    onChange={handleChange}
                    readOnly={managerMode === 'self'}
                    dir="ltr"
                    placeholder="مثال: 09121234567"
                    className="text-xs rounded-xl border-slate-200 font-mono bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Other helpful responsibility persons */}
            <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                <Phone className="w-4 h-4 text-emerald-600" />
                سایر افراد مسئول، معتمد یا بخش‌های اضطراری موکب (اختیاری)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">نام</label>
                  <Input 
                    value={newRespFirstName}
                    onChange={e => setNewRespFirstName(e.target.value)}
                    placeholder="مثال: سید کاظم"
                    className="bg-white border-slate-200 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">نام خانوادگی</label>
                  <Input 
                    value={newRespLastName}
                    onChange={e => setNewRespLastName(e.target.value)}
                    placeholder="مثال: رضایی"
                    className="bg-white border-slate-200 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500">شماره تماس مستقیم</label>
                  <div className="flex gap-2">
                    <Input 
                      value={newRespPhone}
                      onChange={e => setNewRespPhone(e.target.value)}
                      dir="ltr"
                      placeholder="مثال: 09128888888"
                      className="bg-white border-slate-200 text-xs rounded-xl flex-1 font-mono"
                    />
                    <Button 
                      type="button" 
                      onClick={handleAddResponsible}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 px-4 transition-transform hover:-translate-y-0.5"
                    >
                      <Plus className="w-3.5 h-3.5 ml-1" />
                      افزودن
                    </Button>
                  </div>
                </div>
              </div>

              {responsibleList.length > 0 && (
                <div className="overflow-hidden border border-slate-200 bg-white rounded-xl">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <tr>
                        <th className="p-2.5">نام و نام خانوادگی</th>
                        <th className="p-2.5">شماره تماس</th>
                        <th className="p-2.5 text-left">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {responsibleList.map((st, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-semibold text-slate-800">{st.firstName} {st.lastName}</td>
                          <td className="p-2.5 font-mono text-slate-600">{st.phone}</td>
                          <td className="p-2.5 text-left">
                            <button 
                              type="button" 
                              onClick={() => handleRemoveResponsible(i)}
                              className="text-red-500 hover:text-red-700 bg-red-50/40 p-1 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </CardContent>
        </Card>


        {/* 📚 GROUP 4: آدرس موکب، توضیحات تکمیلی و اهداف خدمت‌رسانی */}
        <Card className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-[#1a1c2c] text-white p-5">
            <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-lg bg-amber-500/10 text-amber-400 items-center justify-center font-mono text-xs">۴</span>
              آدرس موکب، توضیحات تکمیلی و اهداف خدمت‌رسانی
            </CardTitle>
            <p className="text-slate-400 text-[11px] mt-1 font-sans">
              توضیح مکتوب از موقعیت قرارگیری دقیق موکب به همراه آرمان‌ها و شعار خدمت‌رسانی سال جاری.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">آدرس دقیق جغرافیایی یا ایستگاه مسیرهای تردد *</label>
              <Textarea 
                required 
                name="address" 
                value={formData.address} 
                onChange={handleChange} 
                rows={2}
                className="font-sans text-xs bg-white border-slate-200 rounded-xl leading-relaxed focus:border-amber-400"
                placeholder="مثال: ایستگاه ۲۸۰ در مسیر تردد شماره ۱ - مقابل ساختمان هلال‌احمر" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">توضیحات تکمیلی، سرگذشت و روایت موکب:</label>
              <Textarea 
                name="detailedDescription" 
                value={formData.detailedDescription} 
                onChange={handleChange} 
                rows={3}
                className="font-sans text-xs bg-white border-slate-200 rounded-xl leading-relaxed focus:border-amber-400"
                placeholder="شرحی از تاریخچه ساخت یا پیام خوش‌آمد صمیمانه به زوار الحسین..." 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">اهداف و آرمان‌های اصلی خدمت‌رسانی موکب:</label>
              <Textarea 
                name="goalsDescription" 
                value={formData.goalsDescription} 
                onChange={handleChange} 
                rows={2}
                className="font-sans text-xs bg-white border-slate-200 rounded-xl leading-relaxed focus:border-amber-400"
                placeholder="مثال: خدمت مخلصانه صلواتی به زائران اباعبدالله، بالا بردن فرهنگ تکریم زوار، برپایی نماز جماعت..." 
              />
            </div>

          </CardContent>
        </Card>


        {/* 🏥 GROUP 5: خدمات و تسهیلات رفاهی ارائه شده */}
        <Card className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-[#1a1c2c] text-white p-5">
            <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-lg bg-amber-500/10 text-amber-400 items-center justify-center font-mono text-xs">۵</span>
              خدمات و تسهیلات رفاهی ارائه شده
            </CardTitle>
            <p className="text-slate-400 text-[11px] mt-1 font-sans">
              تسهیلات رفاهی و خدمات صادرشده رایگان موکب به زوار سیدالشهدا (ع).
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6" dir="rtl">

            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-850 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  افزودن خدمات رفاهی صلواتی فعال (مدیریت موردی توسط کاربر)
                </h4>
                <p className="text-[10px] text-slate-500 mt-1 font-sans">
                  لطفاً خدمات ارائه شده توسط موکب خود را یک به یک بنویسید و دکمه افزودن را فشار دهید.
                </p>
              </div>

              {/* Dynamic input field to add new services */}
              <div className="flex gap-2">
                <Input 
                  type="text"
                  value={customServiceInput}
                  onChange={(e) => setCustomServiceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomService();
                    }
                  }}
                  className="font-sans text-xs bg-white border-slate-250 rounded-xl focus:border-emerald-500"
                  placeholder="عنوان خدمت جدید را بنویسید... (مثال: اسکان صلواتی خواهران)" 
                />
                <Button 
                  type="button"
                  onClick={handleAddCustomService}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 rounded-xl transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن خدمت</span>
                </Button>
              </div>

              {/* Grid of added custom services */}
              <div className="space-y-2 pt-2">
                <label className="text-[11px] font-bold text-slate-500 block">خدمات الصاق شده به پرونده موکب:</label>
                {selectedServices.length === 0 ? (
                  <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center bg-slate-50/50">
                    <p className="text-[11px] text-slate-500 font-sans">
                      ⚠️ هنوز هیچ خدمتی اضافه نکرده‌اید! لطفا خدمات موکب خود (مانند اسکان، توزیع چای، غذا، شارژ موبایل و...) را در کادر بالا بنویسید و دکمه افزودن را بزنید.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedServices.map((srv, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-bold rounded-xl shadow-sm transition-all animate-fade-in"
                      >
                        <span>{srv}</span>
                        <button 
                          type="button"
                          onClick={() => handleRemoveCustomService(srv)}
                          className="w-4 h-4 rounded-full bg-emerald-200/60 text-emerald-800 hover:bg-emerald-200 flex items-center justify-center font-bold text-[10px] transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-[#1a1c2c] block">تشریح کیفیت و کمّیت خدمات رفاهی:</label>
              <Textarea 
                name="exactServices" 
                value={formData.exactServices} 
                onChange={handleChange} 
                rows={2}
                className="font-sans text-xs bg-white border-slate-200 rounded-xl leading-relaxed"
                placeholder="توضیحات تکمیلی پیرامون نحوه ارائه امکانات رفاهی یا ساعات سرو چای و وعده‌های غذایی..." 
              />
            </div>

          </CardContent>
        </Card>


        {/* Submit Panel */}
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row gap-3">
          <Button 
            type="submit" 
            className="w-full bg-[#1a1c2c] hover:bg-slate-800 text-white transition-all py-3.5 rounded-xl font-bold font-sans text-sm h-12 shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5" 
            disabled={submitting}
          >
            {submitting ? 'در حال ارسال مدارک به کارگروه بازرسی...' : 'ثبت نهایی و ارسال درخواست تأسیس موکب الحسین 🌸'}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            className="w-full bg-white hover:bg-slate-100 border-slate-200 rounded-xl h-12 text-slate-600 text-xs font-bold shadow-sm" 
            onClick={() => navigate('/dashboard')}
          >
            انصراف و بازگشت به پنل
          </Button>
        </div>

      </form>
    </div>
  );
}
