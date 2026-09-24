"use client";

import * as React from "react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Menu, Settings, X } from "lucide-react";
import { clearSession, fetchUnreadCount, getSession, logout } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { VITRINE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

type NavLinkItem = { label: string; href?: string; external?: boolean; children?: { label: string; href: string }[] };

function linksForRole(role: string | undefined, permissions: string[], t: (fr: string, en: string) => string): NavLinkItem[] {
  const messages: NavLinkItem = { label: t("Messages", "Messages"), href: "/messages" };
  const visaDocs: NavLinkItem = { label: t("Documents visa", "Visa documents"), href: "/admin/visa-documents" };
  const hasVisaDocsPermission = permissions.includes("MANAGE_VISA_DOCUMENTS");
  if (role === "ADMIN") {
    return [
      { label: t("Dashboard", "Dashboard"), href: "/admin" },
      { label: t("Sales", "Sales"), href: "/admin/sales" },
      { label: t("Utilisateurs", "Users"), href: "/admin/users" },
      {
        label: t("Vitrine", "Website"),
        children: [
          { label: t("Programmes", "Programs"), href: "/admin/programmes" },
          { label: t("Documents visa", "Visa documents"), href: "/admin/visa-documents" },
          { label: t("Avis & Témoignages", "Reviews & Testimonials"), href: "/admin/avis" }
        ]
      },
      { label: t("Archive", "Archive"), href: "/archive" },
      messages
    ];
  }
  if (role === "SALES") {
    return [
      { label: t("Mes étudiants", "My students"), href: "/conseiller" },
      { label: t("Codes", "Codes"), href: "/conseiller/codes" },
      { label: t("Archive", "Archive"), href: "/archive" },
      ...(hasVisaDocsPermission ? [visaDocs] : []),
      messages
    ];
  }
  if (role === "RDV") {
    // Un RDV gère toujours les documents visa des pays dont il est
    // responsable, sans permission explicite à accorder en plus — le lien
    // est donc toujours visible pour ce rôle (portée réelle filtrée côté
    // backend selon ses pays assignés, ou tous les pays s'il a en plus la
    // permission MANAGE_VISA_DOCUMENTS).
    return [
      { label: t("Mes dossiers visa", "My visa files"), href: "/rdv" },
      { label: t("Archive", "Archive"), href: "/archive" },
      visaDocs,
      messages
    ];
  }
  return [
    { label: t("Espace", "Dashboard"), href: "/espace" },
    { label: t("Profil", "Profile"), href: "/profil" },
    { label: t("Documents", "Documents"), href: "/documents" },
    { label: t("Accélérateur", "Accelerator"), href: "/accelerateur" }
  ];
}

const Navbar1 = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const role = getSession()?.user.role;
  const permissions = getSession()?.user.permissions || [];
  const { lang, setLang, t } = useLanguage();
  const links = linksForRole(role, permissions, t);

  React.useEffect(() => {
    if (role === "STUDENT") return;
    function refresh() {
      fetchUnreadCount()
        .then((data) => setUnread(data.unread || 0))
        .catch(() => undefined);
    }
    refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => window.clearInterval(timer);
  }, [location.pathname, role]);

  const toggleMenu = () => setIsOpen(!isOpen);

  async function handleLogout() {
    await logout();
    clearSession();
    navigate("/login");
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[9999] flex justify-center px-4 pt-4">
      <div className="pointer-events-auto relative flex w-full max-w-5xl items-center justify-between rounded-full border border-white/70 bg-white/85 px-6 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <div className="flex items-center">
          <motion.a
            href={VITRINE_URL}
            className="mr-2 flex items-center"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            whileHover={{ rotate: 4, scale: 1.04 }}
            transition={{ duration: 0.3 }}
          >
            <img src="/images/logo-color.png" alt="SM Travel" className="h-8 w-auto" />
          </motion.a>
        </div>

        <nav className="hidden items-center space-x-8 md:flex">
          {links.map((item) => {
            const active = !item.external && item.href && location.pathname === item.href;
            const isChildActive = item.children?.some(child => location.pathname === child.href);
            const className = `text-sm font-medium transition-colors ${
              active || isChildActive ? "text-brand" : "text-gray-900 hover:text-brand"
            }`;
            
            if (item.children) {
              return (
                <div key={item.label} className="relative group">
                  <button className={`${className} inline-flex items-center gap-1 py-2`}>
                    {item.label}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:rotate-180"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <div className="absolute left-1/2 top-full hidden w-56 -translate-x-1/2 pt-2 group-hover:flex">
                    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-white/95 p-2 shadow-xl backdrop-blur-xl">
                      {item.children.map(child => (
                        <Link
                          key={child.label}
                          to={child.href}
                          className={cn(
                            "rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:bg-brand/10 hover:text-brand",
                            location.pathname === child.href ? "bg-brand/5 text-brand" : "text-gray-700"
                          )}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                whileHover={{ scale: 1.05 }}
              >
                {item.external ? (
                  <a href={item.href!} className={className}>
                    {item.label}
                  </a>
                ) : (
                  <Link to={item.href!} className={`${className} inline-flex items-center gap-2 py-2`}>
                    {item.label}
                    {item.href === "/messages" && unread > 0 && (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
                        {unread}
                      </span>
                    )}
                  </Link>
                )}
              </motion.div>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {role === "ADMIN" && (
            <Link
              to="/admin/settings"
              title={t("Paramètres", "Settings")}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white transition hover:border-brand hover:text-brand",
                location.pathname === "/admin/settings" ? "border-brand text-brand" : "text-gray-900"
              )}
            >
              <Settings className="h-4 w-4" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setLang(lang === "fr" ? "en" : "fr")}
            title={t("Passer en anglais", "Switch to French")}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-mid transition hover:border-brand hover:text-brand"
          >
            <span className={cn(lang === "fr" && "text-brand")}>FR</span>
            <span className="text-line">/</span>
            <span className={cn(lang === "en" && "text-brand")}>EN</span>
          </button>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
          >
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-2 text-sm text-white transition-colors hover:bg-brand-dark"
            >
              {t("Déconnexion", "Log out")}
            </button>
          </motion.div>
        </div>

        <motion.button className="flex items-center md:hidden" onClick={toggleMenu} whileTap={{ scale: 0.9 }}>
          <Menu className="h-6 w-6 text-gray-900" />
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[10000] bg-white px-6 pt-24 md:hidden"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <motion.button
              className="absolute right-6 top-6 p-2"
              onClick={toggleMenu}
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <X className="h-6 w-6 text-gray-900" />
            </motion.button>
            <div className="flex flex-col space-y-6">
              {role === "ADMIN" && (
                <Link to="/admin/settings" className="inline-flex items-center gap-2 text-base font-medium text-gray-900" onClick={toggleMenu}>
                  <Settings className="h-4 w-4" /> {t("Paramètres", "Settings")}
                </Link>
              )}
              {links.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 + 0.1 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  {item.children ? (
                    <div className="flex flex-col space-y-4">
                      <span className="text-base font-bold text-brand uppercase tracking-wider text-sm">{item.label}</span>
                      <div className="flex flex-col pl-4 space-y-4 border-l-2 border-line">
                        {item.children.map(child => (
                          <Link key={child.label} to={child.href} className="text-base font-medium text-gray-700" onClick={toggleMenu}>
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : item.external ? (
                    <a href={item.href!} className="text-base font-medium text-gray-900" onClick={toggleMenu}>
                      {item.label}
                    </a>
                  ) : (
                    <Link to={item.href!} className="inline-flex items-center gap-2 text-base font-medium text-gray-900" onClick={toggleMenu}>
                      {item.label}
                      {item.href === "/messages" && unread > 0 && (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </Link>
                  )}
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                exit={{ opacity: 0, y: 20 }}
              >
                <button
                  type="button"
                  onClick={() => setLang(lang === "fr" ? "en" : "fr")}
                  className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-mid"
                >
                  <span className={cn(lang === "fr" && "text-brand")}>FR</span>
                  <span className="text-line">/</span>
                  <span className={cn(lang === "en" && "text-brand")}>EN</span>
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                exit={{ opacity: 0, y: 20 }}
                className="pt-6"
              >
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-3 text-base text-white transition-colors hover:bg-brand-dark"
                  onClick={() => {
                    toggleMenu();
                    handleLogout();
                  }}
                >
                  {t("Déconnexion", "Log out")}
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export { Navbar1 };
