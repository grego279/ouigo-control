import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  ControlAssessment,
  DetailItemKey,
  DETAIL_DEFINITIONS,
  EXTERIOR_SEQUENCE_EXT1,
  EXTERIOR_SEQUENCE_EXT2,
  OP_NETTOYAGE_OPTIONS,
  PHOTO_FAMILIES,
  PHOTO_LOCALIZATIONS,
  PhotoEntry,
  SAMI_CATEGORIES,
  SAMI_COLORS,
  SAMI_LABELS,
  Sami,
  VALISE_NEC_ITEMS,
  ValiseItem,
  computeAllSamiFromResults,
  computeExterior,
  computeNotesFromAssessment,
  createDefaultAssessment,
  emptyControl,
  formatDateDisplay,
  globalEvaluation,
  samiFromPercent,
  scoreOn20,
  validateControl,
  buildInteriorSequence,
  SegmentEntry,
  SegmentResult,
  PlateformeData,
  ReapproswcData,
  WcData,
  SalleVoyageursData,
  EscalierData,
  FourgonData,
  LocalNecData,
  LocalAsctData,
  NuserieData,
  PoubelleData,
} from "@/lib/ouigo-domain";
import {
  GeneratedAttachment,
  buildMailto,
  compressImageToDataUrl,
  downloadAttachments,
  generateAllAttachments,
  generateEmailDraft,
  shareAttachmentsIfSupported,
} from "@/lib/ouigo-exports";
import { Camera, Check, ChevronDown, ChevronUp, Download, EyeOff, FileSpreadsheet, FileText, Home as HomeIcon, Mail, Plus, RefreshCw, TrainFront, Trash2, X } from "lucide-react";
import { saveAs } from "file-saver";

type Step = "accueil" | "exterieur" | "interieur" | "sami" | "photos" | "export";

const stepButtons: Array<{ id: Step; label: string }> = [
  { id: "accueil", label: "Accueil" },
  { id: "exterieur", label: "Aspect extérieur" },
  { id: "interieur", label: "Aspect intérieur" },
  { id: "sami", label: "SAMI intérieur" },
  { id: "photos", label: "Photos" },
  { id: "export", label: "Export" },
];

const samiOptions: Sami[] = ["S", "A", "M", "I"];

// ── Composant DictateBtn ─────────────────────────────────────────────────────────────────────────
// v9 — Fix iOS Safari : getUserMedia appelé directement dans le handler onClick.
// Sur Safari iOS, getUserMedia() doit être dans le gestionnaire de clic direct,
// pas dans une fonction async intermédiaire (restriction de sécurité WebKit).

function DictatePreviewModal({
  open, text, processing, onConfirm, onCancel, onRetry,
}: {
  open: boolean; text: string; processing: boolean;
  onConfirm: () => void; onCancel: () => void; onRetry: () => void;
}) {
  if (!open) return null;
  return (
    <div className="dictate-modal-overlay" onClick={processing ? undefined : onCancel}>
      <div className="dictate-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="dictate-modal-title">🎙 Aperçu de la dictée</h3>
        {processing ? (
          <div className="dictate-modal-processing">
            <div className="dictate-spinner" />
            <span>Transcription en cours…</span>
          </div>
        ) : (
          <div className="dictate-modal-text">{text || <em>Aucun texte dicté</em>}</div>
        )}
        <div className="dictate-modal-actions">
          <button type="button" className="dictate-modal-btn cancel"  onClick={onCancel}  disabled={processing}>✕ Annuler</button>
          <button type="button" className="dictate-modal-btn retry"   onClick={onRetry}   disabled={processing}>🔄 Recommencer</button>
          <button type="button" className="dictate-modal-btn confirm" onClick={onConfirm} disabled={processing}>✓ Valider</button>
        </div>
      </div>
    </div>
  );
}

// Variables globales de module — persistent entre les re-rendus React
// Utilisées pour stocker le MediaRecorder et le stream actifs sur iOS Safari
let _activeMediaRecorder: MediaRecorder | null = null;
let _activeStream: MediaStream | null = null;
let _isIOSRecording = false;

/**
 * DictateBtn v10 — Compatible Android (Chrome) et iPhone (Safari).
 *
 * Mode Chrome/Android : Web Speech API, interimResults=false.
 * Mode iOS/Safari    : getUserMedia appelé DIRECTEMENT dans le handler onClick
 *                      (requis par WebKit — pas d'appel indirect via async).
 *                      MediaRecorder stocké dans une variable globale de module
 *                      pour persister entre les re-rendus React.
 */
function DictateBtn({
  currentValue,
  onValue,
  size,
}: {
  currentValue: string;
  onValue: (v: string) => void;
  size?: string;
}) {
  const [listening, setListening] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [processing, setProcessing] = useState(false);

  const listeningRef   = useRef(false);
  const recRef         = useRef<any>(null);
  const mediaRecRef    = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef    = useRef<string>("");
  const segmentsRef    = useRef<string[]>([]);
  const baseTextRef    = useRef<string>("");
  // Ref vers la fonction d'arret iOS — appelée directement au second clic
  const stopIOSRef     = useRef<(() => void) | null>(null);

  const transcribe = trpc.dictate.transcribe.useMutation();
  const punctuate  = trpc.dictate.punctuate.useMutation();

  const processRawText = async (raw: string) => {
    if (!raw.trim()) return;
    setProcessing(true);
    setShowPreview(true);
    try {
      const { result } = await punctuate.mutateAsync({ text: raw });
      setPreviewText(result || raw);
    } catch {
      setPreviewText(raw);
    } finally {
      setProcessing(false);
    }
  };

  const processAudioBlob = async (blob: Blob, mimeType: string) => {
    if (blob.size === 0) {
      toast.error("Aucun audio enregistré — vérifiez les permissions microphone.");
      return;
    }
    if (blob.size > 16 * 1024 * 1024) {
      toast.error("Enregistrement trop long (max 16 Mo). Dictez un texte plus court.");
      return;
    }
    setProcessing(true);
    setShowPreview(true);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode(...Array.from(uint8.subarray(i, i + chunkSize)));
      }
      const audioBase64 = btoa(binary);
      const actualMime = mimeType.split(";")[0];
      const { result } = await transcribe.mutateAsync({ audioBase64, mimeType: actualMime });
      setPreviewText(result || "");
    } catch (err: any) {
      const errMsg = err?.message || err?.data?.message || "Erreur de transcription. Veuillez réessayer.";
      toast.error(errMsg);
      setShowPreview(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleClick = async () => {
    // ── Arrêt iOS : variable globale de module (persiste entre les re-rendus) ──
    if (_isIOSRecording && _activeMediaRecorder) {
      if (_activeMediaRecorder.state === "recording" || _activeMediaRecorder.state === "paused") {
        _activeMediaRecorder.stop();
      } else {
        // Déjà arrêté — nettoyer manuellement
        if (_activeStream) { _activeStream.getTracks().forEach((t) => t.stop()); _activeStream = null; }
        _activeMediaRecorder = null;
        _isIOSRecording = false;
        listeningRef.current = false;
        setListening(false);
      }
      return;
    }
    // ── Arrêt Web Speech API ──
    if (listeningRef.current && recRef.current) {
      recRef.current.stop();
      recRef.current = null;
      return;
    }
    // ── Démarrage ──
    baseTextRef.current = currentValue ? currentValue.trimEnd() + " " : "";
    const w = window as any;
    // Détection iOS : Safari iOS expose webkitSpeechRecognition depuis iOS 14.5
    // mais il ne fonctionne pas correctement — on force le Mode 2 (MediaRecorder) sur iOS.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const SR = !isIOS && (w.SpeechRecognition || w.webkitSpeechRecognition);
    // Mode 1 : Web Speech API (Chrome, Edge, Android — jamais sur iOS))
    if (SR) {
      segmentsRef.current = [];
      const rec: any = new SR();
      rec.lang            = "fr-FR";
      rec.interimResults  = false;
      rec.maxAlternatives = 1;
      rec.continuous      = true;
      recRef.current = rec;
      rec.onstart  = () => { listeningRef.current = true; setListening(true); };
      rec.onresult = (event: any) => {
        const t = (event.results[event.resultIndex]?.[0]?.transcript ?? "").trim();
        if (t) segmentsRef.current.push(t);
      };
      rec.onerror = (e: any) => {
        if (e.error === "aborted" || e.error === "no-speech") return;
        toast.error("Erreur microphone — vérifiez les permissions.");
        listeningRef.current = false;
        setListening(false);
      };
      rec.onend = async () => {
        listeningRef.current = false;
        setListening(false);
        await processRawText(segmentsRef.current.join(" ").trim());
      };
      rec.start();
      return;
    }

    // Mode 2 : MediaRecorder (iOS Safari)
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Dictée non disponible sur ce navigateur. Utilisez Chrome ou Safari (iOS 14.3+).");
      return;
    }

    try {
      // getUserMedia appelé DIRECTEMENT dans le handler onClick (exigence WebKit)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mime = MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      if (!mime) {
        stream.getTracks().forEach((t) => t.stop());
        toast.error("Format audio non supporté sur ce navigateur.");
        return;
      }

      mimeTypeRef.current = mime;
      const mr = new MediaRecorder(stream, { mimeType: mime });

      // Stocker dans les variables globales de module (persistent entre re-rendus React)
      _activeMediaRecorder = mr;
      _activeStream = stream;
      _isIOSRecording = true;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        // Nettoyer les variables globales
        if (_activeStream) { _activeStream.getTracks().forEach((t) => t.stop()); _activeStream = null; }
        _activeMediaRecorder = null;
        _isIOSRecording = false;
        listeningRef.current = false;
        setListening(false);
        const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
        await processAudioBlob(blob, mimeTypeRef.current);
      };

      mr.start(1000); // chunk toutes les 1000ms
      listeningRef.current = true;
      setListening(true);

    } catch (err: any) {
      const msg = err?.name === "NotAllowedError"
        ? "Accès au microphone refusé. Allez dans Réglages > Safari > Microphone et autorisez l'accès."
        : err?.name === "NotFoundError"
        ? "Aucun microphone détecté sur cet appareil."
        : "Impossible d'accéder au microphone : " + (err?.message || "erreur inconnue");
      toast.error(msg);
    }
  };

  const handleConfirm = () => {
    const combined = (baseTextRef.current + previewText).trim();
    onValue(combined);
    setShowPreview(false);
    setPreviewText("");
    segmentsRef.current = [];
  };

  const handleCancel = () => {
    setShowPreview(false);
    setPreviewText("");
    segmentsRef.current = [];
  };

  const handleRetry = () => {
    setShowPreview(false);
    setPreviewText("");
    segmentsRef.current = [];
  };

  const label = listening
    ? "🎙 Écoute… (appuyer pour arrêter)"
    : "🎤 Dicter";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`dictate-btn${listening ? " listening" : ""}${size === "sm" ? " sm" : ""}`}
        title={listening ? "Appuyer pour arrêter" : "Appuyer pour dicter"}
      >
        {label}
      </button>
      <DictatePreviewModal
        open={showPreview}
        text={previewText}
        processing={processing}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onRetry={handleRetry}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field-card">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SamiBadge({ value }: { value: string }) {
  const color = SAMI_COLORS[value as Sami] ?? "FFE5E7EB";
  return (
    <span className="sami-badge" style={{ backgroundColor: `#${color.slice(2)}`, color: value === "I" ? "white" : "black" }}>
      {value}
    </span>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="section-title">
      <div className="section-icon">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Formulaire contextuel par type de segment ────────────────────────────────

type SegmentFormProps = {
  segment: SegmentEntry;
  result: SegmentResult | undefined;
  onSave: (result: SegmentResult) => void;
  onClose: () => void;
  trainConfig?: import("../lib/ouigo-domain").TrainConfig;
};

/**
 * Retourne les données préremplies avec les valeurs nominales pour chaque type de segment.
 * Les valeurs nominales représentent la situation idéale (tout propre, tout fait).
 */
function emptyDataForType(type: SegmentEntry["type"]): SegmentResult["data"] {
  switch (type) {
    case "plateformeB":
    case "plateformeH":
      // Nominal : Aspiration "fait" / Présence de déchet "Non"
      return { aspiration: "fait", presenceDechet: "Non" } as PlateformeData;
    case "reapproswc":
      // Nominal : 100%
      return { niveau: "100%" } as ReapproswcData;
    case "wc":
      // Nominal : tout conforme
      return { vidanges: "Oui", odeurs: "Non", tags: "Non", poubelleVidee: "Oui", papierWc: "Oui", sol: "Propre", cuvette: "Propre", lavabo: "Propre", savonnier: "Plein" } as WcData;
    case "salleVoyageurs":
      // Nominal : tout propre, pas de déchets
      return { moquette: "Aspirée", vitre: "Propre", presenceDeChets: "Non", plafond: "Propre", sieges: "Propre" } as SalleVoyageursData;
    case "espaceConvivialite":
      // Nominal TANGO : lino propre, vitre propre, présence de déchets Non (nominal), plafond propre, pas de sièges
      return { moquette: "Propre", vitre: "Propre", presenceDeChets: "Non", plafond: "Propre", sieges: null } as SalleVoyageursData;
    case "escalier":
      // Nominal : Propre
      return { etat: "Propre" } as EscalierData;
    case "fourgon":
      // Nominal : Chariot sanglé, pas de déchets
      return { chariot: "Sanglée", dechets: "Non" } as FourgonData;
    case "localNec":
      // Nominal : Propre
      return { etat: "Propre" } as LocalNecData;
    case "localAsct":
      // Nominal : Conforme, machine à café présente
      return { proprete: "Conforme", machineCafe: "Présente", comment: "" } as LocalAsctData;
    case "nurserie":
      // Nominal : pas de tags, poubelle vidée, lavabo propre, savonnier plein
      return { tags: "Non", poubelleVidee: "Oui", lavabo: "Propre", savonnier: "Plein" } as NuserieData;
    case "poubelle":
      // Nominal : sac présent, poubelle vidée
      return { sacPresent: "Oui", videe: "Oui" } as PoubelleData;
    case "r4":
    default:
      return {};
  }
}

function ToggleBtn({ value, option, onSelect }: { value: string | null; option: string; onSelect: (v: string) => void }) {
  return (
    <button
      type="button"
      className={value === option ? "pill selected" : "pill"}
      onClick={() => onSelect(option)}
    >
      {option}
    </button>
  );
}

function SegmentForm({ segment, result, onSave, onClose, trainConfig }: SegmentFormProps) {
  const [data, setData] = useState<SegmentResult["data"]>(() => result?.data ?? emptyDataForType(segment.type));

  function set<T extends object>(patch: Partial<T>) {
    setData((prev) => ({ ...prev, ...patch }));
  }

  function save() {
    onSave({ segmentId: segment.id, segmentLabel: segment.label, segmentType: segment.type, data });
    onClose();
  }

  const type = segment.type;

  return (
    <div className="segment-modal-overlay" onClick={onClose}>
      <div className="segment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="segment-modal-header">
          <h3>{segment.label}</h3>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="segment-modal-body">
          {(type === "plateformeB" || type === "plateformeH") && (() => {
            const d = data as PlateformeData;
            return (
              <>
                <div className="seg-field"><span>Aspiration</span><div className="pill-row"><ToggleBtn value={d.aspiration} option="fait" onSelect={(v) => set<PlateformeData>({ aspiration: v as PlateformeData["aspiration"] })} /><ToggleBtn value={d.aspiration} option="non fait" onSelect={(v) => set<PlateformeData>({ aspiration: v as PlateformeData["aspiration"] })} /></div></div>
                <div className="seg-field"><span>Présence de déchet</span><div className="pill-row"><ToggleBtn value={d.presenceDechet} option="Oui" onSelect={(v) => set<PlateformeData>({ presenceDechet: v as PlateformeData["presenceDechet"] })} /><ToggleBtn value={d.presenceDechet} option="Non" onSelect={(v) => set<PlateformeData>({ presenceDechet: v as PlateformeData["presenceDechet"] })} /></div></div>
              </>
            );
          })()}
          {type === "reapproswc" && (() => {
            const d = data as ReapproswcData;
            return (
              <div className="seg-field"><span>Niveau réappros</span><div className="pill-row">{(["25%", "50%", "75%", "100%"] as const).map((opt) => <ToggleBtn key={opt} value={d.niveau} option={opt} onSelect={(v) => set<ReapproswcData>({ niveau: v as ReapproswcData["niveau"] })} />)}</div></div>
            );
          })()}
          {type === "wc" && (() => {
            const d = data as WcData;
            const YN = (label: string, key: keyof WcData) => (
              <div className="seg-field"><span>{label}</span><div className="pill-row"><ToggleBtn value={d[key] as string | null} option="Oui" onSelect={(v) => set<WcData>({ [key]: v } as Partial<WcData>)} /><ToggleBtn value={d[key] as string | null} option="Non" onSelect={(v) => set<WcData>({ [key]: v } as Partial<WcData>)} /></div></div>
            );
            const PC = (label: string, key: keyof WcData) => (
              <div className="seg-field"><span>{label}</span><div className="pill-row"><ToggleBtn value={d[key] as string | null} option="Propre" onSelect={(v) => set<WcData>({ [key]: v } as Partial<WcData>)} /><ToggleBtn value={d[key] as string | null} option="Non-conforme" onSelect={(v) => set<WcData>({ [key]: v } as Partial<WcData>)} /></div></div>
            );
            return (
              <>
                {YN("Vidangés", "vidanges")}
                {YN("Odeurs", "odeurs")}
                {YN("Présence de Tags", "tags")}
                {YN("Poubelle vidée", "poubelleVidee")}
                {YN("Présence Papier WC", "papierWc")}
                {PC("Sol", "sol")}
                {PC("Cuvette", "cuvette")}
                {PC("Lavabo", "lavabo")}
                <div className="seg-field"><span>Savonnier</span><div className="pill-row">{(["Plein", "Vide", "Manquant"] as const).map((opt) => <ToggleBtn key={opt} value={d.savonnier} option={opt} onSelect={(v) => set<WcData>({ savonnier: v as WcData["savonnier"] })} />)}</div></div>
              </>
            );
          })()}
          {(type === "salleVoyageurs" || type === "espaceConvivialite") && (() => {
            const d = data as SalleVoyageursData;
            const isTangoConviv = type === "espaceConvivialite" && trainConfig === "TANGO";
            const PC = (label: string, key: keyof SalleVoyageursData) => (
              <div className="seg-field"><span>{label}</span><div className="pill-row"><ToggleBtn value={d[key] as string | null} option="Propre" onSelect={(v) => set<SalleVoyageursData>({ [key]: v } as Partial<SalleVoyageursData>)} /><ToggleBtn value={d[key] as string | null} option="Non-conforme" onSelect={(v) => set<SalleVoyageursData>({ [key]: v } as Partial<SalleVoyageursData>)} /></div></div>
            );
            return (
              <>
                {isTangoConviv ? (
                  <div className="seg-field"><span>Lino</span><div className="pill-row"><ToggleBtn value={d.moquette} option="Propre" onSelect={(v) => set<SalleVoyageursData>({ moquette: v as SalleVoyageursData["moquette"] })} /><ToggleBtn value={d.moquette} option="Non-conforme" onSelect={(v) => set<SalleVoyageursData>({ moquette: v as SalleVoyageursData["moquette"] })} /></div></div>
                ) : (
                  <div className="seg-field"><span>Moquette</span><div className="pill-row"><ToggleBtn value={d.moquette} option="Aspirée" onSelect={(v) => set<SalleVoyageursData>({ moquette: v as SalleVoyageursData["moquette"] })} /><ToggleBtn value={d.moquette} option="Non-aspirée" onSelect={(v) => set<SalleVoyageursData>({ moquette: v as SalleVoyageursData["moquette"] })} /></div></div>
                )}
                {PC("Vitre", "vitre")}
                <div className="seg-field"><span>Présence de déchets</span><div className="pill-row"><ToggleBtn value={d.presenceDeChets} option="Oui" onSelect={(v) => set<SalleVoyageursData>({ presenceDeChets: v as SalleVoyageursData["presenceDeChets"] })} /><ToggleBtn value={d.presenceDeChets} option="Non" onSelect={(v) => set<SalleVoyageursData>({ presenceDeChets: v as SalleVoyageursData["presenceDeChets"] })} /></div></div>
                {PC("Plafond", "plafond")}
                {!isTangoConviv && PC("Sièges", "sieges")}
              </>
            );
          })()}
          {type === "escalier" && (() => {
            const d = data as EscalierData;
            return (
              <div className="seg-field"><span>État escalier</span><div className="pill-row"><ToggleBtn value={d.etat} option="Propre" onSelect={(v) => set<EscalierData>({ etat: v as EscalierData["etat"] })} /><ToggleBtn value={d.etat} option="Non-conforme" onSelect={(v) => set<EscalierData>({ etat: v as EscalierData["etat"] })} /></div></div>
            );
          })()}
          {type === "fourgon" && (() => {
            const d = data as FourgonData;
            return (
              <>
                <div className="seg-field"><span>Chariot à poubelle</span><div className="pill-row"><ToggleBtn value={d.chariot} option="Sanglée" onSelect={(v) => set<FourgonData>({ chariot: v as FourgonData["chariot"] })} /><ToggleBtn value={d.chariot} option="Non-sanglée" onSelect={(v) => set<FourgonData>({ chariot: v as FourgonData["chariot"] })} /></div></div>
                <div className="seg-field"><span>Déchets présents</span><div className="pill-row"><ToggleBtn value={d.dechets} option="Oui" onSelect={(v) => set<FourgonData>({ dechets: v as FourgonData["dechets"] })} /><ToggleBtn value={d.dechets} option="Non" onSelect={(v) => set<FourgonData>({ dechets: v as FourgonData["dechets"] })} /></div></div>
              </>
            );
          })()}
          {type === "localNec" && (() => {
            const d = data as LocalNecData;
            return (
              <div className="seg-field"><span>État Local NEC</span><div className="pill-row"><ToggleBtn value={d.etat} option="Propre" onSelect={(v) => set<LocalNecData>({ etat: v as LocalNecData["etat"] })} /><ToggleBtn value={d.etat} option="Non-conforme" onSelect={(v) => set<LocalNecData>({ etat: v as LocalNecData["etat"] })} /></div></div>
            );
          })()}
          {type === "localAsct" && (() => {
            const d = data as LocalAsctData;
            return (
              <>
                <div className="seg-field"><span>Propreté générale</span><div className="pill-row"><ToggleBtn value={d.proprete} option="Conforme" onSelect={(v) => set<LocalAsctData>({ proprete: v as LocalAsctData["proprete"] })} /><ToggleBtn value={d.proprete} option="Non-conforme" onSelect={(v) => set<LocalAsctData>({ proprete: v as LocalAsctData["proprete"] })} /></div></div>
                <div className="seg-field"><span>Machine à café</span><div className="pill-row"><ToggleBtn value={d.machineCafe} option="Présente" onSelect={(v) => set<LocalAsctData>({ machineCafe: v as LocalAsctData["machineCafe"] })} /><ToggleBtn value={d.machineCafe} option="Absente" onSelect={(v) => set<LocalAsctData>({ machineCafe: v as LocalAsctData["machineCafe"] })} /></div></div>
                <div className="seg-field"><span>Commentaire</span><textarea value={d.comment} onChange={(e) => set<LocalAsctData>({ comment: e.target.value })} placeholder="Commentaire local ASCT…" /></div>
              </>
            );
          })()}
          {type === "nurserie" && (() => {
            const d = data as NuserieData;
            const YN = (label: string, key: keyof NuserieData) => (
              <div className="seg-field"><span>{label}</span><div className="pill-row"><ToggleBtn value={d[key] as string | null} option="Oui" onSelect={(v) => set<NuserieData>({ [key]: v } as Partial<NuserieData>)} /><ToggleBtn value={d[key] as string | null} option="Non" onSelect={(v) => set<NuserieData>({ [key]: v } as Partial<NuserieData>)} /></div></div>
            );
            return (
              <>
                {YN("Présence de Tags", "tags")}
                {YN("Poubelle vidée", "poubelleVidee")}
                <div className="seg-field"><span>Lavabo</span><div className="pill-row"><ToggleBtn value={d.lavabo} option="Propre" onSelect={(v) => set<NuserieData>({ lavabo: v as NuserieData["lavabo"] })} /><ToggleBtn value={d.lavabo} option="Non-conforme" onSelect={(v) => set<NuserieData>({ lavabo: v as NuserieData["lavabo"] })} /></div></div>
                <div className="seg-field"><span>Savonnier</span><div className="pill-row">{(["Plein", "Vide", "Manquant"] as const).map((opt) => <ToggleBtn key={opt} value={d.savonnier} option={opt} onSelect={(v) => set<NuserieData>({ savonnier: v as NuserieData["savonnier"] })} />)}</div></div>
              </>
            );
          })()}
          {type === "poubelle" && (() => {
            const d = data as PoubelleData;
            return (
              <>
                <div className="seg-field"><span>Présence de sac poubelle</span><div className="pill-row"><ToggleBtn value={d.sacPresent} option="Oui" onSelect={(v) => set<PoubelleData>({ sacPresent: v as PoubelleData["sacPresent"] })} /><ToggleBtn value={d.sacPresent} option="Non" onSelect={(v) => set<PoubelleData>({ sacPresent: v as PoubelleData["sacPresent"] })} /></div></div>
                <div className="seg-field"><span>Poubelle vidée</span><div className="pill-row"><ToggleBtn value={d.videe} option="Oui" onSelect={(v) => set<PoubelleData>({ videe: v as PoubelleData["videe"] })} /><ToggleBtn value={d.videe} option="Non" onSelect={(v) => set<PoubelleData>({ videe: v as PoubelleData["videe"] })} /></div></div>
              </>
            );
          })()}
          {(type === "r4") && (
            <p className="seg-info">Segment R4 — pas de points de contrôle spécifiques. Appuyez sur Enregistrer pour marquer comme visité.</p>
          )}
        </div>
        <div className="segment-modal-footer">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function Home() {
  const [step, setStep] = useState<Step>("accueil");
  const [control, setControl] = useState(() => emptyControl());
  const [assessment, setAssessment] = useState<ControlAssessment>(() => createDefaultAssessment());
  const [valise, setValise] = useState<ValiseItem[]>(() => VALISE_NEC_ITEMS.map((label) => ({ label, checked: true })));
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [photoDraft, setPhotoDraft] = useState({ family: "Plateforme", localization: "Plateforme R1B", comment: "" });
  const [recipient, setRecipient] = useState("");
  const [attachments, setAttachments] = useState<GeneratedAttachment[]>([]);
  const [generating, setGenerating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [openSegment, setOpenSegment] = useState<SegmentEntry | null>(null);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
  const [skippedSegments, setSkippedSegments] = useState<Set<string>>(new Set());

  // Séquence intérieure selon extrémité et config
  const interiorSequence = useMemo(
    () => buildInteriorSequence(control.startExtremity, control.trainConfig),
    [control.startExtremity, control.trainConfig],
  );

  // Numéros de rame non observés (dédupliqués, ex. ["R3", "R8"]) pour les exports
  const skippedLabels = useMemo(() => {
    const rameSet = new Set<string>();
    interiorSequence
      .filter((seg) => skippedSegments.has(seg.id))
      .forEach((seg) => {
        const match = seg.label.match(/R\d+/);
        if (match) rameSet.add(match[0]);
        else rameSet.add(seg.label); // Local NEC, Local ASCT, etc.
      });
    return Array.from(rameSet).sort();
  }, [interiorSequence, skippedSegments]);
  // Séquence extérieure selon extrémité
  const exteriorSequence = useMemo(
    () => (control.startExtremity === "Extrémité 1" ? EXTERIOR_SEQUENCE_EXT1 : EXTERIOR_SEQUENCE_EXT2),
    [control.startExtremity],
  );

  // Résultats des segments intérieurs
  const segmentResults = assessment.segmentResults;

  // Recalcul SAMI depuis les points terrain (segments Non observés exclus)
  const computedSami = useMemo(
    () => computeAllSamiFromResults(
      segmentResults.filter((r) => !skippedSegments.has(r.segmentId)),
      control.controlType,
    ),
    [segmentResults, skippedSegments, control.controlType],
  );

  // Mise à jour automatique des propositions SAMI dans l'assessment
  const assessmentWithComputed = useMemo<ControlAssessment>(() => {
    const details = { ...assessment.details };
    // Moquette Plateforme
    if (computedSami.moquettePlateforme) details.moquettePlateforme = { ...details.moquettePlateforme, suggested: computedSami.moquettePlateforme.sami, percent: computedSami.moquettePlateforme.percent };
    else details.moquettePlateforme = { ...details.moquettePlateforme, suggested: undefined, percent: undefined };
    // Moquette Salle
    if (computedSami.moquetteSalle) details.moquetteSalle = { ...details.moquetteSalle, suggested: computedSami.moquetteSalle.sami, percent: computedSami.moquetteSalle.percent };
    else details.moquetteSalle = { ...details.moquetteSalle, suggested: undefined, percent: undefined };
    // Poubelles
    if (computedSami.poubelles) details.poubelles = { ...details.poubelles, suggested: computedSami.poubelles.sami, percent: computedSami.poubelles.percent };
    else details.poubelles = { ...details.poubelles, suggested: undefined, percent: undefined };
    // Graffitis
    if (computedSami.graffitis) details.graffitis = { ...details.graffitis, suggested: computedSami.graffitis.sami, percent: computedSami.graffitis.percent };
    else details.graffitis = { ...details.graffitis, suggested: undefined, percent: undefined };
    // Escalier
    if (computedSami.escalier) details.escalier = { ...details.escalier, suggested: computedSami.escalier.sami, percent: computedSami.escalier.percent };
    else details.escalier = { ...details.escalier, suggested: undefined, percent: undefined };
    // WC
    if (computedSami.wc) details.wc = { ...details.wc, suggested: computedSami.wc.sami, percent: computedSami.wc.percent, reapprosMoyenPercent: computedSami.wc.reapprosMoyen };
    else details.wc = { ...details.wc, suggested: undefined, percent: undefined, reapprosMoyenPercent: undefined };
    // Local ASCT
    if (computedSami.localAsct) details.localAsct = { ...details.localAsct, suggested: computedSami.localAsct.sami, percent: computedSami.localAsct.percent };
    else details.localAsct = { ...details.localAsct, suggested: undefined, percent: undefined };
    // Fourgon
    if (computedSami.fourgon) details.fourgon = { ...details.fourgon, suggested: computedSami.fourgon.sami, percent: computedSami.fourgon.percent };
    else details.fourgon = { ...details.fourgon, suggested: undefined, percent: undefined };
    return { ...assessment, details };
  }, [assessment, computedSami]);

  const notes = useMemo(() => computeNotesFromAssessment(assessmentWithComputed), [assessmentWithComputed]);
  const noteOn20 = useMemo(() => scoreOn20(notes), [notes]);
  const exteriorCalc = useMemo(() => computeExterior(assessment.exterior.items), [assessment.exterior.items]);

  // Initialiser les items extérieurs selon la séquence courante
  useMemo(() => {
    setAssessment((prev) => {
      const existing = prev.exterior.items;
      const newItems: Record<string, boolean> = {};
      for (const item of exteriorSequence) {
        newItems[item] = existing[item] ?? true;
      }
      return { ...prev, exterior: { ...prev.exterior, items: newItems } };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control.startExtremity]);

  function updateAssessmentDetail(code: DetailItemKey, patch: Partial<ControlAssessment["details"][DetailItemKey]>) {
    setAssessment((previous) => ({
      ...previous,
      details: {
        ...previous.details,
        [code]: { ...previous.details[code], ...patch },
      },
    }));
  }

  function toggleExteriorItem(item: string) {
    setAssessment((previous) => {
      const items = { ...previous.exterior.items, [item]: !previous.exterior.items[item] };
      const computed = computeExterior(items);
      return {
        ...previous,
        exterior: { ...previous.exterior, items, suggested: computed.sami, manual: computed.sami, percent: computed.percent },
      };
    });
  }

  function saveSegmentResult(result: SegmentResult) {
    setAssessment((previous) => {
      const existing = previous.segmentResults.filter((r) => r.segmentId !== result.segmentId);
      return { ...previous, segmentResults: [...existing, result] };
    });
    toast.success(`${result.segmentLabel} enregistré.`);
  }

  function removeSegmentResult(segmentId: string) {
    setAssessment((previous) => ({
      ...previous,
      segmentResults: previous.segmentResults.filter((r) => r.segmentId !== segmentId),
    }));
  }

  function toggleExpanded(id: string) {
    setExpandedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSkipped(id: string) {
    setSkippedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Supprimer le résultat existant si le segment est marqué Non observé
        removeSegmentResult(id);
      }
      return next;
    });
  }

  function validateAccueil() {
    const errors = validateControl(control);
    if (errors.length) {
      toast.error(errors[0]);
      return false;
    }
    setValidated(true);
    toast.success("Données d'accueil validées. Le contrôle reste modifiable avant export.");
    return true;
  }
  function handleNewControl() {
    if (!window.confirm("Démarrer un nouveau contrôle ? Toutes les données saisies seront effacées.")) return;
    setControl(emptyControl());
    setAssessment(createDefaultAssessment());
    setValise(VALISE_NEC_ITEMS.map((label) => ({ label, checked: true })));
    setPhotos([]);
    setPhotoDraft({ family: "Plateforme", localization: "Plateforme R1B", comment: "" });
    setRecipient("");
    setAttachments([]);
    setValidated(false);
    setOpenSegment(null);
    setExpandedSegments(new Set());
    setSkippedSegments(new Set());
    setStep("accueil");
    toast.success("Nouveau contrôle démarré.");
  }

  async function addPhoto(file: File | null) {
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 250);
      setPhotos((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          localization: photoDraft.localization,
          comment: photoDraft.comment,
          photoDataUrl: compressed.dataUrl,
          photoName: file.name,
          photoSizeKb: compressed.sizeKb,
        },
      ]);
      setPhotoDraft((draft) => ({ ...draft, comment: "" }));
      toast.success(`Photo compressée à ${compressed.sizeKb} Ko et ajoutée.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Compression photo impossible.");
    }
  }

  const effectiveAssessment = assessmentWithComputed;

  async function generateFiles() {
    const errors = validateControl(control);
    if (errors.length) {
      toast.error(errors[0]);
      setStep("accueil");
      return;
    }
    setGenerating(true);
    try {
      const generated = await generateAllAttachments(control, notes, [], valise, effectiveAssessment, photos, skippedLabels);
      setAttachments(generated);
      toast.success("Fichiers Word, Excel suivi et Excel photos générés.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur pendant la génération des fichiers.");
    } finally {
      setGenerating(false);
    }
  }

  async function createEmailDraft() {
    if (!recipient.trim()) {
      toast.error("Saisissez l'adresse e-mail du destinataire.");
      return;
    }
    const base = attachments.length ? attachments : await generateAllAttachments(control, notes, [], valise, effectiveAssessment, photos, skippedLabels);
    if (!attachments.length) setAttachments(base);
    const draft = await generateEmailDraft(control, recipient, base);
    saveAs(draft.file, draft.name);
    toast.success("Brouillon e-mail .eml généré avec les pièces jointes.");
  }

  const getSegmentResult = useCallback(
    (id: string) => segmentResults.find((r) => r.segmentId === id),
    [segmentResults],
  );

  function segmentSummary(seg: SegmentEntry): string {
    const r = getSegmentResult(seg.id);
    if (!r) return "";
    const d = r.data as Record<string, string | null>;
    const filled = Object.values(d).filter((v) => v !== null && v !== "").length;
    return filled > 0 ? `${filled} champ(s) renseigné(s)` : "Visité";
  }

  return (
    <main className="app-shell">
      <header className="hero-panel">
        <div className="hero-logo">
          <img src="/manus-storage/OUIGOControl_v2_b976d64b.png" alt="OUIGO Control" />
        </div>
        <div>
          <p className="eyebrow">Application terrain SNCF</p>
          <h1>OUIGO Control</h1>
          <p>Contrôle propreté mobile-first, génération Word, ligne Excel, Excel photos et brouillon e-mail prêt à envoyer.</p>
        </div>
      </header>

      <nav className="six-nav" aria-label="Navigation principale OUIGO Control">
        {stepButtons.map((button) => (
          <button key={button.id} className={step === button.id ? "active" : ""} onClick={() => setStep(button.id)}>
            {button.label}
          </button>
        ))}
      </nav>

      <section className="status-strip">
        <span>Rame <strong>{control.rame || "XXX"}</strong></span>
        <span>Train <strong>{control.train || "TTTT"}</strong></span>
        <span>Note <strong>{noteOn20}/20</strong></span>
        <span>{validated ? "Contrôle validé" : "Accueil à compléter"}</span>
      </section>

      {/* ── ACCUEIL ─────────────────────────────────────────────────────── */}
      {step === "accueil" && (
        <section className="panel-stack">
          <SectionTitle icon={<HomeIcon />} title="Accueil" subtitle="Les informations renseignent les colonnes A à G du fichier de suivi et les champs du Word." />
          <div className="form-grid">
            <Field label="TM — Technicentre de maintenance">
              <input value={control.tm} onChange={(e) => setControl({ ...control, tm: e.target.value.toUpperCase() })} placeholder="TLG, TATL, TSEE, TLL, TEE…" />
            </Field>
            <Field label="Numéro de rame (3 chiffres)">
              <input inputMode="numeric" maxLength={3} value={control.rame} onChange={(e) => setControl({ ...control, rame: e.target.value.replace(/\D/g, "").slice(0, 3) })} placeholder="793" />
            </Field>
            <Field label="Numéro train / sillon (4 chiffres)">
              <input inputMode="numeric" maxLength={4} value={control.train} onChange={(e) => setControl({ ...control, train: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="7512" />
            </Field>
            <Field label="OP de nettoyage (choix multiple possible)">
              <div className="pill-row">
                {OP_NETTOYAGE_OPTIONS.map((op) => {
                  const selected = control.opNettoyage.split(", ").filter(Boolean).includes(op);
                  return (
                    <button type="button" key={op} className={selected ? "pill selected" : "pill"} onClick={() => {
                      const current = control.opNettoyage.split(", ").filter(Boolean);
                      const next = selected ? current.filter((v) => v !== op) : [...current, op];
                      setControl({ ...control, opNettoyage: next.join(", ") });
                    }}>{op}</button>
                  );
                })}
              </div>
            </Field>
            <Field label="Type de contrôle">
              <select value={control.controlType} onChange={(e) => setControl({ ...control, controlType: e.target.value as typeof control.controlType })}>
                <option>Premier départ</option>
                <option>Demi-tour gare</option>
              </select>
            </Field>
            <Field label="Lieu du contrôle">
              <input value={control.lieu} onChange={(e) => setControl({ ...control, lieu: e.target.value })} placeholder="Gare / site" />
            </Field>
            <Field label="Nom du contrôleur">
              <input value={control.agent} onChange={(e) => setControl({ ...control, agent: e.target.value })} placeholder="Nom agent" />
            </Field>
            <Field label="Date du contrôle">
              <input type="date" value={control.date} onChange={(e) => setControl({ ...control, date: e.target.value })} />
            </Field>
            <Field label="Configuration rame">
              <select value={control.trainConfig} onChange={(e) => setControl({ ...control, trainConfig: e.target.value as typeof control.trainConfig })}>
                <option>OUIGO</option>
                <option>TANGO</option>
              </select>
            </Field>
            <Field label="Début du contrôle">
              <select value={control.startExtremity} onChange={(e) => setControl({ ...control, startExtremity: e.target.value as typeof control.startExtremity })}>
                <option>Extrémité 1</option>
                <option>Extrémité 2</option>
              </select>
            </Field>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button className="primary-action" style={{ flex: 1 }} onClick={validateAccueil}>Valider l'accueil et continuer</Button>
            <Button variant="outline" style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: "fit-content" }} onClick={handleNewControl}>
              <RefreshCw size={16} /> Nouveau contrôle
            </Button>
          </div>
        </section>
      )}
      {/* ── ASPECT EXTÉRIEURR ─────────────────────────────────────────────── */}
      {step === "exterieur" && (
        <section className="panel-stack">
          <SectionTitle icon={<TrainFront />} title="Contrôle Aspect extérieur" subtitle={`Ordre : ${control.startExtremity}. Motrices, remorques, baies vitrées et portes (pas de porte R4).`} />
          <div className="score-card">
            <div><strong>{exteriorCalc.ok}/{exteriorCalc.total}</strong><span> points conformes</span></div>
            <div><strong>{exteriorCalc.percent}%</strong><span> conformité</span></div>
            <div><SamiBadge value={assessment.exterior.manual} /><span>note retenue</span></div>
          </div>
          <div className="quick-grid">
            {exteriorSequence.map((item) => (
              <button key={item} className={assessment.exterior.items[item] !== false ? "check-tile ok" : "check-tile nok"} onClick={() => toggleExteriorItem(item)}>
                <span>{item}</span>
                <strong>{assessment.exterior.items[item] !== false ? "Propre" : "Non-conforme"}</strong>
              </button>
            ))}
          </div>
          <div className="sami-picker">
            {samiOptions.map((option) => (
              <button key={option} className={assessment.exterior.manual === option ? "selected" : ""} onClick={() => setAssessment((prev) => ({ ...prev, exterior: { ...prev.exterior, manual: option } }))}>
                {option} · {SAMI_LABELS[option]}
              </button>
            ))}
          </div>
          <label className="field-card wide">
            <span>Commentaire extérieur (dictable)</span>
            <textarea value={assessment.exterior.comment} onChange={(e) => setAssessment((prev) => ({ ...prev, exterior: { ...prev.exterior, comment: e.target.value } }))} placeholder="Ex. Baie R3 traces persistantes…" />
            <DictateBtn currentValue={assessment.exterior.comment} onValue={(v) => setAssessment((prev) => ({ ...prev, exterior: { ...prev.exterior, comment: v } }))} />
          </label>
        </section>
      )}

      {/* ── ASPECT INTÉRIEUR ─────────────────────────────────────────────── */}
      {step === "interieur" && (
        <section className="panel-stack">
          <SectionTitle icon={<Check />} title="Contrôle Aspect intérieur" subtitle={`Séquence ${control.startExtremity} — ${control.trainConfig}. Appuyez sur + pour saisir les points de contrôle.`} />
          <div className="sequence-list">
            {interiorSequence.map((seg, index) => {
              const result = getSegmentResult(seg.id);
              const summary = segmentSummary(seg);
              const isExpanded = expandedSegments.has(seg.id);
              const isSkipped = skippedSegments.has(seg.id);
              return (
                <div key={seg.id} className={`seq-item ${result ? "done" : ""} ${isSkipped ? "skipped" : ""} ${seg.type === "poubelle" ? "poubelle-item" : ""}`}>
                  <div className="seq-item-header">
                    <span className="seq-num">{index + 1}</span>
                    <span className="seq-label">{seg.label}</span>
                    {isSkipped && <span className="seq-skipped-badge">Non observé</span>}
                    {!isSkipped && summary && <span className="seq-summary">{summary}</span>}
                    <div className="seq-actions">
                      {!isSkipped && result && (
                        <button type="button" className="seq-expand" onClick={() => toggleExpanded(seg.id)} aria-label="Voir/masquer détails">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                      {!isSkipped && result && (
                        <button type="button" className="seq-delete" onClick={() => removeSegmentResult(seg.id)} aria-label="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className={isSkipped ? "seq-skip active" : "seq-skip"}
                        onClick={() => toggleSkipped(seg.id)}
                        aria-label={isSkipped ? "Rétablir" : "Non observé"}
                        title={isSkipped ? "Cliquer pour rétablir" : "Marquer comme non observé"}
                      >
                        <EyeOff size={14} />
                      </button>
                      {!isSkipped && (
                        <button type="button" className="seq-add" onClick={() => setOpenSegment(seg)} aria-label="Saisir">
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  {result && isExpanded && (
                    <div className="seq-detail">
                      {Object.entries(result.data as Record<string, string | null>).map(([k, v]) => v !== null && v !== "" ? (
                        <span key={k} className="seg-chip">{k} : {v}</span>
                      ) : null)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="seq-progress">
            {segmentResults.filter((r) => !skippedSegments.has(r.segmentId)).length} / {interiorSequence.length - skippedSegments.size} segments saisis
            {skippedSegments.size > 0 && <span className="seq-skipped-count"> · {skippedSegments.size} non observé{skippedSegments.size > 1 ? "s" : ""}</span>}
          </p>
        </section>
      )}

      {/* ── SAMI INTÉRIEUR ───────────────────────────────────────────────── */}
      {step === "sami" && (
        <section className="panel-stack">
          <SectionTitle icon={<FileSpreadsheet />} title="SAMI Intérieur" subtitle="Les propositions sont calculées depuis les points terrain et restent modifiables manuellement." />
          <div className="summary-notes">
            {SAMI_CATEGORIES.map((category) => (
              <div key={category}><span>{category}</span><SamiBadge value={notes[category]} /></div>
            ))}
            <div><span>Note propreté</span><strong>{noteOn20}/20 · {globalEvaluation(noteOn20)}</strong></div>
          </div>
          <div className="detail-grid">
            {DETAIL_DEFINITIONS.map((definition) => {
              const detail = effectiveAssessment.details[definition.code];
              const isNuisibles = definition.code === "nuisibles";
              const isManual = definition.code === "siege" || definition.code === "plafond" || definition.code === "localNec";
              return (
                <article key={definition.code} className="detail-card">
                  <h3>{definition.label}</h3>
                  <p className="detail-col">Colonnes Excel : {definition.excelColumns.join(" / ")}</p>
                  {detail.suggested && !isNuisibles && !isManual && (
                    <p className="detail-suggested">
                      Proposition calculée : <SamiBadge value={detail.suggested as string} />
                      {detail.percent !== undefined && <span> ({detail.percent}%)</span>}
                      {definition.code === "wc" && detail.reapprosMoyenPercent !== undefined && detail.reapprosMoyenPercent > 0 && (
                        <span> · Réappros moy. {detail.reapprosMoyenPercent}%</span>
                      )}
                    </p>
                  )}
                  {isManual && <p className="detail-suggested">Note à la diligence du contrôleur</p>}
                  <div className="sami-picker compact">
                    {(isNuisibles ? ["RAS", "NOK"] : samiOptions).map((option) => (
                      <button key={option} className={detail.note === option ? "selected" : ""} onClick={() => updateAssessmentDetail(definition.code, { note: option as typeof detail.note })}>
                        {option}
                      </button>
                    ))}
                  </div>
                  <div className="comment-field">
                    <textarea
                      value={detail.comment}
                      onChange={(e) => updateAssessmentDetail(definition.code, { comment: e.target.value })}
                      placeholder="Commentaire / nouvelle note Excel…"
                    />
                    <DictateBtn currentValue={detail.comment} onValue={(v) => updateAssessmentDetail(definition.code, { comment: v })} size="sm" />
                  </div>
                </article>
              );
            })}
          </div>
          <article className="valise-card">
            <h3>Présence NEC et Valise NEC</h3>
            <div className="comment-field">
              <textarea value={control.presenceNec} onChange={(e) => setControl({ ...control, presenceNec: e.target.value })} placeholder="Présence NEC, livrée, commentaire…" />
              <DictateBtn currentValue={control.presenceNec} onValue={(v) => setControl({ ...control, presenceNec: v })} size="sm" />
            </div>
            <div className="valise-grid">
              {valise.map((item) => (
                <button key={item.label} className={item.checked ? "pill selected" : "pill missing"} onClick={() => setValise((prev) => prev.map((entry) => entry.label === item.label ? { ...entry, checked: !entry.checked } : entry))}>
                  {item.checked ? "✓" : "!"} {item.label}
                </button>
              ))}
            </div>
          </article>
        </section>
      )}

      {/* ── PHOTOS ──────────────────────────────────────────────────────── */}
      {step === "photos" && (
        <section className="panel-stack">
          <SectionTitle icon={<Camera />} title="Photos" subtitle="Les photos sont compressées à 250 Ko maximum et intégrées au classeur Excel photos." />
          <div className="form-grid">
            <Field label="Famille">
              <select value={photoDraft.family} onChange={(e) => setPhotoDraft({ ...photoDraft, family: e.target.value })}>
                {PHOTO_FAMILIES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Localisation">
              <select value={photoDraft.localization} onChange={(e) => setPhotoDraft({ ...photoDraft, localization: e.target.value })}>
                {PHOTO_LOCALIZATIONS.filter((loc) => loc.toLowerCase().includes(photoDraft.family.toLowerCase().split(" ")[0]) || photoDraft.family === "Extérieur").map((loc) => <option key={loc}>{loc}</option>)}
              </select>
            </Field>
            <Field label="Commentaire photo">
              <textarea value={photoDraft.comment} onChange={(e) => setPhotoDraft({ ...photoDraft, comment: e.target.value })} placeholder="Ex. WC R1H papier absent" />
            </Field>
            <Field label="Photo appareil">
              <label className="camera-btn" title="Prendre une photo">
                <Camera size={32} />
                <span>Prendre une photo</span>
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => addPhoto(e.currentTarget.files?.[0] ?? null)} />
              </label>
            </Field>
          </div>
          <div className="photo-list">
            {photos.map((photo) => (
              <article key={photo.id}>
                {photo.photoDataUrl && <img src={photo.photoDataUrl} alt={photo.localization} />}
                <div><strong>{photo.localization}</strong><p>{photo.comment || "Sans commentaire"}</p><span>{photo.photoSizeKb} Ko</span></div>
                <Button variant="outline" onClick={() => setPhotos((prev) => prev.filter((p) => p.id !== photo.id))}><Trash2 /></Button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── EXPORT ──────────────────────────────────────────────────────── */}
      {step === "export" && (
        <section className="panel-stack">
          <SectionTitle icon={<Download />} title="Export" subtitle="Génération Word, ligne Excel, Excel photos et brouillon e-mail avec pièces jointes." />
          <div className="export-grid">
            <article><FileText /><strong>KN1 propreté {control.rame || "XXX"}</strong><span>Rapport Word sans photos, avec couleurs SAMI.</span></article>
            <article><FileSpreadsheet /><strong>Ligne Excel suivi</strong><span>Colonne TM colorée, ligne 3 remplie, notes SAMI et commentaires.</span></article>
            <article><Camera /><strong>Excel photos</strong><span>Localisation, commentaire et photo compressée.</span></article>
          </div>
          <Button className="primary-action" onClick={generateFiles} disabled={generating}>{generating ? "Génération…" : "Générer les fichiers"}</Button>
          {!!attachments.length && (
            <div className="attachment-list">
              {attachments.map((a) => <span key={a.name}>{a.name}</span>)}
              <Button onClick={() => downloadAttachments(attachments)}><Download /> Télécharger</Button>
              <Button variant="outline" onClick={() => shareAttachmentsIfSupported(attachments).then((shared) => !shared && toast.info("Partage natif indisponible : utilisez le téléchargement ou le brouillon e-mail."))}>Partager si possible</Button>
            </div>
          )}
          <Field label="Destinataire e-mail">
            <input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="destinataire@exemple.fr" />
          </Field>
          <Button className="primary-action" onClick={async () => {
            if (!recipient.trim()) { toast.error("Saisissez l'adresse e-mail du destinataire."); return; }
            const base = attachments.length ? attachments : await generateAllAttachments(control, notes, [], valise, effectiveAssessment, photos, skippedLabels);
            if (!attachments.length) setAttachments(base);
            window.location.href = buildMailto(control, recipient, base);
          }}><Mail /> Création du message</Button>
        </section>
      )}

      {/* ── MODAL SEGMENT ───────────────────────────────────────────────── */}
      {openSegment && (
        <SegmentForm
          segment={openSegment}
          result={getSegmentResult(openSegment.id)}
          onSave={saveSegmentResult}
          onClose={() => setOpenSegment(null)}
          trainConfig={control.trainConfig}
        />
      )}
    </main>
  );
}


