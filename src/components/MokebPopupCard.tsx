import React, { useState } from 'react';
import { Mokeb } from '../types';
import { X, MapPin, Phone, User, ChevronLeft, Map as MapIcon, Award, Sparkles, Megaphone, CheckCircle, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import QuickRatingModal from './QuickRatingModal';

interface MokebPopupCardProps {
  mokeb: Mokeb;
  onClose: () => void;
  getMokebAmood: (m: Mokeb) => number;
  getCategoryName: (id: string) => string;
}

export default function MokebPopupCard({ mokeb, onClose, getMokebAmood, getCategoryName }: MokebPopupCardProps) {
  const navigate = useNavigate();
  const { siteSettings } = useAuth();
  const [showRatingModal, setShowRatingModal] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200" dir="rtl">
      {/* Background click listener to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="w-full max-w-md bg-white rounded-3xl relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 shadow-2xl border border-slate-200 text-right">
        
        {/* Official Header bar (Gold / Emerald blend) */}
        <div className="bg-gradient-to-r from-[#00664c] to-[#007f5f] px-6 py-5 text-white relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
          
          <button 
            onClick={onClose}
            className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4 mt-2">
            <div className="w-16 h-16 bg-white rounded-2xl p-1 shadow-md shrink-0 flex items-center justify-center border border-amber-400/40">
              {mokeb.avatarUrl ? (
                <img src={mokeb.avatarUrl} alt={mokeb.name} className="w-full h-full object-cover rounded-xl" />
              ) : siteSettings?.siteLogoUrl ? (
                <img src={siteSettings.siteLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-3xl">🕌</span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-amber-400/20 text-amber-300 font-extrabold px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  شناسنامه رسمی موکب
                </span>
                {mokeb.proCardRequestStatus === 'approved' && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-emerald-500/30">
                    <Award className="w-3 h-3" /> رسمی ستاد
                  </span>
                )}
              </div>
              <h3 className="font-black text-lg tracking-tight text-white">{mokeb.name}</h3>
              <p className="text-emerald-100/95 text-[11px] font-medium">
                {getCategoryName(mokeb.categoryId)}
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Main Info Box */}
          <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                  <User className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">مسئول موکب</p>
                  <p className="font-extrabold text-slate-800">{mokeb.managerName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                  <MapPin className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">موقعیت استقرار</p>
                  <p className="font-extrabold text-slate-800">عمود {getMokebAmood(mokeb)}</p>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-slate-200" />

            <div className="text-xs space-y-1">
              <p className="text-[9px] text-slate-400 font-bold">نشانی دقیق جغرافیایی:</p>
              <p className="font-medium text-slate-700 text-[11px] leading-relaxed">
                {mokeb.address || 'نشانی دقیقی در سیستم ثبت نشده است.'}
              </p>
            </div>
          </div>

          {/* Services Offered Section (خدمات موکب) */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-slate-800">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h4 className="font-black text-xs">خدمات و تسهیلات صلواتی موکب:</h4>
            </div>

            {mokeb.selectedServices && mokeb.selectedServices.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {mokeb.selectedServices.map((service, index) => (
                  <span 
                    key={index} 
                    className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    {service}
                  </span>
                ))}
              </div>
            ) : mokeb.exactServices ? (
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-emerald-900 text-[11px] leading-relaxed font-medium">
                {mokeb.exactServices}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 italic">جزئیات خدمات رفاهی صلواتی وارد نشده است.</p>
            )}
          </div>

          {/* Announcement Call-to-action Warning/Promo Box */}
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-2.5">
            <Megaphone className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-right">
              <h5 className="font-black text-amber-900 text-[11px]">اطلاعیه‌ها، وضعیت اسکان و ظرفیت</h5>
              <p className="text-amber-800 text-[10px] leading-relaxed font-medium">
                خادم گرامی، برای اطلاع از آخرین اطلاعیه‌ها، برنامه‌ها، اطلاعیه گنجایش اسکان و تغذیه وارد صفحه اختصاصی موکب شوید.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button 
              onClick={() => navigate(`/mokeb/${mokeb.id}`)}
              className="flex-1 bg-[#007f5f] hover:bg-[#00664c] text-white h-12 rounded-2xl font-black text-xs flex justify-center items-center gap-1.5 shadow-md shadow-emerald-700/10 transition-all active:scale-95"
            >
              <span>ورود به صفحه اختصاصی موکب</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <button 
              onClick={() => setShowRatingModal(true)}
              className="bg-amber-100 hover:bg-amber-200 border border-amber-200 text-amber-700 h-12 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>ثبت امتیاز</span>
            </button>

            {mokeb.phone && (
              <a 
                href={`tel:${mokeb.phone}`}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 h-12 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all hidden sm:flex"
              >
                <Phone className="w-4 h-4 text-slate-500" />
              </a>
            )}

            {mokeb.lat && mokeb.lng && (
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${mokeb.lat},${mokeb.lng}`}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 h-12 w-12 rounded-2xl flex items-center justify-center transition-all hidden sm:flex"
                title="مسیریابی در گوگل مپ"
              >
                <MapIcon className="w-4 h-4 text-slate-500" />
              </a>
            )}
          </div>

        </div>
      </div>

      {showRatingModal && (
        <QuickRatingModal 
          mokeb={mokeb} 
          onClose={() => setShowRatingModal(false)} 
        />
      )}
    </div>
  );
}
