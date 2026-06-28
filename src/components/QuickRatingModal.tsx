import React, { useState, useEffect } from 'react';
import { Star, X, CheckCircle, Sparkles } from 'lucide-react';
import { collection, addDoc } from '../lib/db';
import { db } from '../lib/db';
import { Mokeb } from '../types';

interface QuickRatingModalProps {
  mokeb: Mokeb;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function QuickRatingModal({ mokeb, onClose, onSuccess }: QuickRatingModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [visitorName, setVisitorName] = useState<string>('');
  const [visitorPhone, setVisitorPhone] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Load saved credentials from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem('visitor_name') || '';
    const savedPhone = localStorage.getItem('visitor_phone') || '';
    if (savedName) setVisitorName(savedName);
    if (savedPhone) setVisitorPhone(savedPhone);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!visitorName.trim()) {
      setError('لطفاً نام و نام خانوادگی خود را وارد کنید.');
      return;
    }

    if (!visitorPhone.trim()) {
      setError('لطفاً شماره تماس همراه خود را وارد کنید.');
      return;
    }

    if (visitorPhone.trim().length < 10) {
      setError('لطفاً شماره تماس معتبر (حداقل ۱۰ رقم) وارد کنید.');
      return;
    }

    setSubmitting(true);

    const randomUserId = 'anonymous_' + Math.random().toString(36).substring(2, 11);
    
    const newReviewData = {
      mokebId: mokeb.id,
      userId: randomUserId,
      userName: visitorName.trim(),
      rating: rating,
      comment: comment.trim(),
      createdAt: new Date().toISOString()
    };

    const registrantData = {
      mokebId: mokeb.id,
      fullName: visitorName.trim(),
      phoneNumber: visitorPhone.trim(),
      rating: rating,
      comment: comment.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Submit to reviews
      await addDoc(collection(db, 'reviews'), newReviewData);
      
      // 2. Submit to registrants (as a visiting record)
      await addDoc(collection(db, 'registrants'), registrantData);

      // Save credentials to localStorage for next time
      localStorage.setItem('visitor_name', visitorName.trim());
      localStorage.setItem('visitor_phone', visitorPhone.trim());

      setSuccess(true);
      if (onSuccess) {
        onSuccess();
      }

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error("Error submitting quick rating:", err);
      setError('متاسفانه خطایی در ثبت امتیاز رخ داد. لطفاً مجدداً تلاش کنید.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      {/* Click outside to close (if not success or submitting) */}
      <div className="absolute inset-0" onClick={() => { if (!submitting && !success) onClose(); }} />

      <div className="bg-white rounded-3xl max-w-md w-full border border-slate-150 shadow-2xl p-6 sm:p-8 space-y-5 text-right relative z-10 animate-in zoom-in-95 duration-200">
        
        {/* Close button */}
        {!success && (
          <button 
            onClick={onClose}
            disabled={submitting}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {success ? (
          <div className="py-8 text-center space-y-4 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-bounce">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-black text-slate-900">امتیاز شما با موفقیت ثبت شد</h3>
            <p className="text-xs text-slate-500 font-bold leading-relaxed max-w-xs">
              زائر گرامی، از اینکه با ثبت امتیاز و نظر خود ما را در ارزیابی خدمات موکب {mokeb.name} یاری کردید صمیمانه متشکریم.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Header */}
            <div className="text-center space-y-1.5 pb-2 border-b border-slate-100">
              <div className="inline-flex items-center justify-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black border border-amber-200/50">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ارزیابی خدمات و امتیازدهی زائرین</span>
              </div>
              <h3 className="font-black text-slate-900 text-base">امتیازدهی به موکب {mokeb.name}</h3>
              <p className="text-[10px] text-slate-400 font-bold">نظر ارزشمند شما در سامانه ثبت و بررسی خواهد شد</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-600 text-[11px] font-bold p-3 rounded-xl border border-red-100 leading-normal text-center">
                {error}
              </div>
            )}

            {/* Big Star Selector */}
            <div className="flex flex-col items-center space-y-2 py-2">
              <span className="text-[11px] font-extrabold text-slate-500">میزان رضایت شما از خدمات موکب:</span>
              <div className="flex gap-2" dir="ltr">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(null)}
                    className="focus:outline-none transform active:scale-75 transition-all duration-150 hover:scale-110"
                  >
                    <Star 
                      className={`w-9 h-9 ${
                        star <= (hoveredRating ?? rating) 
                          ? 'text-amber-400 fill-amber-400 scale-105 filter drop-shadow-[0_2px_4px_rgba(251,191,36,0.2)]' 
                          : 'text-slate-200'
                      } transition-colors`} 
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-black text-amber-600">
                {rating === 5 && 'عالی و رضایت‌بخش صلواتی ⭐⭐⭐⭐⭐'}
                {rating === 4 && 'بسیار خوب و شایسته ⭐⭐⭐⭐'}
                {rating === 3 && 'متوسط و قابل قبول ⭐⭐⭐'}
                {rating === 2 && 'ضعیف و نیازمند بهبود ⭐⭐'}
                {rating === 1 && 'نامناسب و دارای مشکل ⭐'}
              </span>
            </div>

            {/* Input Name */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black text-slate-600">نام و نام خانوادگی زائر:</label>
              <input
                type="text"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="مثال: محمد حسینی"
                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#007f5f] focus:bg-white transition-all"
              />
            </div>

            {/* Input Phone */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black text-slate-600">شماره تلفن همراه:</label>
              <input
                type="tel"
                value={visitorPhone}
                onChange={(e) => setVisitorPhone(e.target.value)}
                placeholder="مثال: 09123456789"
                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#007f5f] focus:bg-white transition-all font-mono text-left"
                dir="ltr"
              />
            </div>

            {/* Input Comment */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black text-slate-600">توضیحات، پیشنهاد یا گزارش وضعیت (اختیاری):</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="نظر خود را درباره کیفیت پذیرایی، برخورد خادمان، اسکان یا نظافت موکب بنویسید..."
                rows={3}
                className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#007f5f] focus:bg-white transition-all resize-none leading-relaxed"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-[#007f5f] hover:bg-[#00664c] disabled:opacity-50 text-white font-black text-xs py-3 rounded-xl transition shadow-md shadow-emerald-700/10 flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>در حال ثبت...</span>
                  </>
                ) : (
                  <span>ثبت امتیاز ارزشمند زائر</span>
                )}
              </button>
              
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition active:scale-95"
              >
                انصراف
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
