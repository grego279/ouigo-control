// ─── Types de base ──────────────────────────────────────────────────────────

export type ControlType = "Premier départ" | "Demi-tour gare";
export type Level = "H" | "B" | "Sans niveau";
export type Sami = "S" | "A" | "M" | "I";
export type SamiCategory = "WC" | "Voitures" | "Local ASCT" | "Extérieur" | "Plateforme";
export type TrainConfig = "OUIGO" | "TANGO";
export type StartExtremity = "Extrémité 1" | "Extrémité 2";

// ─── Données du contrôle (Accueil) ──────────────────────────────────────────

export type ControlData = {
  tm: string;
  controlType: ControlType;
  rame: string;
  train: string;
  date: string;
  agent: string;
  lieu: string;
  opNettoyage: string;
  presenceNec: string;
  trainConfig: TrainConfig;
  startExtremity: StartExtremity;
};

// ─── Anomalie photo ──────────────────────────────────────────────────────────

export type Anomaly = {
  id: string;
  zone: string;
  level: Level;
  place?: string;
  location: string;
  element: string;
  comment: string;
  photoDataUrl?: string;
  photoName?: string;
  photoSizeKb?: number;
};

export type PhotoEntry = {
  id: string;
  localization: string;
  comment: string;
  photoDataUrl?: string;
  photoName?: string;
  photoSizeKb?: number;
};

export type ValiseItem = {
  label: string;
  checked: boolean;
};

// ─── Types de segments intérieur ─────────────────────────────────────────────

export type SegmentType =
  | "plateformeB"
  | "plateformeH"
  | "reapproswc"
  | "wc"
  | "salleVoyageurs"
  | "escalier"
  | "fourgon"
  | "localNec"
  | "localAsct"
  | "nurserie"
  | "poubelle"
  | "r4"
  | "espaceConvivialite";

export type SegmentEntry = {
  id: string;
  label: string;
  type: SegmentType;
  hasPoubelle?: boolean; // OUIGO ou TANGO : présence de poubelle dans ce segment
};

// ─── Données saisies par segment ─────────────────────────────────────────────

export type PlateformeData = {
  aspiration: "fait" | "non fait" | null;
  presenceDechet: "Oui" | "Non" | null;
};

export type ReapproswcData = {
  niveau: "25%" | "50%" | "75%" | "100%" | null;
};

export type WcData = {
  vidanges: "Oui" | "Non" | null;
  odeurs: "Oui" | "Non" | null;
  tags: "Oui" | "Non" | null;
  poubelleVidee: "Oui" | "Non" | null;
  papierWc: "Oui" | "Non" | null;
  sol: "Propre" | "Non-conforme" | null;
  cuvette: "Propre" | "Non-conforme" | null;
  lavabo: "Propre" | "Non-conforme" | null;
  savonnier: "Plein" | "Vide" | "Manquant" | null;
};

export type SalleVoyageursData = {
  moquette: "Aspirée" | "Non-aspirée" | "Propre" | "Non-conforme" | null;
  vitre: "Propre" | "Non-conforme" | null;
  presenceDeChets: "Oui" | "Non" | null;
  plafond: "Propre" | "Non-conforme" | null;
  sieges: "Propre" | "Non-conforme" | null;
};

export type EscalierData = {
  etat: "Propre" | "Non-conforme" | null;
};

export type FourgonData = {
  chariot: "Sanglée" | "Non-sanglée" | null;
  dechets: "Oui" | "Non" | null;
};

export type LocalNecData = {
  etat: "Propre" | "Non-conforme" | null;
};

export type LocalAsctData = {
  proprete: "Conforme" | "Non-conforme" | null;
  machineCafe: "Présente" | "Absente" | null;
  comment: string;
};

export type NuserieData = {
  tags: "Oui" | "Non" | null;
  poubelleVidee: "Oui" | "Non" | null;
  lavabo: "Propre" | "Non-conforme" | null;
  savonnier: "Plein" | "Vide" | "Manquant" | null;
};

export type PoubelleData = {
  sacPresent: "Oui" | "Non" | null;
  videe: "Oui" | "Non" | null;
};

export type SegmentData =
  | { type: "plateformeB"; data: PlateformeData }
  | { type: "plateformeH"; data: PlateformeData }
  | { type: "reapproswc"; data: ReapproswcData }
  | { type: "wc"; data: WcData }
  | { type: "salleVoyageurs"; data: SalleVoyageursData }
  | { type: "escalier"; data: EscalierData }
  | { type: "fourgon"; data: FourgonData }
  | { type: "localNec"; data: LocalNecData }
  | { type: "localAsct"; data: LocalAsctData }
  | { type: "nurserie"; data: NuserieData }
  | { type: "poubelle"; data: PoubelleData }
  | { type: "r4"; data: Record<string, never> }
  | { type: "espaceConvivialite"; data: Record<string, never> };

export type SegmentResult = {
  segmentId: string;
  segmentLabel: string;
  segmentType: SegmentType;
  data: SegmentData["data"];
};

// ─── Notes SAMI ──────────────────────────────────────────────────────────────

export type Notes = Record<SamiCategory, Sami>;

// ─── Évaluation SAMI détaillée ───────────────────────────────────────────────

export type DetailItemKey =
  | "moquettePlateforme"
  | "moquetteSalle"
  | "siege"
  | "plafond"
  | "poubelles"
  | "graffitis"
  | "nuisibles"
  | "escalier"
  | "wc"
  | "localAsct"
  | "localNec"
  | "fourgon";

export type NuisiblesValue = "RAS" | "NOK";

export type DetailAssessment = {
  code: DetailItemKey;
  label: string;
  excelColumns: string[];
  note: Sami | NuisiblesValue;
  suggested?: Sami | NuisiblesValue;
  percent?: number;
  comment: string;
  reapprosMoyenPercent?: number; // pour WC uniquement
};

export type ControlAssessment = {
  exterior: {
    items: Record<string, boolean>;
    suggested: Sami;
    manual: Sami;
    percent: number;
    comment: string;
  };
  details: Record<DetailItemKey, DetailAssessment>;
  notes: Notes;
  segmentResults: SegmentResult[];
};

// ─── Constantes métier ───────────────────────────────────────────────────────

export const SAMI_VALUES: Record<Sami, number> = { S: 4, A: 3, M: 1, I: 0 };

export const SAMI_LABELS: Record<Sami, string> = {
  S: "Satisfaisant",
  A: "Acceptable",
  M: "Moyen",
  I: "Insuffisant",
};

export const SAMI_CATEGORIES: SamiCategory[] = ["WC", "Voitures", "Local ASCT", "Extérieur", "Plateforme"];

export const DEFAULT_NOTES: Notes = {
  WC: "S",
  Voitures: "S",
  "Local ASCT": "S",
  Extérieur: "S",
  Plateforme: "S",
};

export const TM_COLORS: Record<string, string> = {
  TLG: "FFFF9900",
  TATL: "FF66FF33",
  TSEE: "FF00B0F0",
  TLL: "FFFFFF00",
  TEE: "FFC0E6F5",
};

export const SAMI_COLORS: Record<Sami, string> = {
  S: "FF92D050",
  A: "FF00B0F0",
  M: "FFFFFF00",
  I: "FFFF0000",
};

export const VALISE_NEC_ITEMS = [
  "Lingette anti-tag",
  "Sac poubelle jaune",
  "Sac poubelle gris",
  "Cale porte",
  "Solisorb",
  "Porte sac bi-flux",
  "Papier blanc",
  "Ceinture ergonomique",
  "Aspirateur à batterie",
  "Savon liquide",
  "Gel hydroalcoolique",
  "Affichette pour WC",
  "Gants jetables",
  "Clé de Berne",
  "Lunettes de protection",
  "Gilet",
  "Badge",
];

export const OP_NETTOYAGE_OPTIONS = ["NNO", "NWC", "NSY", "MAL", "OPM", "NEB", "PNUISI"];

// ─── Séquences Aspect extérieur ──────────────────────────────────────────────

// Extrémité 1 : Motrice 1, puis R1→R8 (Remorque/Baie vitrée/Porte, sauf porte R4), puis Motrice 2
export const EXTERIOR_SEQUENCE_EXT1: string[] = [
  "Motrice 1",
  "Remorque R1", "Baie vitrée R1", "Porte R1",
  "Remorque R2", "Baie vitrée R2", "Porte R2",
  "Remorque R3", "Baie vitrée R3", "Porte R3",
  "Remorque R4", "Baie vitrée R4",
  "Remorque R5", "Baie vitrée R5", "Porte R5",
  "Remorque R6", "Baie vitrée R6", "Porte R6",
  "Remorque R7", "Baie vitrée R7", "Porte R7",
  "Remorque R8", "Baie vitrée R8", "Porte R8",
  "Motrice 2",
];

// Extrémité 2 : ordre inversé
export const EXTERIOR_SEQUENCE_EXT2: string[] = [...EXTERIOR_SEQUENCE_EXT1].reverse();

// Pour les tests et calculs (liste complète des éléments extérieurs)
export const EXTERIOR_ITEMS: string[] = EXTERIOR_SEQUENCE_EXT1;

// ─── Séquences Aspect intérieur ──────────────────────────────────────────────

// Poubelles OUIGO (segments qui ont une poubelle)
const POUBELLES_OUIGO = new Set([
  "Salle voyageurs R1B", "Plateforme R1H",
  "Salle voyageurs R2B", "Salle voyageurs R2H",
  "Salle voyageurs R3B", "Salle voyageurs R3H",
  "R4",
  "Salle voyageurs R5B", "Salle voyageurs R5H",
  "Salle voyageurs R6B", "Salle voyageurs R6H",
  "Salle voyageurs R7B", "Salle voyageurs R7H",
  "Salle voyageurs R8B", "Plateforme R8H",
]);

// Poubelles TANGO
const POUBELLES_TANGO = new Set([
  "Plateforme R1B", "Salle voyageurs R1B", "Plateforme R1H",
  "Salle voyageurs R2B", "Plateforme R2H",
  "Salle voyageurs R3B", "Plateforme R3H",
  "Espace de convivialité R4",
  "Salle voyageurs R5B", "Plateforme R5H",
  "Salle voyageurs R6B", "Plateforme R6H",
  "Salle voyageurs R7B", "Plateforme R7H",
  "Salle voyageurs R8B", "Plateforme R8H",
]);

function getSegmentType(label: string): SegmentType {
  if (label === "R4") return "r4";
  if (label.startsWith("Espace de convivialité")) return "espaceConvivialite";
  if (label.startsWith("Salle voyageurs") || label.startsWith("Espace convivialité")) return "salleVoyageurs";
  if (label.startsWith("Plateforme") && label.includes("B")) return "plateformeB";
  if (label.startsWith("Plateforme") && label.includes("H")) return "plateformeH";
  if (label.startsWith("Réappros WC")) return "reapproswc";
  if (label.startsWith("WC")) return "wc";
  if (label.startsWith("Escalier")) return "escalier";
  if (label.startsWith("Fourgon")) return "fourgon";
  if (label === "Local NEC") return "localNec";
  if (label === "Local ASCT") return "localAsct";
  if (label === "Nurserie R7H") return "nurserie";
  return "salleVoyageurs";
}

function buildSequence(labels: string[], config: TrainConfig): SegmentEntry[] {
  const poubelleSet = config === "TANGO" ? POUBELLES_TANGO : POUBELLES_OUIGO;
  const entries: SegmentEntry[] = [];
  for (const label of labels) {
    const type = getSegmentType(label);
    const hasPoubelle = poubelleSet.has(label);
    entries.push({ id: `seg-${label.replace(/\s+/g, "-")}`, label, type, hasPoubelle });
    if (hasPoubelle) {
      entries.push({ id: `poubelle-${label.replace(/\s+/g, "-")}`, label: `Poubelle ${label}`, type: "poubelle", hasPoubelle: false });
    }
  }
  return entries;
}

// Labels bruts des séquences (sans les poubelles intercalées)
const SEQ_EXT1_LABELS: string[] = [
  "Plateforme R1B", "Réappros WC R1B", "WC R1B", "Salle voyageurs R1B",
  "Escalier R1", "Plateforme R1H", "WC R1H", "Réappros WC R1H", "Salle voyageurs R1H", "Fourgon R1",
  "Salle voyageurs R2H", "Plateforme R2H", "Réappros WC R2H", "WC R2H",
  "Escalier R2", "Plateforme R2B", "WC R2B", "Réappros WC R2B", "Salle voyageurs R2B",
  "Salle voyageurs R3H", "Plateforme R3H", "Réappros WC R3H", "WC R3H",
  "Escalier R3", "Plateforme R3B", "WC R3B", "Réappros WC R3B", "Salle voyageurs R3B",
  "R4", "Local NEC", "Local ASCT",
  "Escalier R5", "Plateforme R5B", "WC R5B", "Réappros WC R5B", "Salle voyageurs R5B",
  "Plateforme R5H", "WC R5H", "Réappros WC R5H", "Salle voyageurs R5H",
  "Escalier R6", "Plateforme R6B", "WC R6B", "Réappros WC R6B", "Salle voyageurs R6B",
  "Plateforme R6H", "WC R6H", "Réappros WC R6H", "Salle voyageurs R6H",
  "Escalier R7", "Plateforme R7B", "WC R7B", "Réappros WC R7B", "Salle voyageurs R7B",
  "Plateforme R7H", "WC R7H", "Réappros WC R7H", "Nurserie R7H", "Salle voyageurs R7H",
  "Escalier R8", "Plateforme R8B", "WC R8B", "Réappros WC R8B", "Salle voyageurs R8B",
  "Plateforme R8H", "WC R8H", "Réappros WC R8H", "Salle voyageurs R8H", "Fourgon R8",
];

const SEQ_EXT2_LABELS: string[] = [
  "Plateforme R8B", "Réappros WC R8B", "WC R8B", "Salle voyageurs R8B",
  "Escalier R8", "Plateforme R8H", "WC R8H", "Réappros WC R8H", "Salle voyageurs R8H", "Fourgon R8",
  "Salle voyageurs R7H", "Nurserie R7H", "Plateforme R7H", "Réappros WC R7H", "WC R7H",
  "Escalier R7", "Plateforme R7B", "WC R7B", "Réappros WC R7B", "Salle voyageurs R7B",
  "Salle voyageurs R6H", "Plateforme R6H", "Réappros WC R6H", "WC R6H",
  "Escalier R6", "Plateforme R6B", "WC R6B", "Réappros WC R6B", "Salle voyageurs R6B",
  "Salle voyageurs R5H", "Plateforme R5H", "Réappros WC R5H", "WC R5H",
  "Escalier R5", "Plateforme R5B", "WC R5B", "Réappros WC R5B", "Salle voyageurs R5B",
  "Local ASCT", "Local NEC", "R4",
  "Plateforme R3H", "WC R3H", "Réappros WC R3H",
  "Escalier R3", "Plateforme R3B", "WC R3B", "Réappros WC R3B", "Salle voyageurs R3B", "Salle voyageurs R3H",
  "Plateforme R2H", "Réappros WC R2H", "WC R2H",
  "Escalier R2", "Plateforme R2B", "WC R2B", "Réappros WC R2B", "Salle voyageurs R2B", "Salle voyageurs R2H",
  "Plateforme R1H", "WC R1H", "Réappros WC R1H",
  "Escalier R1", "Plateforme R1B", "Réappros WC R1B", "WC R1B", "Salle voyageurs R1B", "Salle voyageurs R1H", "Fourgon R1",
];

// Séquences avec label R4 remplacé par config (OUIGO/TANGO)
function getR4Label(config: TrainConfig): string {
  return config === "TANGO" ? "Espace de convivialité R4" : "Salle voyageurs R4";
}

function resolveLabels(labels: string[], config: TrainConfig): string[] {
  return labels.map((l) => (l === "R4" ? getR4Label(config) : l));
}

// Pour les tests (séquences brutes sans poubelles)
export const INTERIOR_SEQUENCE_EXTREMITY_1: string[] = SEQ_EXT1_LABELS;
export const INTERIOR_SEQUENCE_EXTREMITY_2: string[] = SEQ_EXT2_LABELS;

export function buildInteriorSequence(extremity: StartExtremity, config: TrainConfig): SegmentEntry[] {
  const labels = extremity === "Extrémité 1" ? SEQ_EXT1_LABELS : SEQ_EXT2_LABELS;
  const resolved = resolveLabels(labels, config);
  return buildSequence(resolved, config);
}

// ─── Définitions des rubriques SAMI ──────────────────────────────────────────

export const DETAIL_DEFINITIONS: Array<Omit<DetailAssessment, "note" | "comment">> = [
  { code: "moquettePlateforme", label: "Moquette Plateforme", excelColumns: ["H", "O"], suggested: "S", percent: 100 },
  { code: "moquetteSalle", label: "Moquette Salle", excelColumns: ["I"], suggested: "S", percent: 100 },
  { code: "siege", label: "Siège", excelColumns: ["J"], suggested: "S" },
  { code: "plafond", label: "Plafond", excelColumns: ["K"], suggested: "S" },
  { code: "poubelles", label: "Poubelles", excelColumns: ["L"], suggested: "S", percent: 100 },
  { code: "graffitis", label: "Graffitis", excelColumns: ["M", "R"], suggested: "S", percent: 100 },
  { code: "nuisibles", label: "Nuisibles", excelColumns: ["N", "S"], suggested: "RAS" },
  { code: "escalier", label: "Escalier", excelColumns: ["P"], suggested: "S", percent: 100 },
  { code: "wc", label: "WC propreté, odeurs, LM…", excelColumns: ["Q"], suggested: "S", percent: 100 },
  { code: "localAsct", label: "Local ASCT", excelColumns: ["T"], suggested: "S", percent: 100 },
  { code: "localNec", label: "Local NEC", excelColumns: ["U"], suggested: "S" },
  { code: "fourgon", label: "Fourgon", excelColumns: ["V"], suggested: "S", percent: 100 },
];

// ─── Fonctions de calcul SAMI depuis les points terrain ──────────────────────

export function samiFromPercent(percent: number): Sami {
  if (percent >= 75) return "S";
  if (percent >= 50) return "A";
  if (percent >= 25) return "M";
  return "I";
}

function computePercent(points: number[], scores: number[]): number {
  const total = points.length;
  if (total === 0) return 100;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / total) * 100);
}

/** Calcule le SAMI Moquette Plateforme depuis les résultats de segments */
export function computeSamiMoquettePlateforme(results: SegmentResult[]): { percent: number; sami: Sami } | null {
  const plateformes = results.filter((r) => r.segmentType === "plateformeB" || r.segmentType === "plateformeH");
  if (plateformes.length === 0) return null;
  const scores: number[] = [];
  for (const r of plateformes) {
    const d = r.data as PlateformeData;
    if (d.aspiration !== null) scores.push(d.aspiration === "fait" ? 1 : 0);
    if (d.presenceDechet !== null) scores.push(d.presenceDechet === "Non" ? 1 : 0);
  }
  const percent = computePercent(scores, scores);
  return { percent, sami: samiFromPercent(percent) };
}

/** Calcule le SAMI Moquette Salle depuis les résultats de segments */
export function computeSamiMoquetteSalle(results: SegmentResult[]): { percent: number; sami: Sami } | null {
  const salles = results.filter((r) => r.segmentType === "salleVoyageurs");
  if (salles.length === 0) return null;
  const scores: number[] = [];
  for (const r of salles) {
    const d = r.data as SalleVoyageursData;
    if (d.moquette !== null) scores.push(d.moquette === "Aspirée" ? 1 : 0);
    if (d.vitre !== null) scores.push(d.vitre === "Propre" ? 1 : 0);
    if (d.presenceDeChets !== null) scores.push(d.presenceDeChets === "Non" ? 1 : 0);
  }
  const percent = computePercent(scores, scores);
  return { percent, sami: samiFromPercent(percent) };
}

/** Calcule le SAMI Poubelles depuis les résultats de segments */
export function computeSamiPoubelles(results: SegmentResult[]): { percent: number; sami: Sami } | null {
  const poubelles = results.filter((r) => r.segmentType === "poubelle");
  if (poubelles.length === 0) return null;
  const scores: number[] = [];
  for (const r of poubelles) {
    const d = r.data as PoubelleData;
    if (d.sacPresent !== null) scores.push(d.sacPresent === "Oui" ? 1 : 0);
    if (d.videe !== null) scores.push(d.videe === "Oui" ? 1 : 0);
  }
  const percent = computePercent(scores, scores);
  return { percent, sami: samiFromPercent(percent) };
}

/** Calcule le SAMI Graffitis depuis les WC */
export function computeSamiGraffitis(results: SegmentResult[]): { percent: number; sami: Sami } | null {
  const wcs = results.filter((r) => r.segmentType === "wc");
  if (wcs.length === 0) return null;
  const scores: number[] = [];
  for (const r of wcs) {
    const d = r.data as WcData;
    if (d.tags !== null) scores.push(d.tags === "Non" ? 1 : 0);
  }
  const percent = computePercent(scores, scores);
  return { percent, sami: samiFromPercent(percent) };
}

/** Calcule le SAMI Escalier */
export function computeSamiEscalier(results: SegmentResult[]): { percent: number; sami: Sami } | null {
  const escaliers = results.filter((r) => r.segmentType === "escalier");
  if (escaliers.length === 0) return null;
  const scores: number[] = [];
  for (const r of escaliers) {
    const d = r.data as EscalierData;
    if (d.etat !== null) scores.push(d.etat === "Propre" ? 1 : 0);
  }
  const percent = computePercent(scores, scores);
  return { percent, sami: samiFromPercent(percent) };
}

/** Calcule le SAMI WC */
export function computeSamiWc(results: SegmentResult[]): { percent: number; sami: Sami; reapprosMoyen: number } | null {
  const wcs = results.filter((r) => r.segmentType === "wc");
  const reappros = results.filter((r) => r.segmentType === "reapproswc");
  if (wcs.length === 0 && reappros.length === 0) return null;
  const scores: number[] = [];
  for (const r of wcs) {
    const d = r.data as WcData;
    if (d.vidanges !== null) scores.push(d.vidanges === "Oui" ? 1 : 0);
    if (d.odeurs !== null) scores.push(d.odeurs === "Non" ? 1 : 0);
    if (d.poubelleVidee !== null) scores.push(d.poubelleVidee === "Oui" ? 1 : 0);
    if (d.papierWc !== null) scores.push(d.papierWc === "Oui" ? 1 : 0);
    if (d.sol !== null) scores.push(d.sol === "Propre" ? 1 : 0);
    if (d.cuvette !== null) scores.push(d.cuvette === "Propre" ? 1 : 0);
    if (d.lavabo !== null) scores.push(d.lavabo === "Propre" ? 1 : 0);
    if (d.savonnier !== null) scores.push(d.savonnier === "Plein" ? 1 : 0);
  }
  const percent = computePercent(scores, scores);
  // Réappros moyen
  const niveauToPercent: Record<string, number> = { "25%": 25, "50%": 50, "75%": 75, "100%": 100 };
  const reapprosValues = reappros.map((r) => niveauToPercent[(r.data as ReapproswcData).niveau ?? ""] ?? 0).filter((v) => v > 0);
  const reapprosMoyen = reapprosValues.length ? Math.round(reapprosValues.reduce((a, b) => a + b, 0) / reapprosValues.length) : 0;
  return { percent, sami: samiFromPercent(percent), reapprosMoyen };
}

/** Calcule le SAMI Local ASCT */
export function computeSamiLocalAsct(results: SegmentResult[]): { percent: number; sami: Sami } | null {
  const ascts = results.filter((r) => r.segmentType === "localAsct");
  if (ascts.length === 0) return null;
  const scores: number[] = [];
  for (const r of ascts) {
    const d = r.data as LocalAsctData;
    if (d.proprete !== null) scores.push(d.proprete === "Conforme" ? 1 : 0);
  }
  const percent = computePercent(scores, scores);
  return { percent, sami: samiFromPercent(percent) };
}

/** Calcule le SAMI Fourgon */
export function computeSamiFourgon(results: SegmentResult[], controlType: ControlType): { percent: number; sami: Sami } | null {
  const fourgons = results.filter((r) => r.segmentType === "fourgon");
  if (fourgons.length === 0) return null;
  const scores: number[] = [];
  for (const r of fourgons) {
    const d = r.data as FourgonData;
    if (d.chariot !== null) scores.push(d.chariot === "Sanglée" ? 1 : 0);
    if (controlType === "Premier départ" && d.dechets !== null) scores.push(d.dechets === "Non" ? 1 : 0);
  }
  const percent = computePercent(scores, scores);
  return { percent, sami: samiFromPercent(percent) };
}

/** Recalcule toutes les propositions SAMI depuis les résultats terrain */
export function computeAllSamiFromResults(
  results: SegmentResult[],
  controlType: ControlType,
): {
  moquettePlateforme: { percent: number; sami: Sami } | null;
  moquetteSalle: { percent: number; sami: Sami } | null;
  poubelles: { percent: number; sami: Sami } | null;
  graffitis: { percent: number; sami: Sami } | null;
  escalier: { percent: number; sami: Sami } | null;
  wc: { percent: number; sami: Sami; reapprosMoyen: number } | null;
  localAsct: { percent: number; sami: Sami } | null;
  fourgon: { percent: number; sami: Sami } | null;
} {
  return {
    moquettePlateforme: computeSamiMoquettePlateforme(results),
    moquetteSalle: computeSamiMoquetteSalle(results),
    poubelles: computeSamiPoubelles(results),
    graffitis: computeSamiGraffitis(results),
    escalier: computeSamiEscalier(results),
    wc: computeSamiWc(results),
    localAsct: computeSamiLocalAsct(results),
    fourgon: computeSamiFourgon(results, controlType),
  };
}

// ─── Fonctions utilitaires ───────────────────────────────────────────────────

export function allowedLevelsForZone(zone: string): Level[] {
  if (zone === "R4") return ["H"];
  if (zone.includes("Extérieur") || zone.includes("Local") || zone.includes("Fourgon")) return ["Sans niveau"];
  return ["H", "B"];
}

export function formatDateForFilename(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "date_invalide";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}_${month}_${year}`;
}

export function formatDateCompact(dateIso: string): string {
  return formatDateForFilename(dateIso).replaceAll("_", "");
}

export function formatDateDisplay(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Date invalide";
  return date.toLocaleDateString("fr-FR");
}

export function wordFilename(control: ControlData): string {
  return `KN1 propreté ${control.rame || "XXX"} ${formatDateForFilename(control.date)}.docx`;
}

export function trackingFilename(control: ControlData): string {
  return `Ligne_suivi_propreté_${control.rame || "XXX"}_${formatDateForFilename(control.date)}.xlsx`;
}

export function photoFilename(control: ControlData): string {
  return `Photos_Contrôle-propreté_${control.rame || "XXX"}_${formatDateCompact(control.date)}.xlsx`;
}

export function scoreOn20(notes: Notes): number {
  return SAMI_CATEGORIES.reduce((sum, category) => sum + SAMI_VALUES[notes[category]], 0);
}

export function globalEvaluation(note: number): string {
  if (note < 8) return "Inacceptable";
  if (note < 10) return "Insuffisant";
  if (note < 12) return "Moyen";
  if (note < 15) return "Acceptable";
  return "Satisfaisant";
}

export function countSami(notes: Notes): Record<Sami, number> {
  return SAMI_CATEGORIES.reduce(
    (acc, category) => {
      acc[notes[category]] += 1;
      return acc;
    },
    { S: 0, A: 0, M: 0, I: 0 } as Record<Sami, number>,
  );
}

export function validateControl(control: ControlData): string[] {
  const errors: string[] = [];
  if (!control.tm.trim()) errors.push("Le TM est obligatoire.");
  if (!control.controlType) errors.push("Le type de contrôle est obligatoire.");
  if (!/^\d{3}$/.test(control.rame)) errors.push("Le numéro de rame doit contenir exactement 3 chiffres.");
  if (!/^\d{4}$/.test(control.train)) errors.push("Le numéro train / sillon doit contenir exactement 4 chiffres.");
  if (!control.agent.trim()) errors.push("Le nom du contrôleur est obligatoire.");
  if (!control.opNettoyage.trim()) errors.push("L'OP nettoyage est obligatoire.");
  return errors;
}

export function validateAnomaly(anomaly: Anomaly): string[] {
  const errors: string[] = [];
  if (!anomaly.zone) errors.push("La zone est obligatoire.");
  if (!anomaly.level) errors.push("Le niveau est obligatoire sauf cas spécifique.");
  if (anomaly.zone === "R4" && anomaly.level !== "H") errors.push("R4 est contrôlée uniquement au niveau haut.");
  if (!anomaly.location) errors.push("Le lieu est obligatoire.");
  if (!anomaly.element) errors.push("L'élément contrôlé est obligatoire.");
  if (!anomaly.comment.trim()) errors.push("Le commentaire est obligatoire.");
  return errors;
}

export function photoLocalization(anomaly: Anomaly): string {
  const level = anomaly.level === "Sans niveau" ? "" : anomaly.level;
  const place = anomaly.place?.trim() ? ` place ${anomaly.place.trim()}` : "";
  return `${anomaly.element} ${anomaly.zone}${level ? level : ""}${place}`.trim();
}

export function excelTrackingHeaders(): string[] {
  return [
    "TM", "Rame", "Train", "OP de nettoyage", "Lieu", "Nom du contrôleur", "date",
    "Moquette Plateforme", "Moquette Salle", "Siège", "Plafond", "Poubelles", "Graffitis", "Nuisibles",
    "Moquette Plateforme", "Escalier", "WC propreté, odeurs,LM..", "Graffitis", "Nuisibles",
    "Local ASCT", "Local NEC", "Fourgon", "Aspect extérieur", "Note propreté sur 20", "Présence NEC",
  ];
}

export function createDefaultAssessment(): ControlAssessment {
  const details = DETAIL_DEFINITIONS.reduce((acc, definition) => {
    acc[definition.code] = {
      ...definition,
      note: definition.suggested ?? "S",
      comment: "",
    } as DetailAssessment;
    return acc;
  }, {} as Record<DetailItemKey, DetailAssessment>);
  const notes: Notes = { ...DEFAULT_NOTES };
  return {
    exterior: {
      items: Object.fromEntries(EXTERIOR_ITEMS.map((item) => [item, true])),
      suggested: "S",
      manual: "S",
      percent: 100,
      comment: "",
    },
    details,
    notes,
    segmentResults: [],
  };
}

export function computeExterior(items: Record<string, boolean>) {
  const values = Object.values(items);
  const total = values.length || 1;
  const ok = values.filter(Boolean).length;
  const percent = Math.round((ok / total) * 100);
  return { ok, total, percent, sami: samiFromPercent(percent) };
}

export function computeNotesFromAssessment(assessment: ControlAssessment): Notes {
  const voituresCandidates = [assessment.details.moquetteSalle.note, assessment.details.siege.note, assessment.details.plafond.note, assessment.details.poubelles.note].filter(
    (value): value is Sami => ["S", "A", "M", "I"].includes(String(value)),
  );
  const voituresScore = voituresCandidates.length ? Math.round(voituresCandidates.reduce((sum, value) => sum + SAMI_VALUES[value], 0) / voituresCandidates.length) : 4;
  const toSamiFromAverage = (value: number): Sami => {
    if (value >= 3.5) return "S";
    if (value >= 2) return "A";
    if (value >= 0.5) return "M";
    return "I";
  };
  return {
    WC: assessment.details.wc.note as Sami,
    Voitures: toSamiFromAverage(voituresScore),
    "Local ASCT": assessment.details.localAsct.note as Sami,
    Extérieur: assessment.exterior.manual,
    Plateforme: assessment.details.moquettePlateforme.note as Sami,
  };
}

export function controlToExcelRow(control: ControlData, notes: Notes, assessment?: ControlAssessment, valise?: ValiseItem[]): Array<string | number> {
  const details = assessment?.details;
  const exterior = assessment?.exterior.manual ?? notes.Extérieur;
  const presenceNec = buildPresenceNecText(control, valise ? missingValiseLabels(valise) : []);
  return [
    control.tm,
    control.rame,
    control.train,
    control.opNettoyage,
    `${control.lieu} - ${control.controlType}`,
    control.agent,
    formatDateDisplay(control.date),
    details?.moquettePlateforme.note ?? notes.Plateforme,
    details?.moquetteSalle.note ?? notes.Voitures,
    details?.siege.note ?? notes.Voitures,
    details?.plafond.note ?? notes.Voitures,
    details?.poubelles.note ?? notes.Voitures,
    details?.graffitis.note ?? "S",
    details?.nuisibles.note ?? "RAS",
    details?.moquettePlateforme.note ?? notes.Plateforme,
    details?.escalier.note ?? notes.Plateforme,
    details?.wc.note ?? notes.WC,
    details?.graffitis.note ?? "S",
    details?.nuisibles.note ?? "RAS",
    details?.localAsct.note ?? notes["Local ASCT"],
    details?.localNec.note ?? "S",
    details?.fourgon.note ?? "S",
    exterior,
    scoreOn20(notes),
    presenceNec,
  ];
}

export function missingValiseLabels(valise: ValiseItem[]): string[] {
  return valise.filter((item) => !item.checked).map((item) => item.label);
}

export function buildPresenceNecText(control: ControlData, missingValise: string[]): string {
  const base = control.presenceNec?.trim() || "Présence NEC non renseignée";
  return missingValise.length ? `${base} ; manque : ${missingValise.join(", ")}` : base;
}

export function emptyControl(today = new Date()): ControlData {
  return {
    tm: "",
    controlType: "Premier départ",
    rame: "",
    train: "",
    date: today.toISOString().slice(0, 10),
    agent: "",
    lieu: "",
    opNettoyage: "",
    presenceNec: "",
    trainConfig: "OUIGO",
    startExtremity: "Extrémité 1",
  };
}

// ─── Localisations photos ────────────────────────────────────────────────────

export const PHOTO_FAMILIES = [
  "Plateforme", "WC", "Réappros WC", "Salle voyageurs",
  "Escalier", "Fourgon", "Local NEC", "Local ASCT", "Nurserie", "Extérieur",
];

export const PHOTO_LOCALIZATIONS = [
  ...["R1", "R2", "R3", "R5", "R6", "R7", "R8"].flatMap((car) => [`Plateforme ${car}B`, `Plateforme ${car}H`]),
  "R4",
  ...["R1", "R2", "R3", "R5", "R6", "R7", "R8"].flatMap((car) => [`WC ${car}B`, `WC ${car}H`]),
  ...["R1", "R2", "R3", "R5", "R6", "R7", "R8"].flatMap((car) => [`Réappros WC ${car}B`, `Réappros WC ${car}H`]),
  ...["R1", "R2", "R3", "R5", "R6", "R7", "R8"].flatMap((car) => [`Salle voyageurs ${car}B`, `Salle voyageurs ${car}H`]),
  ...["R1", "R2", "R3", "R5", "R6", "R7", "R8"].map((car) => `Escalier ${car}`),
  "Fourgon R1",
  "Fourgon R8",
  "Local NEC",
  "Local ASCT",
  "Espace de convivialité R4",
  "Nurserie R7H",
  "Extérieur motrice",
  "Extérieur remorque",
];
