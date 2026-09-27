import { Navbar1 } from "@/components/ui/navbar-1";
import { StudentAdvisorChat } from "@/components/ui/student-advisor-chat";
import { getSession } from "@/lib/auth";
import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      navigate("/login", { replace: true });
      return;
    }
    const role = session.user.role;
    const path = location.pathname;
    if (session.user.emailVerified === false) {
      navigate("/verify-email", { replace: true });
      return;
    }
    if (role === "STUDENT" && !session.user.onboardingCompleted) {
      navigate("/onboarding", { replace: true });
      return;
    }
    // Un non-admin avec la permission MANAGE_VISA_DOCUMENTS a accès à cette
    // page dédiée, quel que soit son rôle de base. Un RDV y a en plus
    // toujours accès nativement (limité à ses propres pays côté backend),
    // sans permission supplémentaire à accorder.
    const hasVisaDocsAccess = Boolean(session.user.permissions?.includes("MANAGE_VISA_DOCUMENTS")) || role === "RDV";
    const onVisaDocsPage = path.startsWith("/admin/visa-documents");
    if (role === "ADMIN" && !path.startsWith("/admin") && path !== "/messages" && path !== "/archive" && !path.startsWith("/conseiller/etudiants")) {
      navigate("/admin", { replace: true });
      return;
    }
    if (role === "SALES" && !path.startsWith("/conseiller") && path !== "/messages" && path !== "/archive" && !(hasVisaDocsAccess && onVisaDocsPage)) {
      navigate("/conseiller", { replace: true });
      return;
    }
    if (role === "RDV" && !path.startsWith("/rdv") && path !== "/messages" && path !== "/archive" && !(hasVisaDocsAccess && onVisaDocsPage)) {
      navigate("/rdv", { replace: true });
      return;
    }
    if (role === "STUDENT" && (path.startsWith("/admin") || path.startsWith("/conseiller") || path.startsWith("/rdv"))) {
      navigate("/espace", { replace: true });
    }
  }, [navigate, location.pathname]);

  const session = getSession();
  if (!session?.user) return null;

  return (
    <>
      {/* Decorative background glows — fixed to viewport, behind everything */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <span className="absolute -right-16 -top-24 h-80 w-80 rounded-full bg-violet-300/70 blur-3xl" />
        <span className="absolute -left-20 top-40 h-64 w-64 rounded-full bg-fuchsia-300/50 blur-3xl" />
        <span className="absolute bottom-10 right-[12%] h-40 w-40 rounded-full bg-cyan-200/60 blur-3xl" />
      </div>

      {/* Navbar — fixed to viewport, always on top */}
      <Navbar1 />

      {/* Page content */}
      <div className="min-h-screen pt-24 bg-surface text-dark">
        <Outlet />
      </div>

      {session.user.role === "STUDENT" && <StudentAdvisorChat />}
    </>
  );
}
