import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, addDoc, setDoc, deleteDoc, getDoc, onSnapshot } from '../lib/db';
import { db, handleFirestoreError, OperationType, logout } from '../lib/db';
import { safeStorage } from '../lib/safeStorage';
import { getMillis } from '../lib/dateUtils';
import { Mokeb, MokebStatus, Category } from '../types';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import StoryManagerModal from '../components/StoryManagerModal';
import AnnouncementManagerModal from '../components/AnnouncementManagerModal';
import BackupManagerModal from '../components/BackupManagerModal';
import { resizeImage } from '../lib/imageResizer';
import { 
  MapPin, Plus, Layers, AlertCircle, User as UserIcon, Phone, X, 
  CheckCircle2, Clock, Sparkles, LayoutGrid, List, Eye, Search,
  ShieldAlert, Check, FileText, ChevronRight, HelpCircle, PlaySquare, Image as ImageIcon, Trash2, Megaphone,
  Map as MapIcon, LogOut, Shield, Lock, Terminal, Activity, Download, Upload,
  Users, ArrowRight, Copy, EyeOff, Building2
} from 'lucide-react';

const formatFarsiDate = (val: any) => {
  if (!val) return 'ثبت نشده';
  try {
    let d: Date;
    if (typeof val === 'string') {
      d = new Date(val);
    } else if (val && typeof val.toDate === 'function') {
      d = val.toDate();
    } else if (val && val.seconds) {
      d = new Date(val.seconds * 1000);
    } else {
      d = new Date(val);
    }
    
    if (isNaN(d.getTime())) return 'تاریخ نامعتبر';
    return d.toLocaleDateString('fa-IR') + ' ' + d.toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'});
  } catch (e) {
    return 'خطا در تاریخ';
  }
};

const DEFAULT_NEWS_CATEGORIES: any[] = [];

export default function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const [mokebs, setMokebs] = useState<Mokeb[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetching, setFetching] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedMokeb, setSelectedMokeb] = useState<Mokeb | null>(null);
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    // Show welcome dialog once per browser session
    const shown = sessionStorage.getItem('mokeb_session_greeted');
    return shown !== 'true';
  });
  const navigate = useNavigate();

  // New Professional and User Account Credentials states
  const [detailsTab, setDetailsTab] = useState<'standard' | 'professional'>('standard');
  const [showAuthManager, setShowAuthManager] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editUsernameVal, setEditUsernameVal] = useState('');
  const [editPasswordVal, setEditPasswordVal] = useState('');
  const [editingUserDisplayName, setEditingUserDisplayName] = useState('');
  const [selectedProCardMokeb, setSelectedProCardMokeb] = useState<Mokeb | null>(null);
  const [selectedStoryMokeb, setSelectedStoryMokeb] = useState<Mokeb | null>(null);
  const [selectedAnnouncementMokeb, setSelectedAnnouncementMokeb] = useState<Mokeb | null>(null);

  // Custom creative states for user management screen
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<'all' | 'admin' | 'operator'>('all');
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<{ [key: string]: boolean }>({});

  // States for Official Announcements and Bulletins (تابلو اعلانات و ابلاغیه‌های رسمی راهنمای زائر)
  const [showOfficialNoticesManager, setShowOfficialNoticesManager] = useState(false);
  const [officialNotices, setOfficialNotices] = useState<any[]>([]);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');
  const [newNoticeAuthority, setNewNoticeAuthority] = useState('setad'); // 'setad' | 'faraja'
  const [newNoticeCategory, setNewNoticeCategory] = useState<string>('general');
  const [selectedNoticeTab, setSelectedNoticeTab] = useState<string>('همه');
  const [editingNotice, setEditingNotice] = useState<any | null>(null);
  const [submittingNotice, setSubmittingNotice] = useState(false);
  const [searchNoticeQuery, setSearchNoticeQuery] = useState('');

  // States for Mokeb Operator Announcements (اعلانات پنل موکب‌داران)
  const [showOperatorAnnouncementsManager, setShowOperatorAnnouncementsManager] = useState(false);
  const [operatorAnnouncements, setOperatorAnnouncements] = useState<any[]>([]);
  const [newOpAnnouncementTitle, setNewOpAnnouncementTitle] = useState('');
  const [newOpAnnouncementContent, setNewOpAnnouncementContent] = useState('');
  const [newOpAnnouncementImportance, setNewOpAnnouncementImportance] = useState<'info' | 'warning' | 'critical'>('info');
  const [editingOpAnnouncement, setEditingOpAnnouncement] = useState<any | null>(null);
  const [newOpAnnouncementFile, setNewOpAnnouncementFile] = useState<string | null>(null);
  const [newOpAnnouncementFileName, setNewOpAnnouncementFileName] = useState<string | null>(null);
  const [isDraggingOpFile, setIsDraggingOpFile] = useState(false);
  const [submittingOpAnnouncement, setSubmittingOpAnnouncement] = useState(false);
  const { siteSettings } = useAuth();
  const [showSiteSettingsManager, setShowSiteSettingsManager] = useState(false);
  const [showBackupManager, setShowBackupManager] = useState(false);
  const [siteLogo, setSiteLogo] = useState<string | null>(null);
  const [siteName, setSiteName] = useState('');
  const [footerText, setFooterText] = useState('');
  const [pwaRegistrationBannerEnabled, setPwaRegistrationBannerEnabled] = useState(true);
  const [pwaVisitorAnnouncement, setPwaVisitorAnnouncement] = useState('');
  const [submittingSiteSettings, setSubmittingSiteSettings] = useState(false);

  // States for Database Connection Test
  const [showDbTestModal, setShowDbTestModal] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string; error?: string } | null>(null);
  const [testingDb, setTestingDb] = useState(false);

  // States for dynamic custom authorities
  const [customAuthorities, setCustomAuthorities] = useState<any[]>([]);
  const [newAuthorityName, setNewAuthorityName] = useState('');
  const [submittingAuthority, setSubmittingAuthority] = useState(false);

  // States for dynamic news categories
  const [newsCategories, setNewsCategories] = useState<any[]>([]);
  const [newNewsCategoryName, setNewNewsCategoryName] = useState('');
  const [submittingNewsCategory, setSubmittingNewsCategory] = useState(false);

  // States for Real-time Analytics & Monitoring
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsSearch, setAnalyticsSearch] = useState('');
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [categoryStatsList, setCategoryStatsList] = useState<any[]>([]);
  const [mokebStatsList, setMokebStatsList] = useState<any[]>([]);
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [allRegistrants, setAllRegistrants] = useState<any[]>([]);

  // Subscriptions to reviews and registrants for ratings analysis
  useEffect(() => {
    if (!profile) return;
    const unsubReviews = onSnapshot(collection(db, 'reviews'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setAllReviews(list);
    });

    const unsubRegistrants = onSnapshot(collection(db, 'registrants'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setAllRegistrants(list);
    });

    return () => {
      unsubReviews();
      unsubRegistrants();
    };
  }, [profile]);

  // Subscriptions to real-time analytics
  useEffect(() => {
    if (!profile?.isAdmin || !showAnalyticsModal) return;

    // 1. Global stats subscription
    const unsubscribeGlobal = onSnapshot(doc(db, 'global_stats', 'total'), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalStats(docSnap.data());
      } else {
        setGlobalStats({ count: 0, uniqueCount: 0 });
      }
    });

    // 2. Category stats subscription
    const unsubscribeCategories = onSnapshot(collection(db, 'category_stats'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setCategoryStatsList(list);
    });

    // 3. Mokeb stats subscription
    const unsubscribeMokebs = onSnapshot(collection(db, 'mokeb_stats'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setMokebStatsList(list);
    });

    return () => {
      unsubscribeGlobal();
      unsubscribeCategories();
      unsubscribeMokebs();
    };
  }, [profile, showAnalyticsModal]);

  // Real-time synchronization of operator announcements for everyone
  useEffect(() => {
    if (profile) {
      const q = collection(db, 'operator_announcements');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        // Sort by createdAt descending
        list.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setOperatorAnnouncements(list);
      }, (error) => {
        console.warn("Error subscribing to operator announcements:", error);
      });
      return () => unsubscribe();
    }
  }, [profile]);

  useEffect(() => {
    if (siteSettings) {
      setSiteLogo(siteSettings.siteLogoUrl || null);
      setSiteName(siteSettings.siteName || '');
      setFooterText(siteSettings.footerText || '');
      setPwaRegistrationBannerEnabled(siteSettings.pwaRegistrationBannerEnabled !== false);
      setPwaVisitorAnnouncement(siteSettings.pwaVisitorAnnouncement || '');
    }
  }, [siteSettings]);
  useEffect(() => {
    if (profile?.isAdmin) {
      const q = collection(db, 'official_notices');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        // Sort by createdAt descending
        list.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setOfficialNotices(list);
      }, (error) => {
        console.warn("Error subscribing to official notices:", error);
      });
      return () => unsubscribe();
    }
  }, [profile]);

  // Real-time synchronization of custom authorities
  useEffect(() => {
    if (profile?.isAdmin) {
      const q = collection(db, 'official_authorities');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        list.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setCustomAuthorities(list);
      }, (error) => {
        console.warn("Error subscribing to custom authorities:", error);
      });
      return () => unsubscribe();
    }
  }, [profile]);

  // Real-time synchronization of custom news categories
  useEffect(() => {
    if (profile?.isAdmin) {
      const q = collection(db, 'news_categories');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        list.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setNewsCategories(list);
      }, (error) => {
        console.warn("Error subscribing to news categories:", error);
      });
      return () => unsubscribe();
    }
  }, [profile]);

  const handleCreateAuthority = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthorityName.trim()) return;

    setSubmittingAuthority(true);
    try {
      const authId = 'auth_' + Date.now();
      await setDoc(doc(db, 'official_authorities', authId), {
        name: newAuthorityName.trim(),
        createdAt: new Date().toISOString()
      });
      setNewAuthorityName('');
    } catch (err) {
      console.error("Error creating custom authority:", err);
      alert('خطا در ثبت سازمان صادرکننده جدید');
    } finally {
      setSubmittingAuthority(false);
    }
  };

  const handleDeleteAuthority = async (authId: string) => {
    if (!window.confirm('آیا از حذف این سازمان صادرکننده اطمینان دارید؟ با حذف آن، نام این سازمان در ابلاغیه‌های موجود دست‌نخورده باقی می‌ماند ولی از لیست پیش‌فرض‌های جدید حذف می‌شود.')) return;
    try {
      await deleteDoc(doc(db, 'official_authorities', authId));
    } catch (err) {
      console.error("Error deleting custom authority:", err);
      alert('خطا در حذف سازمان صادرکننده');
    }
  };

  const handleCreateNewsCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNewsCategoryName.trim()) return;

    setSubmittingNewsCategory(true);
    try {
      const catId = 'newscat_' + Date.now();
      await setDoc(doc(db, 'news_categories', catId), {
        name: newNewsCategoryName.trim(),
        createdAt: new Date().toISOString()
      });
      setNewNewsCategoryName('');
    } catch (err) {
      console.error("Error creating news category:", err);
      alert('خطا در ثبت دسته‌بندی خبری جدید');
    } finally {
      setSubmittingNewsCategory(false);
    }
  };

  const handleDeleteNewsCategory = async (catId: string) => {
    if (!window.confirm('آیا از حذف این دسته‌بندی خبری اطمینان دارید؟ با حذف آن، دسته‌بندی ابلاغیه‌های موجود دست‌نخورده باقی می‌ماند ولی از گزینه‌های ابلاغیه جدید حذف می‌شود.')) return;
    try {
      await deleteDoc(doc(db, 'news_categories', catId));
    } catch (err) {
      console.error("Error deleting news category:", err);
      alert('خطا در حذف دسته‌بندی خبری');
    }
  };

  const handleCreateOfficialNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeTitle.trim() || !newNoticeContent.trim()) return;

    setSubmittingNotice(true);
    try {
      const noticeId = editingNotice ? editingNotice.id : 'notice_' + Date.now();
      
      // Resolve authorityName
      let authName = 'ستاد برگزاری مراسم';
      if (newNoticeAuthority === 'faraja') {
        authName = 'پلیس فراجا';
      } else if (newNoticeAuthority === 'red_crescent') {
        authName = 'سازمان هلال احمر';
      } else if (newNoticeAuthority === 'setad') {
        authName = 'ستاد برگزاری مراسم';
      } else {
        const found = customAuthorities.find(a => a.id === newNoticeAuthority);
        if (found) {
          authName = found.name;
        } else {
          authName = newNoticeAuthority;
        }
      }

      const updatedNotice = {
        title: newNoticeTitle.trim(),
        content: newNoticeContent.trim(),
        authority: newNoticeAuthority,
        authorityName: authName,
        category: newNoticeCategory,
        time: editingNotice ? (editingNotice.time || 'بروزرسانی شده') : 'هم‌اکنون',
        createdAt: editingNotice ? (editingNotice.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'official_notices', noticeId), updatedNotice, { merge: true });
      
      alert(editingNotice ? 'ابلاغیه با موفقیت بروزرسانی شد.' : 'ابلاغیه رسمی با موفقیت ثبت شد.');
      setNewNoticeTitle('');
      setNewNoticeContent('');
      setEditingNotice(null);
    } catch (err) {
      console.error("Error creating official notice:", err);
      alert('خطا در ثبت ابلاغیه رسمی');
    } finally {
      setSubmittingNotice(false);
    }
  };

  const handleDeleteOfficialNotice = async (noticeId: string) => {
    if (!window.confirm('آیا از حذف این ابلاغیه رسمی اطمینان دارید؟')) return;
    try {
      await deleteDoc(doc(db, 'official_notices', noticeId));
    } catch (err) {
      console.error("Error deleting official notice:", err);
      alert('خطا در حذف ابلاغیه');
    }
  };

  // Mokeb Operator Announcements Handlers
  const handleOpAnnouncementFileUpload = (file: File) => {
    if (!file) return;
    if (file.size > 300 * 1024) {
      alert('اندازه فایل ضمیمه نباید بیشتر از ۳۰۰ کیلوبایت باشد. لطفا از فایل کوچکتری استفاده کنید.');
      return;
    }
    setNewOpAnnouncementFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewOpAnnouncementFile(reader.result);
      }
    };
    reader.onerror = () => {
      alert('خطایی در خوانش فایل رخ داد. لطفا مجددا تلاش کنید.');
    };
    reader.readAsDataURL(file);
  };

  const handleOpFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleOpAnnouncementFileUpload(file);
  };

  const handleOpFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOpFile(true);
  };

  const handleOpFileDragLeave = () => {
    setIsDraggingOpFile(false);
  };

  const handleOpFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOpFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleOpAnnouncementFileUpload(file);
  };

  const handleCreateOperatorAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpAnnouncementTitle.trim() || !newOpAnnouncementContent.trim()) return;

    setSubmittingOpAnnouncement(true);
    try {
      const announcementId = editingOpAnnouncement ? editingOpAnnouncement.id : 'announcement_' + Date.now();
      const updatedAnn = {
        title: newOpAnnouncementTitle.trim(),
        content: newOpAnnouncementContent.trim(),
        importance: newOpAnnouncementImportance,
        attachmentUrl: newOpAnnouncementFile || (editingOpAnnouncement ? editingOpAnnouncement.attachmentUrl : null),
        attachmentName: newOpAnnouncementFileName || (editingOpAnnouncement ? editingOpAnnouncement.attachmentName : null),
        createdAt: editingOpAnnouncement ? (editingOpAnnouncement.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'operator_announcements', announcementId), updatedAnn, { merge: true });

      alert(editingOpAnnouncement ? 'اعلان با موفقیت بروزرسانی شد.' : 'اعلان جدید با موفقیت ثبت شد.');
      setNewOpAnnouncementTitle('');
      setNewOpAnnouncementContent('');
      setNewOpAnnouncementImportance('info');
      setNewOpAnnouncementFile(null);
      setNewOpAnnouncementFileName(null);
      setEditingOpAnnouncement(null);
    } catch (err) {
      console.error("Error creating operator announcement:", err);
      alert('خطا در ثبت اعلان جدید');
    } finally {
      setSubmittingOpAnnouncement(false);
    }
  };

  const handleDeleteOperatorAnnouncement = async (id: string) => {
    if (!window.confirm('آیا از حذف این اعلان اطمینان دارید؟')) return;
    try {
      await deleteDoc(doc(db, 'operator_announcements', id));
    } catch (err) {
      console.error("Error deleting operator announcement:", err);
      alert('خطا در حذف اعلان');
    }
  };

  // Default the modal tab to standard whenever selectedMokeb changes
  useEffect(() => {
    if (selectedMokeb) {
      setDetailsTab('standard');
    }
  }, [selectedMokeb]);

  const fetchAllUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ ...d.data(), id: d.id });
      });
      setAllUsers(list);
    } catch (err) {
      console.error("Error fetching all users:", err);
    }
  };

  const handleUpdateUserCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const newUsernameClean = editUsernameVal.trim().toLowerCase();
    const oldUserId = editingUser.id;

    if (!newUsernameClean) {
      alert('لطفا نام کاربری معتبری وارد نمایید.');
      return;
    }

    try {
      if (newUsernameClean !== oldUserId) {
        // We are changing the username/ID!
        // 1. Check if the newly requested username already exists as a document
        const targetUserRef = doc(db, 'users', newUsernameClean);
        const targetUserSnap = await getDoc(targetUserRef);
        if (targetUserSnap.exists()) {
          alert(`خطا: نام کاربری "${newUsernameClean}" قبلاً توسط فرد دیگری ثبت شده است.`);
          return;
        }

        if (!window.confirm(`آیا از تغییر نام کاربری از "${oldUserId}" به "${newUsernameClean}" اطمینان دارید؟ تمامی ارتباطات و پرونده‌های موکب منتقل خواهند شد.`)) {
          return;
        }

        // 2. Prepare the new user document data
        const oldUserRef = doc(db, 'users', oldUserId);
        const oldUserSnap = await getDoc(oldUserRef);
        const userData = oldUserSnap.exists() ? oldUserSnap.data() : editingUser;

        const updatedData = {
          ...userData,
          id: newUsernameClean,
          username: newUsernameClean,
          password: editPasswordVal.trim(),
          name: editingUserDisplayName.trim(),
          email: `${newUsernameClean}@system.local` // keep matching style
        };

        // 3. Write to the new document ID
        await setDoc(targetUserRef, updatedData);

        // 4. Update associated collections!
        // Update Mokebs where ownerId === oldUserId
        try {
          const mokebsSnap = await getDocs(query(collection(db, 'mokebs'), where('ownerId', '==', oldUserId)));
          for (const mokebDoc of mokebsSnap.docs) {
            await updateDoc(doc(db, 'mokebs', mokebDoc.id), {
              ownerId: newUsernameClean
            });
          }
        } catch (mokebErr) {
          console.error("Error migrating mokeb ownerId:", mokebErr);
        }

        // Update Tickets where userId === oldUserId
        try {
          const ticketsSnap = await getDocs(query(collection(db, 'tickets'), where('userId', '==', oldUserId)));
          for (const ticketDoc of ticketsSnap.docs) {
            await updateDoc(doc(db, 'tickets', ticketDoc.id), {
              userId: newUsernameClean
            });
          }
        } catch (ticketErr) {
          console.error("Error migrating ticket userId:", ticketErr);
        }

        // 5. Delete the old document
        await deleteDoc(oldUserRef);

        // 6. If the admin renamed themselves (highly improbable, but just in case), they would need to login again.
        if (safeStorage.getItem('mock_auth_username') === oldUserId) {
          safeStorage.setItem('mock_auth_username', newUsernameClean);
        }

        alert('نام کاربری و گذرواژه موکب‌دار جدید با موفقیت انتقال یافته و بروزرسانی شد.');
      } else {
        // Username didn't change, just update password & name!
        await updateDoc(doc(db, 'users', oldUserId), {
          password: editPasswordVal.trim(),
          name: editingUserDisplayName.trim()
        });
        alert('کلمه عبور و نام خادم با موفقیت ویرایش شد.');
      }

      setEditingUser(null);
      fetchAllUsers();
    } catch (err) {
      console.error("Error updating user:", err);
      alert('خطا در ارتباط با پایگاه داده جهت بروزرسانی مشخصات');
    }
  };

  const fetchCategories = async () => {
    try {
      const catSnap = await getDocs(collection(db, 'categories'));
      const cats: Category[] = [];
      catSnap.forEach(d => cats.push({ id: d.id, ...(d.data() as any) } as Category));
      if (cats.length > 0) {
        setCategories(cats);
        safeStorage.setItem('offline_categories', JSON.stringify(cats));
      } else {
        throw new Error('Empty categories fetched from online');
      }
    } catch (err) {
      console.warn("Error fetching categories, utilizing cached/default categories:", err);
      const cached = safeStorage.getItem('offline_categories');
      if (cached) {
        try {
          setCategories(JSON.parse(cached));
        } catch (_) {
          setDefaultCategories();
        }
      } else {
        setDefaultCategories();
      }
    }
  };

  const setDefaultCategories = () => {
    setCategories([
      { id: 'cat-1', name: 'خدمات اسکان', icon: 'home', order: 1 },
      { id: 'cat-2', name: 'توزیع غذا و چای', icon: 'coffee', order: 2 },
      { id: 'cat-3', name: 'پزشکی و هلال‌احمر', icon: 'heart', order: 3 },
      { id: 'cat-4', name: 'فرهنگی و مذهبی', icon: 'book', order: 4 },
      { id: 'cat-5', name: 'اینترنت و دیجیتال', icon: 'wifi', order: 5 }
    ]);
  };

  const getCategoryName = (id: string) => {
    return categories.find(c => c.id === id)?.name || 'دسته عمومی';
  };

  const getNewsCategoryName = (id: string) => {
    if (id === 'general') return 'عمومی';
    const foundCustom = newsCategories.find(c => c.id === id);
    if (foundCustom) return foundCustom.name;
    const foundDefault = DEFAULT_NEWS_CATEGORIES.find(c => c.id === id);
    return foundDefault ? foundDefault.name : id;
  };

  const fetchMokebs = async () => {
    if (!profile) return;
    setFetching(true);
    try {
      const mokebsRef = collection(db, 'mokebs');
      let q;
      if (profile.isAdmin) {
        q = query(mokebsRef);
      } else {
        q = query(mokebsRef, where('ownerId', '==', profile.id));
      }
      
      const snap = await getDocs(q);
      const fetched: Mokeb[] = [];
      snap.forEach(d => fetched.push({ id: d.id, ...(d.data() as any) } as Mokeb));
      
      fetched.sort((a, b) => {
        const aStatus = a.status || '';
        const bStatus = b.status || '';
        if (aStatus.includes('pending') && !bStatus.includes('pending')) return -1;
        if (!aStatus.includes('pending') && bStatus.includes('pending')) return 1;
        return 0;
      });
      
      setMokebs(fetched);
      safeStorage.setItem('offline_mokebs', JSON.stringify(fetched));
    } catch (err) {
      console.warn("Firestore Mokebs fetch failed, leveraging localized content:", err);
      const cached = safeStorage.getItem('offline_mokebs');
      if (cached) {
        try {
          const list = JSON.parse(cached) as Mokeb[];
          if (profile.isAdmin) {
            setMokebs(list);
          } else {
            setMokebs(list.filter(m => m.ownerId === profile.id));
          }
        } catch (parseErr) {
          console.error("Error parsing cached mokebs:", parseErr);
        }
      }
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (profile) {
      if (!profile.isAdmin) {
        navigate('/pwa?tab=dashboard', { replace: true });
        return;
      }
      fetchMokebs();
      fetchCategories();
      fetchAllUsers();
    }
  }, [profile, navigate]);

  const updateMokebLocalStateAndCache = (mokebId: string, updates: Partial<Mokeb>) => {
    setMokebs(prev => {
      const updated = prev.map(m => m.id === mokebId ? { ...m, ...updates } : m);
      safeStorage.setItem('offline_mokebs', JSON.stringify(updated));
      return updated;
    });
    if (selectedMokeb && selectedMokeb.id === mokebId) {
      setSelectedMokeb(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleUpdateStatus = async (mokebId: string, status: MokebStatus) => {
    try {
      await updateDoc(doc(db, 'mokebs', mokebId), {
        status,
        updatedAt: serverTimestamp()
      });
      fetchMokebs();
    } catch (err) {
      console.warn("Firestore update failed, falling back to local update:", err);
      updateMokebLocalStateAndCache(mokebId, { status });
    }
  };

  const handleRequestProCard = async (mokebId: string) => {
    try {
      await updateDoc(doc(db, 'mokebs', mokebId), {
        proCardRequestStatus: 'pending',
        updatedAt: serverTimestamp()
      });
      alert('درخواست ساخت کارت گرافیکی معرفی موکب با موفقیت ثبت شد و در حال بررسی است.');
      fetchMokebs();
    } catch (err) {
      console.warn("Firestore pro card request failed, falling back to local update:", err);
      updateMokebLocalStateAndCache(mokebId, { proCardRequestStatus: 'pending' });
      alert('درخواست ساخت کارت گرافیکی معرفی موکب به صورت آفلاین ذخیره شد.');
    }
  };

  const handleRequestStory = async (mokebId: string) => {
    try {
      await updateDoc(doc(db, 'mokebs', mokebId), {
        storyRequestStatus: 'pending',
        updatedAt: serverTimestamp()
      });
      alert('درخواست فعال‌سازی سرویس استوری ۲۴ ساعته با موفقیت ثبت شد.');
      fetchMokebs();
    } catch (err) {
      console.warn("Firestore story request failed, falling back to local update:", err);
      updateMokebLocalStateAndCache(mokebId, { storyRequestStatus: 'pending' });
      alert('درخواست فعال‌سازی سرویس استوری ۲۴ ساعته به صورت آفلاین ثبت شد.');
    }
  };

  const handleSeedDemoMokeb = async () => {
    if (!profile?.isAdmin) return;
    try {
      setFetching(true);
      
      const demos = [
        {
          name: 'موکب بین‌المللی امام رضا (ع)',
          managerName: 'سید رضا علوی',
          phone: '09121111111',
          categoryId: 'test-category',
          address: 'کربلا، باب‌القبله حرم مطهر، عمود ۲۸۰',
          lat: 32.58,
          lng: 44.02,
          description: 'ارائه دهنده اسکان زائرین، همراه با برپایی نماز جماعت و پذیرایی سه وعده غذا.',
          detailedDescription: 'موکب بین‌المللی امام رضا (ع) با هدف خدمت‌رسانی بی‌وقفه به زانران اباعبدالله الحسین در عمود ۲۸۰ تاسیس شده است. این موکب مجهز به استراحتگاه‌های تفکیک‌شده خواهران و برادران و آشپزخانه بزرگ توزیع غذای گرم روزانه می‌باشد.',
          selectedServices: ["اسکان صلواتی برادران و خواهران", "توزیع سه وعده غذای گرم", "ایستگاه چای، قهوه و دمنوش صلواتی"],
          staffList: ["سید رضا علوی | سرپرست موکب", "علی کریمی | مسئول خادمین", "حاج رضا کربلایی | آشپز اصلی"],
          galleryUrls: [
            'https://images.unsplash.com/photo-1542856391-010fb87dcfed?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&q=80&w=600'
          ],
          trackingCode: 'MKB-REZA-' + Math.floor(1000 + Math.random() * 9000),
          status: 'pending_stage1',
          ownerId: profile.id,
          createdAt: serverTimestamp(),
        },
        {
          name: 'موکب شهدای مدافع حرم',
          managerName: 'محمد کرمی',
          phone: '09122222222',
          categoryId: 'test-category',
          address: 'مسیرهای تردد زائران، ایستگاه ۷۵۰',
          lat: 32.61,
          lng: 44.03,
          description: 'ایستگاه صلواتی توزیع چای، شربت، و خدمات درمانی سرپایی برای زائرین گرامی.',
          detailedDescription: 'موکب شهدای مدافع حرم به همت جمعی از جوانان پرشور میهن عزیزمان برپا گشته تا در زمینه توزیع شبانه‌روزی نوشیدنی‌های گرم، شربت‌های گیاهی سنتی خنک و چای عراقی و ایرانی به زائران گرامی مسیر بهشت ادای دین کند.',
          selectedServices: ["ایستگاه چای، قهوه و دمنوش صلواتی", "ایستگاه شارژ موبایل و اینترنت بی سیم", "تعمیرات کیف، کفش، ویلچر و کالسکه"],
          staffList: ["محمد کرمی | مسئول بیرق", "سجاد مرادی | متصدی چایخانه صلواتی", "امیرحسین رضایی | تعمیرات کفش زوار"],
          galleryUrls: [
            'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=600'
          ],
          trackingCode: 'MKB-SHHD-' + Math.floor(1000 + Math.random() * 9000),
          status: 'pending_stage2',
          ownerId: profile.id,
          createdAt: serverTimestamp(),
        },
        {
          name: 'موکب درمانی علی‌اکبر (ع)',
          managerName: 'دکتر امین رضایی',
          phone: '09123333333',
          categoryId: 'test-category',
          address: 'عمود ۱۱۲۰ - مجاور ایستگاه هلال احمر',
          lat: 32.62,
          lng: 44.07,
          description: 'مجموعه تخصصی فوریت‌های پزشکی، اهدای دارو و مشاوره درمانی رایگان.',
          detailedDescription: 'موکب درمانی علی‌اکبر (ع) با استقرار تیمی متشکل از پزشکان عمومی، پرستاران و تکنسین‌های داوطلب هلال‌احمر، آماده ارائه خدمات فوریت‌های سلامت، بررسی فشار و قند خون، و پانسمان پاهای خسته زائران گرامی در عمود ۱۱۲۰ است.',
          selectedServices: ["بخش درمانی و فوریت‌های پزشکی", "پاسخ به مسائل شرعی و غرفه‌های فرهنگی", "مهدکودک و تفریح زائران خردسال"],
          staffList: ["دکتر امین رضایی | پزشک کشیک و سرپرست", "خانم دکتر اکبری | پرستار مراقبت‌ها", "حجت‌الاسلام تقوی | پاسخ به مسائل شرعی"],
          galleryUrls: [
            'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=600'
          ],
          trackingCode: 'MKB-ALAK-' + Math.floor(1000 + Math.random() * 9000),
          status: 'active',
          ownerId: profile.id,
          createdAt: serverTimestamp(),
        }
      ];

      for (const item of demos) {
        await addDoc(collection(db, 'mokebs'), item);
      }

      fetchMokebs();
      alert("سه موکب آزمایشی با وضعیت‌های مختلف و شناسنامه‌های دیجیتالی حرفه‌ای فعال، با موفقیت در سیستم تولید شدند!");
    } catch(err) {
      console.log(err);
      alert("خطایی در ایجاد اطلاعات نمونه پیش آمد.");
    }
  };

  const getStatusBadge = (status: MokebStatus) => {
    switch (status) {
      case 'pending_stage1': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-200">در حال بررسی</span>;
      case 'approved_stage1': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-200">نیاز به اطلاعات بیشتر</span>;
      case 'pending_stage2': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-200">در حال بررسی</span>;
      case 'active': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-200">فعال و تایید شده</span>;
      case 'rejected': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold border border-red-200">مردود شده</span>;
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === 'admin') {
      alert('کاربر مدیر کل قابل حذف نیست.');
      return;
    }
    if (!window.confirm(`آیا از حذف کاربر «${userName}» اطمینان دارید؟`)) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      setAllUsers(prev => prev.filter(u => u.id !== userId));
      alert('کاربر با موفقیت حذف شد.');
    } catch (err) {
      console.error("Error deleting user:", err);
      alert('خطا در حذف کاربر.');
    }
  };

  const handleUpdateSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.isAdmin) return;
    setSubmittingSiteSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        siteLogoUrl: siteLogo,
        siteName: siteName.trim(),
        footerText: footerText.trim(),
        pwaRegistrationBannerEnabled,
        pwaVisitorAnnouncement: pwaVisitorAnnouncement.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert('تنظیمات سایت با موفقیت بروزرسانی شد.');
      setShowSiteSettingsManager(false);
    } catch (err) {
      console.error("Error updating site settings:", err);
      alert('خطا در بروزرسانی تنظیمات');
    } finally {
      setSubmittingSiteSettings(false);
    }
  };

  const handleTestDbConnection = async () => {
    setTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await fetch('/api/db/test');
      const data = await res.json();
      setDbTestResult({
        success: data.success,
        message: data.message || (data.success ? 'اتصال موفقیت‌آمیز بود' : 'اتصال ناموفق بود'),
        error: data.error
      });
    } catch (err) {
      setDbTestResult({
        success: false,
        message: 'خطا در ارتباط با سرور یا تنظیم نبودن مشخصات اتصال',
        error: (err as Error).message
      });
    } finally {
      setTestingDb(false);
    }
  };

  const handleSiteLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size, though we resize, we still want a reasonable initial limit (e.g., 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("حجم فایل نباید بیشتر از ۵ مگابایت باشد.");
      return;
    }

    try {
      const resizedBase64 = await resizeImage(file, 400, 400, 0.8);
      setSiteLogo(resizedBase64);
    } catch (error) {
      console.error("Error resizing image", error);
      alert("خطا در پردازش تصویر.");
    }
  };
  const handleDismissWelcome = () => {
    setShowWelcome(false);
    sessionStorage.setItem('mokeb_session_greeted', 'true');
  };

  const handleDeleteMokeb = async (mokebId: string, mokebName: string) => {
    if (!window.confirm(`آیا از حذف موکب «${mokebName}» اطمینان دارید؟ این عملیات غیرقابل بازگشت است.`)) return;
    try {
      await deleteDoc(doc(db, 'mokebs', mokebId));
      setMokebs(prev => prev.filter(m => m.id !== mokebId));
      const cached = safeStorage.getItem('offline_mokebs');
      if (cached) {
        try {
          const list = JSON.parse(cached) as Mokeb[];
          safeStorage.setItem('offline_mokebs', JSON.stringify(list.filter(m => m.id !== mokebId)));
        } catch (e) {}
      }
      alert('موکب با موفقیت حذف شد.');
      if (selectedMokeb?.id === mokebId) {
        setSelectedMokeb(null);
      }
    } catch (err) {
      console.error("Error deleting mokeb", err);
      alert('خطا در حذف موکب.');
    }
  };

  if (loading) return null;
  if (!user || !profile) return <Navigate to="/login" />;

  const totalMokebs = mokebs.length;
  const pendingStage1Count = mokebs.filter(m => m.status === 'pending_stage1').length;
  const pendingStage2Count = mokebs.filter(m => m.status === 'pending_stage2').length;
  const activeCount = mokebs.filter(m => m.status === 'active').length;
  const pendingProCardsCount = mokebs.filter(m => m.proCardRequestStatus === 'pending').length;
  const pendingStoriesCount = mokebs.filter(m => m.storyRequestStatus === 'pending').length;

  const totalPendingMokebRequests = pendingStage1Count + pendingStage2Count;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl relative" dir="rtl">
      
      {/* 🌟 Welcome Greeting Modal */}
      {showWelcome && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <Card className="max-w-lg w-full bg-white rounded-3xl border-slate-100 shadow-2xl relative overflow-hidden transition-transform transform scale-100">
            {/* Top decorative glow */}
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 via-emerald-500 to-blue-500" />
            
            <CardContent className="p-8">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-amber-50 rounded-full border border-amber-100 flex items-center justify-center text-amber-500 p-0 text-3xl">
                  <Sparkles className="w-8 h-8 animate-bounce text-amber-500" />
                </div>
              </div>

              <h2 className="text-2xl font-black text-center text-slate-900 mb-2 font-sans tracking-tight">
                ورود موفقیت‌آمیز به پورتال کمیته مواکب
              </h2>
              
              <p className="text-center text-slate-500 mb-6 text-xs font-medium">
                {profile.isAdmin ? 'سامانه یکپارچه نظارت و تایید موقعیت موکب‌های مردمی مرز و عتبات عالیات' : 'پایگاه مرکزی تکمیل مدارک و رهگیری صدور پروانه موکب'}
              </p>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-5 mb-6 text-sm text-slate-700 leading-relaxed font-sans">
                <span className="font-bold text-[#1a1c2c] block mb-2 text-base">
                  سلام، {profile.name || 'کاربر محترم'} {profile.isAdmin ? '👑 (مدیر کل)' : ''} گرامی؛
                </span>
                {profile.isAdmin ? (
                  <span>
                    شما با موفقیت به عنوان <b>مدیر کل سامانه</b> وارد شدید. در این بخش می‌توانید پرونده‌های ارسال شده را بررسی کنید، مدارک آن‌ها را رصد نموده، موکب‌ها را تایید یا رد کنید و دسته‌بندی‌های موکب، اسلایدرها و گزارش‌های آماری زنده را مدیریت کنید.
                  </span>
                ) : (
                  <span>
                    پرونده موکب‌های شخصی شما به راحتی در این پنل قابل رهگیری است. مراحل ۱ تا ۳ فرآیند بررسی را به صورت زنده دنبال کنید و در صورت نیاز به تکمیل اطلاعات، فرم‌های اختصاصی را بارگذاری نمایید تا پروانه موکب صادر شود.
                  </span>
                )}
              </div>

              <div className="flex gap-3 justify-center">
                <Button 
                  onClick={handleDismissWelcome} 
                  className="bg-[#1a1c2c] hover:bg-[#2b2e44] text-white px-8 py-2 md:py-3 font-semibold rounded-xl text-sm transition-all shadow-md shadow-slate-200 w-full"
                >
                  بسیار خب، ورود به پنل کاربری
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header section */}
      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {profile.isAdmin ? 'پنل مدیریت و نظارت مواکب' : 'کارتابل مدیریت موکب'}
            </h1>
            <p className="text-slate-400 text-sm font-sans">
              {`خوش آمدید، ${profile.name || 'کاربر گرامی'}`}
            </p>
            {/* Unified Search Box */}
            <div className="flex bg-slate-800 border border-slate-700 items-center gap-2 px-3 py-2 rounded-2xl max-w-lg shadow-inner">
              <Search className="text-slate-400 w-4 h-4 shrink-0" />
              <input 
                type="text"
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
                placeholder="جستجو بر اساس نام موکب، نام خادم، ایمیل یا نام کاربری..."
                className="w-full bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-xs text-white font-medium placeholder-slate-500"
              />
              {searchUserQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchUserQuery('')} 
                  className="text-xs text-red-400 hover:text-red-300 font-bold px-1.5"
                >
                  پاک کردن
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto self-stretch md:self-auto justify-end border-t border-white/10 pt-4 md:pt-0 md:border-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => {
                await logout();
                navigate('/login');
              }} 
              className="bg-red-500/10 text-red-300 border-red-500/20 hover:bg-red-500 hover:text-white font-extrabold gap-1.5 shadow-sm rounded-xl h-10 px-4 shrink-0 transition-all text-xs"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج از پنل</span>
            </Button>

            <Link to="/dashboard/tickets" className="shrink-0">
              <Button className="bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/40 text-white gap-2 transition-all shadow-md text-xs h-10 rounded-xl px-4">
                <span>💬 پشتیبانی و تیکت‌ها</span>
              </Button>
            </Link>

            {profile.isAdmin && (
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setShowAnalyticsModal(true)}
                  className="bg-[#007f5f]/10 text-[#007f5f] hover:bg-[#007f5f] hover:text-white border border-[#007f5f]/20 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 h-10 shadow-sm"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>📊 مانیتورینگ و آمار زنده</span>
                </button>
                <button 
                  onClick={() => {
                    setShowAuthManager(true);
                    setShowOfficialNoticesManager(false);
                  }}
                  className="bg-purple-500/10 text-purple-300 hover:bg-purple-500 hover:text-white border border-purple-500/20 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 h-10"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>🔑 مدیریت حساب‌ها</span>
                </button>
                <button 
                  onClick={() => {
                    setShowOfficialNoticesManager(true);
                    setShowAuthManager(false);
                  }}
                  className="bg-amber-500/10 text-amber-300 hover:bg-amber-500 hover:text-white border border-amber-500/20 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 h-10"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>📢 ابلاغیه‌های رسمی</span>
                </button>
                <button 
                  onClick={() => setShowOperatorAnnouncementsManager(true)}
                  className="bg-teal-500/10 text-teal-300 hover:bg-teal-500 hover:text-white border border-teal-500/20 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 h-10"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>📣 اعلانات موکب‌داران</span>
                </button>
                <button 
                  onClick={() => setShowSiteSettingsManager(true)}
                  className="bg-blue-500/10 text-blue-300 hover:bg-blue-500 hover:text-white border border-blue-500/20 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 h-10"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>⚙️ تنظیمات سایت</span>
                </button>
                <button 
                  onClick={() => setShowBackupManager(true)}
                  className="bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 h-10"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>💾 پشتیبان‌گیری SQL</span>
                </button>
                <button 
                  onClick={() => {
                    setShowDbTestModal(true);
                    handleTestDbConnection();
                  }}
                  className="bg-rose-500/10 text-rose-300 hover:bg-rose-500 hover:text-white border border-rose-500/20 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 h-10"
                >
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  <span>🔌 تست اتصال دیتابیس</span>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Horizontal quick navigation sidebar alternatives inside header for Admin */}
        {profile.isAdmin && (
          <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>دسترسی سریع به ماژول‌های اطلاعاتی ستاد:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/dashboard/categories">
                <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-lg h-8 px-3 text-[11px] gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  دسته‌بندی‌ها
                </Button>
              </Link>
              <Link to="/dashboard/routes">
                <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-lg h-8 px-3 text-[11px] gap-1.5">
                  <MapIcon className="w-3.5 h-3.5 text-violet-400" />
                  مسیرها و عمودها
                </Button>
              </Link>
              <Link to="/dashboard/sliders">
                <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-lg h-8 px-3 text-[11px] gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  اسلایدرها
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 🌟 USER REGULAR DASHBOARD (TRACKER + INTERACTIVE CHECKS) */}
      {profile.isAdmin && totalPendingMokebRequests > 0 && (
          <div className="mb-8 border-2 border-amber-300 bg-amber-50 rounded-2xl p-6 shadow-sm cursor-pointer hover:bg-amber-100 transition-all flex flex-col gap-4"
             onClick={() => {
               setViewMode('table');
               setTimeout(() => document.getElementById('mokebs-table')?.scrollIntoView({ behavior: 'smooth' }), 100);
             }}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-amber-200 text-amber-800">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-900 text-lg">شما {totalPendingMokebRequests} درخواست بررسی نشده دارید!</h3>
                    <p className="text-amber-800 text-sm">جهت تسریع در خدمترسانی موکبها لطفاً نسبت به بررسی موارد فوق اقدام فرمایید.</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-amber-800" />
            </div>
            
            {/* Breakdown */}
            <div className="flex flex-wrap gap-2">
                {pendingStage1Count > 0 && (
                    <span className="bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-lg text-xs font-bold">
                        {pendingStage1Count} بررسی اولیه
                    </span>
                )}
                {pendingStage2Count > 0 && (
                    <span className="bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-lg text-xs font-bold">
                        {pendingStage2Count} تایید نهایی
                    </span>
                )}
            </div>
          </div>
        )}

      {!profile.isAdmin && (
        <div className="space-y-8 mb-12">
          {operatorAnnouncements.length > 0 && (
            <Card className="rounded-3xl border border-slate-100 bg-white overflow-hidden shadow-sm" dir="rtl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center">
                    <Megaphone className="w-5 h-5 text-teal-600 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm">📣 اطلاعیه‌ها و اعلانات مهم ستاد مواکب</h3>
                    <p className="text-[10px] text-slate-400">آخرین دستورالعمل‌ها، بخش‌نامه‌ها و فراخوان‌های اختصاصی مواکب</p>
                  </div>
                </div>

                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {operatorAnnouncements.map((ann) => (
                    <div 
                      key={ann.id} 
                      className={`p-4 border rounded-2xl flex flex-col md:flex-row md:items-start md:justify-between gap-4 transition-all ${
                        ann.importance === 'critical' ? 'bg-red-50/55 border-red-150' :
                        ann.importance === 'warning' ? 'bg-amber-50/55 border-amber-150' :
                        'bg-slate-50 border-slate-150'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full ${
                            ann.importance === 'critical' ? 'bg-red-100 text-red-700' :
                            ann.importance === 'warning' ? 'bg-amber-100 text-amber-800' :
                            'bg-teal-100 text-teal-800'
                          }`}>
                            {ann.importance === 'critical' ? 'فوری و اضطراری' : ann.importance === 'warning' ? 'مهم' : 'اطلاع‌رسانی'}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold">
                            {formatFarsiDate(ann.createdAt)}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-xs text-slate-800">{ann.title}</h4>
                        <p className="text-[10px] text-slate-600 leading-relaxed text-justify whitespace-pre-line">{ann.content}</p>
                      </div>

                      {ann.attachmentUrl && (
                        <div className="shrink-0 flex items-center">
                          <a 
                            href={ann.attachmentUrl} 
                            download={ann.attachmentName || 'announcement_file'} 
                            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-[11px] font-extrabold px-4 py-2 rounded-xl transition-colors shadow-sm"
                          >
                            <FileText className="w-4 h-4 text-teal-600" />
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-slate-800 leading-none">دانلود سند ضمیمه</p>
                              <p className="text-[8px] text-slate-400 mt-0.5 max-w-[120px] truncate">{ann.attachmentName || 'فایل پیوست'}</p>
                            </div>
                            <Download className="w-3.5 h-3.5 text-slate-400 mr-1" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {mokebs.map((mokeb) => {
            const isActive = mokeb.status === 'active';
            const isRejected = mokeb.status === 'rejected';
            const isPending1 = mokeb.status === 'pending_stage_1';
            const isApproved1 = mokeb.status === 'approved_stage_1';
            const isPending2 = mokeb.status === 'pending_stage_2';
            
            return (
              <div key={mokeb.id} className="animate-in fade-in slide-in-from-bottom-5 duration-500">
                <Card className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm bg-white" dir="rtl">
                  <div className="p-5 sm:p-8 pr-7 space-y-6">
                        
                        {/* Title and Top header status receipt */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-slate-500 text-[10px] font-bold bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg font-mono">
                                کد پرونده: {mokeb.trackingCode || 'ثبت بدون کد'}
                              </span>
                              <span className="text-slate-500 text-[10px] font-sans font-bold">
                                تاریخ ثبت: {formatFarsiDate(mokeb.createdAt)}
                              </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-black text-slate-800 pt-1">
                              موقعیت پایش موکب: {mokeb.name}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-bold ml-1">وضعیت:</span>
                            {isActive && (
                              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center gap-1.5 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                فعال و دارای پروانه رسمی
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                رد صلاحیت / نیازمند تعدیل
                              </span>
                            )}
                            {isPending1 && (
                              <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-bold text-xs flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                در انتظار ارزیابی اولیه مدارک
                              </span>
                            )}
                            {isApproved1 && (
                              <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                تایید اول - در انتظار صدور پروانه
                              </span>
                            )}
                            {isPending2 && (
                              <span className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-bold text-xs flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
                                درگاه تایید عالی ستاد عتبات
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Interactive Step-by-Step Tracker Pipeline (Responsive: vertical on mobile, horizontal on desktop) */}
                        <div className="space-y-3.5">
                          <h4 className="font-extrabold text-xs text-slate-700">📍 روند پایش و صدور پروانه موکب:</h4>
                          
                          {/* Desktop Stepper */}
                          <div className="hidden md:grid grid-cols-4 gap-6 relative pt-2">
                            <div className="absolute top-[22px] inset-x-8 h-1 bg-slate-100 z-0" />

                            {/* Step 1 */}
                            <div className="relative z-10 flex flex-col items-start text-right space-y-2">
                              <div className="w-11 h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-sm shadow-md shadow-emerald-500/20 border-4 border-white">✓</div>
                              <div className="space-y-0.5">
                                <h5 className="font-bold text-xs text-slate-800">۱. ثبت‌نام سجلی و هویتی</h5>
                                <p className="text-[9px] text-slate-400">حساب خادمی با کدملی {profile.nationalId || '-'} تایید شد.</p>
                              </div>
                            </div>

                            {/* Step 2 */}
                            <div className="relative z-10 flex flex-col items-start text-right space-y-2">
                              <div className="w-11 h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-sm shadow-md shadow-emerald-500/20 border-4 border-white">✓</div>
                              <div className="space-y-0.5">
                                <h5 className="font-bold text-xs text-slate-800">۲. ثبت مشخصات فنی</h5>
                                <p className="text-[9px] text-slate-400">موقعیت دقیق، کادر خادمین و خدمات صلواتی الصاق شد.</p>
                              </div>
                            </div>

                            {/* Step 3 */}
                            <div className="relative z-10 flex flex-col items-start text-right space-y-2">
                              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm border-4 border-white shadow-md ${
                                isActive ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
                                isRejected ? 'bg-rose-500 text-white shadow-rose-500/20' :
                                isPending2 ? 'bg-purple-600 text-white shadow-purple-600/20 animate-pulse' :
                                isApproved1 ? 'bg-blue-600 text-white shadow-blue-600/20' :
                                'bg-amber-500 text-slate-950 shadow-amber-500/20 animate-bounce'
                              }`}>
                                {isActive ? '✓' : isRejected ? '✕' : '⏳'}
                              </div>
                              <div className="space-y-0.5">
                                <h5 className="font-bold text-xs text-slate-800">۳. ارزیابی ستاد</h5>
                                <p className="text-[9px] text-slate-400">
                                  {isPending1 ? 'پرونده هویتی در نوبت ارزیابی و تطبیق است.' :
                                   isApproved1 ? 'تایید فنی اول صادر شده و ارجاع به کارگروه عالی گردید.' :
                                   isPending2 ? 'در حال پایش اطلاعات درگاه و ارزیابی عالی.' :
                                   isActive ? 'ارزیابی ممیزی با تایید ۱۰۰٪ کامل شد.' : 'پرونده با عدم تطبیق متوقف شد.'}
                                </p>
                              </div>
                            </div>

                            {/* Step 4 */}
                            <div className="relative z-10 flex flex-col items-start text-right space-y-2">
                              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm border-4 border-white ${
                                isActive ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {isActive ? '✓' : '۴'}
                              </div>
                              <div className="space-y-0.5">
                                <h5 className="font-bold text-xs text-slate-800">۴. صدور پروانه رسمی</h5>
                                <p className="text-[9px] text-slate-400">انتشار بر روی نقشه تعاملی زائران و فعال‌سازی سرویس‌ها.</p>
                              </div>
                            </div>
                          </div>

                          {/* Mobile Stepper (Clean & Vertical) */}
                          <div className="block md:hidden space-y-3 pt-1">
                            <div className="flex gap-3 items-start">
                              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">✓</div>
                              <div>
                                <h5 className="font-bold text-xs text-slate-850">۱. ثبت‌نام سجلی و هویتی</h5>
                                <p className="text-[10px] text-slate-400">شناسنامه هویتی با کدملی {profile.nationalId || '-'} تایید شد.</p>
                              </div>
                            </div>

                            <div className="flex gap-3 items-start border-r-2 border-dashed border-slate-100 pr-2.5 mr-2.5 pb-1">
                              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">✓</div>
                              <div>
                                <h5 className="font-bold text-xs text-slate-855">۲. ثبت مشخصات فنی موکب</h5>
                                <p className="text-[10px] text-slate-400">ثبت موقعیت جغرافیایی، کادر خادمین و چارت سازمانی.</p>
                              </div>
                            </div>

                            <div className="flex gap-3 items-start border-r-2 border-dashed border-slate-100 pr-2.5 mr-2.5 pb-1">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                isActive ? 'bg-emerald-500 text-white' :
                                isRejected ? 'bg-rose-500 text-white' :
                                'bg-amber-500 text-slate-900 animate-pulse'
                              }`}>
                                {isActive ? '✓' : isRejected ? '✕' : '⏳'}
                              </div>
                              <div>
                                <h5 className="font-bold text-xs text-slate-855 font-sans">۳. ممیزی و ارزیابی ستاد</h5>
                                <p className="text-[10px] text-slate-500 font-medium">
                                  {isPending1 ? 'در نوبت ممیزی و هماهنگی مدارک.' :
                                   isApproved1 ? 'تایید فنی اول صادر شد و پرونده به ستاد عالی رفت.' :
                                   isPending2 ? 'در حال تایید عالی ستاد عتبات.' :
                                   isActive ? 'ارزیابی ممیزی ۱۰۰٪ تکمیل شد.' : 'پرونده متوقف شد.'}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-3 items-start">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {isActive ? '✓' : '۴'}
                              </div>
                              <div>
                                <h5 className="font-bold text-xs text-slate-855">۴. صدور پروانه رسمی</h5>
                                <p className="text-[10px] text-slate-400">نمایش آیکون موکب روی نقشه زائران و فعال‌سازی پنل مدیریت.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Consolidated Action Panel (Single Unified, Responsive Grid) */}
                        <div className="pt-2">
                          <h4 className="font-extrabold text-xs text-slate-700 mb-3">🛠️ میز کار و ابزارهای مدیریت موکب‌دار:</h4>
                          
                          {/* If NOT fully active yet, show a clean helper call to complete details */}
                          {!isActive && !isRejected && (
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                              <div className="space-y-1">
                                <span className="text-[11px] font-black text-[#007f5f] block">📝 نیاز به ویرایش یا تکمیل اطلاعات دارید؟</span>
                                <p className="text-[10px] text-slate-500 font-medium font-sans">تا زمان صدور نهایی پروانه می‌توانید اطلاعات فنی، آدرس، خادمین و تصاویر خود را ویرایش کنید.</p>
                              </div>
                              <Link to={`/dashboard/mokeb/${mokeb.id}/complete`} className="w-full sm:w-auto">
                                <Button className="bg-[#1a1c2c] hover:bg-slate-800 text-white font-bold text-xs h-9.5 px-4 rounded-xl w-full">
                                  تکمیل و ویرایش شناسنامه فنی
                                </Button>
                              </Link>
                            </div>
                          )}

                          {isRejected && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-xs font-semibold leading-relaxed mb-4">
                              ❌ متأسفانه پرونده موکب شما دارای نقص مدارک جدی است یا مورد تایید ستاد ممیزی قرار نگرفته است. برای رفع نقص و هماهنگی مجدد، از دکمه «پشتیبانی و تیکت‌ها» در بالای همین صفحه پیام بفرستید.
                            </div>
                          )}

                          {/* Unified Grid for Tools (active or locked) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            
                            {/* Tool 1: Visual Stories */}
                            <div className={`p-4 rounded-2xl border flex flex-col justify-between ${isActive ? 'bg-purple-50/40 border-purple-100' : 'bg-slate-50/50 border-slate-150 opacity-60'}`}>
                              <div className="space-y-1.5 mb-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">🎬</span>
                                  <h5 className="font-extrabold text-xs text-slate-800">داستان‌های تصویری (استوری ۲۴ ساعته)</h5>
                                </div>
                                <p className="text-[10px] text-slate-500 font-sans leading-normal">امکان ارسال روزانه عکس و فیلم‌های کوتاه از زنده بودن و حضور معنوی موکب شما بر روی نقشه زائران.</p>
                              </div>
                              
                              <div>
                                {isActive ? (
                                  <div className="flex items-center gap-2">
                                    {(!mokeb.storyRequestStatus || mokeb.storyRequestStatus === 'none') && (
                                      <Button 
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] h-9.5 w-full rounded-xl"
                                        onClick={() => handleRequestStory(mokeb.id)}
                                      >
                                        فعال‌سازی سرویس استوری
                                      </Button>
                                    )}
                                    {mokeb.storyRequestStatus === 'pending' && (
                                      <div className="bg-amber-50 text-amber-700 border border-amber-200 py-2 rounded-xl text-[10px] font-bold text-center w-full">
                                        ⏳ درخواست در دست بررسی
                                      </div>
                                    )}
                                    {mokeb.storyRequestStatus === 'approved' && (
                                      <Button 
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] h-9.5 w-full rounded-xl"
                                        onClick={() => setSelectedStoryMokeb(mokeb)}
                                      >
                                        📸 مدیریت و ارسال استوری جدید
                                      </Button>
                                    )}
                                    {mokeb.storyRequestStatus === 'rejected' && (
                                      <Button 
                                        variant="outline"
                                        className="border-purple-300 text-purple-700 font-bold text-[10px] h-9.5 w-full rounded-xl hover:bg-purple-50"
                                        onClick={() => handleRequestStory(mokeb.id)}
                                      >
                                        رد شده - درخواست مجدد فعال‌سازی
                                      </Button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold block text-center">🔒 نیازمند فعال بودن موکب (مرحله ۴)</span>
                                )}
                              </div>
                            </div>

                            {/* Tool 2: Announcements Panel */}
                            <div className={`p-4 rounded-2xl border flex flex-col justify-between ${isActive ? 'bg-amber-50/40 border-amber-200/60' : 'bg-slate-50/50 border-slate-150 opacity-60'}`}>
                              <div className="space-y-1.5 mb-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">📢</span>
                                  <h5 className="font-extrabold text-xs text-slate-800">پنل اطلاعیه‌ها و پیام‌های زنده</h5>
                                </div>
                                <p className="text-[10px] text-slate-500 font-sans leading-normal">مدیریت انتشار اخبار مهم موکب نظیر اتمام ظرفیت اسکان، ساعات توزیع غذا و گمشده‌ها در بستر زائران.</p>
                              </div>
                              
                              <div>
                                {isActive ? (
                                  <Button 
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] h-9.5 w-full rounded-xl"
                                    onClick={() => setSelectedAnnouncementMokeb(mokeb)}
                                  >
                                    📝 ثبت و ویرایش اطلاعیه جدید
                                  </Button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold block text-center">🔒 نیازمند فعال بودن موکب (مرحله ۴)</span>
                                )}
                              </div>
                            </div>

                            {/* Tool 3: Categories & Services */}
                            <div className={`p-4 rounded-2xl border flex flex-col justify-between ${isActive ? 'bg-emerald-50/40 border-emerald-100' : 'bg-slate-50/50 border-slate-150 opacity-60'}`}>
                              <div className="space-y-1.5 mb-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">📊</span>
                                  <h5 className="font-extrabold text-xs text-slate-800">مدیریت دسته‌بندی و تسهیلات صلواتی</h5>
                                </div>
                                <p className="text-[10px] text-slate-500 font-sans leading-normal">تطبیق و ویرایش لیست خدمات صلواتی ارائه‌شده اعم از سرویس بهداشتی، حمام و اسکان زوار.</p>
                              </div>
                              
                              <div>
                                {isActive ? (
                                  <Link to="/dashboard/categories" className="block w-full">
                                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] h-9.5 w-full rounded-xl">
                                      ✏️ ویرایش سبد خدمات فعال موکب
                                    </Button>
                                  </Link>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold block text-center">🔒 نیازمند فعال بودن موکب (مرحله ۴)</span>
                                )}
                              </div>
                            </div>

                            {/* Tool 4: Professional Card */}
                            <div className={`p-4 rounded-2xl border flex flex-col justify-between ${isActive ? 'bg-sky-50/40 border-sky-100' : 'bg-slate-50/50 border-slate-150 opacity-60'}`}>
                              <div className="space-y-1.5 mb-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">💳</span>
                                  <h5 className="font-extrabold text-xs text-slate-800">کارت معرفی گرافیکی و حرفه‌ای</h5>
                                </div>
                                <p className="text-[10px] text-slate-500 font-sans leading-normal">درخواست تولید کارت معرفی دیجیتال با اطلاعات رسمی موکب جهت اشتراک گذاری در فضای مجازی.</p>
                              </div>
                              
                              <div>
                                {isActive ? (
                                  <div className="flex items-center gap-2">
                                    {(!mokeb.proCardRequestStatus || mokeb.proCardRequestStatus === 'none') && (
                                      <Button 
                                        className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] h-9.5 w-full rounded-xl"
                                        onClick={() => handleRequestProCard(mokeb.id)}
                                      >
                                        سفارش ساخت کارت معرفی دیجیتال
                                      </Button>
                                    )}
                                    {mokeb.proCardRequestStatus === 'pending' && (
                                      <div className="bg-amber-50 text-amber-700 border border-amber-200 py-2 rounded-xl text-[10px] font-bold text-center w-full">
                                        ⏳ کارت در حال آماده سازی
                                      </div>
                                    )}
                                    {mokeb.proCardRequestStatus === 'approved' && (
                                      <Button 
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] h-9.5 w-full rounded-xl"
                                        onClick={() => setSelectedProCardMokeb(mokeb)}
                                      >
                                        ✨ مشاهده و دانلود کارت صادر شده
                                      </Button>
                                    )}
                                    {mokeb.proCardRequestStatus === 'rejected' && (
                                      <Button 
                                        variant="outline"
                                        className="border-sky-300 text-sky-700 font-bold text-[10px] h-9.5 w-full rounded-xl hover:bg-sky-50"
                                        onClick={() => handleRequestProCard(mokeb.id)}
                                      >
                                        رد شده - سفارش مجدد ساخت کارت
                                      </Button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold block text-center">🔒 نیازمند فعال بودن موکب (مرحله ۴)</span>
                                )}
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* ⭐ Star Ratings & Reviews Dashboard for Mokeb Owner */}
                        <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
                          {(() => {
                            const mReviews = allReviews.filter(r => r.mokebId === mokeb.id);
                            const mAvg = mReviews.length > 0 
                              ? (mReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / mReviews.length).toFixed(1) 
                              : null;

                            return (
                              <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-150 text-right" dir="rtl">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 border-b border-slate-200 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">⭐</span>
                                    <h5 className="font-extrabold text-xs text-slate-800">ارزیابی و امتیازهای مردمی زائرین</h5>
                                    <span className="text-[10px] font-bold bg-[#007f5f]/10 text-[#007f5f] px-2 py-0.5 rounded-md">
                                      {mReviews.length} امتیاز ثبت شده
                                    </span>
                                  </div>
                                  
                                  {mAvg && (
                                    <div className="flex items-center gap-1.5 self-start sm:self-auto bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
                                      <span className="text-[10px] font-extrabold text-amber-800">میانگین امتیاز زوار:</span>
                                      <span className="text-xs font-black text-amber-600 font-sans">★ {Number(mAvg).toLocaleString('fa-IR')} از ۵</span>
                                    </div>
                                  )}
                                </div>

                                {mReviews.length === 0 ? (
                                  <p className="text-[10px] text-slate-400 italic font-bold py-1">هنوز هیچ امتیازی برای موکب شما ثبت نشده است.</p>
                                ) : (
                                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                                    {mReviews.map((rev) => (
                                      <div key={rev.id} className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs space-y-1 text-right">
                                        <div className="flex justify-between items-center text-[9px] text-slate-500">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-slate-700">{rev.reviewerName || rev.userName || 'زائر گرامی'}</span>
                                            <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.2 rounded font-sans">
                                              ارزیاب تایید شده
                                            </span>
                                          </div>
                                          <span className="font-sans text-[8px]">
                                            {rev.createdAt ? formatFarsiDate(rev.createdAt) : ''}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          {Array.from({ length: 5 }).map((_, i) => (
                                            <span key={i} className={`text-[10px] ${i < (Number(rev.rating) || 0) ? 'text-amber-500' : 'text-slate-200'}`}>
                                              ★
                                            </span>
                                          ))}
                                        </div>

                                        {rev.comment && (
                                          <p className="text-[10px] text-slate-600 leading-relaxed font-medium">{rev.comment}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}

      {profile.isAdmin && !showAuthManager && !showOfficialNoticesManager && (
        <div className="space-y-4 mb-8">
          {false && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-2xl shadow-sm text-amber-900 border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                  <AlertCircle className="w-6 h-6 text-amber-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold truncate">شما {totalPendingMokebRequests} درخواست بررسی نشده دارید!</h3>
                  <p className="text-xs text-amber-700/80 mt-1 font-semibold">جهت تسریع در خدمت‌رسانی موکب‌ها لطفاً نسبت به بررسی موارد زیر اقدام فرمایید.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {pendingStage1Count > 0 && (
                  <span className="bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold text-center flex-1 md:flex-none">
                    {pendingStage1Count} بررسی اولیه
                  </span>
                )}
                {pendingStage2Count > 0 && (
                  <span className="bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold text-center flex-1 md:flex-none">
                    {pendingStage2Count} تایید نهایی
                  </span>
                )}
                {pendingProCardsCount > 0 && (
                  <span className="bg-sky-100 text-sky-700 border border-sky-200 px-3 py-1.5 rounded-lg text-xs font-bold text-center flex-1 md:flex-none">
                    {pendingProCardsCount} صدور کارت
                  </span>
                )}
                {pendingStoriesCount > 0 && (
                  <span className="bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg text-xs font-bold text-center flex-1 md:flex-none">
                    {pendingStoriesCount} مجوز استوری
                  </span>
                )}
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Card className="bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">کل موکب‌های ثبت شده</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1 font-mono">{totalMokebs}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/50 flex items-center justify-center text-slate-600 shadow-sm">
                  <MapPin className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white to-amber-50/20 border border-amber-100/80 shadow-sm rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-600">در انتظار بررسی اول</p>
                  <h3 className="text-2xl font-black text-amber-700 mt-1 font-mono">{pendingStage1Count}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
                  <AlertCircle className="w-6 h-6 animate-pulse" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white to-purple-50/20 border border-purple-100/80 shadow-sm rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-purple-600">در انتظار تایید نهایی</p>
                  <h3 className="text-2xl font-black text-purple-700 mt-1 font-mono">{pendingStage2Count}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
                  <Layers className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white to-emerald-50/20 border border-emerald-100/80 shadow-sm rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-600">موکب‌های فعال شده</p>
                  <h3 className="text-2xl font-black text-emerald-700 mt-1 font-mono">{activeCount}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 🌟 View Toggle and List Section */}
      {profile.isAdmin && !showAuthManager && !showOfficialNoticesManager && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden mb-12">
        <div className="p-4 sm:p-6 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-800 text-lg">
              {profile.isAdmin ? 'مدیریت موکب‌های سامانه‌' : 'پرونده‌های شما'}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100 font-mono">
              {mokebs.length} موکب
            </span>
          </div>

          {/* Segmented Controller Toggle */}
          <div className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200">
            <button 
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>نمای کارتی نوآورانه (پیشنهادی)</span>
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <List className="w-3.5 h-3.5" />
              <span>نمای جدولی کلاسیک</span>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {fetching ? (
            <div className="p-16 text-center text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
              <span>در حال بارگذاری اطلاعات موکب‌ها...</span>
            </div>
          ) : mokebs.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <MapPin className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-bold text-slate-800 mb-1">هیچ موکبی برای نمایش وجود ندارد.</p>
              <p className="text-xs text-slate-400">جهت شروع، موکب جدید خود را ثبت نام بکنید.</p>
            </div>
          ) : viewMode === 'grid' ? (
            /* 🌟 Grid of Creative Cards */
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50/20">
              {mokebs.map(mokeb => {
                return (
                  <div 
                    key={mokeb.id}
                    onClick={() => setSelectedMokeb(mokeb)}
                    className="group bg-white rounded-2xl border border-slate-100 hover:border-slate-300 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden relative flex flex-col h-full transform hover:-translate-y-1"
                  >
                    {/* Colored left strip based on status */}
                    <div className={`absolute top-0 bottom-0 right-0 w-1.5 ${
                      mokeb.status === 'active' ? 'bg-emerald-500' :
                      mokeb.status === 'rejected' ? 'bg-red-500' :
                      mokeb.status === 'pending_stage2' ? 'bg-purple-500' :
                      mokeb.status === 'approved_stage1' ? 'bg-blue-500' : 'bg-amber-500'
                    }`} />
                    
                    <div className="p-5 flex-1 pr-7">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden relative">
                             {mokeb.avatarUrl ? (
                               <img src={mokeb.avatarUrl} alt={mokeb.name} className="w-full h-full object-cover" />
                             ) : siteSettings?.siteLogoUrl ? (
                               <img src={siteSettings.siteLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                             ) : (
                               <span className="text-xl">🕌</span>
                             )}
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 px-2.5 py-0.5 rounded-full bg-slate-100 uppercase tracking-wide">
                            {getCategoryName(mokeb.categoryId)}
                          </span>
                        </div>
                        {getStatusBadge(mokeb.status)}
                      </div>

                      <h3 className="font-bold text-slate-800 text-base mb-3 group-hover:text-[#1a1c2c] transition-colors line-clamp-1 flex items-center justify-between">
                        <span>{mokeb.name}</span>
                        <div className="flex shrink-0 gap-1 rtl:mr-2">
                           {profile.isAdmin && mokeb.proCardRequestStatus === 'pending' && (
                              <span className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 shadow-sm" title="درخواست ساخت کارت گرافیکی">
                                <Sparkles className="w-3 h-3" />
                              </span>
                           )}
                           {profile.isAdmin && mokeb.storyRequestStatus === 'pending' && (
                              <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm" title="درخواست فعال‌سازی استوری">
                                <PlaySquare className="w-3 h-3" />
                              </span>
                           )}
                        </div>
                      </h3>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium line-clamp-1">مسئول: {mokeb.managerName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono">{mokeb.phone}</span>
                        </div>
                        {mokeb.address && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="line-clamp-1">{mokeb.address}</span>
                          </div>
                        )}
                      </div>

                      {/* Horizontal Step Progress-Bar pipeline */}
                      <div className="border-t border-slate-50 pt-4 mt-auto">
                        <p className="text-[10px] font-bold text-slate-400 mb-2">روند بررسی فرآیندها:</p>
                        <div className="flex items-center gap-2">
                          {mokeb.status === 'active' ? (
                            <>
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-emerald-500 text-white shadow-sm">✓</div>
                              <span className="text-[11px] font-bold text-emerald-600">پروانه موکب فعال و تایید شده است</span>
                            </>
                          ) : mokeb.status === 'rejected' ? (
                            <>
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-red-500 text-white shadow-sm">✕</div>
                              <span className="text-[11px] font-bold text-red-600">درخواست رد شده است</span>
                            </>
                          ) : (
                            <>
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-amber-100 text-amber-700 font-black animate-pulse shadow-sm">●</div>
                              <span className="text-[11px] font-bold text-amber-600">در حال بررسی و ارزیابی</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Section */}
                    <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider">
                          {mokeb.trackingCode || 'ثبت بدون کد'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMokeb(mokeb.id, mokeb.name);
                          }}
                          className="text-red-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50"
                          title="حذف موکب"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs text-[#1a1c2c] group-hover:text-amber-600 font-bold flex items-center gap-1 transition-colors">
                        <span>رصد مستقیم پرونده</span>
                        <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 🌟 Classical Table View */
            <div className="overflow-x-auto" id="mokebs-table">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold sticky top-0">
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4">نام موکب</th>
                    <th className="px-6 py-4 hidden md:table-cell">مسئول</th>
                    <th className="px-6 py-4 hidden sm:table-cell">کد رهگیری</th>
                    {profile.isAdmin && <th className="px-6 py-4 hidden lg:table-cell">مدارک</th>}
                    <th className="px-6 py-4 text-center">وضعیت</th>
                    <th className="px-6 py-4 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {mokebs.map(mokeb => (
                    <tr 
                      key={mokeb.id} 
                      onClick={() => setSelectedMokeb(mokeb)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span>{mokeb.name}</span>
                          {profile.isAdmin && mokeb.proCardRequestStatus === 'pending' && (
                             <span className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center text-sky-600" title="درخواست ساخت کارت گرافیکی">
                               <Sparkles className="w-3 h-3" />
                             </span>
                          )}
                          {profile.isAdmin && mokeb.storyRequestStatus === 'pending' && (
                             <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-purple-600" title="درخواست فعال‌سازی استوری">
                               <PlaySquare className="w-3 h-3" />
                             </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-slate-600">
                        {mokeb.managerName} <br />
                        <span className="text-[10px] text-slate-400 font-mono">{mokeb.phone}</span>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell text-slate-600 font-mono text-xs">
                        {mokeb.trackingCode || '-'}
                      </td>
                      {profile.isAdmin && (
                        <td className="px-6 py-4 hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
                          {mokeb.documentUrl ? (
                            <a href={mokeb.documentUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">مشاهده فایل</a>
                          ) : (
                            <span className="text-slate-400">ندارد</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(mokeb.status)}
                      </td>
                      <td className="px-6 py-4 text-left whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {!profile.isAdmin ? (
                            <>
                               {mokeb.status === 'active' ? (
                                 <Link to={`/dashboard/mokeb/${mokeb.id}/complete`}>
                                   <Button size="sm" className="bg-[#1a1c2c] hover:bg-slate-800 text-white font-bold text-xs h-8.5 rounded-lg px-3">
                                     مدیریت و ویرایش موکب
                                   </Button>
                                 </Link>
                               ) : (
                                 <span className="text-xs text-amber-600 font-bold bg-amber-50 px-3 py-2 rounded-lg">در حال بررسی</span>
                               )}
                            </>
                          ) : (
                             <Link to={`/dashboard/admin/mokeb/${mokeb.id}`}>
                               <Button size="sm" variant="outline" className="text-blue-600 border-blue-200">بررسی پرونده</Button>
                             </Link>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleDeleteMokeb(mokeb.id, mokeb.name)}
                            className="text-red-500 hover:bg-red-50 border-red-200 hover:text-red-700 h-8.5 rounded-lg px-2"
                            title="حذف موکب"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      {/* 🔑 Creative Integrated Account Management View */}
      {profile.isAdmin && showAuthManager && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500" dir="rtl">
          {/* Header Card */}
          <div className="bg-gradient-to-l from-purple-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-3xl border border-purple-950 shadow-xl relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-purple-500/20 text-purple-300 p-2 rounded-xl border border-purple-500/30">
                    <Lock className="w-5 h-5 text-purple-300 animate-pulse" />
                  </span>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight">پرتال امنیتی و مدیریت یکپارچه حساب‌های خادمین</h2>
                </div>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-sans max-w-2xl">
                  مدیر کل گرامی؛ در این صفحه اختصاصی می‌توانید نام‌های کاربری، مشخصات عبور، سطوح دسترسی و وضعیت ورود تمامی موکب‌داران مراسم تشییع رهبر شهید را به صورت آنی مدیریت، جستجو و ممیزی نمایید.
                </p>
              </div>

              <Button 
                onClick={() => {
                  setShowAuthManager(false);
                  setEditingUser(null);
                }}
                className="bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs h-10 px-5 rounded-xl border border-white/10 gap-1.5 self-start md:self-auto shadow-sm backdrop-blur transition-all"
              >
                <ArrowRight className="w-4 h-4 text-purple-300" />
                <span>بازگشت به پیشخوان اصلی</span>
              </Button>
            </div>

            {/* Dashboard Quick stats inside Accounts Section */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-400 font-bold">کل حساب‌های کاربری</p>
                  <p className="text-xl font-black mt-1 font-mono text-purple-300">{allUsers.length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-300">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-400 font-bold">مدیران ارشد سامانه</p>
                  <p className="text-xl font-black mt-1 font-mono text-red-300">{allUsers.filter(u => u.isAdmin).length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-300">
                  <Shield className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-400 font-bold">خادمان و موکب‌داران</p>
                  <p className="text-xl font-black mt-1 font-mono text-emerald-300">{allUsers.filter(u => !u.isAdmin).length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-300">
                  <UserIcon className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Inline Edit Credential panel (Smooth transition) */}
          {editingUser && (
            <Card className="border-2 border-purple-500/30 bg-purple-50/5 rounded-3xl overflow-hidden shadow-md animate-in zoom-in-95 duration-300">
              <CardContent className="p-6 md:p-8 space-y-4">
                <div className="flex items-center justify-between border-b border-purple-500/10 pb-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping" />
                    <h3 className="text-sm font-black text-slate-800">
                      تغییر و بروزرسانی مشخصات امنیتی برای خادم: <span className="text-purple-600 font-black">{editingUser.name || editingUser.email}</span>
                    </h3>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setEditingUser(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-xs"
                  >
                    بستن فرم ویرایش ✕
                  </Button>
                </div>

                <form onSubmit={handleUpdateUserCredentials} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-500">نام موکب / خادم معرفی شده</label>
                      <input 
                        type="text" 
                        value={editingUserDisplayName} 
                        onChange={(e) => setEditingUserDisplayName(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        placeholder="مثلا: موکب امام علی (ع)"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-500">نام کاربری جدید (یا شناسه ورود)</label>
                      <input 
                        type="text" 
                        value={editUsernameVal} 
                        onChange={(e) => setEditUsernameVal(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono text-left"
                        placeholder="e.g. mokeb_ali"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-500">کلمه عبور جدید (پسورد)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={editPasswordVal} 
                          onChange={(e) => setEditPasswordVal(e.target.value)}
                          required
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono text-left"
                          placeholder="کلمه عبور"
                          dir="ltr"
                        />
                        <button 
                          type="button"
                          onClick={() => setEditPasswordVal("123456")}
                          className="text-[10px] px-2.5 py-1.5 rounded-xl border bg-indigo-50 border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100 transition-all shadow-sm shrink-0"
                          title="ریست به پیش‌فرض ۱۲۳۴۵۶"
                        >
                          ریست (۱۲۳۴۵۶)
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
                            let rand = '';
                            for (let i = 0; i < 8; i++) {
                              rand += chars.charAt(Math.floor(Math.random() * chars.length));
                            }
                            setEditPasswordVal(rand);
                          }}
                          className="text-[10px] px-2.5 py-1.5 rounded-xl border bg-amber-50/80 border-amber-200 text-amber-700 font-bold hover:bg-amber-100 transition-all shadow-sm shrink-0"
                          title="تولید گذرواژه تصادفی امن"
                        >
                          رمز تصادفی ⚙️
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setEditingUser(null)} 
                      className="text-xs text-slate-500 hover:bg-slate-100 font-semibold rounded-xl"
                    >
                      انصراف
                    </Button>
                    <Button 
                      type="submit" 
                      size="sm" 
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-sm transition-all"
                    >
                      ذخیره و تایید نهایی مشخصات امنیتی
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Filter, Search & Directory Control panel */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              
              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setSelectedUserFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedUserFilter === 'all' 
                      ? 'bg-purple-600 text-white shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-200/50'
                  }`}
                >
                  همه حساب‌ها ({allUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUserFilter('admin')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedUserFilter === 'admin' 
                      ? 'bg-red-600 text-white shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-200/50'
                  }`}
                >
                  مدیران ارشد ({allUsers.filter(u => u.isAdmin).length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUserFilter('operator')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedUserFilter === 'operator' 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-200/50'
                  }`}
                >
                  خادمان موکب‌ها ({allUsers.filter(u => !u.isAdmin).length})
                </button>
              </div>
            </div>

            {/* List of accounts styled as creative grids */}
            {(() => {
              const filteredUsers = allUsers.filter(usr => {
                const matchesSearch = 
                  (usr.name || '').toLowerCase().includes(searchUserQuery.toLowerCase()) ||
                  (usr.email || '').toLowerCase().includes(searchUserQuery.toLowerCase()) ||
                  (usr.username || '').toLowerCase().includes(searchUserQuery.toLowerCase());
                
                if (selectedUserFilter === 'admin') return matchesSearch && usr.isAdmin;
                if (selectedUserFilter === 'operator') return matchesSearch && !usr.isAdmin;
                return matchesSearch;
              });

              if (filteredUsers.length === 0) {
                return (
                  <div className="text-center py-12 border-2 border-dashed border-slate-150 rounded-2xl p-6">
                    <p className="text-slate-400 text-xs font-bold font-sans">کاربری با مشخصات فوق در سیستم یافت نشد.</p>
                  </div>
                );
              }

              const handleCopyToClipboard = (text: string, userId: string, type: 'username' | 'password') => {
                try {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text);
                  } else {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                  }
                  setCopiedUserId(`${userId}_${type}`);
                  setTimeout(() => setCopiedUserId(null), 2000);
                } catch (err) {
                  console.warn("Clipboard copy failed:", err);
                }
              };

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-2">
                  {filteredUsers.map((usr) => {
                    const isRevealed = !!revealedPasswords[usr.id];
                    // Generate avatar initials and random gradient index
                    const initial = (usr.name || usr.username || 'خ').substring(0, 1);
                    const gradientColors = [
                      'from-purple-500 to-indigo-600',
                      'from-teal-400 to-emerald-600',
                      'from-pink-500 to-rose-600',
                      'from-amber-400 to-orange-500',
                      'from-blue-500 to-cyan-600'
                    ];
                    const charCodeSum = usr.id.split('').reduce((acc: number, cur: string) => acc + cur.charCodeAt(0), 0);
                    const gradient = gradientColors[charCodeSum % gradientColors.length];

                    return (
                      <div 
                        key={usr.id} 
                        className="bg-slate-50/50 border border-slate-150 rounded-3xl p-5 hover:border-purple-400 hover:bg-white hover:shadow-md transition-all duration-300 flex flex-col justify-between gap-4 relative overflow-hidden group"
                      >
                        {/* Decorative side badge color */}
                        <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${gradient}`} />

                        {/* Top Header Card */}
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center text-sm font-black font-sans shadow-sm`}>
                                {initial}
                              </div>
                              <div className="text-right">
                                <h4 className="font-extrabold text-xs text-slate-800 leading-none group-hover:text-purple-700 transition-colors">
                                  {usr.name || 'خادم معرفی نشده'}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-mono mt-1 text-left" dir="ltr">
                                  {usr.email || '-'}
                                </p>
                              </div>
                            </div>

                            {usr.isAdmin ? (
                              <span className="px-2 py-0.5 rounded-lg bg-red-50 text-red-600 text-[9px] font-bold border border-red-100 shrink-0">
                                👑 مدیر ارشد
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 text-[9px] font-bold border border-emerald-100 shrink-0">
                                🕋 خادم موکب
                              </span>
                            )}
                          </div>

                          {/* Credentials Segment (Receipt block) */}
                          <div className="bg-white border border-slate-100 rounded-2xl p-3 space-y-2 mt-4 text-[11px] shadow-inner font-sans">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-400 font-medium">نام کاربری:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-slate-800 font-mono" dir="ltr">
                                  {usr.username || 'تعریف نشده'}
                                </span>
                                {usr.username && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyToClipboard(usr.username, usr.id, 'username')}
                                    className="text-purple-600 hover:text-purple-800 p-0.5 hover:bg-purple-50 rounded transition-colors"
                                    title="کپی نام کاربری"
                                  >
                                    {copiedUserId === `${usr.id}_username` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600 font-black" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-50">
                              <span className="text-slate-400 font-medium">رمز عبور:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800 font-mono" dir="ltr">
                                  {isRevealed ? (usr.password || 'سیستمی') : '••••••••'}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setRevealedPasswords(prev => ({ ...prev, [usr.id]: !prev[usr.id] }))}
                                    className="text-slate-400 hover:text-slate-600 p-0.5 hover:bg-slate-100 rounded transition-colors"
                                    title={isRevealed ? "مخفی کردن" : "نمایش رمز عبور"}
                                  >
                                    {isRevealed ? (
                                      <EyeOff className="w-3 h-3" />
                                    ) : (
                                      <Eye className="w-3 h-3" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyToClipboard(usr.password || '123456', usr.id, 'password')}
                                    className="text-purple-600 hover:text-purple-800 p-0.5 hover:bg-purple-50 rounded transition-colors"
                                    title="کپی رمز عبور"
                                  >
                                    {copiedUserId === `${usr.id}_password` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600 font-black" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card Actions Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 gap-2 mt-2">
                          <Button 
                            type="button"
                            onClick={() => {
                              setEditingUser(usr);
                              setEditUsernameVal(usr.username || usr.id || '');
                              setEditPasswordVal(usr.password || '123456');
                              setEditingUserDisplayName(usr.name || '');
                              // Scroll up to editing panel smoothly
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            size="sm"
                            variant="ghost"
                            className="text-[11px] text-purple-600 hover:bg-purple-50 hover:text-purple-800 font-bold rounded-xl flex items-center gap-1"
                          >
                            <span>✏️ ویرایش مشخصات</span>
                          </Button>

                          <Button 
                            type="button"
                            onClick={() => handleDeleteUser(usr.id, usr.name || usr.username)}
                            size="sm"
                            variant="ghost"
                            className="text-[11px] text-red-500 hover:bg-red-50 hover:text-red-700 font-bold rounded-xl flex items-center gap-1"
                          >
                            <span>🗑️ حذف حساب</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 📢 Creative Integrated Official Announcements and Bulletins Manager */}
      {profile.isAdmin && showOfficialNoticesManager && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500" dir="rtl">
          {/* Header Card */}
          <div className="bg-gradient-to-l from-amber-950 via-slate-900 to-amber-950/90 p-6 md:p-8 rounded-3xl border border-amber-900/30 shadow-xl relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-600/5 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold font-mono tracking-wider uppercase">
                    پنل ستاد راهنمای زائر
                  </span>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
                  <Megaphone className="w-7 h-7 text-amber-400 animate-bounce" />
                  <span>مدیریت ابلاغیه‌های رسمی و اطلاعیه‌ها</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-sans max-w-2xl leading-relaxed">
                  مدیر کل گرامی، در این پرتال مجهز می‌توانید اطلاعیه‌های صادر شده از فراجا، هلال‌احمر، ستاد برگزاری مراسم یا ارگان‌های سفارشی را مدیریت نمایید. این ابلاغیه‌ها به صورت زنده در تابلوی اعلانات صفحه اصلی کاربران منتشر می‌شوند.
                </p>
              </div>

              <div className="shrink-0">
                <Button 
                  onClick={() => setShowOfficialNoticesManager(false)}
                  className="bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-xs px-6 py-2.5 rounded-2xl h-11 shadow-md flex items-center gap-2 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>بازگشت به کارتابل اصلی</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden relative p-5 rounded-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">کُل ابلاغیه‌های فعال</p>
                  <p className="text-2xl font-extrabold text-amber-400 font-mono">{officialNotices.length}</p>
                </div>
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                  <Megaphone className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden relative p-5 rounded-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">دسته‌بندی‌های خبری فعال</p>
                  <p className="text-2xl font-extrabold text-emerald-400 font-mono">{newsCategories.length}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 text-white overflow-hidden relative p-5 rounded-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">سازمان‌های صادرکننده</p>
                  <p className="text-2xl font-extrabold text-blue-400 font-mono">{customAuthorities.length + 3}</p>
                </div>
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </div>

          {/* Form & Management Panels Bento-like Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Form Box */}
            <div className="lg:col-span-7 bg-white border border-slate-100 shadow-sm rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
              <form onSubmit={handleCreateOfficialNotice} className="space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                    <span className="text-lg">✍️</span>
                    <span>{editingNotice ? 'ویرایش ابلاغیه رسمی جاری' : 'ثبت و انتشار ابلاغیه رسمی جدید'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">مشخصات اطلاعیه را با دقت پر کنید تا بلافاصله بر روی نرم‌افزار زوار بارگذاری شود.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">عنوان ابلاغیه / خبر</label>
                    <input 
                      type="text"
                      value={newNoticeTitle}
                      onChange={e => setNewNoticeTitle(e.target.value)}
                      placeholder="مثلا: لزوم همراه داشتن گذرنامه زیارتی معتبر"
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">سازمان صادرکننده</label>
                      <select 
                        value={newNoticeAuthority}
                        onChange={e => setNewNoticeAuthority(e.target.value)}
                        className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200/80 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      >
                        <option value="setad">ستاد برگزاری مراسم</option>
                        <option value="faraja">پلیس فراجا</option>
                        <option value="red_crescent">سازمان هلال احمر</option>
                        {customAuthorities.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">دسته‌بندی موضوعی</label>
                      <select 
                        value={newNoticeCategory}
                        onChange={e => setNewNoticeCategory(e.target.value)}
                        className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200/80 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      >
                        <option value="general">عمومی (اطلاع‌رسانی کلی)</option>
                        {DEFAULT_NEWS_CATEGORIES.filter(c => c.id !== 'general').map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                        {newsCategories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">شرح کامل ابلاغیه رسمی</label>
                  <textarea 
                    value={newNoticeContent}
                    onChange={e => setNewNoticeContent(e.target.value)}
                    placeholder="متن کامل خبر، توصیه‌ها، هشدارها یا آیین‌نامه‌ها را با دقت بنویسید..."
                    className="w-full h-32 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200/80 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-amber-500 outline-none resize-none transition-all"
                    required
                  />
                </div>

                <div className="flex justify-end pt-3 gap-2 border-t border-slate-100">
                  {editingNotice && (
                    <Button 
                      type="button"
                      onClick={() => {
                        setEditingNotice(null);
                        setNewNoticeTitle('');
                        setNewNoticeContent('');
                        setNewNoticeAuthority('setad');
                        setNewNoticeCategory('general');
                      }}
                      variant="outline"
                      className="border-slate-200 text-slate-600 text-xs font-extrabold h-11 px-5 rounded-xl hover:bg-slate-50 transition-all"
                    >
                      انصراف از ویرایش
                    </Button>
                  )}
                  <Button 
                    type="submit" 
                    disabled={submittingNotice}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs px-6 rounded-xl h-11 shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    {submittingNotice ? (
                      'در حال ثبت...'
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>{editingNotice ? 'ذخیره تغییرات ابلاغیه' : 'ثبت و انتشار فوری'}</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Organizations & Categories Management */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Org Admin Panel */}
              <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                    <span>🏢</span>
                    <span>سازمان‌های صادرکننده اختصاصی</span>
                  </h3>
                  
                  <form onSubmit={handleCreateAuthority} className="space-y-2 mb-4">
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={newAuthorityName}
                        onChange={e => setNewAuthorityName(e.target.value)}
                        placeholder="سازمان جدید (مثلا: هلال احمر، فراجا)"
                        className="flex-1 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200/80 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                        required
                      />
                      <Button 
                        type="submit" 
                        disabled={submittingAuthority}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 rounded-xl h-9 shrink-0 transition-all"
                      >
                        {submittingAuthority ? '...' : 'افزودن'}
                      </Button>
                    </div>
                  </form>

                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {customAuthorities.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">هیچ سازمان صادرکننده دستی هنوز تعریف نشده است.</p>
                    ) : (
                      customAuthorities.map(auth => (
                        <div key={auth.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-xs">
                          <span className="font-semibold text-slate-800">{auth.name}</span>
                          <button 
                            type="button"
                            onClick={() => handleDeleteAuthority(auth.id)}
                            className="text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-50 transition-all"
                            title="حذف"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Categories Admin Panel */}
              <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                    <span>📰</span>
                    <span>دسته‌بندی‌های خبری اختصاصی</span>
                  </h3>
                  
                  <form onSubmit={handleCreateNewsCategory} className="space-y-2 mb-4">
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={newNewsCategoryName}
                        onChange={e => setNewNewsCategoryName(e.target.value)}
                        placeholder="موضوع جدید (مثلا: گمشدگان، تغذیه)"
                        className="flex-1 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200/80 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                        required
                      />
                      <Button 
                        type="submit" 
                        disabled={submittingNewsCategory}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 rounded-xl h-9 shrink-0 transition-all"
                      >
                        {submittingNewsCategory ? '...' : 'افزودن'}
                      </Button>
                    </div>
                  </form>

                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {newsCategories.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">هیچ موضوع اختصاصی دستی هنوز تعریف نشده است.</p>
                    ) : (
                      newsCategories.map(cat => (
                        <div key={cat.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-xs">
                          <span className="font-semibold text-slate-800">{cat.name}</span>
                          <button 
                            type="button"
                            onClick={() => handleDeleteNewsCategory(cat.id)}
                            className="text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-50 transition-all"
                            title="حذف"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Search, Filter Tabs & List Card */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
            
            {/* Header and Search */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-50 pb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">📋 لیست کل ابلاغیه‌های رسمی</h3>
                <p className="text-xs text-slate-500 mt-1">ابلاغیه‌های بالا با جستجو و تب‌های زیر قابل پالایش هستند.</p>
              </div>

              {/* Advanced search bar inside the section */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input 
                  type="text"
                  value={searchNoticeQuery}
                  onChange={e => setSearchNoticeQuery(e.target.value)}
                  placeholder="جستجو در عنوان یا متن خبر..."
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200/80 rounded-xl pr-10 pl-4 py-2 text-xs focus:ring-2 focus:ring-amber-500 outline-none transition-all font-sans"
                />
                {searchNoticeQuery && (
                  <button 
                    onClick={() => setSearchNoticeQuery('')}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold font-mono"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 pb-2 overflow-x-auto scrollbar-none border-b border-slate-100">
              {['همه', ...newsCategories.map(c => c.id)].filter((val, idx, self) => self.indexOf(val) === idx).map(catId => {
                const isSelected = selectedNoticeTab === catId;
                const displayName = catId === 'همه' ? 'کُل اطلاعیه‌ها' : getNewsCategoryName(catId as string);
                
                // Get counts for badge
                const count = officialNotices.filter(n => {
                  const matchesTab = catId === 'همه' || n.category === catId;
                  const matchesSearch = !searchNoticeQuery || 
                    n.title.toLowerCase().includes(searchNoticeQuery.toLowerCase()) || 
                    n.content.toLowerCase().includes(searchNoticeQuery.toLowerCase());
                  return matchesTab && matchesSearch;
                }).length;

                return (
                  <button 
                    key={catId} 
                    onClick={() => setSelectedNoticeTab(catId)}
                    className={`px-4 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                      isSelected 
                        ? 'text-amber-800 border-amber-500 bg-amber-50/40' 
                        : 'text-slate-500 border-transparent hover:text-slate-700'
                    }`}
                  >
                    <span>{displayName}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${isSelected ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Notices List */}
            {(() => {
              const getAuthorityLabel = (authId: string) => {
                if (authId === 'setad') return 'ستاد برگزاری مراسم';
                if (authId === 'faraja') return 'پلیس فراجا';
                if (authId === 'red_crescent') return 'سازمان هلال احمر';
                const found = customAuthorities.find(a => a.id === authId);
                return found ? found.name : authId;
              };

              const filtered = officialNotices.filter(notice => {
                const matchesTab = selectedNoticeTab === 'همه' || notice.category === selectedNoticeTab;
                const matchesSearch = !searchNoticeQuery || 
                  notice.title.toLowerCase().includes(searchNoticeQuery.toLowerCase()) || 
                  notice.content.toLowerCase().includes(searchNoticeQuery.toLowerCase());
                return matchesTab && matchesSearch;
              });

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl">
                    <Megaphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-bold">هیچ ابلاغیه‌ای با این مشخصات یافت نشد.</p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filtered.map(notice => (
                    <div 
                      key={notice.id} 
                      className="p-5 bg-white border border-slate-100 hover:border-amber-200 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden"
                    >
                      {/* Subtile tag */}
                      <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-tr from-transparent via-transparent to-amber-500/5 pointer-events-none" />
                      
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[10px] font-black px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-100/30">
                            📢 {getAuthorityLabel(notice.authority)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {notice.category === 'general' ? 'دسته‌ب بندی: عمومی' : `موضوع: ${getNewsCategoryName(notice.category)}`}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-sm text-slate-900 mb-2">{notice.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed text-justify line-clamp-3 mb-4">{notice.content}</p>
                      </div>

                      <div className="flex justify-end pt-3 border-t border-slate-50 gap-2 mt-auto">
                        <Button 
                          onClick={() => {
                            setEditingNotice(notice);
                            setNewNoticeTitle(notice.title);
                            setNewNoticeContent(notice.content);
                            setNewNoticeAuthority(notice.authority);
                            setNewNoticeCategory(notice.category);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          size="sm"
                          variant="outline" 
                          className="h-8.5 text-slate-700 hover:text-amber-800 hover:bg-amber-50/50 border-slate-200 hover:border-amber-200 text-[11px] font-extrabold rounded-xl px-3 flex items-center gap-1 transition-all"
                        >
                          <span>✏️ ویرایش ابلاغیه</span>
                        </Button>
                        <Button 
                          onClick={() => handleDeleteOfficialNotice(notice.id)}
                          size="sm"
                          variant="ghost" 
                          className="h-8.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-[11px] font-extrabold rounded-xl px-3 flex items-center gap-1 transition-all"
                        >
                          <span>🗑️ حذف</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 🌟 Creative Details Overlay Modal */}
      {selectedMokeb && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <Card className="max-w-2xl w-full bg-white rounded-3xl overflow-hidden border-slate-100 shadow-2xl relative my-8">
            <div className="absolute top-4 left-4 z-10">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedMokeb(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Accent Header */}
            <div className="relative bg-slate-100 text-slate-900 p-6 sm:p-8 border-b border-slate-100">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/30 rounded-full blur-3xl -mr-16 -mt-16" />
              
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden relative">
                   {selectedMokeb.avatarUrl ? (
                     <img src={selectedMokeb.avatarUrl} alt={selectedMokeb.name} className="w-full h-full object-cover" />
                   ) : siteSettings?.siteLogoUrl ? (
                     <img src={siteSettings.siteLogoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                   ) : (
                     <span className="text-3xl">🕌</span>
                   )}
                </div>
                <div className="text-center sm:text-right">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                    <span className="px-3 py-0.5 rounded bg-amber-500 border border-amber-400 text-xs text-white font-semibold font-mono tracking-wider uppercase">
                      {getCategoryName(selectedMokeb.categoryId)}
                    </span>
                    {getStatusBadge(selectedMokeb.status)}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#1a1c2c]">{selectedMokeb.name}</h2>
                  <p className="text-slate-500 text-xs mt-1 font-mono">شناسه رهگیری: {selectedMokeb.trackingCode || 'ثبت بدون کد رهگیری'}</p>
                </div>
              </div>
            </div>

            {/* Interactive Tab Controller inside the Modal */}
            <div className="bg-slate-50 border-b border-slate-100 flex items-center p-1 px-4 sm:px-6" dir="rtl">
              <button 
                onClick={() => setDetailsTab('standard')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
                  detailsTab === 'standard' 
                    ? 'border-amber-500 text-slate-900 font-black' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                📊 پرونده اداری و فرآیند تایید
              </button>
              <button 
                onClick={() => setDetailsTab('professional')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  detailsTab === 'professional' 
                    ? 'border-emerald-600 text-emerald-700 font-black' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span>✨ شناسنامه خلاقانه و حرفه‌ای موکب (عمومی)</span>
              </button>
            </div>

            <CardContent className="p-6 sm:p-8 space-y-6 max-h-[60vh] overflow-y-auto font-sans" dir="rtl">
              
              {detailsTab === 'standard' ? (
                <>
                  {/* Vertical Step Workflow timeline */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-3 border-r-4 border-amber-500 pr-2">آخرین وضعیت بررسی سامانه</h4>
                    <div className="relative border-r-2 border-slate-100 mr-4 pr-6 py-2 space-y-6">
                      
                      {/* Unified Status Tracking */}
                      <div className="relative">
                        <span className={`absolute -right-[31px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] ${
                          selectedMokeb.status === 'active' 
                            ? 'bg-emerald-500 border-emerald-500 text-white font-black'
                            : selectedMokeb.status === 'rejected'
                              ? 'bg-red-500 border-red-500 text-white'
                              : 'bg-amber-100 text-amber-700 border-amber-300 font-black animate-pulse' 
                        }`}>
                          {selectedMokeb.status === 'active' ? '✓' : selectedMokeb.status === 'rejected' ? '✕' : '●'}
                        </span>
                        <h5 className="text-xs font-bold text-slate-800">
                          {selectedMokeb.status === 'active' ? 'پروانه موکب فعال و تایید شده است' :
                           selectedMokeb.status === 'rejected' ? 'درخواست رد شده است' :
                           'در حال بررسی و ارزیابی'}
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {selectedMokeb.status === 'active' ? 'تبریک! موکب شما هم اکنون بر روی نقشه سراسری فعال است و زائرین قادر به مشاهده آن می‌باشند.' :
                           selectedMokeb.status === 'rejected' ? 'متاسفانه مدارک و اطلاعات ثبت شده با سیاست‌های سامانه همخوانی نداشت. جهت بررسی بیشتر تیکت پشتیبانی ارسال کنید.' :
                           'اطلاعات و مدارک شما توسط مدیریت کمیته در حال بررسی می‌باشد. پس از تایید نهایی، پنل کاربری موکب فعال خواهد شد.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* General details lists */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-tight mb-2">مشخصات موکب غرفه‌ها</h4>
                      <div className="space-y-1.5 text-xs text-slate-700 font-sans">
                        <p><b className="text-slate-500">استان:</b> {selectedMokeb.province || 'ثبت نشده'}</p>
                        <p><b className="text-slate-500">شهرستان:</b> {selectedMokeb.county || selectedMokeb.city || 'ثبت نشده'}</p>
                        <p><b className="text-slate-500">موقعیت/عمود:</b> {selectedMokeb.address || 'ثبت نشده'}</p>
                        {selectedMokeb.utm && <p><b className="text-slate-500">موقعیت UTM:</b> <span className="font-mono">{selectedMokeb.utm}</span></p>}
                        <p><b className="text-slate-500">طول جغرافیایی:</b> {selectedMokeb.lng || '-'}</p>
                        <p><b className="text-slate-500">عرض جغرافیایی:</b> {selectedMokeb.lat || '-'}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-tight mb-2">مشخصات مسئول رسمی موکب</h4>
                      <div className="space-y-1.5 text-xs text-slate-700 font-sans">
                        <p><b className="text-slate-500">نام کامل:</b> {selectedMokeb.managerName}</p>
                        <p><b className="text-slate-500">شماره موبایل:</b> <span className="font-mono">{selectedMokeb.phone}</span></p>
                        <p><b className="text-slate-500">نام پدر:</b> {selectedMokeb.fatherName || 'ثبت نشده'}</p>
                        <p><b className="text-slate-500">کد ملی:</b> <span className="font-mono">{selectedMokeb.nationalId || 'ثبت نشده'}</span></p>
                      </div>
                    </div>
                  </div>

                  {selectedMokeb.description && (
                    <div className="border-t border-slate-100 pt-4 text-xs">
                      <h4 className="font-bold text-slate-700 mb-1">درباره و شرح خدمات موکب</h4>
                      <p className="text-slate-600 leading-relaxed font-sans">{selectedMokeb.description}</p>
                    </div>
                  )}

                  {selectedMokeb.documentUrl && (
                    <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <span className="text-xs font-bold text-slate-700">سند بارگذاری شده (تعهدنامه/مجوز ملکیت مال)</span>
                      </div>
                      <a 
                        href={selectedMokeb.documentUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="px-4 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-colors"
                      >
                        مشاهده سند بارگذاری شده
                      </a>
                    </div>
                  )}
                </>
              ) : (
                /* ✨ GLORIOUS DIGITAL INNOVATIVE PROFESSIONAL CARD AESTHETIC PANEL */
                <div className="space-y-6">
                  {/* Decorative Banner Intro */}
                  <div className="p-6 bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-2xl relative overflow-hidden shadow-md">
                    <div className="absolute bottom-0 right-0 w-24 h-24 bg-emerald-800/20 rounded-full blur-2xl" />
                    <Sparkles className="w-10 h-10 text-amber-500 absolute top-4 left-4 animate-pulse" />
                    <h4 className="text-base font-black mb-1">کارت شناسایی خلاق و چندرسانه‌ای موکب</h4>
                    <p className="text-[11px] text-emerald-200/90 leading-relaxed font-sans">
                      این شناسنامه شامل اطلاعات تکمیلی حضور خادمیاران، گالری آنلاین از خدمات موکب و جزییات سرویس‌های برگزیده در ایام مراسم تشییع رهبر شهید می‌باشد.
                    </p>
                  </div>

                  {/* 1. Description Story telling */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 relative">
                    <span className="absolute -top-3 right-4 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">بخش معرفی و رسالت موکب</span>
                    <h5 className="text-xs font-bold text-slate-400 mb-2 mt-1">توضیحات تکمیلی و اهداف خدمت‌رسانی:</h5>
                    <p className="text-xs text-slate-700 leading-relaxed font-sans pr-2 border-r-2 border-emerald-500 italic">
                      {selectedMokeb.detailedDescription || selectedMokeb.description || 'توضیحات معرفی و داستان موکب توسط مدیر موکب تکمیل نگردیده است.'}
                    </p>
                  </div>

                  {/* 2. Registered Option services */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 mb-3 border-r-4 border-emerald-600 pr-2">خدمات و تسهیلات رفاهی ارائه شده:</h5>
                    {selectedMokeb.selectedServices && selectedMokeb.selectedServices.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedMokeb.selectedServices.map((service, index) => (
                          <div key={index} className="flex items-center gap-2.5 bg-emerald-50/50 border border-emerald-100/70 rounded-xl p-3 text-xs text-emerald-950 font-semibold shadow-sm">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">✓</span>
                            <span>{service}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-xl p-4 text-center text-xs text-slate-400 font-sans">
                      </div>
                    )}
                  </div>

                  {/* 3. Stationed Staff list with avatars */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 mb-3 border-r-4 border-emerald-600 pr-2">کادر خادمین و چارت سازمانی معرفی شده:</h5>
                    {selectedMokeb.staffList && selectedMokeb.staffList.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedMokeb.staffList.map((staff, ind) => {
                          const parts = staff.split('|');
                          const name = parts[0]?.trim();
                          const role = parts[1]?.trim();
                          return (
                            <div key={ind} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:border-slate-200 transition-colors">
                              <div className="w-8 h-8 rounded-full bg-[#1a1c2c] text-white flex items-center justify-center text-xs font-bold font-mono">
                                {name ? name.substring(0, 1) : 'خ'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h6 className="text-xs font-black text-slate-800 truncate">{name || staff}</h6>
                                {role && <p className="text-[10px] text-emerald-600 font-medium mt-0.5">{role}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-xl p-4 text-center text-xs text-slate-400 font-sans">
                      </div>
                    )}
                  </div>

                  {/* 4. Beautiful photo gallery */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 mb-3 border-r-4 border-emerald-600 pr-2">آلبوم تصاویر و جلوه خدمت‌رسانی:</h5>
                    {selectedMokeb.galleryUrls && selectedMokeb.galleryUrls.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {selectedMokeb.galleryUrls.map((url, i) => (
                          <div key={i} className="group relative rounded-xl overflow-hidden aspect-video border border-slate-200 shadow-sm bg-slate-100">
                            <img 
                              src={url} 
                              alt="Gallery Pic" 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <a href={url} target="_blank" rel="noreferrer" className="bg-white text-slate-900 text-[10px] px-2.5 py-1 rounded font-bold shadow-sm">مشاهده بزرگ</a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-xl p-4 text-center text-xs text-slate-400 font-sans">
                        عکسی در آلبوم نگارخانه موکب بارگذاری نشده است.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Direct Actions in Dialog Modal */}
              <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row gap-2 justify-end">
                {profile.isAdmin ? (
                  <Link to={`/dashboard/admin/mokeb/${selectedMokeb.id}`} onClick={() => setSelectedMokeb(null)} className="w-full sm:w-auto">
                    <Button className="w-full bg-[#1a1c2c] hover:bg-slate-800 text-white gap-2 font-semibold text-xs py-2">
                      <ShieldAlert className="w-4 h-4" />
                      ورود به صفحه بررسی پرونده مدیریت
                    </Button>
                  </Link>
                ) : (
                  <>
                    {selectedMokeb.status === 'active' ? (
                      <Link to={`/dashboard/mokeb/${selectedMokeb.id}/complete`} onClick={() => setSelectedMokeb(null)} className="w-full sm:w-auto">
                        <Button className="w-full bg-[#1a1c2c] hover:bg-slate-800 text-white gap-2 font-semibold text-xs py-2">
                          <Check className="w-4 h-4" />
                          مدیریت و ویرایش موکب
                        </Button>
                      </Link>
                    ) : (
                      <span className="w-full sm:w-auto text-xs text-amber-600 font-bold bg-amber-50 px-3 py-2 rounded-lg flex items-center justify-center">در حال بررسی</span>
                    )}
                  </>
                )}
                <Button 
                  onClick={() => handleDeleteMokeb(selectedMokeb.id, selectedMokeb.name)} 
                  variant="outline" 
                  className="w-full sm:w-auto border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف موکب
                </Button>
                <Button 
                  onClick={() => setSelectedMokeb(null)} 
                  variant="outline" 
                  className="w-full sm:w-auto border-slate-200 text-slate-500 text-xs font-bold"
                >
                  بستن پنجره اطلاعات
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}



      {/* 📊 Live Monitoring & Analytics Modal */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <Card className="max-w-4xl w-full bg-white rounded-3xl border-slate-100 shadow-2xl relative p-6 sm:p-8 flex flex-col max-h-[90vh]">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowAnalyticsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Header */}
            <div className="border-b border-slate-100 pb-4 mb-6 text-right" dir="rtl">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span className="p-1.5 bg-[#007f5f]/10 text-[#007f5f] rounded-lg">📊</span>
                <span>پایش زنده و آمار مانیتورینگ سیستم (Real-time Analytics)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                مشاهده آمار بازدیدهای کل و واقعی سامانه، دسته‌بندی‌ها و تک‌تک مواکب به صورت کاملاً زنده و متصل به پایگاه داده.
              </p>
            </div>

            {/* Modal Scrollable Content Container */}
            <div className="overflow-y-auto pr-1 pl-1 flex-1 space-y-6" dir="rtl">
              
              {/* 1. Global Overview (آمار کلی) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/50 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-[#007f5f]">بازدید کل سامانه (Hits)</span>
                    <h3 className="text-2xl font-black text-[#007f5f] font-sans">
                      {(globalStats?.count || 0).toLocaleString('fa-IR')}
                    </h3>
                    <p className="text-[9px] text-slate-400">نمایش صفحات</p>
                  </div>
                  <div className="w-10 h-10 bg-[#007f5f]/10 text-[#007f5f] rounded-xl flex items-center justify-center text-lg">
                    📈
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100/50 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-indigo-700">بازدید حقیقی (Uniques)</span>
                    <h3 className="text-2xl font-black text-indigo-700 font-sans">
                      {(globalStats?.uniqueCount || 0).toLocaleString('fa-IR')}
                    </h3>
                    <p className="text-[9px] text-slate-400">دستگاه‌های یکتا</p>
                  </div>
                  <div className="w-10 h-10 bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center text-lg">
                    👥
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/50 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-amber-700">ثبت‌نام‌کنندگان زائر</span>
                    <h3 className="text-2xl font-black text-amber-700 font-sans">
                      {(allRegistrants.length).toLocaleString('fa-IR')}
                    </h3>
                    <p className="text-[9px] text-slate-400">زوار امتیازدهنده</p>
                  </div>
                  <div className="w-10 h-10 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center text-lg">
                    ✍️
                  </div>
                </div>

                <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100/50 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-rose-700">امتیاز کل موکب‌ها</span>
                    <h3 className="text-2xl font-black text-rose-700 font-sans">
                      {allReviews.length > 0 
                        ? Number((allReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / allReviews.length).toFixed(1)).toLocaleString('fa-IR') 
                        : '۰'
                      }
                    </h3>
                    <p className="text-[9px] text-slate-400">از {allReviews.length} امتیاز ثبت‌شده</p>
                  </div>
                  <div className="w-10 h-10 bg-rose-500/10 text-rose-600 rounded-xl flex items-center justify-center text-lg">
                    ⭐
                  </div>
                </div>
              </div>

              {/* 2. Categories Stats & Live Charts (آمار دسته‌بندی‌ها) */}
              <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
                  <span>📂 آمار بازدید به تفکیک دسته‌بندی مواکب</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map((cat) => {
                    const stat = categoryStatsList.find(s => s.id === cat.id);
                    const count = stat?.count || 0;
                    const uniqueCount = stat?.uniqueCount || 0;
                    
                    // Calculate percentage of max count to show relative progress
                    const maxCount = Math.max(...categoryStatsList.map(s => s.count || 1), 1);
                    const percentage = Math.round((count / maxCount) * 100);

                    return (
                      <div key={cat.id} className="bg-white border border-slate-200/60 p-4 rounded-xl shadow-sm space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-xs text-slate-800">{cat.name}</span>
                          <span className="text-[10px] font-bold text-slate-400">کد: {cat.id}</span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] pt-1 text-slate-500">
                          <span>بازدید کل: <b className="text-slate-700 font-sans">{count}</b></span>
                          <span>حقیقی: <b className="text-indigo-600 font-sans">{uniqueCount}</b></span>
                        </div>
                      </div>
                    );
                  })}
                  {categories.length === 0 && (
                    <div className="col-span-2 text-center py-4 text-xs text-slate-400 font-bold">
                      دسته‌بندی ثبت نشده است.
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Detailed Mokeb Visits (آمار تک‌تک مواکب) */}
              <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                    <span>🕌 مانیتورینگ بازدیدها و امتیازهای موکب‌ها ({mokebs.length} موکب)</span>
                  </h3>
                  
                  {/* Local Search inside stats */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="جستجوی نام موکب..."
                      value={analyticsSearch}
                      onChange={(e) => setAnalyticsSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#007f5f]/20 focus:border-[#007f5f] transition-all"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-[300px] overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-100 sticky top-0 z-10">
                      <tr>
                        <th className="p-3">نام موکب</th>
                        <th className="p-3">دسته‌بندی</th>
                        <th className="p-3 text-center">بازدید کل (Hits)</th>
                        <th className="p-3 text-center">حقیقی (Unique)</th>
                        <th className="p-3 text-center">میانگین امتیاز</th>
                        <th className="p-3 text-left">آخرین بازدید</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {(() => {
                        const filtered = mokebs
                          .filter(m => m.name.toLowerCase().includes(analyticsSearch.toLowerCase()))
                          .map(m => {
                            const stat = mokebStatsList.find(s => s.id === m.id);
                            const mReviews = allReviews.filter(r => r.mokebId === m.id);
                            const avgR = mReviews.length > 0 
                              ? mReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / mReviews.length 
                              : 0;

                            return {
                              ...m,
                              count: stat?.count || 0,
                              uniqueCount: stat?.uniqueCount || 0,
                              lastUpdated: stat?.lastUpdated,
                              avgRating: avgR,
                              reviewsCount: mReviews.length
                            };
                          })
                          // Sort by highest rating first, then by highest visits first
                          .sort((a, b) => b.avgRating - a.avgRating || b.count - a.count);

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                                موکبی یافت نشد یا بازدیدی ثبت نشده است.
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-bold text-slate-800">{m.name}</td>
                            <td className="p-3">
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded-full text-slate-600 border border-slate-200">
                                {getCategoryName(m.categoryId)}
                              </span>
                            </td>
                            <td className="p-3 text-center text-emerald-700 font-sans font-bold text-sm">
                              {m.count.toLocaleString('fa-IR')}
                            </td>
                            <td className="p-3 text-center text-indigo-700 font-sans font-bold text-sm">
                              {m.uniqueCount.toLocaleString('fa-IR')}
                            </td>
                            <td className="p-3 text-center">
                              {m.reviewsCount > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-rose-600 font-extrabold text-xs">
                                    ⭐ {m.avgRating.toFixed(1).toLocaleString('fa-IR')}
                                  </span>
                                  <span className="text-[9px] text-slate-400">({m.reviewsCount.toLocaleString('fa-IR')} نظر)</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400">بدون امتیاز</span>
                              )}
                            </td>
                            <td className="p-3 text-left text-[10px] text-slate-400 font-sans">
                              {m.lastUpdated ? formatFarsiDate(m.lastUpdated) : 'بدون بازدید'}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Registered Visitors Registry (دفتر ثبت‌نام‌کنندگان و امتیازدهندگان زوار) */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-855 flex items-center gap-1.5">
                    <span>✍️ دفتر ثبت‌نام‌کنندگان و زوار امتیازدهنده ({allRegistrants.length} زائر)</span>
                  </h3>
                  <span className="text-[10px] font-bold text-[#007f5f] bg-[#007f5f]/10 px-2.5 py-1 rounded-full border border-[#007f5f]/20">
                    فاقد پنل کاربری - دسترسی محدود به سیستم نظارت
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[300px] overflow-y-auto bg-white">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-extrabold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="p-3">نام و نام خانوادگی</th>
                        <th className="p-3">شماره تماس (موبایل)</th>
                        <th className="p-3">موکب ارزیابی شده</th>
                        <th className="p-3 text-center">امتیاز زائر</th>
                        <th className="p-3">متن بازخورد / نظر زائر</th>
                        <th className="p-3 text-left">تاریخ ثبت‌نام</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 font-medium text-slate-700">
                      {allRegistrants.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                            تاکنون زائری ثبت‌نام نکرده و امتیازی ثبت نشده است.
                          </td>
                        </tr>
                      ) : (
                        [...allRegistrants]
                          .sort((a, b) => {
                            const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                            const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                            return tB - tA;
                          })
                          .map((reg) => {
                            const ratedMokebName = mokebs.find(m => m.id === reg.mokebId)?.name || 'موکب نامشخص';
                            return (
                              <tr key={reg.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 font-bold text-slate-900">{reg.fullName || 'بدون نام'}</td>
                                <td className="p-3 font-mono text-indigo-700 font-bold tracking-wider">{reg.phoneNumber || 'بدون شماره'}</td>
                                <td className="p-3 text-slate-800 font-bold">{ratedMokebName}</td>
                                <td className="p-3 text-center">
                                  <span className="font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs">
                                    ★ {reg.rating || 0}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-600 max-w-xs truncate" title={reg.comment}>
                                  {reg.comment || <span className="text-slate-400 italic">بدون بازخورد متنی</span>}
                                </td>
                                <td className="p-3 text-left text-[10px] text-slate-400 font-sans">
                                  {reg.createdAt ? formatFarsiDate(reg.createdAt) : '-'}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </Card>
        </div>
      )}

      {/* 💾 Backup Manager Modal */}
      {showBackupManager && (
        <BackupManagerModal 
          isOpen={showBackupManager}
          onClose={() => setShowBackupManager(false)}
          siteSettings={siteSettings}
        />
      )}

      {/* ⚙️ Site Settings Modal */}
      {showSiteSettingsManager && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <Card className="max-w-md w-full bg-white rounded-3xl overflow-hidden border-slate-100 shadow-2xl relative p-6 sm:p-8">
            <div className="absolute top-4 left-4 z-10">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowSiteSettingsManager(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="mb-6 animate-fade-in" dir="rtl">
              <h2 className="text-xl font-bold text-slate-850 flex items-center gap-2">
                <span>⚙️ تنظیمات عمومی سامانه</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">مدیر کل گرامی، در این بخش می‌توانید نام و لوگوی اصلی سایت را مدیریت کنید.</p>
            </div>

            <form onSubmit={handleUpdateSiteSettings} className="space-y-5" dir="rtl">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">نام رسمی سامانه</label>
                <input 
                  type="text" 
                  value={siteName} 
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="مثلا: سامانه هوشمند مواکب اربعین"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">لوگوی سایت (لوگوی پیش‌فرض مواکب)</label>
                <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  {siteLogo ? (
                    <div className="relative group">
                      <img src={siteLogo} alt="Site Logo" className="w-24 h-24 object-contain rounded-xl shadow-md bg-white p-2" />
                      <button 
                        type="button"
                        onClick={() => setSiteLogo(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-10 h-10" />
                    </div>
                  )}
                  
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 font-bold mb-2">فرمت‌های مجاز: JPG, PNG (حداکثر ۱ مگابایت)</p>
                    <label className="cursor-pointer bg-white border border-slate-200 hover:border-blue-400 text-slate-600 px-4 py-2 rounded-xl text-[11px] font-black shadow-sm transition-all inline-block">
                      <span>انتشار و تغییر لوگو</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleSiteLogoUpload} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer Settings */}
              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">متن کپی‌رایت / فوتر سایت</label>
                <textarea 
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="متن نمایش داده شده در فوتر پایین سایت"
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none font-sans"
                />
              </div>

              {/* PWA Settings Section */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  📱 تنظیمات اختصاصی PWA موبایل زائران
                </h3>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-150">
                  <div className="space-y-0.5">
                    <label className="block text-xs font-extrabold text-slate-800">نمایش نوار ثبت‌نام موکب‌دار</label>
                    <span className="text-[10px] text-slate-400 leading-normal block">نوار زیر اسلایدر در صفحه اصلی PWA زوار جهت دعوت به ثبت‌نام خادمین جدید</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={pwaRegistrationBannerEnabled} 
                      onChange={(e) => setPwaRegistrationBannerEnabled(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5">پیام اعلان سراسری و خلاقانه برای بازدیدکنندگان (PWA)</label>
                  <textarea 
                    value={pwaVisitorAnnouncement} 
                    onChange={(e) => setPwaVisitorAnnouncement(e.target.value)}
                    placeholder="پیام یا خبر داغی که می‌خواهید زیر اسلایدر به عموم زائران نمایش داده شود (مثلا: با توجه به دمای هوا، زوار محترم عینک آفتابی همراه داشته باشند.)"
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed"
                  />
                  <span className="text-[9px] text-slate-400">در صورت خالی گذاشتن این کادر، اعلان بازدیدکنندگان نمایش داده نخواهد شد.</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  disabled={submittingSiteSettings}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-3 rounded-2xl shadow-lg shadow-blue-200 transition-all"
                >
                  {submittingSiteSettings ? 'در حال بروزرسانی...' : '💾 ذخیره تغییرات نهایی'}
                </Button>
                <Button 
                  type="button"
                  variant="ghost"
                  onClick={() => setShowSiteSettingsManager(false)}
                  className="px-6 text-slate-400 text-xs font-bold"
                >
                  انصراف
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}



      {/* 📣 Operator Announcements Management Modal */}
      {showOperatorAnnouncementsManager && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <Card className="max-w-4xl w-full bg-white rounded-3xl overflow-hidden border-slate-100 shadow-2xl relative my-8 p-6 sm:p-8" dir="rtl">
            <div className="absolute top-4 left-4 z-10">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowOperatorAnnouncementsManager(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-teal-500 animate-pulse" />
                <span>مدیریت اعلانات اختصاصی موکب‌داران</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">مدیر گرامی، اعلانات ثبت شده در این بخش منحصراً در پنل کارتابل صاحبان مواکب نمایش داده می‌شود.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              
              {/* Create Announcement Form */}
              <div className="lg:col-span-1">
                <form onSubmit={handleCreateOperatorAnnouncement} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-150">✍️ ثبت اعلان جدید</h3>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">عنوان اعلان</label>
                      <input 
                        type="text"
                        value={newOpAnnouncementTitle}
                        onChange={e => setNewOpAnnouncementTitle(e.target.value)}
                        placeholder="مثلا: فراخوان دریافت سهمیه گاز مایع مواکب"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">درجه اهمیت</label>
                      <select 
                        value={newOpAnnouncementImportance}
                        onChange={e => setNewOpAnnouncementImportance(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                      >
                        <option value="info">اطلاع‌رسانی (سبز)</option>
                        <option value="warning">مهم / هشدار دهنده (زرد)</option>
                        <option value="critical">بحرانی و اضطراری (قرمز)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">متن کامل اعلان</label>
                      <textarea 
                        value={newOpAnnouncementContent}
                        onChange={e => setNewOpAnnouncementContent(e.target.value)}
                        placeholder="جزئیات و دستورالعمل اجرایی را در این بخش بنویسید..."
                        className="w-full h-24 bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">فایل ضمیمه / سند پیوست (اختیاری)</label>
                      <div 
                        onDragOver={handleOpFileDragOver}
                        onDragLeave={handleOpFileDragLeave}
                        onDrop={handleOpFileDrop}
                        className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isDraggingOpFile 
                            ? 'border-teal-500 bg-teal-50/50' 
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                        }`}
                        onClick={() => document.getElementById('op-file-input')?.click()}
                      >
                        <input 
                          id="op-file-input"
                          type="file"
                          className="hidden"
                          onChange={handleOpFileChange}
                        />
                        {newOpAnnouncementFileName ? (
                          <div className="flex items-center gap-2 text-slate-700">
                            <FileText className="w-5 h-5 text-teal-500 shrink-0" />
                            <span className="text-xs font-bold truncate max-w-[150px]">{newOpAnnouncementFileName}</span>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewOpAnnouncementFile(null);
                                setNewOpAnnouncementFileName(null);
                              }}
                              className="text-rose-500 hover:text-rose-700 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-center space-y-1">
                            <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                            <p className="text-[11px] text-slate-500">فایل خود را به اینجا بکشید یا کلیک کنید</p>
                            <p className="text-[9px] text-slate-400">حجم مجاز: تا ۵ مگابایت</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      type="submit" 
                      disabled={submittingOpAnnouncement}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs px-5 rounded-xl h-10 shadow-sm w-full"
                    >
                      {submittingOpAnnouncement ? 'در حال ثبت...' : editingOpAnnouncement ? '💾 ذخیره تغییرات اعلان' : '🚀 ثبت و ارسال اعلان'}
                    </Button>
                    {editingOpAnnouncement && (
                      <Button 
                        type="button"
                        onClick={() => {
                          setEditingOpAnnouncement(null);
                          setNewOpAnnouncementTitle('');
                          setNewOpAnnouncementContent('');
                          setNewOpAnnouncementFile(null);
                          setNewOpAnnouncementFileName(null);
                        }}
                        variant="ghost"
                        className="mt-2 text-slate-500 text-xs font-bold w-full"
                      >
                        انصراف از ویرایش
                      </Button>
                    )}
                  </div>
                </form>
              </div>

              {/* List of announcements */}
              <div className="lg:col-span-2">
                <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 h-full flex flex-col">
                  <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 mb-3 flex items-center gap-1.5">
                    <span>📋 اعلانات ارسال شده به موکب‌داران ({operatorAnnouncements.length})</span>
                  </h3>

                  {operatorAnnouncements.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                      <Megaphone className="w-10 h-10 text-slate-300" />
                      <p className="text-xs font-bold">هنوز هیچ اعلانی برای موکب‌داران ثبت نشده است.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                      {operatorAnnouncements.map((ann) => (
                        <div 
                          key={ann.id} 
                          className={`p-4 border rounded-2xl bg-white shadow-sm flex flex-col justify-between ${
                            ann.importance === 'critical' ? 'border-r-4 border-r-rose-500' :
                            ann.importance === 'warning' ? 'border-r-4 border-r-amber-500' :
                            'border-r-4 border-r-teal-500'
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full ${
                                ann.importance === 'critical' ? 'bg-red-50 text-red-700 border border-red-100' :
                                ann.importance === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-100' :
                                'bg-teal-50 text-teal-800 border border-teal-100'
                              }`}>
                                {ann.importance === 'critical' ? 'اضطراری' : ann.importance === 'warning' ? 'مهم' : 'اطلاع‌رسانی'}
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold">
                                {formatFarsiDate(ann.createdAt)}
                              </span>
                            </div>
                            <h4 className="font-extrabold text-xs text-slate-800 mb-1.5">{ann.title}</h4>
                            <p className="text-[10px] text-slate-600 leading-relaxed text-justify mb-3 whitespace-pre-line">{ann.content}</p>
                          </div>

                          {ann.attachmentUrl && (
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl mb-3">
                              <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                              <span className="text-[10px] font-bold text-slate-700 truncate max-w-[200px]">{ann.attachmentName || 'فایل ضمیمه'}</span>
                              <a 
                                href={ann.attachmentUrl} 
                                download={ann.attachmentName || 'attachment'} 
                                className="mr-auto text-[10px] text-teal-600 hover:text-teal-800 font-bold flex items-center gap-0.5 border border-teal-200 bg-white px-2 py-0.5 rounded-lg"
                              >
                                <Download className="w-3 h-3" />
                                <span>دانلود</span>
                              </a>
                            </div>
                          )}

                          <div className="flex justify-end border-t border-slate-100/50 pt-2 mt-auto gap-2">
                            <Button 
                              onClick={() => {
                                setEditingOpAnnouncement(ann);
                                setNewOpAnnouncementTitle(ann.title);
                                setNewOpAnnouncementContent(ann.content);
                                setNewOpAnnouncementImportance(ann.importance);
                                setNewOpAnnouncementFileName(ann.attachmentName || null);
                                // Attachment file itself is handled by current value or new upload
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              size="sm"
                              variant="ghost" 
                              className="h-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700 gap-1 rounded-xl text-[10px] font-bold"
                            >
                              <span>✏️ ویرایش</span>
                            </Button>
                            <Button 
                              onClick={() => handleDeleteOperatorAnnouncement(ann.id)}
                              size="sm"
                              variant="ghost" 
                              className="h-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1 rounded-xl text-[10px] font-bold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف اعلان</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setShowOperatorAnnouncementsManager(false)} className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl px-5 h-9">
                بستن پرتال اعلانات
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Pro Card Creative Modal */}
      {selectedProCardMokeb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-transparent w-full max-w-sm rounded-[32px] shadow-2xl relative overflow-hidden ring-4 ring-white/10" dir="rtl">
            
            {/* Action Bar */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
               <button 
                 onClick={() => setSelectedProCardMokeb(null)}
                 className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-white hover:text-slate-900 transition-colors shadow-sm"
               >
                 <X className="w-5 h-5" />
               </button>
            </div>

            {/* Poster content */}
            <div className="relative font-sans pt-12 pb-8 px-6 bg-gradient-to-b from-indigo-950 via-slate-900 to-black text-white min-h-[550px] flex flex-col items-center text-center">
              
              {/* decorative star */}
              <Sparkles className="w-12 h-12 text-amber-300 absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 opacity-80" />

              <div className="w-24 h-24 rounded-full border-4 border-amber-400 bg-emerald-950 flex items-center justify-center shadow-2xl mb-4 overflow-hidden relative">
                 {selectedProCardMokeb.galleryUrls && selectedProCardMokeb.galleryUrls.length > 0 ? (
                    <img src={selectedProCardMokeb.galleryUrls[0]} className="w-full h-full object-cover" alt="Mokeb Logo" />
                 ) : (
                    <span className="text-4xl">🕋</span>
                 )}
              </div>

              <div className="inline-block px-4 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-[10px] font-bold text-amber-200 mb-5 tracking-widest">
                کارت خدمت‌رسانی مراسم تشییع
              </div>

              <h2 className="text-2xl font-black text-white mb-2 leading-tight">
                {selectedProCardMokeb.name}
              </h2>
              <p className="text-xs font-semibold text-slate-300 mb-6">به مدیریت: {selectedProCardMokeb.managerName}</p>

              {/* Status / Track badge */}
              <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 shadow-inner text-right">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">وضعیت استقرار</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400 font-bold">{selectedProCardMokeb.address || 'آدرس ثبت نشده'}</p>
              </div>

              <div className="flex-1 w-full space-y-3">
                 <div className="border border-indigo-500/30 rounded-2xl p-3 flex items-center justify-between bg-indigo-500/10">
                    <span className="text-[10px] font-bold text-indigo-200">شماره ثبت سامانه</span>
                    <span className="font-mono text-sm font-black text-white tracking-wider">{selectedProCardMokeb.trackingCode}</span>
                 </div>
                 {selectedProCardMokeb.phone && (
                    <div className="border border-sky-500/30 rounded-2xl p-3 flex items-center justify-between bg-sky-500/10">
                        <span className="text-[10px] font-bold text-sky-200">تلفن خادم</span>
                        <span className="font-mono text-sm font-black text-white tracking-wider" dir="ltr">{selectedProCardMokeb.phone}</span>
                    </div>
                 )}
              </div>

              {/* Verified seal */}
              <div className="mt-8 flex flex-col items-center">
                 <div className="w-12 h-12 bg-amber-400/20 rounded-full flex items-center justify-center mb-2">
                   <ShieldAlert className="w-6 h-6 text-amber-400" />
                 </div>
                 <span className="text-[9px] font-bold text-amber-500">پروانه معتبر در سامانه موکب‌داران</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Story Manager Modal */}
      {selectedStoryMokeb && (
         <StoryManagerModal 
           mokeb={selectedStoryMokeb} 
           onClose={() => setSelectedStoryMokeb(null)} 
           onUpdate={() => fetchMokebs()}
         />
      )}
      
      {/* Announcement Manager Modal */}
      {selectedAnnouncementMokeb && (
         <AnnouncementManagerModal 
           mokeb={selectedAnnouncementMokeb} 
           onClose={() => setSelectedAnnouncementMokeb(null)} 
           onUpdate={() => fetchMokebs()}
         />
      )}

      {/* 🔌 Database Connection Test Modal */}
      {showDbTestModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <Card className="max-w-md w-full bg-white rounded-3xl overflow-hidden border-slate-100 shadow-2xl relative p-6 sm:p-8" dir="rtl">
            <div className="absolute top-4 left-4 z-10">
              <Button 
                type="button"
                variant="ghost" 
                size="icon" 
                onClick={() => setShowDbTestModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="mb-6 text-right">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="text-xl">🔌 بررسی وضعیت اتصال دیتابیس</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">مدیر کل گرامی، در این بخش می‌توانید صحت ارتباط زنده سرور با پایگاه داده MySQL را محک بزنید.</p>
            </div>

            <div className="space-y-6 text-right">
              {testingDb ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div>
                  <span className="text-xs font-bold text-slate-500">در حال ارسال سیگنال و آزمودن اتصال MySQL...</span>
                </div>
              ) : dbTestResult ? (
                <div className="space-y-4">
                  {dbTestResult.success ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-2xl font-bold">✓</div>
                      <h3 className="text-sm font-extrabold text-emerald-800">اتصال پایگاه داده با موفقیت برقرار است</h3>
                      <p className="text-xs text-emerald-600 leading-relaxed font-sans">{dbTestResult.message}</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
                      <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 text-2xl font-bold">✗</div>
                      <h3 className="text-sm font-extrabold text-rose-800">بروز خطا در اتصال پایگاه داده</h3>
                      <p className="text-xs text-rose-600 leading-relaxed font-sans">{dbTestResult.message}</p>
                      {dbTestResult.error && (
                        <div className="w-full bg-rose-950 text-rose-200 p-3 rounded-xl text-left font-mono text-[10px] overflow-x-auto whitespace-pre-wrap mt-2">
                          {dbTestResult.error}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl text-xs space-y-1.5 font-sans">
                    <div className="flex justify-between">
                      <span className="text-slate-400">نوع پایگاه داده:</span>
                      <span className="font-bold text-slate-700">MySQL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">زمان تست:</span>
                      <span className="font-bold text-slate-700">{new Date().toLocaleTimeString('fa-IR')}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2 pt-2">
                <Button 
                  type="button"
                  onClick={handleTestDbConnection}
                  disabled={testingDb}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-3 rounded-2xl transition-all"
                >
                  {testingDb ? 'در حال آزمایش...' : '🔌 تلاش مجدد برای اتصال'}
                </Button>
                <Button 
                  type="button"
                  onClick={() => setShowDbTestModal(false)}
                  variant="ghost"
                  className="px-6 text-slate-400 text-xs font-bold"
                >
                  بستن صفحه
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
