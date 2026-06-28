import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, Navigate } from 'react-router-dom';
import { collection, query, getDocs, setDoc, doc, deleteDoc } from '../lib/db';
import { db, handleFirestoreError, OperationType } from '../lib/db';
import { Category } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Trash2, ArrowRight } from 'lucide-react';

export default function CategoriesPage() {
  const { user, profile, loading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetching, setFetching] = useState(true);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCats = async () => {
    setFetching(true);
    try {
      const catSnap = await getDocs(collection(db, 'categories'));
      const cats: Category[] = [];
      catSnap.forEach(d => cats.push({ id: d.id, ...(d.data() as any) } as Category));
      setCategories(cats);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'categories');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (profile?.isAdmin) {
      fetchCats();
    }
  }, [profile]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    
    try {
      const newCatId = doc(collection(db, 'categories')).id;
      await setDoc(doc(db, 'categories', newCatId), {
        name: name.trim(),
        description: description.trim()
      });
      setName('');
      setDescription('');
      fetchCats();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'categories');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editName.trim()) return;
    setSubmitting(true);
    try {
      await setDoc(doc(db, 'categories', editingCategory.id), {
        name: editName.trim(),
        description: editDescription.trim()
      }, { merge: true });
      setEditingCategory(null);
      fetchCats();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `categories/${editingCategory.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این دسته‌بندی مطمئن هستید؟')) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
      fetchCats();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `categories/${id}`);
    }
  };

  if (loading) return null;
  if (!user || !profile || !profile.isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon" className="text-slate-500">
            <ArrowRight className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">مدیریت دسته‌بندی‌ها</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 h-fit rounded-2xl border-slate-100 shadow-sm">
          <CardHeader className="bg-white border-b border-slate-50">
            <CardTitle className="text-lg font-bold text-slate-800">افزودن دسته‌بندی</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">نام</label>
                <Input required value={name} onChange={e => setName(e.target.value)} placeholder="مثال: موکب پزشکی" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">توضیحات (اختیاری)</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <Button type="submit" className="w-full bg-[#1a1c2c] hover:bg-slate-800 text-white transition-colors" disabled={submitting}>
                {submitting ? 'در حال ثبت...' : 'ثبت دسته‌بندی'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 rounded-2xl border-slate-100 shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-50">
            <CardTitle className="text-lg font-bold text-slate-800">لیست دسته‌بندی‌ها</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {fetching ? (
              <div className="p-10 text-center text-slate-500">در حال بارگزاری...</div>
            ) : categories.length === 0 ? (
              <div className="p-10 text-center text-slate-500">هیچ دسته‌بندی ثبت نشده است.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {categories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-4 hover:bg-slate-50">
                    <div>
                      <div className="font-semibold text-slate-900">{cat.name}</div>
                      {cat.description && <div className="text-sm text-slate-500 mt-1">{cat.description}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-blue-500 hover:text-blue-600 hover:bg-blue-50" 
                        onClick={() => {
                          setEditingCategory(cat);
                          setEditName(cat.name);
                          setEditDescription(cat.description || '');
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(cat.id)}>
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

      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md rounded-2xl">
            <CardHeader>
              <CardTitle>ویرایش دسته‌بندی</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateCategory} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">نام</label>
                  <Input required value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">توضیحات</label>
                  <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1 bg-[#1a1c2c]" disabled={submitting}>
                    ذخیره تغییرات
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingCategory(null)}>
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
