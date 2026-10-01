import WhatsAppInbox from "@/components/WhatsAppInbox";
import { segmentFromPath } from "@/lib/whatsapp";
import { Navigate, useParams } from "react-router-dom";

// Deux messageries : /whatsapp/inscrits (étudiants déjà inscrits) et
// /whatsapp/prospects (personnes pas encore inscrites).
// Sur téléphone : plein écran bord à bord sous la barre de navigation, comme
// l'application WhatsApp. Sur ordinateur : carte centrée.
export default function WhatsAppPage() {
  const { segment: param } = useParams();
  const segment = segmentFromPath(param);
  if (!segment) return <Navigate to="/whatsapp/prospects" replace />;

  return (
    <main className="md:px-6 md:pb-5">
      <div className="mx-auto h-[calc(100dvh-6rem)] max-w-6xl overflow-hidden bg-white md:h-[calc(100dvh-8rem)] md:rounded-[28px] md:border md:border-line md:shadow-[0_20px_60px_rgba(109,40,217,.12)]">
        <WhatsAppInbox segment={segment} />
      </div>
    </main>
  );
}
