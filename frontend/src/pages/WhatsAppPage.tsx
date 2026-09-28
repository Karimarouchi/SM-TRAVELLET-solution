import WhatsAppInbox from "@/components/WhatsAppInbox";

// Sur téléphone : plein écran bord à bord sous la barre de navigation,
// comme l'application WhatsApp. Sur ordinateur : carte centrée.
export default function WhatsAppPage() {
  return (
    <main className="md:px-6 md:pb-5">
      <div className="mx-auto h-[calc(100dvh-6rem)] max-w-6xl overflow-hidden bg-white md:h-[calc(100dvh-8rem)] md:rounded-[28px] md:border md:border-line md:shadow-[0_20px_60px_rgba(109,40,217,.12)]">
        <WhatsAppInbox />
      </div>
    </main>
  );
}
