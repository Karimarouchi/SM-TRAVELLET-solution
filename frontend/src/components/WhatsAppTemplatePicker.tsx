import { confirmDialog } from "@/components/ui/dialog-host";
import { fetchWhatsAppTemplates, sendWhatsAppTemplate, type WhatsAppMessage, type WhatsAppTemplate } from "@/lib/whatsapp";
import { Send, X } from "lucide-react";
import { useEffect, useState } from "react";

// Fenêtre de 24 h fermée : seul un modèle approuvé par Meta peut être envoyé.
// Le conseiller reprend la conversation normalement dès que le client répond.
export default function WhatsAppTemplatePicker({ contactId, onSent, onClose }: { contactId: string; onSent: (message: WhatsAppMessage) => void; onClose: () => void }) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[] | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWhatsAppTemplates()
      .then(setTemplates)
      .catch((err) => {
        setTemplates([]);
        setError(err instanceof Error ? err.message : "Impossible de charger les modèles.");
      });
  }, []);

  const keyOf = (template: WhatsAppTemplate) => `${template.name}:${template.language}`;
  const selected = templates?.find((template) => keyOf(template) === selectedKey) || null;
  const ready = Boolean(selected) && selected!.variables.every((key) => (values[key] || "").trim());

  async function onSend() {
    if (!selected || !ready || sending) return;
    if (!(await confirmDialog(`Envoyer le modèle « ${selected.name} » à ce contact ? Meta facture ce message une fois livré.`, { confirmLabel: "Envoyer" }))) return;
    setSending(true);
    setError("");
    try {
      onSent(await sendWhatsAppTemplate(contactId, { name: selected.name, language: selected.language, variables: values }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-line bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-dark">Envoyer un modèle approuvé</p>
        <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full p-1 text-muted hover:text-dark"><X className="h-4 w-4" /></button>
      </div>
      {templates === null && <p className="mt-2 text-xs text-muted">Chargement des modèles...</p>}
      {templates?.length === 0 && !error && <p className="mt-2 text-xs text-muted">Aucun modèle approuvé utilisable. Vérifiez vos modèles dans WhatsApp Manager.</p>}
      {templates && templates.length > 0 && (
        <select
          value={selectedKey}
          onChange={(event) => {
            setSelectedKey(event.target.value);
            setValues({});
          }}
          className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-dark"
        >
          <option value="">Choisir un modèle</option>
          {templates.map((template) => (
            <option key={keyOf(template)} value={keyOf(template)}>{template.name} · {template.language}</option>
          ))}
        </select>
      )}
      {selected && (
        <>
          <p dir="auto" className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#d9fdd3] px-3 py-2 text-[13px] leading-5 text-[#111b21]">{selected.body}</p>
          {selected.variables.map((key) => (
            <label key={key} className="mt-2 block text-xs font-semibold text-muted">
              Valeur de {`{{${key}}}`}
              <input
                dir="auto"
                value={values[key] || ""}
                onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-dark"
              />
            </label>
          ))}
          <button type="button" disabled={!ready || sending} onClick={() => void onSend()} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
            <Send className="h-3.5 w-3.5" /> {sending ? "Envoi..." : "Envoyer ce modèle"}
          </button>
        </>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
