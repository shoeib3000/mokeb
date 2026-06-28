import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from '../lib/db';
import { db, handleFirestoreError, OperationType } from '../lib/db';
import { Mokeb } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { 
  ArrowLeft, CheckCircle, XCircle, Info, Phone, 
  MapPin, HeartHandshake, FileText, Image as ImageIcon, Users, CheckSquare, Sparkles, PlaySquare
} from 'lucide-react';

export default function AdminMokebViewPage() {
  const { user, profile, loading } = useAuth();
  const { mokebId } = useParams();
  const navigate = useNavigate();
  const [mokeb, setMokeb] = useState<Mokeb | null>(null);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const fetchMokeb = async () => {
      if (!profile?.isAdmin || !mokebId) return;
      setFetching(true);
      try {
        const docRef = doc(db, 'mokebs', mokebId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMokeb({ id: docSnap.id, ...(docSnap.data() as any) } as Mokeb);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `mokebs/${mokebId}`);
      } finally {
        setFetching(false);
      }
    };
    if (!loading) {
      fetchMokeb();
    }
  }, [mokebId, profile, loading]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!mokeb) return;
    setMokeb({ ...mokeb, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (statusOverride?: Mokeb['status']) => {
    if (!mokeb) return;
    setSubmitting(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      if (typeof mokeb.utm === 'string' && mokeb.utm.trim()) {
        const parts = mokeb.utm.split(',');
        if (parts.length === 2) {
          const parsedLat = parseFloat(parts[0].trim());
          const parsedLng = parseFloat(parts[1].trim());
          if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
            lat = parsedLat;
            lng = parsedLng;
          }
        }
      }

      const updateData: any = {
        name: mokeb.name,
        managerName: mokeb.managerName,
        phone: mokeb.phone,
        emergencyPhone: mokeb.emergencyPhone || '',
        nationalId: mokeb.nationalId || '',
        fatherName: mokeb.fatherName || '',
        description: mokeb.description || '',
        address: mokeb.address || '',
        exactServices: mokeb.exactServices || '',
        responsiblePersons: mokeb.responsiblePersons || '',
        showContactInfoPublicly: !!mokeb.showContactInfoPublicly,
        routeId: mokeb.routeId || null,
        amoodNumber: mokeb.amoodNumber ? parseInt(String(mokeb.amoodNumber)) : null,
        province: mokeb.province || '',
        county: mokeb.county || '',
        city: mokeb.county || '', // Seamless query support
        utm: mokeb.utm || '',
        lat: lat,
        lng: lng,
        updatedAt: serverTimestamp()
      };
      
      if (statusOverride) {
        updateData.status = statusOverride;
      }

      await updateDoc(doc(db, 'mokebs', mokeb.id), updateData);
      
      if (statusOverride) {
         setMokeb({ ...mokeb, status: statusOverride });
         alert(`وضعیت موکب به ${statusOverride === 'active' ? 'فعال' : 'رد شده'} تغییر یافت.`);
      } else {
         alert("اطلاعات با موفقیت بروزرسانی شد");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `mokebs/${mokeb.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProCardStatus = async (proStatus: 'none' | 'pending' | 'approved' | 'rejected') => {
    if (!mokeb) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'mokebs', mokeb.id), {
        proCardRequestStatus: proStatus,
        updatedAt: serverTimestamp()
      });
      setMokeb({ ...mokeb, proCardRequestStatus: proStatus });
      alert('وضعیت کارت معرفی با موفقیت بروزرسانی شد.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `mokebs/${mokeb.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStoryStatus = async (storyStatus: 'none' | 'pending' | 'approved' | 'rejected') => {
    if (!mokeb) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'mokebs', mokeb.id), {
        storyRequestStatus: storyStatus,
        updatedAt: serverTimestamp()
      });
      setMokeb({ ...mokeb, storyRequestStatus: storyStatus });
      alert('وضعیت درخواست استوری با موفقیت بروزرسانی شد.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `mokebs/${mokeb.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!user || !profile || !profile.isAdmin) return <Navigate to="/dashboard" />;

  if (fetching) return <div className="p-10 text-center text-slate-500 font-sans">در حال بارگزاری...</div>;
  if (!mokeb) return <div className="p-10 text-center text-red-500 font-sans">موکب یافت نشد مجدد تلاش کنید</div>;

  const TABS = [
    { id: 'general', label: 'اطلاعات عمومی', icon: <Info className="w-4 h-4" /> },
    { id: 'contact', label: 'تماس و آدرس', icon: <Phone className="w-4 h-4" /> },
    { id: 'services', label: 'خدمات رفاهی', icon: <HeartHandshake className="w-4 h-4" /> },
    { id: 'team', label: 'تیم اجرایی', icon: <Users className="w-4 h-4" /> },
    { id: 'media', label: 'رسانه و مدارک', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'proCard', label: 'کارت حرفه‌ای موکب', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'storiesReq', label: 'فعال‌سازی استوری', icon: <PlaySquare className="w-4 h-4" /> },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl font-sans" dir="rtl">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-6 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-100 rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1 leading-tight">بررسی پرونده موکب</h1>
            <p className="text-sm text-slate-500 font-semibold">{mokeb.name}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 font-bold tracking-widest flex items-center gap-2 shadow-sm">
              <span className="text-[10px] text-slate-400">کد رهگیری: </span>
              {mokeb.trackingCode || '-'}
            </span>

            <span className={`text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm flex items-center gap-1.5
              ${mokeb.status === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                mokeb.status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                'bg-amber-100 text-amber-700 border border-amber-200'}
            `}>
              {mokeb.status === 'active' ? <CheckCircle className="w-3.5 h-3.5" /> : null}
              {mokeb.status === 'active' ? 'تایید و فعال شده' :
               mokeb.status === 'rejected' ? 'رد شده' : 'در حال بررسی (نیازمند تایید)'}
            </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm sticky top-24">
            <h3 className="text-xs font-bold text-slate-400 mb-3 px-3">بخش‌های پرونده</h3>
            <div className="flex flex-col gap-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
                    ${activeTab === tab.id 
                      ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'}`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div className="mt-8 pt-4 border-t border-slate-100 p-2 text-center">
              <Phone className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-[11px] text-slate-400 leading-relaxed font-bold">
                جهت هرگونه ابهام می‌توانید مستقیماً با مدیریت موکب تماس بگیرید.
              </p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <Card className="rounded-3xl shadow-sm border-slate-200 overflow-hidden bg-white/50 backdrop-blur-sm">
            <form onSubmit={(e) => e.preventDefault()} className="p-6 md:p-8 min-h-[500px]">
              
              {/* Tab 1: General Info */}
              {activeTab === 'general' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <Info className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">اطلاعات عمومی موکب</h2>
                      <p className="text-xs text-slate-500 mt-1">مشخصات اولیه و معرفی حقوقی موکب</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1"><CheckSquare className="w-3 h-3 text-emerald-500" /> نام موکب</label>
                      <Input name="name" value={mokeb.name} onChange={handleChange} className="bg-slate-50 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">نام و نام خانوادگی مدیر</label>
                      <Input name="managerName" value={mokeb.managerName} onChange={handleChange} className="bg-slate-50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">کد ملی</label>
                      <Input name="nationalId" value={mokeb.nationalId || ''} onChange={handleChange} dir="ltr" className="bg-slate-50 text-left font-mono" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">نام پدر</label>
                      <Input name="fatherName" value={mokeb.fatherName || ''} onChange={handleChange} className="bg-slate-50" />
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700">توضیحات کوتاه معرفی موکب</label>
                    <Textarea 
                      name="description" 
                      value={mokeb.description || ''} 
                      onChange={handleChange}
                      className="bg-slate-50 min-h-[100px] leading-relaxed"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700">توضیحات تکمیلی اهداف و چشم‌انداز (در صورت وجود)</label>
                    <Textarea 
                      name="detailedDescription" 
                      value={mokeb.detailedDescription || ''} 
                      onChange={handleChange}
                      className="bg-slate-50 min-h-[100px] leading-relaxed text-sm text-slate-600"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Contact & Address */}
              {activeTab === 'contact' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">اطلاعات تماس و استقرار</h2>
                      <p className="text-xs text-slate-500 mt-1">آدرس دقیق و مسیرهای ارتباطی</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">شماره موبایل ارتباطی</label>
                      <Input name="phone" value={mokeb.phone} onChange={handleChange} dir="ltr" className="bg-slate-50 text-left font-mono font-bold text-lg text-indigo-700" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">شماره موبایل اضطراری (پشتیبان)</label>
                      <Input name="emergencyPhone" value={mokeb.emergencyPhone || ''} onChange={handleChange} dir="ltr" className="bg-slate-50 text-left font-mono" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">استان محل استقرار</label>
                      <Input name="province" value={mokeb.province || ''} onChange={handleChange} className="bg-slate-50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">شهرستان / شهر محل استقرار</label>
                      <Input name="county" value={mokeb.county || ''} onChange={handleChange} className="bg-slate-50" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-slate-700">موقعیت نقشه UTM (طول،عرض جغرافیایی)</label>
                      <Input name="utm" value={mokeb.utm || ''} onChange={handleChange} dir="ltr" placeholder="مثال: 32.4279, 48.2435" className="bg-slate-50 text-center font-mono" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">شناسه مسیر</label>
                      <Input name="routeId" value={mokeb.routeId || ''} onChange={handleChange} className="bg-slate-50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">شماره عمود</label>
                      <Input name="amoodNumber" type="number" value={mokeb.amoodNumber || ''} onChange={handleChange} className="bg-slate-50" />
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-red-500" /> آدرس دقیق استقرار موکب</label>
                    <Textarea 
                      name="address" 
                      value={mokeb.address || ''} 
                      onChange={handleChange}
                      className="bg-slate-50 min-h-[100px] leading-relaxed font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Tab 3: Services */}
              {activeTab === 'services' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <HeartHandshake className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">تسهیلات و خدمات رفاهی صلواتی</h2>
                      <p className="text-xs text-slate-500 mt-1">سرویس‌هایی که توسط موکب ارائه می‌شود</p>
                    </div>
                  </div>

                  {mokeb.selectedServices && mokeb.selectedServices.length > 0 && (
                    <div className="space-y-3 pb-6 border-b border-slate-100">
                      <label className="text-xs font-bold text-slate-700 block">برچسب‌های طلایی خدمات (ثبت شده)</label>
                      <div className="flex flex-wrap gap-2">
                        {mokeb.selectedServices.map((srv, idx) => (
                           <div key={idx} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-bold shadow-sm">
                             {srv}
                           </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-slate-700">شرح تفصیلی نحوه خدمت‌رسانی</label>
                    <Textarea 
                      name="exactServices" 
                      value={mokeb.exactServices || ''} 
                      onChange={handleChange}
                      className="bg-slate-50 min-h-[150px] leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* Tab 4: Team */}
              {activeTab === 'team' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">کادر اجرایی و مسئولین</h2>
                      <p className="text-xs text-slate-500 mt-1">معرفی اعضای هیئت امنا و خادمین اصلی</p>
                    </div>
                  </div>

                  {mokeb.staffList && mokeb.staffList.length > 0 && (
                    <div className="space-y-3 pb-6 border-b border-slate-100">
                      <label className="text-xs font-bold text-slate-700 block">لیست عناوین مسئولین ثبت‌شده</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {mokeb.staffList.map((stf, idx) => {
                          const parts = stf.split('|').map(s => s.trim());
                          return (
                            <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-1">
                              <span className="text-sm font-bold text-slate-800">{parts[0]}</span>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded shadow-sm self-start">{parts[1] || 'خادم'}</span>
                                {parts[2] && (
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${parts[2] === 'نمایش عمومی' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {parts[2]}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-slate-700">توضیحات تکمیلی کادر اجرایی (رابطین شهرستان‌ها و ...)</label>
                    <Textarea 
                      name="responsiblePersons" 
                      value={mokeb.responsiblePersons || ''} 
                      onChange={handleChange}
                      className="bg-slate-50 min-h-[150px] leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* Tab 5: Media & Docs */}
              {activeTab === 'media' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">اسناد، مدارک و رسانه‌ها</h2>
                      <p className="text-xs text-slate-500 mt-1">تاییدیه صرب موکب و پرونده‌های تصویری پیوست</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-700 block border-b border-slate-100 pb-2">سند پروانه و مجوز (در صورت دارا بودن)</label>
                    <div className="bg-rose-50/50 border border-slate-200 p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
                      <FileText className="w-12 h-12 text-slate-300" />
                      {mokeb.documentUrl ? (
                         <div className="space-y-3">
                           <p className="text-sm font-bold text-slate-700">مدارک شناسایی موکب ضمیمه شده است.</p>
                           <a href={mokeb.documentUrl} target="_blank" rel="noreferrer" className="inline-block bg-white text-blue-600 border border-slate-200 shadow-sm px-6 py-2.5 rounded-xl font-bold text-sm hover:shadow-md transition-all">
                             مشاهده و دریافت فایل مدرک ضمیمه
                           </a>
                         </div>
                      ) : (
                         <p className="text-sm font-bold text-slate-400">سندی آپلود نشده است</p>
                      )}
                    </div>
                  </div>

                  {mokeb.galleryUrls && mokeb.galleryUrls.length > 0 && (
                    <div className="space-y-4 pt-6 border-t border-slate-100 mt-6">
                       <label className="text-xs font-bold text-slate-700 block">گالری تصاویر پیوست شده</label>
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                         {mokeb.galleryUrls.map((url, idx) => (
                           <div key={idx} className="aspect-square bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative group">
                              <img src={url} alt="Mokeb Media" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              <a href={url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-slate-900/60 hidden group-hover:flex items-center justify-center text-white text-xs font-bold backdrop-blur-sm">
                                مشاهده کامل
                              </a>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 6: Pro Card Request */}
              {activeTab === 'proCard' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">بررسی درخواست کارت معرفی حرفه‌ای</h2>
                      <p className="text-xs text-slate-500 mt-1">مدیریت درخواست ساخت کارت گرافیکی برای نمایش عمومی موکب</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center shadow-inner space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow mb-2">
                       <Sparkles className={`w-8 h-8 ${mokeb.proCardRequestStatus === 'approved' ? 'text-indigo-600' : mokeb.proCardRequestStatus === 'pending' ? 'text-amber-500' : mokeb.proCardRequestStatus === 'rejected' ? 'text-rose-500' : 'text-slate-300'}`} />
                    </div>
                    
                    <h3 className="text-sm font-bold text-slate-800">وضعیت درخواست:</h3>
                    
                    {!mokeb.proCardRequestStatus || mokeb.proCardRequestStatus === 'none' ? (
                      <div className="text-slate-500 font-bold bg-white mx-auto max-w-sm px-6 py-3 rounded-xl border border-slate-100 shadow-sm text-sm">
                        موردی برای بررسی وجود ندارد. خادم تاکنون درخواستی ثبت نکرده است.
                      </div>
                    ) : mokeb.proCardRequestStatus === 'pending' ? (
                      <div className="text-amber-700 font-bold bg-amber-50 mx-auto max-w-sm px-6 py-3 rounded-xl border border-amber-200 shadow-sm text-sm">
                        در انتظار بررسی توسط مدیریت
                      </div>
                    ) : mokeb.proCardRequestStatus === 'approved' ? (
                      <div className="text-emerald-700 font-bold bg-emerald-50 mx-auto max-w-sm px-6 py-3 rounded-xl border border-emerald-200 shadow-sm text-sm">
                        تایید شده (کارت گرافیکی فعال است)
                      </div>
                    ) : (
                      <div className="text-rose-700 font-bold bg-rose-50 mx-auto max-w-sm px-6 py-3 rounded-xl border border-rose-200 shadow-sm text-sm">
                        درخواست رد شده است
                      </div>
                    )}

                    {/* Action buttons specifically for Pro Card Status */}
                    {mokeb.proCardRequestStatus && mokeb.proCardRequestStatus !== 'none' && (
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-6 border-t border-slate-200">
                        {mokeb.proCardRequestStatus !== 'approved' && (
                           <Button 
                             onClick={() => handleUpdateProCardStatus('approved')}
                             className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-10 px-6 rounded-xl shadow-md border-none"
                           >
                             <CheckCircle className="w-4 h-4 ml-1.5" />
                             تایید و صدور کارت معرفی
                           </Button>
                        )}
                        {mokeb.proCardRequestStatus !== 'rejected' && mokeb.proCardRequestStatus !== 'none' && (
                           <Button 
                             onClick={() => handleUpdateProCardStatus('rejected')}
                             variant="outline"
                             className="text-rose-600 border-rose-200 hover:bg-rose-50 font-bold h-10 px-6 rounded-xl"
                           >
                             <XCircle className="w-4 h-4 ml-1.5" />
                             رد درخواست
                           </Button>
                        )}
                        {mokeb.proCardRequestStatus === 'approved' && (
                           <Button 
                             onClick={() => handleUpdateProCardStatus('none')}
                             variant="outline"
                             className="text-slate-500 border-slate-300 hover:bg-slate-50 font-bold h-10 px-6 rounded-xl"
                           >
                             حذف کارت (ریست وضعیت)
                           </Button>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* Tab 7: Stories Request */}
              {activeTab === 'storiesReq' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                      <PlaySquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">بررسی درخواست سرویس استوری</h2>
                      <p className="text-xs text-slate-500 mt-1">مدیریت مجوز ارسال استوری‌های ۲۴ ساعته برای موکب</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center shadow-inner space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow mb-2">
                       <PlaySquare className={`w-8 h-8 ${mokeb.storyRequestStatus === 'approved' ? 'text-indigo-600' : mokeb.storyRequestStatus === 'pending' ? 'text-amber-500' : mokeb.storyRequestStatus === 'rejected' ? 'text-rose-500' : 'text-slate-300'}`} />
                    </div>
                    
                    <h3 className="text-sm font-bold text-slate-800">وضعیت درخواست:</h3>
                    
                    {!mokeb.storyRequestStatus || mokeb.storyRequestStatus === 'none' ? (
                      <div className="text-slate-500 font-bold bg-white mx-auto max-w-sm px-6 py-3 rounded-xl border border-slate-100 shadow-sm text-sm">
                        موردی برای بررسی وجود ندارد. خادم تاکنون درخواستی ثبت نکرده است.
                      </div>
                    ) : mokeb.storyRequestStatus === 'pending' ? (
                      <div className="text-amber-700 font-bold bg-amber-50 mx-auto max-w-sm px-6 py-3 rounded-xl border border-amber-200 shadow-sm text-sm">
                        در انتظار بررسی توسط مدیریت
                      </div>
                    ) : mokeb.storyRequestStatus === 'approved' ? (
                      <div className="text-emerald-700 font-bold bg-emerald-50 mx-auto max-w-sm px-6 py-3 rounded-xl border border-emerald-200 shadow-sm text-sm">
                        تایید شده (ارسال استوری فعال است)
                      </div>
                    ) : (
                      <div className="text-rose-700 font-bold bg-rose-50 mx-auto max-w-sm px-6 py-3 rounded-xl border border-rose-200 shadow-sm text-sm">
                        درخواست رد شده است
                      </div>
                    )}

                    {/* Action buttons specifically for Story Status */}
                    {mokeb.storyRequestStatus && mokeb.storyRequestStatus !== 'none' && (
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-6 border-t border-slate-200">
                        {mokeb.storyRequestStatus !== 'approved' && (
                           <Button 
                             onClick={() => handleUpdateStoryStatus('approved')}
                             className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-10 px-6 rounded-xl shadow-md border-none"
                           >
                             <CheckCircle className="w-4 h-4 ml-1.5" />
                             تایید و فعال‌سازی سرویس
                           </Button>
                        )}
                        {mokeb.storyRequestStatus !== 'rejected' && mokeb.storyRequestStatus !== 'none' && (
                           <Button 
                             onClick={() => handleUpdateStoryStatus('rejected')}
                             variant="outline"
                             className="text-rose-600 border-rose-200 hover:bg-rose-50 font-bold h-10 px-6 rounded-xl"
                           >
                             <XCircle className="w-4 h-4 ml-1.5" />
                             رد درخواست
                           </Button>
                        )}
                        {mokeb.storyRequestStatus === 'approved' && (
                           <Button 
                             onClick={() => handleUpdateStoryStatus('none')}
                             variant="outline"
                             className="text-slate-500 border-slate-300 hover:bg-slate-50 font-bold h-10 px-6 rounded-xl"
                           >
                             لغو دسترسی استوری (ریست وضعیت)
                           </Button>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}

            </form>
          </Card>

          {/* Action Bar */}
          <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 p-4 lg:p-6 bg-slate-800 text-white rounded-3xl shadow-xl">
             <div className="flex-1 text-center md:text-right w-full sm:w-auto">
               <h3 className="font-bold text-sm text-slate-100 mb-1">اقدامات مدیریتی</h3>
               <p className="text-[11px] text-slate-400">پس از بررسی دقیق تمام بخش‌ها نسبت به تایید نهایی و صدور مجوز سیستم اقدام فرمایید.</p>
             </div>
             
             <div className="flex flex-wrap md:flex-nowrap gap-3 items-center w-full md:w-auto justify-end">
                <Button 
                   variant="outline" 
                   className="w-full md:w-auto bg-slate-700 border-slate-600 text-white hover:bg-slate-600 hover:text-white" 
                   disabled={submitting} 
                   onClick={() => handleUpdate()}
                >
                   صرفاً ذخیره تغییرات فرم
                </Button>

                {mokeb.status !== 'active' && (
                  <Button 
                     className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg border-none" 
                     disabled={submitting} 
                     onClick={() => handleUpdate('active')}
                  >
                     <CheckCircle className="w-4 h-4 ml-1.5" />
                     تایید سیستم و فعال‌سازی قطعی موکب
                  </Button>
                )}

                {mokeb.status !== 'rejected' && (
                  <Button 
                     className="w-full md:w-auto bg-rose-500 hover:bg-rose-600 text-white shadow-lg border-none" 
                     disabled={submitting} 
                     onClick={() => handleUpdate('rejected')}
                  >
                     <XCircle className="w-4 h-4 ml-1.5" />
                     {mokeb.status === 'active' ? 'تعلیق و غیرفعال‌سازی' : 'رد درخواست'}
                  </Button>
                )}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}

