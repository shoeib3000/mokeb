import React, { useState } from 'react';
import { Mokeb, MokebAnnouncement } from '../types';
import { doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove } from '../lib/db';
import { db } from '../lib/db';
import { X, Plus, Trash2, Megaphone } from 'lucide-react';
import { Button } from './ui/button';
import { Input, Textarea } from './ui/input';

interface AnnouncementManagerModalProps {
  mokeb: Mokeb;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AnnouncementManagerModal({ mokeb, onClose, onUpdate }: AnnouncementManagerModalProps) {
  const [announcements, setAnnouncements] = useState<MokebAnnouncement[]>(mokeb.announcements || []);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    
    setAdding(true);
    try {
      const newAnnouncement: MokebAnnouncement = {
        id: 'ann_' + Date.now(),
        title,
        content,
        createdAt: Date.now(),
        active: true
      };
      
      await updateDoc(doc(db, 'mokebs', mokeb.id), {
        announcements: arrayUnion(newAnnouncement),
        updatedAt: serverTimestamp()
      });
      
      setAnnouncements([...announcements, newAnnouncement]);
      setTitle('');
      setContent('');
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت اطلاعیه');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteAnnouncement = async (announcement: MokebAnnouncement) => {
    if (!window.confirm('آیا از حذف این اطلاعیه اطمینان دارید؟')) return;
    try {
      await updateDoc(doc(db, 'mokebs', mokeb.id), {
        announcements: arrayRemove(announcement),
        updatedAt: serverTimestamp()
      });
      setAnnouncements(announcements.filter(a => a.id !== announcement.id));
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAnnouncement = async (announcement: MokebAnnouncement) => {
    try {
        const updatedAnnouncements = announcements.map(a => 
            a.id === announcement.id ? { ...a, active: !a.active } : a
        );
        await updateDoc(doc(db, 'mokebs', mokeb.id), {
            announcements: updatedAnnouncements,
            updatedAt: serverTimestamp()
        });
        setAnnouncements(updatedAnnouncements);
        onUpdate();
    } catch (err) {
        console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col font-sans bg-slate-50 w-full max-w-md mx-auto shadow-2xl border-x border-slate-200 animate-in slide-in-from-bottom-full duration-300 overflow-hidden" dir="rtl">
      
      {/* Mobile Top App Bar */}
      <div className="bg-[#007f5f] text-white p-4 shrink-0 shadow-sm flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95"
          >
            <X className="w-5 h-5 text-amber-300" />
          </button>
          <div className="space-y-0.5">
            <h2 className="text-sm font-black tracking-tight flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5" />
              مدیریت اطلاعیه‌ها
            </h2>
            <p className="text-[9px] text-emerald-100 font-bold truncate max-w-[200px]">موکب {mokeb.name}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        
        {/* Add Form */}
        <form onSubmit={handleAddAnnouncement} className="bg-white p-4 rounded-3xl space-y-4 border border-slate-100 shadow-sm">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-700">عنوان اطلاعیه</label>
            <Input 
              placeholder="مثلا: ساعت توزیع ناهار" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required 
              className="bg-slate-50 border-slate-200 rounded-2xl h-12 text-xs shadow-sm focus:border-amber-400 focus:bg-white transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-700">شرح اطلاعیه</label>
            <Textarea 
              placeholder="توضیحات تکمیلی..." 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              required 
              className="bg-slate-50 border-slate-200 rounded-2xl h-24 text-xs shadow-sm focus:border-amber-400 focus:bg-white transition-colors resize-none"
            />
          </div>
          <Button 
            type="submit" 
            disabled={adding} 
            className="w-full bg-[#1a1c2c] hover:bg-slate-800 text-white rounded-2xl h-12 shadow-md transition-all font-bold active:scale-95"
          >
            {adding ? 'در حال ثبت...' : 'افزودن اطلاعیه'}
          </Button>
        </form>

        <div className="space-y-3 pb-8">
          <h3 className="text-xs font-black text-slate-800 border-b border-slate-200 pb-2">لیست اطلاعیه‌ها ({announcements.length})</h3>
          
          {announcements.length === 0 ? (
            <div className="text-center p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
               <div className="w-10 h-10 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-2">
                 <Megaphone className="w-4 h-4" />
               </div>
               <p className="text-[10px] font-bold text-slate-400">هیچ اطلاعیه‌ای اضافه نکرده‌اید.</p>
            </div>
          ) : (
            announcements.map(ann => (
              <div key={ann.id} className={`p-4 border rounded-3xl space-y-2 transition-colors ${ann.active ? 'bg-amber-50/50 border-amber-100' : 'bg-white border-slate-200 opacity-75'}`}>
                <div className="flex justify-between items-start">
                    <h4 className={`font-black text-xs ${ann.active ? 'text-amber-900' : 'text-slate-700'}`}>{ann.title}</h4>
                    <div className="flex bg-slate-100/50 rounded-lg p-0.5 border border-slate-200/50 items-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleToggleAnnouncement(ann)} 
                          className={`h-7 px-2 text-[10px] font-bold rounded-md transition-colors ${ann.active ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-slate-200 text-slate-500'}`}
                        >
                            {ann.active ? 'وضعیت: فعال' : 'نمایش'}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteAnnouncement(ann)} 
                          className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-100 hover:text-rose-700 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{ann.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
