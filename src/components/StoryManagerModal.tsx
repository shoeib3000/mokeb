import React, { useState, useEffect, useRef } from 'react';
import { Mokeb, MokebStory } from '../types';
import { doc, updateDoc, serverTimestamp } from '../lib/db';
import { db, storage } from '../lib/db';
import { getMillis } from '../lib/dateUtils';
import { X, Plus, Trash2, Clock, Image as ImageIcon, Video, Play, Pause, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { Input, Textarea } from './ui/input';
import { ref, uploadBytes, getDownloadURL } from '../lib/db';

interface StoryManagerModalProps {
  mokeb: Mokeb;
  onClose: () => void;
  onUpdate: () => void;
}

export default function StoryManagerModal({ mokeb, onClose, onUpdate }: StoryManagerModalProps) {
  const [stories, setStories] = useState<MokebStory[]>(mokeb.stories || []);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number>(0);
  const [viewingStory, setViewingStory] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newStoryCaption, setNewStoryCaption] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  
  const progressInterval = useRef<any>(null);
  const [progress, setProgress] = useState(0);

  // Filter out expired stories (24h)
  useEffect(() => {
    const now = Date.now();
    const validStories = (mokeb.stories || []).filter(s => {
       const exp = getMillis(s.expiresAt);
       return exp > now;
    });
    setStories(validStories);
  }, [mokeb.stories]);

  const handleAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !newStoryCaption) return;
    
    setUploading(true);
    try {
      let mediaUrl;
      let mediaType: 'image' | 'video' | undefined;

      if (selectedFile) {
          const storageRef = ref(storage, `stories/${mokeb.id}/${Date.now()}_${selectedFile.name}`);
          const snapshot = await uploadBytes(storageRef, selectedFile);
          mediaUrl = await getDownloadURL(snapshot.ref);
          mediaType = selectedFile.type.startsWith('video') ? 'video' : 'image';
      }

      const now = Date.now();
      const newStory: MokebStory = {
        id: 'story_' + now,
        caption: newStoryCaption,
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000 // 24 hours
      };
      
      if (mediaUrl) newStory.mediaUrl = mediaUrl;
      if (mediaType) newStory.mediaType = mediaType;

      const updatedStories = [...stories, newStory];
      await updateDoc(doc(db, 'mokebs', mokeb.id), {
        stories: updatedStories,
        updatedAt: serverTimestamp()
      });
      
      setStories(updatedStories);
      setSelectedFile(null);
      setNewStoryCaption('');
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت استوری');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!window.confirm('آیا از حذف این استوری اطمینان دارید؟')) return;
    try {
      const updatedStories = stories.filter(s => s.id !== storyId);
      await updateDoc(doc(db, 'mokebs', mokeb.id), {
        stories: updatedStories,
        updatedAt: serverTimestamp()
      });
      setStories(updatedStories);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const startStoryViewer = (index: number) => {
    setActiveStoryIndex(index);
    setViewingStory(true);
    setProgress(0);
    setIsPaused(false);
  };

  const nextStory = () => {
    if (activeStoryIndex < stories.length - 1) {
      setActiveStoryIndex(prev => prev + 1);
      setProgress(0);
    } else {
      setViewingStory(false);
    }
  };

  const prevStory = () => {
    if (activeStoryIndex > 0) {
      setActiveStoryIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (!viewingStory || isPaused) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          return 100;
        }
        return prev + 1;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [viewingStory, activeStoryIndex, isPaused]);

  useEffect(() => {
    if (viewingStory && progress >= 100) {
      nextStory();
    }
  }, [progress, viewingStory]);

  const getStoryAgeHours = (story: MokebStory) => {
    if (!story || !story.createdAt) return 0;
    const storyTime = getMillis(story.createdAt);
    if (!storyTime || isNaN(storyTime)) return 0;
    return Math.max(0, Math.floor((Date.now() - storyTime) / 3600000));
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
            <h2 className="text-sm font-black tracking-tight">مدیریت استوری‌ها</h2>
            <p className="text-[9px] text-emerald-100 font-bold truncate max-w-[200px]">موکب {mokeb.name}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        
        {/* Add New Story */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-rose-500" />
              ثبت استوری جدید
            </h3>
            
            <form onSubmit={handleAddStory} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-700">انتخاب عکس یا ویدیو (اختیاری)</label>
                <div className="border border-dashed border-slate-300 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 transition-colors active:scale-95 cursor-pointer relative overflow-hidden">
                  <input 
                    type="file" 
                    accept="image/*,video/*"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                  />
                  <Upload className="w-6 h-6 text-slate-400" />
                  {selectedFile ? (
                    <p className="text-[10px] font-bold text-rose-600 truncate max-w-full px-2">{selectedFile.name}</p>
                  ) : (
                    <p className="text-[10px] font-bold text-slate-500">برای انتخاب فایل ضربه بزنید</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-700">توضیحات استوری</label>
                <Textarea 
                  placeholder="اینجا بنویسید..." 
                  value={newStoryCaption}
                  onChange={e => setNewStoryCaption(e.target.value)}
                  className="bg-slate-50 border-slate-200 rounded-2xl resize-none h-20 text-xs shadow-sm focus:border-rose-400 focus:bg-white transition-colors"
                  maxLength={150}
                  required={!selectedFile}
                />
              </div>
              
              <Button 
                type="submit" 
                disabled={uploading || (!selectedFile && !newStoryCaption)}
                className="w-full bg-[#1a1c2c] hover:bg-slate-800 text-white font-bold rounded-2xl h-12 shadow-md transition-all active:scale-95"
              >
                {uploading ? 'درحال بارگذاری استوری...' : 'انتشار در صفحه موکب'}
              </Button>
            </form>
          </div>
        </div>

        {/* Active Stories List */}
        <div className="space-y-3 pb-8">
          <h3 className="text-xs font-black text-slate-800 border-b border-slate-200 pb-2">استوری‌های فعال ({stories.length})</h3>
          
          {stories.length === 0 ? (
            <div className="text-center p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
               <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-2">
                 <ImageIcon className="w-5 h-5" />
               </div>
               <p className="text-[10px] font-bold text-slate-400">هیچ استوری فعالی ندارید.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {stories.map((story, idx) => (
                <div key={story.id} className="relative group rounded-3xl overflow-hidden aspect-[9/16] bg-slate-100 border border-slate-100 shadow-sm">
                  {story.mediaType ? (
                     story.mediaType === 'video' ? (
                       <video src={story.mediaUrl} className="w-full h-full object-cover" />
                    ) : (
                       <img src={story.mediaUrl} alt="Story" className="w-full h-full object-cover" />
                    )
                  ) : (
                     <div className="w-full h-full bg-slate-800 flex items-center justify-center p-3 text-center">
                        <p className="text-[10px] text-white font-medium leading-relaxed drop-shadow-md">{story.caption}</p>
                     </div>
                  )}
                  
                  <div className="absolute inset-x-0 bottom-0 p-3 pt-6 bg-gradient-to-t from-black/90 to-transparent">
                     <p className="text-[9px] text-white font-bold line-clamp-2 leading-tight">{story.caption || 'بدون محتوای متنی'}</p>
                  </div>

                  <div className="absolute top-3 right-3 bg-black/60 text-white text-[8px] font-bold px-2 py-1 rounded-full backdrop-blur-md flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-amber-300" />
                    {Math.max(0, Math.floor((getMillis(story.expiresAt) - Date.now()) / 3600000))} ساعت مانده
                  </div>

                  {/* Actions overlay for Mobile */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 focus-within:opacity-100 hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm z-20">
                     <button onClick={() => startStoryViewer(idx)} className="w-10 h-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg">
                       <Play className="w-4 h-4 ml-0.5" />
                     </button>
                     <button onClick={(e) => { e.stopPropagation(); handleDeleteStory(story.id); }} className="w-10 h-10 rounded-full bg-rose-500/90 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg">
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FULL SCREEN STORY VIEWER */}
      {viewingStory && stories[activeStoryIndex] && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-in fade-in zoom-in-95 duration-200">
          
          {/* Progress Bars */}
          <div className="absolute top-4 inset-x-4 flex gap-1 z-10" dir="ltr">
            {stories.map((s, i) => (
              <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-white ${i < activeStoryIndex ? 'w-full' : i === activeStoryIndex ? 'w-full transition-all ease-linear' : 'w-0'}`} 
                  style={i === activeStoryIndex ? { width: `${progress}%`, transitionDuration: '50ms' } : undefined}
                />
              </div>
            ))}
          </div>

          {/* Header Controls */}
          <div className="absolute top-8 inset-x-4 flex items-center justify-between z-10 text-white">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-white overflow-hidden flex items-center justify-center">
                 <span className="text-xl">🕋</span>
               </div>
               <div>
                 <h4 className="font-bold text-sm text-shadow">{mokeb.name}</h4>
                 <p className="text-[10px] opacity-80 text-shadow">{getStoryAgeHours(stories[activeStoryIndex])} ساعت پیش</p>
               </div>
            </div>
            <div className="flex items-center gap-4 text-white">
              <button onClick={() => setIsPaused(!isPaused)} className="hover:opacity-80">
                {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
              </button>
              <button onClick={() => setViewingStory(false)} className="hover:opacity-80">
                <X className="w-7 h-7" />
              </button>
            </div>
          </div>

          {/* Media Container */}
          <div 
             className="flex-1 relative flex items-center justify-center w-full h-full sm:max-w-md mx-auto"
             onPointerDown={() => setIsPaused(true)}
             onPointerUp={() => setIsPaused(false)}
             onPointerLeave={() => setIsPaused(false)}
          >
             {/* Nav touch zones */}
             <div className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer" onClick={(e) => { e.stopPropagation(); prevStory(); }} />
             <div className="absolute inset-y-0 right-0 w-1/3 z-10 cursor-pointer" onClick={(e) => { e.stopPropagation(); nextStory(); }} />
             
             {stories[activeStoryIndex].mediaType ? (
               stories[activeStoryIndex].mediaType === 'video' ? (
                <video 
                  src={stories[activeStoryIndex].mediaUrl} 
                  className="w-full max-h-full object-contain"
                  autoPlay 
                  loop={isPaused} 
                  muted
                />
             ) : (
                <img 
                  src={stories[activeStoryIndex].mediaUrl} 
                  className="w-full max-h-full object-contain"
                  alt="Story content"
                />
             )
             ) : (
                <div className="w-full h-full flex items-center justify-center p-8 text-center bg-slate-900">
                    <p className="text-white text-xl font-bold leading-relaxed">{stories[activeStoryIndex].caption}</p>
                </div>
             )}

             {/* Caption bottom safe area */}
             {stories[activeStoryIndex].caption && (
               <div className="absolute bottom-10 inset-x-4 z-10 text-center">
                 <div className="inline-block bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl max-w-[90%]">
                    <p className="text-white text-sm font-bold leading-relaxed">{stories[activeStoryIndex].caption}</p>
                 </div>
               </div>
             )}
          </div>
        </div>
      )}

    </div>
  );
}
