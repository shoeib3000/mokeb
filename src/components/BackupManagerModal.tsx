import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { collection, getDocs, doc, updateDoc } from '../lib/db';
import { SiteSettings } from '../types';
import { X, Database, Download, Check, AlertCircle, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';

interface BackupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteSettings: SiteSettings | null;
}

export default function BackupManagerModal({ isOpen, onClose, siteSettings }: BackupManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'export'>('settings');
  const [host, setHost] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (siteSettings) {
      setHost(siteSettings.sqlHost || '');
      setUser(siteSettings.sqlUser || '');
      setPassword(siteSettings.sqlPassword || '');
      setDatabase(siteSettings.sqlDatabase || '');
    }
  }, [siteSettings]);

  if (!isOpen) return null;

  const handleSyncToMysql = async () => {
    if (!host || !user || !database) {
      alert('ابتدا باید تنظیمات سرور MySQL را وارد و ذخیره کنید.');
      return;
    }
    
    setIsSyncing(true);
    try {
      const collections = ['users', 'mokebs', 'categories', 'official_notices', 'settings', 'routes'];
      const allData: Record<string, any[]> = {};

      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        allData[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      let sql = `-- Database Backup Export\n-- Generated on ${new Date().toLocaleString()}\n\n`;
      Object.entries(allData).forEach(([colName, docs]) => {
        sql += `-- Table: ${colName}\n`;
        docs.forEach(doc => {
          const keys = Object.keys(doc);
          const values = keys.map(k => {
            const val = doc[k];
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'number') return val;
            if (val === null || val === undefined) return 'NULL';
            return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          });
          sql += `INSERT INTO ${colName} (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        });
        sql += '\n';
      });

      const res = await fetch('/api/sync-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host, user, password, database, data: sql
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
      } else {
        alert('خطا در همگام‌سازی: ' + data.message);
      }
    } catch (err: any) {
      console.error(err);
      alert('خطا در ارتباط با سرور: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateDoc(doc(db, 'settings', 'general'), {
        sqlHost: host,
        sqlUser: user,
        sqlPassword: password,
        sqlDatabase: database,
        updatedAt: new Date().toISOString()
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving SQL settings:", err);
      alert('خطا در ذخیره تنظیمات');
    } finally {
      setIsSaving(false);
    }
  };

  const exportData = async (format: 'json' | 'sql') => {
    setIsExporting(true);
    try {
      const collections = ['users', 'mokebs', 'categories', 'official_notices', 'settings', 'routes'];
      const allData: Record<string, any[]> = {};

      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        allData[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
      } else {
        // Simple SQL dump generator
        let sql = `-- Database Backup Export\n-- Generated on ${new Date().toLocaleString()}\n\n`;
        
        Object.entries(allData).forEach(([colName, docs]) => {
          sql += `-- Table: ${colName}\n`;
          docs.forEach(doc => {
            const keys = Object.keys(doc);
            const values = keys.map(k => {
              const val = doc[k];
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'number') return val;
              if (val === null || val === undefined) return 'NULL';
              return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            });
            sql += `INSERT INTO ${colName} (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
          });
          sql += '\n';
        });

        const blob = new Blob([sql], { type: 'text/sql' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().split('T')[0]}.sql`;
        a.click();
      }
    } catch (err) {
      console.error("Error exporting data:", err);
      alert('خطا در استخراج داده‌ها');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 bg-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black leading-tight">مدیریت دیتابیس و پشتیبان‌گیری</h2>
              <p className="text-[10px] text-white/70 font-medium">اتصال به SQL محلی و مدیریت همگام‌سازی</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-4 text-xs font-black transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'settings' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Server className="w-4 h-4" />
            تنظیمات اتصال SQL
          </button>
          <button 
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-4 text-xs font-black transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'export' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Download className="w-4 h-4" />
            پشتیبان‌گیری و خروجی
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'settings' ? (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
                <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-blue-900">امنیت اطلاعات و همگام‌سازی</h4>
                  <p className="text-[10px] text-blue-800 leading-relaxed">
                    این تنظیمات به سیستم اجازه می‌دهد تا اطلاعات را جهت مدیریت در MySQL/SQL Server لوکال شما آماده‌سازی کند. 
                    توجه داشته باشید که جهت همگام‌سازی خودکار، نیاز به نصب ماژول "MokebSync" در سرور محلی خود دارید.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 block pr-1">آدرس سرور SQL (Host) *</label>
                  <input 
                    type="text"
                    value={host}
                    onChange={e => setHost(e.target.value)}
                    placeholder="مثلاً localhost یا 127.0.0.1"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl h-11 px-4 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 block pr-1">نام دیتابیس (Database Name) *</label>
                  <input 
                    type="text"
                    value={database}
                    onChange={e => setDatabase(e.target.value)}
                    placeholder="مثلاً mokeb_db"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl h-11 px-4 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 block pr-1">نام کاربری (Username) *</label>
                  <input 
                    type="text"
                    value={user}
                    onChange={e => setUser(e.target.value)}
                    placeholder="مثلاً root"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl h-11 px-4 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 block pr-1">کلمه عبور (Password)</label>
                  <input 
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl h-11 px-4 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  disabled={isSaving}
                  className={`w-full h-12 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
                    saveSuccess ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  {isSaving ? 'در حال ذخیره‌سازی...' : saveSuccess ? 'تنظیمات با موفقیت ذخیره شد' : 'ذخیره تنظیمات دیتابیس محلی'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-8 py-4">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-slate-800">استخراج کل داده‌های سامانه</h3>
                <p className="text-xs text-slate-500">تمامی اطلاعات موکب‌ها، کاربران، تنظیمات و دسته‌بندی‌ها را در قالب فایل استاندارد دریافت کنید.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-slate-100 bg-slate-50 rounded-3xl p-6 flex flex-col items-center gap-4 text-center hover:border-emerald-200 transition-all">
                  <div className="p-4 bg-emerald-100 text-emerald-700 rounded-2xl">
                    <Download className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900">خروجی JSON کامل</h4>
                    <p className="text-[10px] text-slate-500">مناسب برای برنامه‌نویسان و همگام‌سازی‌های نرم‌افزاری</p>
                  </div>
                  <Button 
                    onClick={() => exportData('json')}
                    disabled={isExporting}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 rounded-xl text-[11px] font-bold"
                  >
                    {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'دریافت فایل JSON'}
                  </Button>
                </div>

                <div className="border border-slate-100 bg-slate-50 rounded-3xl p-6 flex flex-col items-center gap-4 text-center hover:border-indigo-200 transition-all">
                  <div className="p-4 bg-indigo-100 text-indigo-700 rounded-2xl">
                    <Database className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900">انتقال مستقیم به MySQL</h4>
                    <p className="text-[10px] text-slate-500">همگام‌سازی و انتقال به دیتابیس تنظیم شده در سرور</p>
                  </div>
                  <div className="flex gap-2 w-full">
                    <Button 
                      onClick={() => exportData('sql')}
                      disabled={isExporting || isSyncing}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-10 rounded-xl text-[10px] font-bold px-2"
                    >
                      {isExporting ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'دانلود SQL'}
                    </Button>
                    <Button 
                      onClick={handleSyncToMysql}
                      disabled={isExporting || isSyncing}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 h-10 rounded-xl text-[10px] font-bold px-2"
                    >
                      {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'همگام‌سازی مستقیم'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-900">نکته مهم در مورد پشتیبان‌گیری</h4>
                  <p className="text-[10px] text-amber-800 leading-relaxed">
                    فایل‌های آپلود شده (تصاویر، مدارک) در این پشتیبان‌گیری گنجانده نمی‌شوند و فقط آدرس (URL) آن‌ها ذخیره می‌شود. 
                    توصیه می‌شود هر هفته یکبار از داده‌های خود نسخه پشتیبان تهیه فرمایید.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
