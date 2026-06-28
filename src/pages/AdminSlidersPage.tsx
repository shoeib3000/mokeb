import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, where } from '../lib/db';
import { db, storage, handleFirestoreError, OperationType } from '../lib/db';
import { ref, uploadBytes, getDownloadURL } from '../lib/db';
import { AppSlider } from '../types';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Trash2, Plus, Image as ImageIcon } from 'lucide-react';

export default function AdminSlidersPage() {
  const { user, profile, loading } = useAuth();
  const [sliders, setSliders] = useState<AppSlider[]>([]);
  const [fetching, setFetching] = useState(true);
  
  // new slider state
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newButtonText, setNewButtonText] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newOrder, setNewOrder] = useState('0');
  const [uploading, setUploading] = useState(false);

  const [hasApprovedMokeb, setHasApprovedMokeb] = useState(false);
  const [checkingMokeb, setCheckingMokeb] = useState(true);

  const fetchSliders = async () => {
    setFetching(true);
    try {
      const q = query(collection(db, 'sliders'), orderBy('order'));
      const snap = await getDocs(q);
      const fetched: AppSlider[] = [];
      snap.forEach(d => fetched.push({ id: d.id, ...(d.data() as any) } as AppSlider));
      setSliders(fetched);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'sliders');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    const checkMokeb = async () => {
      if (!profile) return;
      if (profile.isAdmin) {
        setHasApprovedMokeb(true);
        setCheckingMokeb(false);
        fetchSliders();
        return;
      }
      try {
        const q = query(collection(db, 'mokebs'), where('ownerId', '==', profile.id), where('status', '==', 'active'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setHasApprovedMokeb(true);
          fetchSliders();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingMokeb(false);
      }
    };
    if (!loading) {
      checkMokeb();
    }
  }, [profile, loading]);

  const handleAddSlider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageUrl && !newImageFile) {
        alert("لطفا یک تصویر انتخاب کنید یا آدرس آن را وارد نمایید");
        return;
    }
    setUploading(true);
    try {
      let finalUrl = newImageUrl;
      if (newImageFile) {
        const fileRef = ref(storage, `sliders/${Date.now()}_${newImageFile.name}`);
        const uploadResult = await uploadBytes(fileRef, newImageFile);
        finalUrl = await getDownloadURL(uploadResult.ref);
      }

      await addDoc(collection(db, 'sliders'), {
        title: newTitle,
        subtitle: newSubtitle,
        link: newLink,
        buttonText: newButtonText,
        imageUrl: finalUrl,
        order: Number(newOrder),
        active: true,
        createdAt: serverTimestamp()
      });
      
      setNewTitle('');
      setNewSubtitle('');
      setNewLink('');
      setNewButtonText('');
      setNewImageFile(null);
      setNewImageUrl('');
      setNewOrder(String(sliders.length + 1));
      
      fetchSliders();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sliders');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (sliderId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'sliders', sliderId), {
        active: !currentStatus
      });
      fetchSliders();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sliders/${sliderId}`);
    }
  };

  const handleDelete = async (sliderId: string) => {
    if (!window.confirm("آیا از حذف این اسلایدر اطمینان دارید؟")) return;
    try {
      await deleteDoc(doc(db, 'sliders', sliderId));
      fetchSliders();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sliders/${sliderId}`);
    }
  };

  if (loading || checkingMokeb) return null;
  if (!user || !profile || (!profile.isAdmin && !hasApprovedMokeb)) return <Navigate to="/dashboard" />;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">مدیریت اسلایدر صفحه اصلی</h1>

      <Card className="mb-8 p-6 bg-slate-50 border-slate-100">
        <h2 className="font-bold mb-4 text-slate-700">افزودن اسلایدر جدید</h2>
        <form onSubmit={handleAddSlider} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">عنوان اسلایدر (اختیاری)</label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="مثال: فراخوان ثبت نام موکب" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">متن توضیحات / توصیف اسلایدر (اختیاری)</label>
              <Input value={newSubtitle} onChange={e => setNewSubtitle(e.target.value)} placeholder="متنی جذاب که روی تصویر نمایش داده می‌شود" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">لینک دکمه (اختیاری)</label>
              <Input value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="مثال: /dashboard/mokeb/new" dir="ltr" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">متن دکمه (اختیاری)</label>
              <Input value={newButtonText} onChange={e => setNewButtonText(e.target.value)} placeholder="مثال: ثبت نام فوری (پیش‌فرض: مشاهده جزییات)" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">ترتیب نمایش</label>
              <Input type="number" value={newOrder} onChange={e => setNewOrder(e.target.value)} />
            </div>
          </div>
          
          <div className="space-y-2 p-4 bg-white rounded-xl border border-slate-200">
            <label className="text-sm font-semibold text-slate-700 block mb-2">تصویر اسلایدر *</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <span className="text-xs text-slate-500 mb-1 block">آپلود فایل</span>
                  <Input type="file" accept="image/*" onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                          setNewImageFile(e.target.files[0]);
                          setNewImageUrl('');
                      }
                  }} />
              </div>
              <div>
                  <span className="text-xs text-slate-500 mb-1 block">یا آدرس مستقیم تصویر (URL)</span>
                  <Input value={newImageUrl} onChange={e => {
                      setNewImageUrl(e.target.value);
                      setNewImageFile(null);
                  }} placeholder="https://..." dir="ltr" />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={uploading}>
             {uploading ? 'در حال ثبت...' : <><Plus className="w-4 h-4 ml-2" /> افزودن اسلایدر</>}
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        <h2 className="font-bold text-slate-700">اسلایدرهای موجود</h2>
        {fetching ? (
            <div className="text-center p-8 text-slate-500">در حال دریافت...</div>
        ) : sliders.length === 0 ? (
            <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">هیچ اسلایدری یافت نشد</div>
        ) : (
            <div className="grid grid-cols-1 gap-4">
              {sliders.map(s => (
                  <Card key={s.id} className={`flex flex-col md:flex-row overflow-hidden ${!s.active ? 'opacity-50 grayscale' : ''}`}>
                      <div className="md:w-1/3 bg-slate-100 flex items-center justify-center h-48 md:h-auto">
                         {s.imageUrl ? (
                             <img src={s.imageUrl} alt={s.title} className="w-full h-full object-cover" />
                         ) : (
                             <ImageIcon className="w-10 h-10 text-slate-300" />
                         )}
                      </div>
                      <CardContent className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                              <h3 className="font-bold text-lg">{s.title || '(بدون عنوان)'}</h3>
                              {s.subtitle && <p className="text-sm text-slate-600 mt-1">{s.subtitle}</p>}
                              {s.link && (
                                <p className="text-xs text-blue-500 mt-1" dir="ltr">
                                  لینک: {s.link} {s.buttonText && `(${s.buttonText})`}
                                </p>
                              )}
                              <p className="text-xs text-slate-400 mt-2">ترتیب: {s.order}</p>
                          </div>
                          <div className="flex gap-2 justify-end mt-4">
                              <Button size="sm" variant="outline" onClick={() => handleToggleActive(s.id, s.active)}>
                                  {s.active ? 'غیرفعال کردن' : 'فعال کردن'}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDelete(s.id)}>
                                  <Trash2 className="w-4 h-4" />
                              </Button>
                          </div>
                      </CardContent>
                  </Card>
              ))}
            </div>
        )}
      </div>

    </div>
  );
}
