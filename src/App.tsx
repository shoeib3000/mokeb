import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { Home, Map, MapPin, User as UserIcon, LogOut, Settings, LayoutDashboard, Search, Smartphone, UserCheck } from 'lucide-react';
import { Button } from './components/ui/button';
import { logout } from './lib/db';

// Lazy load pages for better performance
const HomePage = lazy(() => import('./pages/HomePage'));
const PwaPage = lazy(() => import('./pages/PwaPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RegisterMokebPage = lazy(() => import('./pages/RegisterMokebPage'));
const PwaRegisterPage = lazy(() => import('./pages/PwaRegisterPage'));
const CreateMokebPage = lazy(() => import('./pages/CreateMokebPage'));
const CompleteMokebProfilePage = lazy(() => import('./pages/CompleteMokebProfilePage'));
const AdminMokebViewPage = lazy(() => import('./pages/AdminMokebViewPage'));
const AdminSlidersPage = lazy(() => import('./pages/AdminSlidersPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const WalkRoutesPage = lazy(() => import('./pages/WalkRoutesPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const PwaLoginPage = lazy(() => import('./pages/PwaLoginPage'));
const SupportTicketsPage = lazy(() => import('./pages/SupportTicketsPage'));
const MokebDetailsPage = lazy(() => import('./pages/MokebDetailsPage'));

function AppContent() {
  const { user, profile, loading, siteSettings } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  // Redirect mobile users to /pwa
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const isDesktopForced = searchParams.get('desktop') === 'true' || sessionStorage.getItem('force_desktop') === 'true';

    if (searchParams.get('desktop') === 'true') {
      sessionStorage.setItem('force_desktop', 'true');
    }

    if (isMobile && location.pathname === '/' && !isDesktopForced) {
      navigate('/pwa', { replace: true });
    }
  }, [location.pathname, navigate, searchParams]);

  const handleSearchChange = (val: string) => {
    const isPwa = location.pathname === '/pwa';
    const targetPath = isPwa ? '/pwa' : '/';
    setSearchParams(prev => {
      if (val) {
        prev.set('q', val);
      } else {
        prev.delete('q');
      }
      return prev;
    }, { replace: true });

    if (location.pathname !== '/' && location.pathname !== '/pwa') {
      navigate(`${targetPath}?q=${encodeURIComponent(val)}`);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  // Determine if we should render the legacy/desktop layout footer
  const isPwaActive = location.pathname.startsWith('/pwa') || 
                      location.pathname.startsWith('/dashboard') || 
                      location.pathname === '/register' || 
                      location.pathname === '/login';

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50 text-slate-900 overflow-x-hidden">
      {!isPwaActive && (
        <header className="sticky top-0 z-50 w-full border-t-4 border-[#007f5f] border-b border-[#007f5f]/20 bg-white shadow-sm">
          <div className="w-full max-w-[1720px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3 font-bold text-lg shrink-0">
              <div className="w-10 h-10 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-white shadow-lg overflow-hidden relative">
                {siteSettings?.siteLogoUrl ? (
                  <img src={siteSettings.siteLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <MapPin className="w-6 h-6 text-red-600" />
                )}
              </div>
              <span className="text-xl font-black tracking-tight text-black">
                {siteSettings?.siteName || (
                  <>کمیته مواکب قائد <span className="text-red-600">شهید</span> امت</>
                )}
              </span>
            </Link>

            {/* Integrated Search Bar inside Header (کادر جستجو در هدر) */}
            <div className="flex-1 max-w-md relative hidden md:block">
              <Search className="absolute right-3.5 top-2.5 w-4 h-4 text-[#007f5f]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="کدام موکب یا عمود را جستجو می‌کنید؟..."
                className="w-full pr-10 pl-4 py-1.5 min-h-[36px] bg-slate-50 border-2 border-[#007f5f]/15 focus:border-[#007f5f] rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 outline-none transition-all focus:ring-1 focus:ring-[#007f5f]"
              />
            </div>
            
            <nav className="flex items-center gap-4 shrink-0">
              <Link to="/pwa" className="text-xs bg-[#007f5f]/10 text-[#007f5f] px-3 py-1.5 rounded-full font-black flex items-center gap-1 hover:bg-[#007f5f]/20 transition-all">
                <Smartphone className="w-4 h-4 text-[#fcc21b]" />
                <span className="hidden sm:inline">نسخه موبایل/PWA</span>
              </Link>

              <Link to="/" className="text-sm font-bold text-[#007f5f] hover:text-[#fcc21b] hidden sm:block transition-colors">
                لیست موکب‌ها
              </Link>
              
              <Link to="/register" className="text-xs bg-[#007f5f] text-white hover:bg-[#00503c] px-3.5 py-2 rounded-xl font-black flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all">
                <UserCheck className="w-4 h-4 text-[#fcc21b]" />
                <span>ثبت‌نام موکب‌داران و خادمین</span>
              </Link>
              
              {user ? (
                <div className="flex items-center gap-3">
                  {profile?.isAdmin && (
                    <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      مدیر کل سیستم
                    </span>
                  )}
                  <Link to="/dashboard">
                    <Button variant="outline" size="sm" className={`gap-2 border-[#007f5f]/30 text-[#007f5f] hover:bg-[#007f5f]/5 ${profile?.isAdmin ? 'bg-amber-500/10 border-amber-200 text-amber-900 hover:bg-amber-500/20' : ''}`}>
                      <LayoutDashboard className={`w-4 h-4 ${profile?.isAdmin ? 'text-amber-600' : 'text-[#007f5f]'}`} />
                      <span>{profile?.isAdmin ? 'پنل مدیریت' : 'داشبورد'}</span>
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => logout()} title="خروج" className="hover:bg-slate-100">
                    <LogOut className="w-5 h-5 text-slate-500" />
                  </Button>
                </div>
              ) : (
                <Link to="/login">
                  <Button className="bg-[#fcc21b] hover:bg-[#e0a000] text-slate-950 font-black shadow-md border-none transition-all">
                    <UserIcon className="w-4 h-4 ml-2" />
                    ورود / ثبت‌نام
                  </Button>
                </Link>
              )}
            </nav>
          </div>
        </header>
      )}

      <main className="flex-1">
        <Suspense fallback={
          <div className="min-h-[50vh] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          </div>
        }>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pwa" element={<PwaPage />} />
            <Route path="/pwa/login" element={<PwaLoginPage />} />
            <Route path="/pwa/register" element={<PwaRegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterMokebPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/mokeb/new" element={<CreateMokebPage />} />
            <Route path="/dashboard/mokeb/:mokebId/complete" element={<CompleteMokebProfilePage />} />
            <Route path="/dashboard/admin/mokeb/:mokebId" element={<AdminMokebViewPage />} />
            <Route path="/dashboard/sliders" element={<AdminSlidersPage />} />
            <Route path="/dashboard/categories" element={<CategoriesPage />} />
            <Route path="/dashboard/routes" element={<WalkRoutesPage />} />
            <Route path="/dashboard/tickets" element={<SupportTicketsPage />} />
            <Route path="/mokeb/:mokebId" element={<MokebDetailsPage />} />
          </Routes>
        </Suspense>
      </main>
      
      {!isPwaActive && (
        <footer className="border-t-4 border-[#007f5f] bg-white py-8 mt-12">
          <div className="w-full max-w-[1720px] mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-white shadow overflow-hidden relative">
                {siteSettings?.siteLogoUrl ? (
                  <img src={siteSettings.siteLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <MapPin className="w-5 h-5 text-red-600" />
                )}
              </div>
              <span className="font-extrabold text-black">
                {siteSettings?.siteName || (
                  <>کمیته مواکب قائد <span className="text-red-600">شهید</span> امت</>
                )}
              </span>
            </div>
            <div className="text-center text-xs text-slate-400 font-medium whitespace-pre-wrap">
              {siteSettings?.footerText || "این سایت به موجب راهنمایی شرکت کنندگان در مراسم قائد شهید امت با هماهنگی موکب یار توسط تیم موتورجستجو فراجو طراحی و پیاده سازی شده است."}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

