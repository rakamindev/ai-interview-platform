import { useState, useEffect } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtom, useAtomValue } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken, saveUser, type UserProfile } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { ClipboardList, Briefcase, LogOut, Building, Award, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import PageLoader from "@/components/common/PageLoader";
import PageTransition from "@/components/common/PageTransition";
import { AnimatePresence, motion } from "framer-motion";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Role Vacancies", icon: Briefcase },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const [auth, setAuth] = useAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Auto-sync profile from /api/v1/auth/me if token exists to ensure avatar and name are up-to-date
  useEffect(() => {
    if (auth.token) {
      authApi
        .me()
        .then((res) => {
          const u = res.data.user;
          if (u) {
            setAuth((prev) => {
              const current = prev.user;
              const name =
                u.name ||
                current?.name ||
                u.email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              const picture = u.avatar_url || current?.picture;
              const avatar_url = u.avatar_url || current?.avatar_url;

              if (
                current?.id === u.id &&
                current?.email === u.email &&
                current?.name === name &&
                current?.picture === picture &&
                current?.avatar_url === avatar_url &&
                current?.role === u.role
              ) {
                return prev;
              }

              const userProfile: UserProfile = {
                id: u.id,
                email: u.email,
                name,
                picture,
                avatar_url,
                role: u.role,
              };
              saveUser(userProfile);
              return { ...prev, user: userProfile };
            });
          }
        })
        .catch(() => {
          // Token might be unauthenticated or network error
        });
    }
  }, [auth.token, setAuth]);

  const handleLogout = () => {
    setMobileMenuOpen(false);
    clearToken();
    setAuth({ token: null, user: null });
    navigate("/login");
  };

  const user = auth.user;
  const avatarUrl = user?.picture || user?.avatar_url;

  // Reset image error state whenever avatar URL changes
  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const displayName =
    user?.name ||
    (user?.email
      ? user.email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
      : "Assessor");

  // Dynamic Initials:
  // - If name has multiple words: first letters (e.g. "Rpl Tunggal" -> "RT")
  // - If single word or email: 1-2 letters (e.g. "Rpltunggal" -> "R", "admin" -> "AD")
  const displayInitials = user?.name
    ? user.name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email
    ? user.email.split("@")[0].slice(0, 2).toUpperCase()
    : "RA";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 w-full overflow-x-hidden">
      {/* Top animated page loader bar on route changes */}
      <PageLoader />

      {/* Brand accent gradient bar */}
      <div className="h-[3px] bg-gradient-to-r from-[#01959f] via-teal-400 to-[#fbc036] w-full" />

      {/* Top sticky header — Pure opaque white to prevent see-through overlapping when scrolling */}
      <header className="border-b border-slate-200/90 bg-white sticky top-0 z-50 shadow-xs">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo & Desktop Navigation */}
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <Link
              to="/assessments"
              className="flex items-center group shrink-0"
              onClick={() => setMobileMenuOpen(false)}
            >
              <img
                src="/images/rakamin-logo.png"
                alt="Rakamin"
                className="h-5 sm:h-[21px] w-auto object-contain transition-transform group-hover:scale-102 shrink-0"
              />
            </Link>

            <div className="hidden md:block h-4 w-[1px] bg-slate-200 shrink-0" />

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 shrink-0">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
                      isActive
                        ? "bg-[#01959f]/10 text-[#01959f] shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="leading-none">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Desktop Right Side: Tenant Context & Profile */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {tenant.name && (
              <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-teal-50/70 border border-teal-200/60 rounded-full px-3 py-1">
                <Building className="h-3 w-3 text-[#01959f]" />
                <span className="text-muted-foreground font-normal">Org:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[120px]">{tenant.name}</span>
              </div>
            )}

            <div className="h-4 w-[1px] bg-slate-200" />

            <div className="flex items-center gap-2.5">
              {/* User Avatar: Google profile image if present, else fallback to dynamic initials */}
              {avatarUrl && !imageError ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#01959f]/15 text-[#01959f] text-xs font-bold flex items-center justify-center border border-[#01959f]/30 shrink-0 shadow-2xs">
                  {displayInitials}
                </div>
              )}

              {/* User Name & Email */}
              <div className="hidden lg:flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-slate-800 truncate max-w-[140px]" title={displayName}>
                  {displayName}
                </span>
                <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={user?.email}>
                  {user?.email || "assessor"}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-[#fbc036] hover:font-bold rounded-xl transition-all ml-1"
                title="Keluar dari akun"
              >
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>

          {/* Mobile Right Controls: Avatar + Hamburger Menu Toggle */}
          <div className="flex md:hidden items-center gap-2">
            {avatarUrl && !imageError ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#01959f]/15 text-[#01959f] text-xs font-bold flex items-center justify-center border border-[#01959f]/30 shrink-0">
                {displayInitials}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-3 shadow-lg"
            >
              {/* User Profile Summary in Mobile Menu */}
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                {avatarUrl && !imageError ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#01959f]/15 text-[#01959f] text-xs font-bold flex items-center justify-center border border-[#01959f]/30 shrink-0">
                    {displayInitials}
                  </div>
                )}
                <div className="flex flex-col text-left leading-tight min-w-0">
                  <span className="text-xs font-bold text-slate-900 truncate">{displayName}</span>
                  <span className="text-[11px] text-slate-500 truncate">{user?.email || "Assessor"}</span>
                </div>
              </div>

              <nav className="flex flex-col gap-1">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const isActive = location.pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      to={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                        isActive
                          ? "bg-[#01959f]/10 text-[#01959f]"
                          : "text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>

              {tenant.name && (
                <div className="flex items-center gap-2 text-xs text-slate-700 bg-teal-50 border border-teal-200/60 rounded-xl px-3 py-2">
                  <Building className="h-3.5 w-3.5 text-[#01959f] shrink-0" />
                  <span className="text-muted-foreground">Org:</span>
                  <span className="font-semibold text-slate-800">{tenant.name}</span>
                </div>
              )}

              <div className="pt-1">
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full justify-center text-xs font-bold text-slate-700 hover:bg-[#fbc036] hover:text-slate-900 hover:border-[#fbc036] rounded-xl py-2"
                >
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  Sign Out
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Page Content with animated transition */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-3.5 sm:px-6 py-5 sm:py-8 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}
