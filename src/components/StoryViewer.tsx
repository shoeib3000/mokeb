import React, { useState, useEffect, useRef } from 'react';
import { MokebStory } from '../types';
import { getMillis } from '../lib/dateUtils';
import { X, Play, Pause } from 'lucide-react';
import { doc, updateDoc } from '../lib/db';
import { db } from '../lib/db';

interface StoryViewerProps {
  stories: MokebStory[];
  mokebName: string;
  mokebId?: string;
  initialIndex?: number;
  onClose: () => void;
}

export default function StoryViewer({ stories, mokebName, mokebId, initialIndex = 0, onClose }: StoryViewerProps) {
  const [activeStoryIndex, setActiveStoryIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const progressInterval = useRef<any>(null);

  useEffect(() => {
    const incrementView = async () => {
      if (!mokebId) return;
      const storyRef = doc(db, 'mokebs', mokebId);
      
      const newStories = stories.map((s, idx) => {
        if (idx === activeStoryIndex) {
          return { ...s, views: (s.views || 0) + 1 };
        }
        return s;
      });

      await updateDoc(storyRef, { stories: newStories });
    };
    incrementView();
  }, [activeStoryIndex, mokebId, stories]);

  const nextStory = () => {
    if (activeStoryIndex < stories.length - 1) {
      setActiveStoryIndex(prev => prev + 1);
      setProgress(0);
    } else {
      setTimeout(onClose, 0);
    }
  };

  const prevStory = () => {
    if (activeStoryIndex > 0) {
      setActiveStoryIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          return 100;
        }
        return prev + 1;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [activeStoryIndex, isPaused]);

  useEffect(() => {
    if (progress >= 100) {
      nextStory();
    }
  }, [progress]);

  const getStoryAgeHours = (story: MokebStory) => {
    if (!story || !story.createdAt) return 0;
    const storyTime = getMillis(story.createdAt);
    if (!storyTime || isNaN(storyTime)) return 0;
    return Math.max(0, Math.floor((Date.now() - storyTime) / 3600000));
  };

  if (!stories[activeStoryIndex]) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-in fade-in zoom-in-95 duration-200">
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

      <div className="absolute top-8 inset-x-4 flex items-center justify-between z-50 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-white overflow-hidden flex items-center justify-center">
            <span className="text-xl">🕋</span>
          </div>
          <div>
            <h4 className="font-bold text-sm">{mokebName}</h4>
            <p className="text-[10px] opacity-80">{getStoryAgeHours(stories[activeStoryIndex])} ساعت پیش</p>
          </div>
        </div>
        <button onClick={onClose} className="hover:opacity-80">
          <X className="w-7 h-7" />
        </button>
      </div>

      <div 
         className="flex-1 relative flex items-center justify-center w-full h-full"
         onPointerDown={() => setIsPaused(true)}
         onPointerUp={() => setIsPaused(false)}
      >
         <div className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer" onClick={(e) => { e.stopPropagation(); prevStory(); }} />
         <div className="absolute inset-y-0 right-0 w-1/3 z-10 cursor-pointer" onClick={(e) => { e.stopPropagation(); nextStory(); }} />
         
         {stories[activeStoryIndex].mediaType ? (
           stories[activeStoryIndex].mediaType === 'video' ? (
             <video src={stories[activeStoryIndex].mediaUrl} className="w-full max-h-full object-contain" autoPlay loop muted />
           ) : (
             <img src={stories[activeStoryIndex].mediaUrl} className="w-full max-h-full object-contain" alt="Story" />
           )
         ) : (
           <div className="w-full h-full flex items-center justify-center p-8 text-center bg-slate-900 px-6">
               <p className="text-white text-xl font-bold leading-relaxed drop-shadow-md">{stories[activeStoryIndex].caption}</p>
           </div>
         )}

         {stories[activeStoryIndex].caption && stories[activeStoryIndex].mediaType && (
           <div className="absolute bottom-10 inset-x-4 z-10 text-center pointer-events-none">
             <div className="inline-block bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl max-w-[90%]">
                <p className="text-white text-sm font-bold leading-relaxed">{stories[activeStoryIndex].caption}</p>
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
