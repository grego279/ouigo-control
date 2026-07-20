import { useState, useRef } from "react";

/**
 * Page de diagnostic de la dictée vocale.
 * Affiche les transcriptions brutes de Chrome (avant tout traitement).
 * Accessible via /diag-dictee
 */
export default function DiagDictee() {
  const [logs, setLogs] = useState<{ idx: number; final: boolean; raw: string }[]>([]);
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const listeningRef = useRef(false);

  const start = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { alert("SpeechRecognition non disponible"); return; }

    setLogs([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = true;
    recRef.current = rec;

    rec.onstart = () => { listeningRef.current = true; setListening(true); };
    rec.onresult = (event: any) => {
      const idx = event.resultIndex;
      const result = event.results[idx];
      const raw = result?.[0]?.transcript ?? "(vide)";
      const isFinal = result?.isFinal ?? false;
      setLogs(prev => [...prev, { idx, final: isFinal, raw }]);
    };
    rec.onerror = (e: any) => {
      setLogs(prev => [...prev, { idx: -1, final: false, raw: `ERREUR: ${e.error}` }]);
    };
    rec.onend = () => { listeningRef.current = false; setListening(false); };
    rec.start();
  };

  const stop = () => { recRef.current?.stop(); };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 800 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>🔬 Diagnostic Dictée Vocale</h1>
      <p style={{ marginBottom: 16, fontSize: 14, color: "#666" }}>
        Dictez des mots de ponctuation (<strong>virgule</strong>, <strong>point</strong>, <strong>deux points</strong>, etc.)
        pour voir exactement ce que Chrome retranscrit.
      </p>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button
          onClick={listening ? stop : start}
          style={{
            padding: "10px 20px",
            background: listening ? "#dc2626" : "#16a34a",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          {listening ? "⏹ Arrêter" : "🎤 Démarrer"}
        </button>
        <button
          onClick={() => setLogs([])}
          style={{
            padding: "10px 20px",
            background: "#6b7280",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          🗑 Effacer
        </button>
      </div>
      {listening && (
        <div style={{ padding: "8px 16px", background: "#fef3c7", borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          🔴 Écoute en cours… Dictez vos mots de ponctuation puis appuyez sur Arrêter.
        </div>
      )}
      <div style={{ background: "#1e1e1e", color: "#d4d4d4", borderRadius: 8, padding: 16, minHeight: 200 }}>
        {logs.length === 0 && (
          <div style={{ color: "#666" }}>Aucune transcription pour l'instant…</div>
        )}
        {logs.map((log, i) => (
          <div key={i} style={{ marginBottom: 8, borderBottom: "1px solid #333", paddingBottom: 8 }}>
            <span style={{ color: "#888", fontSize: 12 }}>#{log.idx} [{log.final ? "FINAL" : "interim"}] </span>
            <span style={{ color: log.final ? "#4ade80" : "#fbbf24", fontSize: 16 }}>
              "{log.raw}"
            </span>
            <span style={{ color: "#888", fontSize: 12, marginLeft: 8 }}>
              ({log.raw.length} chars, codes: {Array.from(log.raw).map(c => c.charCodeAt(0)).join(",")})
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
        <strong>Codes utiles :</strong> virgule=44 | point=46 | point-virgule=59 | deux-points=58 | !excl=33 | ?interro=63 | …=8230
      </div>
    </div>
  );
}
