import WhatsAppInbox from "@/components/WhatsAppInbox";

export default function WhatsAppPage() {
  return (
    <main className="px-3 pb-5 md:px-6">
      <div
        className="mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_20px_60px_rgba(109,40,217,.12)]"
        style={{ height: "calc(100dvh - 8rem)" }}
      >
        <WhatsAppInbox />
      </div>
    </main>
  );
}
