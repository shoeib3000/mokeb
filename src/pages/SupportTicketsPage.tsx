import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/db';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  deleteDoc,
  getDocs 
} from '../lib/db';
import { 
  MessageSquare, 
  Send, 
  PlusCircle, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Shield, 
  Search, 
  Filter, 
  ArrowLeft, 
  HelpCircle, 
  X, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Trash2,
  AlertOctagon,
  ChevronLeft,
  RefreshCw
} from 'lucide-react';
import { Ticket, TicketMessage, TicketStatus, TicketPriority } from '../types';

export default function SupportTicketsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  // Basic states
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // New Ticket Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('تایید مدارک و ثبت‌نام');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [initialMessage, setInitialMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active chat state
  const [replyText, setReplyText] = useState('');
  const activeMessageCountRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Admin Quick Reply templates
  const adminTemplates = [
    "مدارک ارسالی شما ناقص است؛ لطفا کپی فیش بیمه و مدرک تائید آدرس موکب را در پیام‌های بعدی ارسال کنید.",
    "مکان جغرافیایی دقیق موکب تایید گردید. لطفا مرحله دوم تعهدنامه مالی را امضا و نهایی نمایید.",
    "نقص فنی ورود به پنل کاربری برطرف شد. لطفا حافظه مرورگر خود را بازنشانی کرده و مجدداً تلاش نمایید.",
    "تبریک می‌گوئیم؛ پرونده شما با موفقیت بررسی شد و مجوز رسمی موکب خدمت‌رسانی مراسم تشییع شما صادر و روی نقشه فعال شد."
  ];

  // Synthesize notification sound
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      console.warn("Audio Context block:", e);
    }
  };

  // 1. Fetch & Sync Tickets
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    let q;
    
    // Admin sees ALL tickets, User only sees their OWN tickets
    if (profile?.isAdmin) {
      q = query(collection(db, 'tickets'), orderBy('updatedAt', 'desc'));
    } else {
      q = query(
        collection(db, 'tickets'), 
        where('userId', '==', user.uid), 
        orderBy('updatedAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketsData: Ticket[] = [];
      snapshot.forEach((doc) => {
        ticketsData.push({ id: doc.id, ...doc.data() } as Ticket);
      });
      setTickets(ticketsData);
      setLoading(false);
      
      // Update selected ticket state if it was updated in DB
      if (selectedTicket) {
        const updated = ticketsData.find(t => t.id === selectedTicket.id);
        if (updated) {
          setSelectedTicket(updated);
        }
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'tickets');
    });

    return () => unsubscribe();
  }, [user, profile?.isAdmin]);

  // 2. Fetch & Sync Messages for the Active Ticket
  useEffect(() => {
    if (!selectedTicket?.id) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, `tickets/${selectedTicket.id}/messages`), 
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData: TicketMessage[] = [];
      snapshot.forEach((doc) => {
        messagesData.push({ id: doc.id, ...doc.data() } as TicketMessage);
      });
      
      // Play alert sound if a new message is received from the opposite party
      if (messagesData.length > activeMessageCountRef.current && activeMessageCountRef.current > 0) {
        const lastMsg = messagesData[messagesData.length - 1];
        const currentRole = profile?.isAdmin ? 'admin' : 'user';
        if (lastMsg.senderRole !== currentRole) {
          playAlertSound();
        }
      }
      
      activeMessageCountRef.current = messagesData.length;
      setMessages(messagesData);
      
      // Smooth scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `tickets/${selectedTicket.id}/messages`);
    });

    // Mark as Read when opening the ticket
    const updateReadStatus = async () => {
      try {
        const tRef = doc(db, 'tickets', selectedTicket.id);
        if (profile?.isAdmin) {
          await updateDoc(tRef, { unreadByAdmin: false });
        } else {
          await updateDoc(tRef, { unreadByUser: false });
        }
      } catch (err) {
        console.error("Failed to mark ticket as read:", err);
      }
    };
    updateReadStatus();

    return () => unsubscribe();
  }, [selectedTicket?.id, profile?.isAdmin]);

  // 3. Submit New Ticket (User)
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subject.trim() || !initialMessage.trim()) return;

    setSubmitting(true);
    try {
      // Find user name from profile or auth
      const userDisplay = profile?.name || user.email || 'خادم موکب مجهول';
      
      // Attempt to retrieve Mokeb name if available
      let mokebNameVal = '';
      try {
        const mokebsSnap = await getDocs(query(collection(db, 'mokebs'), where('ownerId', '==', user.uid)));
        if (!mokebsSnap.empty) {
          mokebNameVal = mokebsSnap.docs[0].data().name;
        }
      } catch (e) {
        console.warn("Unable to read mokeb name:", e);
      }

      const ticketPayload = {
        userId: user.uid,
        userDisplayName: userDisplay,
        userEmail: user.email || '',
        mokebName: mokebNameVal || 'ثبت‌نام نشده',
        subject: subject.trim(),
        category,
        priority,
        status: 'open' as TicketStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageText: initialMessage.trim().substring(0, 100),
        lastSenderRole: 'user' as const,
        unreadByAdmin: true,
        unreadByUser: false,
      };

      // Add actual ticket doc
      const docRef = await addDoc(collection(db, 'tickets'), ticketPayload);
      
      // Add first message 
      await addDoc(collection(db, `tickets/${docRef.id}/messages`), {
        ticketId: docRef.id,
        senderId: user.uid,
        senderName: userDisplay,
        senderRole: 'user' as const,
        text: initialMessage.trim(),
        createdAt: serverTimestamp()
      });

      // Clear form & close
      setSubject('');
      setInitialMessage('');
      setShowCreateModal(false);
      
      // Instantly open the newly created ticket
      setSelectedTicket({
        id: docRef.id,
        ...ticketPayload,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      playAlertSound();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tickets');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Send Message (User or Admin)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTicket || !replyText.trim()) return;

    const messageText = replyText.trim();
    setReplyText('');

    try {
      const senderDisplay = profile?.name || user.email || 'ناشناس';
      const currentRole = profile?.isAdmin ? 'admin' : 'user';

      // 1. Add current reply to messages collection
      await addDoc(collection(db, `tickets/${selectedTicket.id}/messages`), {
        ticketId: selectedTicket.id,
        senderId: user.uid,
        senderName: senderDisplay,
        senderRole: currentRole,
        text: messageText,
        createdAt: serverTimestamp()
      });

      // 2. Update ticket meta details
      const ticketRef = doc(db, 'tickets', selectedTicket.id);
      await updateDoc(ticketRef, {
        updatedAt: serverTimestamp(),
        lastMessageText: messageText.substring(0, 100),
        lastSenderRole: currentRole,
        unreadByAdmin: currentRole === 'user',
        unreadByUser: currentRole === 'admin',
        // Auto mark as answered if admin writes, or open if user replies
        status: currentRole === 'admin' ? 'answered' : 'in_progress'
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `tickets/${selectedTicket.id}/messages`);
    }
  };

  // 5. Update Status manually (e.g. Admin close ticket)
  const handleUpdateStatus = async (newStatus: TicketStatus) => {
    if (!selectedTicket) return;
    try {
      const ticketRef = doc(db, 'tickets', selectedTicket.id);
      await updateDoc(ticketRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${selectedTicket.id}`);
    }
  };

  // 6. Update Priority manually (Admin)
  const handleUpdatePriority = async (newPriority: TicketPriority) => {
    if (!selectedTicket) return;
    try {
      const ticketRef = doc(db, 'tickets', selectedTicket.id);
      await updateDoc(ticketRef, {
        priority: newPriority,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${selectedTicket.id}`);
    }
  };

  // 7. Delete Ticket (Admin Only)
  const handleDeleteTicket = async (ticketId: string) => {
    if (!window.confirm("آیا از حذف کامل این تیکت و پیام‌های آن اطمینان دارید؟این عمل غیر قابل بازگشت است.")) return;
    try {
      await deleteDoc(doc(db, 'tickets', ticketId));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tickets/${ticketId}`);
    }
  };

  // Filter Logic
  const filteredTickets = tickets.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch = 
      t.subject?.toLowerCase().includes(queryLower) ||
      t.userDisplayName?.toLowerCase().includes(queryLower) ||
      t.userEmail?.toLowerCase().includes(queryLower) ||
      t.mokebName?.toLowerCase().includes(queryLower);

    return matchesStatus && matchesPriority && matchesSearch;
  });

  // KPI Calculations
  const totalOpened = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
  const pendingResponse = tickets.filter(t => t.unreadByAdmin).length;
  const totalResolved = tickets.filter(t => t.status === 'closed' || t.status === 'answered').length;
  const criticalCount = tickets.filter(t => t.priority === 'critical' && t.status !== 'closed').length;

  // Local helper UI badges creators
  const getStatusLabelAndColor = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return { label: 'جدید (باز)', bg: 'bg-indigo-50 border-indigo-250 text-indigo-700 font-black' };
      case 'in_progress':
        return { label: 'در حال بررسی', bg: 'bg-amber-50 border-amber-250 text-amber-700 font-black' };
      case 'answered':
        return { label: 'پاسخ داده شده', bg: 'bg-emerald-50 border-emerald-250 text-emerald-700 font-semibold' };
      case 'closed':
        return { label: 'بسته شده', bg: 'bg-slate-100 border-slate-200 text-slate-500' };
      default:
        return { label: status, bg: 'bg-slate-50 border-slate-200' };
    }
  };

  const getPriorityLabelAndColor = (priority: TicketPriority) => {
    switch (priority) {
      case 'low':
        return { label: 'کم اهمیت', bg: 'bg-slate-100 text-slate-600 border-slate-200' };
      case 'medium':
        return { label: 'متوسط', bg: 'bg-blue-50 text-blue-600 border-blue-200' };
      case 'high':
        return { label: 'فوری 🔥', bg: 'bg-orange-50 text-orange-700 border-orange-200 font-bold' };
      case 'critical':
        return { label: 'بحرانی 🚨', bg: 'bg-red-50 text-red-700 border-red-300 font-black animate-pulse' };
      default:
        return { label: priority, bg: 'bg-slate-50' };
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'چند ثانیه پیش';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans w-full max-w-md mx-auto shadow-xl border-x border-slate-200 relative flex flex-col" dir="rtl">
      {/* Upper header navigation (Mobile styling) */}
      <div className="bg-[#007f5f] text-white p-4 sticky top-0 z-30 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="space-y-0.5">
            <h1 className="text-sm font-black tracking-tight">پشتیبانی و تیکت‌ها</h1>
            <p className="text-[9px] text-emerald-100 font-bold">ارتباط با کارشناسان ستاد</p>
          </div>
        </div>

        <button 
          onClick={() => {
            setSoundEnabled(!soundEnabled);
            playAlertSound();
          }}
          className="p-2 hover:bg-white/10 rounded-full transition-colors relative"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-100" /> : <VolumeX className="w-4 h-4 text-emerald-100/60" />}
        </button>
      </div>

      <div className="px-4 mt-6">
        
        {/* KPI Score Cards Section (Both Admin and User see tailored stats) */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {profile?.isAdmin ? (
            <>
              {/* Admin KPI 1 */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 h-1.5 w-full bg-indigo-500" />
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-[11px] text-slate-400 font-bold uppercase transition-colors">کل تیکت‌های پاسخ‌نشده</h4>
                  <p className="text-2xl font-black text-slate-800 mt-1 font-mono">{pendingResponse}</p>
                </div>
              </div>

              {/* Admin KPI 2 */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 h-1.5 w-full bg-amber-500" />
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold animate-pulse">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-[11px] text-slate-400 font-bold uppercase">در حال بررسی (آرشیو جاری)</h4>
                  <p className="text-2xl font-black text-slate-800 mt-1 font-mono">{totalOpened}</p>
                </div>
              </div>

              {/* Admin KPI 3 */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 h-1.5 w-full bg-red-500" />
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                  <AlertOctagon className="w-6 h-6 animate-spin-slow" />
                </div>
                <div>
                  <h4 className="text-[11px] text-slate-400 font-bold uppercase">بحرانی / اولویت اورژانسی</h4>
                  <p className="text-2xl font-black text-red-600 mt-1 font-mono">{criticalCount}</p>
                </div>
              </div>

              {/* Admin KPI 4 */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 h-1.5 w-full bg-emerald-500" />
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-[11px] text-slate-400 font-bold uppercase">مجموع حل و بسته شده</h4>
                  <p className="text-2xl font-black text-emerald-600 mt-1 font-mono">{totalResolved}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* User KPI 1 */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-none rounded-3xl p-5 flex items-center gap-4 shadow-md relative overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-white/10 text-amber-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1">
                  <h4 className="text-[11px] text-indigo-200 font-bold">راهنمای هوشمند تیکت</h4>
                  <p className="text-xs text-indigo-50 mt-1 pr-1 font-sans">
                    هرگونه نقص مدارک، مشکلات مکانی یا صدور مجوز را اینجا با کارشناسان ما درمیان بگذارید.
                  </p>
                </div>
              </div>

              {/* User KPI 2 */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 h-1.5 w-full bg-amber-500" />
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-[11px] text-slate-400 font-bold uppercase">تیکت‌های شما در نوبت تایید</h4>
                  <p className="text-2xl font-black text-slate-800 mt-1 font-mono">{tickets.filter(t => t.status !== 'closed').length}</p>
                </div>
              </div>

              {/* User KPI 3 */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 h-1.5 w-full bg-emerald-500" />
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-[11px] text-slate-400 font-bold uppercase">آرشیو تیکت‌های بسته شده</h4>
                  <p className="text-2xl font-black text-slate-800 mt-1 font-mono">{tickets.filter(t => t.status === 'closed').length}</p>
                </div>
              </div>

              {/* User Action card */}
              <div className="bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-3xl p-5 flex items-center justify-between gap-4 shadow-sm transition-all cursor-pointer" onClick={() => setShowCreateModal(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-indigo-950">ثبت پیام پشتیبانی جدید</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">کلیک کنید و موضوع خود را بنویسید</p>
                  </div>
                </div>
                <ChevronLeft className="w-5 h-5 text-indigo-400" />
              </div>
            </>
          )}
        </div>

        {/* Outer Split Pane Structure */}
        <div className="flex flex-col bg-white border border-slate-100 rounded-3xl shadow-md min-h-[640px]">
          
          {/* Left / Navigation Pane: Tickets Directory */}
          {!selectedTicket && (
            <div className="flex flex-col min-h-[600px] h-full bg-slate-50/50 rounded-3xl overflow-hidden">
            
            {/* Nav Header: Filter Tools */}
            <div className="p-4 bg-white border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>پذیرش و بایگانی مکاتبات</span>
                  <span className="text-[100%] font-mono bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full text-xs font-black">
                    {filteredTickets.length}
                  </span>
                </h3>
                
                {/* Admin/User New Ticket Floating shortcut */}
                {!profile?.isAdmin && (
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="p-1 px-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <span>➕ ثبت‌تیکت</span>
                  </button>
                )}
              </div>

              {/* Dynamic Text Finder */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input 
                  type="text" 
                  placeholder={profile?.isAdmin ? "جستجوی خادم، ایمیل، شناسه ی تیکت یا موضوع..." : "جستجوی موضوع یا پیام..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                />
              </div>

              {/* Advanced Combobox Filter rows */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {/* Status selector */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/65 rounded-lg px-2.5 py-1">
                  <span className="text-slate-400 pr-0.5 font-bold">وضعیت:</span>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent focus:outline-none flex-1 font-bold text-slate-700"
                  >
                    <option value="all">کلیه وضعیت‌ها</option>
                    <option value="open">جدید (باز شده)</option>
                    <option value="in_progress">در حال بررسی</option>
                    <option value="answered">پاسخ داده شده</option>
                    <option value="closed">بسته و تایید شده</option>
                  </select>
                </div>

                {/* Priority Selector */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/65 rounded-lg px-2.5 py-1">
                  <span className="text-slate-400 pr-0.5 font-bold">فوریت:</span>
                  <select 
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-transparent focus:outline-none flex-1 font-bold text-slate-700"
                  >
                    <option value="all">همه اولویت‌ها</option>
                    <option value="critical">بحرانی 🚨</option>
                    <option value="high">فوری 🔥</option>
                    <option value="medium">متوسط</option>
                    <option value="low">کم اهمیت</option>
                  </select>
                </div>
              </div>
            </div>

            {/* List Body Section container */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[500px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
                  <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin" />
                  <span className="text-xs">در حال بارگزاری پیام‌ها...</span>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 gap-2">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                    <Filter className="w-5 h-5 text-slate-400" />
                  </div>
                  <h4 className="text-xs font-black text-slate-700">هیچ تیکتی با این فیلتر یا نام مشخص نشد</h4>
                  <p className="text-[10px] leading-relaxed max-w-[200px]">
                    {profile?.isAdmin ? "هیچ خادمی پیام ثبت نکرده یا کوئری خروجی ندارد." : "تاکنون پیام پشتیبانی با این مشخصات نفرستاده اید."}
                  </p>
                </div>
              ) : (
                filteredTickets.map((t) => {
                  const isSelected = selectedTicket?.id === t.id;
                  const statusInfo = getStatusLabelAndColor(t.status);
                  const priorityInfo = getPriorityLabelAndColor(t.priority);
                  
                  // Check if unread to make it bold & highlight background
                  const hasUnread = profile?.isAdmin ? t.unreadByAdmin : t.unreadByUser;

                  return (
                    <div 
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className={`p-4 transition-all pr-5 cursor-pointer relative ${
                        isSelected 
                          ? 'bg-indigo-500/10 border-r-4 border-indigo-600' 
                          : hasUnread 
                            ? 'bg-amber-500/5 hover:bg-slate-100/80' 
                            : 'bg-white hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Unread circle notification */}
                      {hasUnread && (
                        <span className="absolute top-4 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" title="پیام جدید خوانده نشده" />
                      )}

                      <div className="flex justify-between items-start gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[9px] border font-bold ${statusInfo.bg}`}>
                            {statusInfo.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] border font-semibold ${priorityInfo.bg}`}>
                            {priorityInfo.label}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono font-bold">{formatTimestamp(t.updatedAt || t.createdAt)}</span>
                      </div>

                      <h4 className={`text-xs font-black text-slate-900 mt-2 truncate max-w-[280px] ${hasUnread ? 'text-indigo-950 font-extrabold scale-[1.01]' : ''}`}>
                        {t.subject}
                      </h4>

                      <p className="text-[10px] text-slate-500 mt-1 truncate max-w-[280px] font-sans">
                        {t.lastMessageText || 'بدون متن اولیه'}
                      </p>

                      {/* Display sender info if admin */}
                      {profile?.isAdmin && (
                        <div className="mt-2.5 flex items-center justify-between border-t border-slate-100/60 pt-2 text-[9px] text-slate-500 font-sans">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <b className="text-slate-700">{t.userDisplayName || 'خادم سیستم'}</b>
                          </div>
                          {t.mokebName && (
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-bold">{t.mokebName}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
           </div>
          )}

          {/* Right Pane: Active Ticket Chat Room Container */}
          {selectedTicket && (
            <div className="flex flex-col min-h-[600px] h-full justify-between bg-white relative rounded-3xl overflow-hidden">
              
              {/* Back to list button */}
              <div className="bg-slate-100 p-2 border-b border-slate-200">
                 <button onClick={() => setSelectedTicket(null)} className="flex items-center gap-1.5 text-xs text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm font-bold">
                    <ArrowLeft className="w-4 h-4" /> بازگشت به لیست تیکت‌ها
                 </button>
              </div>

              {/* 1. Room Header details & controls */}
              <div className="p-4 sm:p-5 bg-white border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                          💼 موضوع کلاس: {selectedTicket.category || 'عمومی'}
                        </span>
                        
                        {/* Status Label */}
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusLabelAndColor(selectedTicket.status).bg}`}>
                          {getStatusLabelAndColor(selectedTicket.status).label}
                        </span>

                        {/* Priority Badge */}
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getPriorityLabelAndColor(selectedTicket.priority).bg}`}>
                          {getPriorityLabelAndColor(selectedTicket.priority).label}
                        </span>
                      </div>

                      <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                        {selectedTicket.subject}
                      </h2>

                      <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400 font-sans">
                        <span>خادم ارسال کننده: <b>{selectedTicket.userDisplayName}</b></span>
                        <span className="text-slate-300">|</span>
                        <span>مربوط به عمود/موکب: <b>{selectedTicket.mokebName || 'بدون اطلاعات'}</b></span>
                      </div>
                    </div>

                    {/* Admin Actions Panel */}
                    {profile?.isAdmin && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Change Status select dropdown */}
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                          <label className="text-[10px] text-slate-500 font-bold">تغییر وضعیت:</label>
                          <select 
                            value={selectedTicket.status} 
                            onChange={(e) => handleUpdateStatus(e.target.value as TicketStatus)}
                            className="bg-transparent focus:outline-none font-bold text-slate-700"
                          >
                            <option value="open">جدید (باز)</option>
                            <option value="in_progress">در حال بررسی</option>
                            <option value="answered">پاسخ داده شد</option>
                            <option value="closed">بستن تیکت</option>
                          </select>
                        </div>

                        {/* Delete ticket */}
                        <button 
                          onClick={() => handleDeleteTicket(selectedTicket.id)}
                          className="p-2.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl border border-transparent hover:border-red-100 transition-all"
                          title="حذف کامل گفتگو"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* User manual close ticket */}
                    {!profile?.isAdmin && selectedTicket.status !== 'closed' && (
                      <button 
                        onClick={() => handleUpdateStatus('closed')}
                        className="p-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[11px] font-bold transition-all border border-slate-200"
                      >
                        ✓ تایید حل و بستن مکاتبه
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Messages Bubble Area */}
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[420px] bg-slate-50/40 min-h-[300px]">
                  
                  {/* Decorative Welcome info banner */}
                  <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 text-center max-w-lg mx-auto mb-4">
                    <p className="text-[11px] text-indigo-950 font-bold leading-relaxed font-sans">
                      مکالمه آغاز شد. کارشناسان ما به محض بررسی مستندات جواب خواهند داد. فایل‌ها یا مستندات را می‌توانید با لینک مستقیم ارسال نمائید.
                    </p>
                    <span className="text-[9px] text-slate-400 font-mono font-bold mt-1.5 block">ارسال شده در: {formatTimestamp(selectedTicket.createdAt)}</span>
                  </div>

                  {messages.map((msg) => {
                    const isAdminMsg = msg.senderRole === 'admin';
                    return (
                      <div 
                        key={msg.id}
                        className={`flex flex-col max-w-[85%] ${isAdminMsg ? 'mr-auto items-start' : 'ml-auto items-end'}`}
                      >
                        {/* Bubble Header / Sender info */}
                        <span className="text-[9px] text-slate-400 font-bold mb-1 flex items-center gap-1 px-1">
                          {isAdminMsg ? <Shield className="w-2.5 h-2.5 text-amber-500" /> : <User className="w-2.5 h-2.5 text-indigo-500" />}
                          <span>{msg.senderName} ({isAdminMsg ? 'کارشناس رسمی' : 'خادم موکب'})</span>
                        </span>

                        {/* Interactive Message Bubble body */}
                        <div className={`p-3.5 rounded-2xl text-xs leading-relaxed font-sans relative ${
                          isAdminMsg 
                            ? 'bg-gradient-to-br from-indigo-950 to-indigo-900 text-indigo-55 border-none rounded-tl-none shadow-sm' 
                            : 'bg-white text-slate-800 border border-slate-150 rounded-tr-none shadow-sm'
                        }`}>
                          {/* Display checkmarks for texts */}
                          <p className="whitespace-pre-line">{msg.text}</p>
                          <span className={`text-[8px] mt-1.5 block text-left font-mono font-semibold ${
                            isAdminMsg ? 'text-indigo-200/80' : 'text-slate-400'
                          }`}>
                            {formatTimestamp(msg.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={scrollRef} />
                </div>

                {/* 3. Room Footer: Replier / Message composer */}
                <div className="p-4 bg-white border-t border-slate-100 space-y-3">
                  
                  {/* Admin Quick Templates selection panel */}
                  {profile?.isAdmin && (
                    <div className="border-b border-slate-50 pb-3 font-sans">
                      <span className="text-[10px] font-bold text-slate-400 block mb-2">⚡ پاسخ‌های آماده و پرکاربرد کارشناس سامانه:</span>
                      <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
                        {adminTemplates.map((tmpl, tIdx) => (
                          <button
                            key={tIdx}
                            onClick={() => setReplyText(tmpl)}
                            className="text-[9px] bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold px-3 py-1.5 rounded-full border border-slate-200 shrink-0 transition-colors"
                          >
                            {tmpl.substring(0, 36)}...
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Send text Form area */}
                  {selectedTicket.status === 'closed' ? (
                    <div className="bg-slate-100 rounded-2xl p-4 text-center text-xs text-slate-500 font-sans">
                      📥 این تیکت بسته شده است و امکان ارسال پیام جدید وجود ندارد. در صورت وجود سوال جدید، لطفا تیکت جدید تشکیل دهید.
                    </div>
                  ) : (
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <textarea 
                        rows={2}
                        placeholder={profile?.isAdmin ? "پاسخ خود را بنویسید..." : "طرح سوال، گزارش مشکل یا ارسال مدارک..."}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        required
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white resize-none font-sans"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                          }
                        }}
                      />
                      <button 
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-95 text-white p-3 rounded-2xl flex items-center justify-center transition-all h-full self-end shadow-md shadow-indigo-600/10"
                        title="ارسال پیام"
                      >
                        <Send className="w-5 h-5 ml-0.5" />
                      </button>
                    </form>
                  )}
                </div>
            </div>
          )}
        </div>
      </div>

      {/* ➕ Full Featured Create Ticket Dialog (Modal) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-100 relative animate-scale-up">
            
            {/* Modal Closer */}
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 left-4 p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Title bar */}
            <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
              <h3 className="text-base sm:text-lg font-black font-sans">تشکیل پرونده پشتیبانی جدید</h3>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed font-sans">
                لطفا اطلاعات فرم زیر را به نحو صحیح تکمیل فرمائید تا کارشناس مربوطه فورا ارجاع گیرد.
              </p>
            </div>

            <form onSubmit={handleCreateTicket} className="p-6 space-y-4 font-sans text-right" dir="rtl">
              
              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">موضوع پیام یا درخواست شما (خلاصه در یک خط):</label>
                <input 
                  type="text" 
                  placeholder="مثال: اصلاح آدرس عمود موکب، رفع نقص اسکن فیش بیمه، تائید کدملی خادمان"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white font-sans"
                />
              </div>

              {/* Grid selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">دسته‌بندی و بخش مربوطه:</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-850 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                  >
                    <option value="تایید مدارک و ثبت‌نام">تایید مدارک و ثبت‌نام هویتی</option>
                    <option value="بررسی دقیق آدرس عمود و نقشه">بررسی دقیق آدرس عمود و نقشه</option>
                    <option value="امضا تعهدنامه و فیش بیمه">امضا تعهدنامه و فیش بیمه</option>
                    <option value="نقص فنی یا مشکلات ورود سامانه">نقص فنی یا مشکلات ورود سامانه</option>
                    <option value="عمومی و متفرقه">سوال عام یا پیشنهاد کلی</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">اولویت / فوریت زمان پاسخ:</label>
                  <select 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TicketPriority)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-850 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white font-bold"
                  >
                    <option value="low" className="text-slate-600">کم اهمیت (آرشیو اداری عمومی)</option>
                    <option value="medium" className="text-blue-600">متوسط (بازه زمانی استاندارد)</option>
                    <option value="high" className="text-orange-600">فوری (بسیار سریع) 🔥</option>
                    <option value="critical" className="text-red-650">بحرانی (پاسخ آنی کارگروه ارشد) 🚨</option>
                  </select>
                </div>
              </div>

              {/* Core message */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">شرح دقیق درخواست پشتیبانی خود را مرقوم فرمائید:</label>
                <textarea 
                  rows={4}
                  placeholder="لطفا کلیه مدارک، نام خادمین، مشکلات ورود یا آدرس ملکیت یا ارور موردنظر را با شرح کامل بنویسید..."
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white resize-none font-sans"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all"
                >
                  انصراف
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-350 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  {submitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>ارسال و ایجاد شروع پرونده</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
