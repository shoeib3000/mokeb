import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, getDocs, query, collection, orderBy } from '../lib/db';
import { db, handleFirestoreError, OperationType } from '../lib/db';
import { safeStorage } from '../lib/safeStorage';
import { Mokeb, WalkRoute } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { 
  Sparkles, CheckSquare, Plus, Trash2, Camera, MapPin,
  Users, Phone, Image, HeartHandshake, Info, ArrowLeft, HelpCircle
} from 'lucide-react';

const PHOTO_PRESETS = [
  { id: 'tea', url: 'https://images.unsplash.com/photo-1542856391-010fb87dcfed?auto=format&fit=crop&q=80&w=600', caption: 'توزیع چای صلواتی' },
  { id: 'sleep', url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&q=80&w=600', caption: 'اسکان و استراحتگاه زائران' },
  { id: 'tents', url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=600', caption: 'موکب و بیرق‌های عزاداری' },
  { id: 'medical', url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=600', caption: 'فوریت‌های پزشکی و درمانی صلواتی' }
];

export default function CompleteMokebProfilePage() {
  const { mokebId } = useParams<{ mokebId: string }>();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromParam = searchParams.get('from');
  const [mokeb, setMokeb] = useState<Mokeb | null>(null);
  const [fetching, setFetching] = useState(true);
  
  // States matching user groups
  const [formData, setFormData] = useState({
    // Group 1
    avatarUrl: '',
    lat: '',
    lng: '',
    // Group 2
    orgChartDesc: '',
    orgChartImgUrl: '',
    // Group 3
    respFirstName: '',
    respLastName: '',
    respPhone: '',
    showContactInfoPublicly: false,
    // Group 4
    address: '',
    detailedDescription: '',
    goalsDescription: '', // اهداف خدمت رسانی
    // Group 5
    exactServices: 'ارائه دهنده خدمات عمومی به زوار'
  });

  // Group 2: lists
  const [staffList, setStaffList] = useState<string[]>([]);
  // Group 3: lists
  const [responsibleList, setResponsibleList] = useState<{firstName: string, lastName: string, phone: string}[]>([]);
  // Group 5: lists
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  // Group 1: lists
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  
  const [reviews, setReviews] = useState<any[]>([]);
  const [fetchingReviews, setFetchingReviews] = useState(false);
  
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });
  const [newStoryCaption, setNewStoryCaption] = useState('');

  // Auxiliary UI controls
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('');
  const [newStaffShowContact, setNewStaffShowContact] = useState(false);
  
  const [newRespFirstName, setNewRespFirstName] = useState('');
  const [newRespLastName, setNewRespLastName] = useState('');
  const [newRespPhone, setNewRespPhone] = useState('');

  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customServiceInput, setCustomServiceInput] = useState('');
  const [walkRoutes, setWalkRoutes] = useState<WalkRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [amoodNumber, setAmoodNumber] = useState('');

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const q = query(collection(db, 'routes'), orderBy('order', 'asc'));
        const snp = await getDocs(q);
        const rts: WalkRoute[] = [];
        snp.forEach(d => rts.push({ id: d.id, ...d.data() } as WalkRoute));
        setWalkRoutes(rts);
      } catch (err) {
        console.error(err);
      }
    };
    fetchRoutes();
  }, []);

  useEffect(() => {
    const fetchMokeb = async () => {
      if (!mokebId || !profile) return;
      try {
        const docSnap = await getDoc(doc(db, 'mokebs', mokebId));
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...(docSnap.data() as any) } as Mokeb;
          
          // Allow edit if Admin OR Owner
          if (data.ownerId !== profile.id && !profile.isAdmin) {
             if (fromParam === 'pwa') {
                navigate('/pwa?tab=dashboard');
             } else {
                navigate('/dashboard');
             }
             return;
          }
          
          setMokeb(data);

          // Parse first name & last name from managerName as fallback
          let initialFirstName = (data as any).respFirstName || '';
          let initialLastName = (data as any).respLastName || '';
          
          if (!initialFirstName && data.managerName) {
            const parts = data.managerName.trim().split(' ');
            initialFirstName = parts[0] || '';
            initialLastName = parts.slice(1).join(' ') || '';
          }

          if (data.routeId) setSelectedRouteId(data.routeId);
          if (data.amoodNumber) setAmoodNumber(data.amoodNumber.toString());

          setFormData({
            avatarUrl: data.avatarUrl || '',
            lat: data.lat?.toString() || '',
            lng: data.lng?.toString() || '',
            orgChartDesc: (data as any).orgChartDesc || '',
            orgChartImgUrl: (data as any).orgChartImgUrl || '',
            respFirstName: initialFirstName,
            respLastName: initialLastName,
            respPhone: (data as any).respPhone || data.phone || '',
            showContactInfoPublicly: data.showContactInfoPublicly ?? false,
            address: data.address || '',
            detailedDescription: data.detailedDescription || '',
            goalsDescription: (data as any).goalsDescription || '',
            exactServices: data.exactServices || 'ارائه دهنده خدمات عمومی به زوار'
          });

          setStaffList(data.staffList || []);
          setResponsibleList((data as any).responsibleList || []);
          setSelectedServices(data.selectedServices || []);
          setSelectedPhotos(data.galleryUrls || []);
          setAnnouncements(data.announcements || []);
          setStories(data.stories || []);
        }
      } catch (err) {
        console.error("Error loading mokeb:", err);
      } finally {
        setFetching(false);
      }
    };
    fetchMokeb();

    // Fetch reviews
    const fetchReviews = async () => {
      if (!mokebId) return;
      setFetchingReviews(true);
      try {
        const reviewsRef = collection(db, 'mokebs', mokebId, 'reviews');
        const q = query(reviewsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedReviews = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setReviews(fetchedReviews);
      } catch (err) {
        console.error("Error loading reviews:", err);
      } finally {
        setFetchingReviews(false);
      }
    };
    fetchReviews();
  }, [mokebId, profile, navigate]);

  // 🌟 Load draft from safeStorage once fetching is false
  useEffect(() => {
    if (fetching || !mokebId) return;
    try {
      const savedDraft = safeStorage.getItem('edit_mokeb_draft_' + mokebId);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft.formData) setFormData(draft.formData);
        if (draft.staffList) setStaffList(draft.staffList);
        if (draft.responsibleList) setResponsibleList(draft.responsibleList);
        if (draft.selectedServices) setSelectedServices(draft.selectedServices);
        if (draft.selectedPhotos) setSelectedPhotos(draft.selectedPhotos);
        if (draft.selectedRouteId) setSelectedRouteId(draft.selectedRouteId);
        if (draft.amoodNumber) setAmoodNumber(draft.amoodNumber);
      }
    } catch (e) {
      console.warn("Failed to load edit mokeb draft:", e);
    }
  }, [fetching, mokebId]);

  // 🌟 Save draft to safeStorage on change
  useEffect(() => {
    if (fetching || !mokebId) return;
    try {
      const draft = {
        formData,
        staffList,
        responsibleList,
        selectedServices,
        selectedPhotos,
        selectedRouteId,
        amoodNumber
      };
      safeStorage.setItem('edit_mokeb_draft_' + mokebId, JSON.stringify(draft));
    } catch (e) {
      console.warn("Failed to save edit mokeb draft:", e);
    }
  }, [mokebId, fetching, formData, staffList, responsibleList, selectedServices, selectedPhotos, selectedRouteId, amoodNumber]);

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
    const entry = `${newStaffName.trim()} | ${newStaffRole.trim()} | ${newStaffShowContact ? 'نمایش عمومی' : 'عدم نمایش'}`;
    const nameExists = staffList.some(s => s.split('|')[0].trim() === newStaffName.trim());
    if (!nameExists) {
      setStaffList(prev => [...prev, entry]);
    }
    setNewStaffName('');
    setNewStaffRole('');
    setNewStaffShowContact(false);
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

  const handleAddAnnouncement = () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return;
    setAnnouncements(prev => [
      {
        id: Date.now().toString(),
        title: newAnnouncement.title.trim(),
        content: newAnnouncement.content.trim(),
        createdAt: new Date(),
        active: true
      },
      ...prev
    ]);
    setNewAnnouncement({ title: '', content: '' });
  };

  const handleRemoveAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  const handleAddStory = () => {
    if (!newStoryCaption.trim()) return;
    setStories(prev => [
      {
        id: Date.now().toString(),
        caption: newStoryCaption.trim(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      ...prev
    ]);
    setNewStoryCaption('');
  };

  const handleRemoveStory = (id: string) => {
    setStories(prev => prev.filter(s => s.id !== id));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !mokebId) return;

    if (!selectedRouteId) {
      alert("انتخاب مسیر پیاده‌روی الزامی است. لطفا مسیر مورد نظر خود را انتخاب کنید.");
      return;
    }

    setSubmitting(true);
    
    try {
      const combinedManagerName = `${formData.respFirstName.trim()} ${formData.respLastName.trim()}`.trim();
      
      await updateDoc(doc(db, 'mokebs', mokebId), {
        // Group 1
        avatarUrl: formData.avatarUrl,
        lat: formData.lat ? parseFloat(formData.lat) : null,
        lng: formData.lng ? parseFloat(formData.lng) : null,
        galleryUrls: selectedPhotos,

        // Group 2
        staffList,
        orgChartDesc: formData.orgChartDesc,
        orgChartImgUrl: formData.orgChartImgUrl,

        // Group 3
        managerName: combinedManagerName || mokeb?.managerName || '',
        phone: formData.respPhone || mokeb?.phone || '',
        respFirstName: formData.respFirstName,
        respLastName: formData.respLastName,
        respPhone: formData.respPhone,
        responsibleList,
        showContactInfoPublicly: formData.showContactInfoPublicly,

        // Group 4
        address: formData.address,
        routeId: selectedRouteId || null,
        amoodNumber: amoodNumber ? parseInt(amoodNumber) : null,
        detailedDescription: formData.detailedDescription,
        goalsDescription: formData.goalsDescription,

        // Group 5
        selectedServices,
        exactServices: formData.exactServices,
        
        // Group 7 (Stories & Announcements)
        announcements,
        stories,

        updatedAt: serverTimestamp()
      });
      
      alert('اطلاعات شناسنامه موکب شما با موفقیت ذخیره و در سامانه فعال گردید.');
      try {
        safeStorage.removeItem('edit_mokeb_draft_' + mokebId);
      } catch (e) {}
      if (fromParam === 'pwa') {
        navigate('/pwa?tab=dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `mokebs/${mokebId}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex justify-center items-center h-[50vh]" dir="rtl">
        <span className="text-slate-500 font-bold">درحال بارگذاری فرم کاربری...</span>
      </div>
    );
  }

  if (!user || !profile || !mokeb) return <Navigate to="/login" />;

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen shadow-xl border-x border-slate-200 pb-24 relative flex flex-col font-sans" dir="rtl">
      
      {/* Mobile Top App Bar */}
      <div className="bg-[#007f5f] text-white p-4 sticky top-0 z-30 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => {
              if (fromParam === 'pwa') navigate('/pwa?tab=dashboard') 
              else navigate('/dashboard')
            }} 
            className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180 text-amber-300" />
          </button>
          <div className="space-y-0.5">
            <h1 className="text-sm font-black tracking-tight">شناسنامه تخصصی موکب</h1>
            <p className="text-[9px] text-emerald-100 font-bold truncate max-w-[150px]">{mokeb.name}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4">
        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">

        {/* 🗺️ GROUP 1: موقعیت نقشه موکب، آلبوم تصاویر و جلوه خدمت‌رسانی */}
        <Card className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-[#1a1c2c] text-white p-5">
            <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-lg bg-amber-500/10 text-amber-400 items-center justify-center font-mono text-xs">۱</span>
              موقعیت نقشه موکب، آلبوم تصاویر و جلوه خدمت‌رسانی
            </CardTitle>
            <p className="text-slate-400 text-[11px] mt-1 font-medium font-sans">
              تعیین دقیق نقطه استقرار روی نقشه گوگل جهت مسیریابی زائران، به همراه آلبوم عکاسی جلوه‌های خدمت‌رسانی.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            {/* Map point details */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-500" />
                مختصات جغرافیایی موکب (جهت ترسیم دقیق روی نقشه تعاملی)
              </h4>
              <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                مختصات را می‌توانید به راحتی از نگه داشتن انگشت روی نقشه گوگل مپ در گوشی همراه خود کپی کرده و در کادرهای زیر جایگذاری کنید.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 block">عرض جغرافیایی (Latitude) *</label>
                  <Input 
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

            {/* Avatar URL */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Image className="w-4 h-4 text-purple-500" />
                آواتار / لوگوی اختصاصی موکب
              </h4>
              <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                آدرس اینترنتی (URL) تصویر لوگو یا نشان اختصاصی موکب خود را وارد نمایید. این تصویر در پروفایل و استوری‌های شما نمایش داده می‌شود.
              </p>
              <Input 
                name="avatarUrl" 
                value={formData.avatarUrl} 
                onChange={handleChange} 
                dir="ltr" 
                className="font-mono text-xs bg-white border-slate-200 rounded-xl focus:border-amber-400"
                placeholder="https://example.com/logo.png" 
              />
              {formData.avatarUrl && (
                <div className="mt-2 flex justify-center">
                  <img src={formData.avatarUrl} alt="Avatar Preview" className="w-16 h-16 rounded-full border-2 border-slate-200 object-cover" />
                </div>
              )}
            </div>

            {/* Photo Gallery & Album */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Image className="w-4 h-4 text-blue-500" />
                نگارخانه مصور و آلبوم تصاویر خدمت‌رسانی موکب
              </h4>
              <p className="text-[11px] text-slate-500 font-sans">
                برای آلبوم کارت موکب خود، از میان تصاویر پیش‌فرض زیر انتخاب کنید یا آدرس تصویر اختصاصی موردنظر خود را اضافه نمایید.
              </p>

              {/* UNsplash mock photos checklist */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {PHOTO_PRESETS.map((p) => {
                  const isChecked = selectedPhotos.includes(p.url);
                  return (
                    <div 
                      key={p.id}
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

              {/* Add custom URL */}
              <div className="bg-slate-50/40 p-4 rounded-xl border border-slate-100 space-y-3">
                <label className="text-[11px] font-bold text-slate-600 block">افزودن آدرس تصویر دلخواه دیگر (URL مستقیم):</label>
                <div className="flex gap-2">
                  <Input 
                    value={customPhotoUrl}
                    onChange={e => setCustomPhotoUrl(e.target.value)}
                    placeholder="https://example.com/images/mokeb-view.jpg"
                    dir="ltr"
                    className="bg-white border-slate-200 text-xs rounded-xl flex-1"
                  />
                  <Button 
                    type="button" 
                    onClick={handleAddCustomPhoto}
                    className="bg-[#1a1c2c] hover:bg-slate-800 text-white rounded-xl text-xs font-bold px-4 shrink-0"
                  >
                    <Camera className="w-3.5 h-3.5 ml-1.5" />
                    ذخیره در آلبوم
                  </Button>
                </div>

                {/* Listing of currently selected custom photos */}
                {selectedPhotos.filter(u => !PHOTO_PRESETS.some(p => p.url === u)).length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[10px] font-bold text-slate-400">تصاویر اختصاصی افزوده شده:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedPhotos.filter(u => !PHOTO_PRESETS.some(p => p.url === u)).map((url, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-mono">
                          <span className="truncate max-w-[200px]" dir="ltr">{url}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemovePhoto(url)} 
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            حذف
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
            <p className="text-slate-400 text-[11px] mt-1 font-medium font-sans">
              ترسیم ساختار چارت سازمانی، تشریح نقش‌ها و معرفی اسامی خادمان مستقر در ایستگاه‌های مختلف موکب.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            {/* Org Chart text explanation */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">چارت سازمانی و ساختار هدایت موکب:</label>
              <Textarea 
                name="orgChartDesc"
                value={formData.orgChartDesc}
                onChange={handleChange}
                rows={2}
                className="text-xs bg-white border-slate-200 rounded-xl leading-relaxed"
                placeholder="توضیحات کوتاهی در مورد ساختار کارگروه‌ها، تشکیلات، چارت سازمانی و تفکیک وظایف ارائه دهید..."
              />
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-600 block">آدرس تصویر چارت سازمانی (در صورت تمایل به بارگذاری گرافیکی - URL):</label>
              <Input 
                name="orgChartImgUrl"
                value={formData.orgChartImgUrl}
                onChange={handleChange}
                dir="ltr"
                placeholder="https://example.com/org-chart.png"
                className="text-xs bg-white border-slate-200 rounded-xl"
              />
            </div>

            {/* Staff list generator */}
            <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                <Users className="w-4 h-4 text-purple-600" />
                معرفی تک تک خادمین ثابت و شیفتی موکب
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
                  <label className="text-[10px] font-bold text-slate-500">مسئولیت / نقش او در چارت سازمانی</label>
                  <div className="flex gap-2">
                    <Input 
                      value={newStaffRole} 
                      onChange={e => setNewStaffRole(e.target.value)}
                      placeholder="مثال: معاون امور بهداشتی، آشپز، تامین برق و موتورآلات"
                      className="bg-white border-slate-200 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5">
                  <input 
                    type="checkbox" 
                    id="newStaffShowContact" 
                    checked={newStaffShowContact}
                    onChange={(e) => setNewStaffShowContact(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                  />
                  <label htmlFor="newStaffShowContact" className="text-[9px] text-slate-700 font-extrabold cursor-pointer select-none">
                    نمایش عمومی اطلاعات در سایت
                  </label>
                </div>
                <Button 
                  type="button" 
                  onClick={handleAddStaff}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shrink-0 px-4 h-9"
                >
                  <Plus className="w-3.5 h-3.5 ml-1" />
                  افزودن خادم
                </Button>
              </div>

              {/* Staff output list tags */}
              {staffList.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {staffList.map((st, i) => {
                    const [name, role, visibility] = st.split('|').map(s => s.trim());
                    return (
                      <div key={i} className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1 text-xs">
                        <span className="font-bold text-slate-800">{name}</span>
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-semibold">{role || 'خادم موکب'}</span>
                        {visibility && (
                          <span className={`text-[8.5px] px-1.5 py-0.5 rounded-full font-bold ${visibility === 'نمایش عمومی' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                            {visibility}
                          </span>
                        )}
                        <button 
                          type="button" 
                          onClick={() => handleRemoveStaff(i)}
                          className="text-red-400 hover:text-red-600 p-0.5 rounded-full transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-4 text-xs text-slate-400 font-sans">
                  تاکنون هیچ معرفی کادری ثبت نشده است. نام خادمین و نقش آنها را برای تکمیل در شناسنامه بالا وارد نمایید.
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
            <p className="text-slate-400 text-[11px] mt-1 font-medium font-sans">
              درج دقیق نام، نام خانوادگی و شماره تماس معتبرِ فرد یا مجموعه مسئولین هماهنگی، جهت برقراری ارتباط سریع مدیریت و زوار.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">

            {/* Primary Responsible Person */}
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
                    placeholder="مثال: علیرضا"
                    className="text-xs rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600">نام خانوادگی مسئول *</label>
                  <Input 
                    required
                    name="respLastName"
                    value={formData.respLastName}
                    onChange={handleChange}
                    placeholder="مثال: موسوی کربلایی"
                    className="text-xs rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600">شماره مستقیم تماس مسئول *</label>
                  <Input 
                    required
                    name="respPhone"
                    value={formData.respPhone}
                    onChange={handleChange}
                    dir="ltr"
                    placeholder="مثال: 09121234567"
                    className="text-xs rounded-xl border-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
              <input 
                type="checkbox" 
                id="showContactInfoPub" 
                checked={formData.showContactInfoPublicly}
                onChange={(e) => setFormData(prev => ({ ...prev, showContactInfoPublicly: e.target.checked }))}
                className="mt-1 rounded border-amber-300 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="showContactInfoPub" className="text-[11px] text-amber-900 font-bold leading-relaxed cursor-pointer">
                موافقم اطلاعات تماس اصلی (نام مدیر و شماره تلفن) جهت ارتباط زائرین در صفحه عمومی موکب نمایش داده شود. (توصیه می‌شود جهت هماهنگی بهتر زائران تایید کنید)
              </label>
            </div>

            {/* Secondary/Alternative Responsible Persons */}
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
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 px-4"
                    >
                      <Plus className="w-3.5 h-3.5 ml-1" />
                      افزودن مسئول
                    </Button>
                  </div>
                </div>
              </div>

              {/* Responsible output list */}
              {responsibleList.length > 0 ? (
                <div className="overflow-hidden border border-slate-200 bg-white rounded-xl">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <tr>
                        <th className="p-3">نام و نام خانوادگی مسئول</th>
                        <th className="p-3">شماره تماس</th>
                        <th className="p-3 text-left">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {responsibleList.map((st, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-800">{st.firstName} {st.lastName}</td>
                          <td className="p-3 font-mono text-slate-600">{st.phone}</td>
                          <td className="p-3 text-left">
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
              ) : (
                <p className="text-center text-[11px] text-slate-400 py-2">
                  مسئول هماهنگی دیگری ثبت نشده است. (اطلاعات فرد مسئول اصلی موکب در فرم کفایت می‌کند).
                </p>
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
            <p className="text-slate-400 text-[11px] mt-1 font-medium font-sans">
              جزئیات توصیفی از مکان مستقر، همراه با اهداف خلاقانه و شرح ماموریت خدمت‌رسانی که زائران باید بدانند.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">

            {/* Physcial address */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">انتخاب مسیر پیاده‌روی (اختیاری)</label>
                  <select 
                    className="w-full text-xs font-sans bg-white border-slate-200 rounded-xl h-10 px-3 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                    value={selectedRouteId}
                    onChange={(e) => setSelectedRouteId(e.target.value)}
                  >
                    <option value="">-- لطفا یک مسیر را انتخاب کنید --</option>
                    {walkRoutes.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">شماره عمود مسیر (در صورت استقرار در مسیر)</label>
                  <Input 
                    type="number"
                    value={amoodNumber}
                    onChange={e => setAmoodNumber(e.target.value)}
                    className="text-xs font-mono bg-white border-slate-200 rounded-xl focus:border-amber-400"
                    placeholder="مثال: 450" 
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">آدرس دقیق استقرار موکب *</label>
                <Textarea 
                  required 
                  name="address" 
                  value={formData.address} 
                  onChange={handleChange} 
                  rows={2}
                  className="font-sans text-xs bg-white border-slate-200 rounded-xl leading-relaxed focus:border-amber-400"
                  placeholder="مثال: مسیرهای تردد، ایستگاه 450 - مجاور مرکز هلال احمر" 
                />
              </div>
            </div>

            {/* Detailed description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">توضیحات تکمیلی، سرگذشت و روایت موکب:</label>
              <Textarea 
                name="detailedDescription" 
                value={formData.detailedDescription} 
                onChange={handleChange} 
                rows={3}
                className="font-sans text-xs bg-white border-slate-200 rounded-xl leading-relaxed focus:border-amber-400"
                placeholder="در این قسمت سرگذشت تاسیس موکب، شعار سال جاری، پیام‌های خوش‌آمد گویی اختصاصی به زائرین و هر توضیح تکمیلی سودمند دیگر را درج نمایید..." 
              />
            </div>

            {/* Goals representation */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">اهداف و آرمان‌های اصلی خدمت‌رسانی:</label>
              <Textarea 
                name="goalsDescription" 
                value={formData.goalsDescription} 
                onChange={handleChange} 
                rows={2}
                className="font-sans text-xs bg-white border-slate-200 rounded-xl leading-relaxed focus:border-amber-400"
                placeholder="اهداف عالیه، شعار خدمت و چشم‌اندازهای اجرایی موکب را شرح دهید (مثال: ترویج فرهنگ ناب اهل‌بیت، تکریم همسایگان عراقی، ارتقاء بهداشت زوار)..." 
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
            <p className="text-slate-400 text-[11px] mt-1 font-medium font-sans">
              انتخاب دسته‌بندی و تشریح تسهیلات اسکان صلواتی، توزیع چای یا غذا، خدمات درمانی و فوریت‌های فنی.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6" dir="rtl">

            {/* Dynamic input field to add new services */}
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

            {/* Custom complementary text on facilities */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-[#1a1c2c] block">تشریح تفصیلی نوع و کیفیت تسهیلات رفاهی ارائه شده:</label>
              <Textarea 
                name="exactServices" 
                value={formData.exactServices} 
                onChange={handleChange} 
                rows={2}
                className="font-sans text-xs bg-white border-slate-200 rounded-xl leading-relaxed"
                placeholder="توضیحات تکمیلی در مورد نحوه توزیع خدمات رفاهی (مثلا: اسکان زنانه دارای بخش مجهز سرمایشی، خدمات درمانی با حضور پزشک خانم و غیره)..." 
              />
            </div>

          </CardContent>
        </Card>

        {/* ⭐ GROUP 6: نظرات و امتیازات مردمی */}
        {reviews.length > 0 && (
          <Card className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-[#1a1c2c] text-white p-5">
              <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2">
                <span className="flex h-6 w-6 rounded-lg bg-amber-500/10 text-amber-400 items-center justify-center font-mono text-xs">۶</span>
                نظرات و امتیازات مردمی به موکب شما
              </CardTitle>
              <p className="text-slate-400 text-[11px] mt-1 font-medium font-sans">
                زائران پس از استفاده از خدمات موکب شما، نظرات و امتیازات خود را در اینجا ثبت می‌کنند.
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                <div className="text-4xl font-black text-amber-500">
                  {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}
                </div>
                <div className="space-y-1">
                  <div className="flex gap-1 text-amber-400">
                    {'★'.repeat(Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length))}
                    {'☆'.repeat(5 - Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length))}
                  </div>
                  <div className="text-xs text-slate-500 font-bold">از مجموع {reviews.length} رای ثبت شده</div>
                </div>
              </div>
              
              <div className="space-y-3 pt-2">
                {reviews.map((r) => (
                  <div key={r.id} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-xs text-slate-800">{r.reviewerName || 'زائر ناشناس'}</span>
                      <span className="text-amber-500 text-xs">{'★'.repeat(r.rating)}</span>
                    </div>
                    {r.comment && (
                      <p className="text-[11px] text-slate-600 font-sans leading-relaxed">{r.comment}</p>
                    )}
                    <div className="text-[9px] text-slate-400 mt-2 font-mono">
                      {new Date(r.createdAt?.toDate ? r.createdAt.toDate() : Date.now()).toLocaleDateString('fa-IR')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 📢 GROUP 7: اطلاعیه‌ها و استوری‌ها */}
        <Card className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-[#1a1c2c] text-white p-5">
            <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2">
              <span className="flex h-6 w-6 rounded-lg bg-indigo-500/10 text-indigo-400 items-center justify-center font-mono text-xs">۷</span>
              اطلاعیه‌ها و استوری‌های زنده
            </CardTitle>
            <p className="text-slate-400 text-[11px] mt-1 font-medium font-sans">
              در این بخش می‌توانید اطلاعیه‌های مهم (متنی) و استوری‌های روزانه خود را برای زائران منتشر کنید.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            
            {/* Announcements Section */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                ثبت اطلاعیه جدید
              </h4>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                <Input 
                  placeholder="عنوان اطلاعیه (مثال: توزیع غذای گرم)" 
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                  className="font-sans text-xs bg-white"
                />
                <Textarea 
                  placeholder="متن کامل اطلاعیه..."
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                  rows={2}
                  className="font-sans text-xs bg-white"
                />
                <Button 
                  type="button" 
                  onClick={handleAddAnnouncement}
                  className="w-full sm:w-auto text-xs bg-blue-600 hover:bg-blue-700"
                >
                  افزودن اطلاعیه
                </Button>
              </div>

              {/* Announcements List */}
              {announcements.length > 0 && (
                <div className="space-y-2 mt-4">
                  {announcements.map((a) => (
                    <div key={a.id} className="flex justify-between items-start p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                      <div>
                        <h5 className="font-bold text-xs text-slate-800">{a.title}</h5>
                        <p className="text-[11px] text-slate-600 mt-1">{a.content}</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveAnnouncement(a.id)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* Stories Section */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                ثبت استوری (وضعیت لحظه‌ای)
              </h4>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                <Input 
                  placeholder="متن استوری شما (کوتاه و مختصر)" 
                  value={newStoryCaption}
                  onChange={(e) => setNewStoryCaption(e.target.value)}
                  className="font-sans text-xs bg-white"
                />
                <Button 
                  type="button" 
                  onClick={handleAddStory}
                  className="w-full sm:w-auto text-xs bg-purple-600 hover:bg-purple-700"
                >
                  افزودن استوری (۲۴ ساعته)
                </Button>
              </div>

              {/* Stories List */}
              {stories.length > 0 && (
                <div className="space-y-2 mt-4">
                  {stories.map((s) => (
                    <div key={s.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 border-2 border-purple-500 p-0.5 shrink-0 flex items-center justify-center">
                          <Image className="w-4 h-4 text-purple-600" />
                        </div>
                        <p className="text-[11px] font-bold text-slate-800 line-clamp-2">{s.caption}</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveStory(s.id)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Submit Actions Button Panel */}
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row gap-3">
          <Button 
            type="submit" 
            className="w-full bg-[#1a1c2c] hover:bg-slate-800 text-white transition-colors py-3.5 rounded-xl font-bold font-sans text-sm h-12 shadow-md hover:shadow-lg" 
            disabled={submitting}
          >
            {submitting ? 'در حال ثبت...' : 'ثبت شناسنامه'}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            className="w-full bg-white hover:bg-slate-100 border-slate-200 rounded-xl h-12 text-slate-600 text-xs font-bold" 
            onClick={() => {
              if (fromParam === 'pwa') navigate('/pwa?tab=dashboard') 
              else navigate('/dashboard')
            }}
          >
            انصراف و بازگشت
          </Button>
        </div>

        </form>
      </div> {/* extra end from flex-1 wrapper */}
    </div>
  );
}
