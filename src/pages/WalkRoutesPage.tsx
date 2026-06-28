import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, Navigate } from 'react-router-dom';
import { collection, query, getDocs, setDoc, doc, deleteDoc, orderBy } from '../lib/db';
import { db, handleFirestoreError, OperationType } from '../lib/db';
import { WalkRoute } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Trash2, ArrowRight } from 'lucide-react';

export default function WalkRoutesPage() {
  const { user, profile, loading } = useAuth();
  const [routes, setRoutes] = useState<WalkRoute[]>([]);
  const [fetching, setFetching] = useState(true);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#007f5f');
  const [order, setOrder] = useState('1');
  const [editingRoute, setEditingRoute] = useState<WalkRoute | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('#007f5f');
  const [editOrder, setEditOrder] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const fetchRoutes = async () => {
    setFetching(true);
    try {
      const q = query(collection(db, 'routes'), orderBy('order', 'asc'));
      const routeSnap = await getDocs(q);
      const rts: WalkRoute[] = [];
      routeSnap.forEach(d => rts.push({ id: d.id, ...(d.data() as any) } as WalkRoute));
      setRoutes(rts);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'routes');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (profile?.isAdmin) {
      fetchRoutes();
    }
  }, [profile]);

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    
    try {
      const newRouteId = doc(collection(db, 'routes')).id;
      await setDoc(doc(db, 'routes', newRouteId), {
        name: name.trim(),
        description: description.trim(),
        color,
        order: parseInt(order) || 1
      });
      setName('');
      setDescription('');
      fetchRoutes();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'routes');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute || !editName.trim()) return;
    setSubmitting(true);
    try {
      await setDoc(doc(db, 'routes', editingRoute.id), {
        name: editName.trim(),
        description: editDescription.trim(),
        color: editColor,
        order: parseInt(editOrder) || 1
      }, { merge: true });
      setEditingRoute(null);
      fetchRoutes();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `routes/${editingRoute.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این مسیر مطمئن هستید؟')) return;
    try {
      await deleteDoc(doc(db, 'routes', id));
      fetchRoutes();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `routes/${id}`);
    }
  };

  if (loading) return null;
  if (!user || !profile || !profile.isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl" dir="rtl">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon" className="text-slate-500">
            <ArrowRight className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">مدیریت مسیرهای پیاده‌روی</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 h-fit rounded-2xl border-slate-100 shadow-sm">
          <CardHeader className="bg-white border-b border-slate-50">
            <CardTitle className="text-lg font-bold text-slate-800">افزودن مسیر</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleAddRoute} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">نام مسیر</label>
                <Input required value={name} onChange={e => setName(e.target.value)} placeholder="مثال: مسیر تردد شماره ۱" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">توضیحات (اختیاری)</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="توضیح کوتاه در مورد مسیر" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">رنگ مسیر</label>
                  <Input type="color" className="h-10 p-1" value={color} onChange={e => setColor(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">ترتیب نمایش</label>
                  <Input type="number" required value={order} onChange={e => setOrder(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full bg-[#1a1c2c] hover:bg-slate-800 text-white transition-colors" disabled={submitting}>
                {submitting ? 'در حال ثبت...' : 'ثبت مسیر'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 rounded-2xl border-slate-100 shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-50">
            <CardTitle className="text-lg font-bold text-slate-800">لیست مسیرها</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {fetching ? (
              <div className="p-10 text-center text-slate-500">در حال بارگزاری...</div>
            ) : routes.length === 0 ? (
              <div className="p-10 text-center text-slate-500">هیچ مسیری ثبت نشده است.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {routes.map(rt => (
                  <div key={rt.id} className="flex justify-between items-center p-4 hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: rt.color || '#007f5f' }}>
                         <span className="text-white text-xs font-bold">{rt.order}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{rt.name}</div>
                        {rt.description && <div className="text-sm text-slate-500 mt-1">{rt.description}</div>}
                      </div>
                    </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-blue-500 hover:text-blue-600 hover:bg-blue-50" 
                          onClick={() => {
                            setEditingRoute(rt);
                            setEditName(rt.name);
                            setEditDescription(rt.description || '');
                            setEditColor(rt.color || '#007f5f');
                            setEditOrder(String(rt.order));
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(rt.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      {editingRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md rounded-2xl">
            <CardHeader>
              <CardTitle>ویرایش مسیر</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateRoute} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">نام مسیر</label>
                  <Input required value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">توضیحات</label>
                  <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">رنگ</label>
                    <Input type="color" className="h-10 p-1" value={editColor} onChange={e => setEditColor(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">ترتیب</label>
                    <Input type="number" required value={editOrder} onChange={e => setEditOrder(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1 bg-[#1a1c2c]" disabled={submitting}>
                    ذخیره تغییرات
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingRoute(null)}>
                    انصراف
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
