import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTES,
  DETAIL_DEFINITIONS,
  EXTERIOR_ITEMS,
  INTERIOR_SEQUENCE_EXTREMITY_1,
  INTERIOR_SEQUENCE_EXTREMITY_2,
  allowedLevelsForZone,
  computeExterior,
  computeNotesFromAssessment,
  controlToExcelRow,
  createDefaultAssessment,
  emptyControl,
  photoLocalization,
  scoreOn20,
  validateAnomaly,
  validateControl,
  wordFilename,
  type Anomaly,
  type Notes,
} from "./ouigo-domain";

describe("OUIGO Control domain rules", () => {
  it("calcule la note SAMI finale sur 20", () => {
    const notes: Notes = {
      WC: "S",
      Voitures: "A",
      "Local ASCT": "M",
      Extérieur: "I",
      Plateforme: "S",
    };

    expect(scoreOn20(notes)).toBe(12);
    expect(scoreOn20(DEFAULT_NOTES)).toBe(20);
  });

  it("valide les champs obligatoires du contrôle terrain", () => {
    const invalid = emptyControl(new Date("2026-02-17T00:00:00"));
    expect(validateControl(invalid)).toContain("Le numéro de rame doit contenir exactement 3 chiffres.");
    expect(validateControl(invalid)).toContain("Le numéro train / sillon doit contenir exactement 4 chiffres.");

    const valid = {
      ...invalid,
      rame: "793",
      train: "7822",
      agent: "Nouara",
      lieu: "Départ PMP",
      opNettoyage: "NSY+NWC",
      tm: "TLG",
    };
    expect(validateControl(valid)).toEqual([]);
    expect(wordFilename(valid)).toBe("KN1 propreté 793 17_02_2026.docx");
  });

  it("applique la règle R4 haut uniquement", () => {
    expect(allowedLevelsForZone("R4")).toEqual(["H"]);

    const anomaly: Anomaly = {
      id: "a1",
      zone: "R4",
      level: "B",
      location: "Salle voyageurs",
      element: "Moquette",
      comment: "Saleté visible",
    };

    expect(validateAnomaly(anomaly)).toContain("R4 est contrôlée uniquement au niveau haut.");
  });

  it("produit la localisation automatique des photos", () => {
    const anomaly: Anomaly = {
      id: "a2",
      zone: "R2",
      level: "B",
      location: "Salle voyageurs",
      element: "Têtière",
      place: "201",
      comment: "Têtière tachée",
    };

    expect(photoLocalization(anomaly)).toBe("Têtière R2B place 201");
  });

  it("génère une ligne Excel compatible avec les colonnes de suivi", () => {
    const control = {
      ...emptyControl(new Date("2026-02-17T00:00:00")),
      rame: "793",
      train: "7822",
      agent: "Luc",
      lieu: "Départ PLY",
      opNettoyage: "NNO+NWC",
      presenceNec: "Présence NEC",
      tm: "PD",
    };

    const row = controlToExcelRow(control, DEFAULT_NOTES);
    expect(row).toHaveLength(25);
    expect(row[0]).toBe("PD");
    expect(row[1]).toBe("793");
    expect(row[2]).toBe("7822");
    expect(row[3]).toBe("NNO+NWC");
    expect(row[4]).toBe("Départ PLY - Premier départ");
    expect(row[5]).toBe("Luc");
    expect(row[6]).toBe("17/02/2026");
    expect(row[23]).toBe(20);
    expect(row[24]).toBe("Présence NEC");
  });

  it("décrit explicitement les structures Aspect extérieur, intérieur et SAMI détaillé", () => {
    expect(EXTERIOR_ITEMS).toEqual(expect.arrayContaining(["Motrice 1", "Motrice 2", "Remorque R1", "Baie vitrée R8"]));
    expect(INTERIOR_SEQUENCE_EXTREMITY_1[0]).toBe("Plateforme R1B");
    expect(INTERIOR_SEQUENCE_EXTREMITY_1).toContain("Local NEC");
    expect(INTERIOR_SEQUENCE_EXTREMITY_1).toContain("Nurserie R7H");
    expect(INTERIOR_SEQUENCE_EXTREMITY_1.at(-1)).toBe("Fourgon R8");
    // EXT2 est une séquence indépendante (pas l'inverse exact de EXT1 — les R3/R2/R1 ont un ordre différent)
    expect(INTERIOR_SEQUENCE_EXTREMITY_2[0]).toBe("Plateforme R8B");
    expect(INTERIOR_SEQUENCE_EXTREMITY_2.at(-1)).toBe("Fourgon R1");
    expect(INTERIOR_SEQUENCE_EXTREMITY_2).toContain("Local NEC");
    expect(INTERIOR_SEQUENCE_EXTREMITY_2).toContain("Nurserie R7H");

    const detailCodes = DETAIL_DEFINITIONS.map((definition) => definition.code);
    expect(detailCodes).toEqual([
      "moquettePlateforme",
      "moquetteSalle",
      "siege",
      "plafond",
      "poubelles",
      "graffitis",
      "nuisibles",
      "escalier",
      "wc",
      "localAsct",
      "localNec",
      "fourgon",
    ]);
    expect(DETAIL_DEFINITIONS.find((definition) => definition.code === "wc")?.excelColumns).toEqual(["Q"]);
    expect(DETAIL_DEFINITIONS.find((definition) => definition.code === "localNec")?.excelColumns).toEqual(["U"]);
  });

  it("calcule les propositions SAMI modifiables depuis les contrôles extérieur et intérieur", () => {
    const exterior = computeExterior({ "Motrice 1": true, "Motrice 2": true, "Remorque R1": false, "Porte R1": false });
    expect(exterior).toEqual({ ok: 2, total: 4, percent: 50, sami: "A" });

    const assessment = createDefaultAssessment();
    assessment.exterior.manual = "M";
    assessment.details.wc.note = "I";
    assessment.details.localAsct.note = "A";
    assessment.details.moquettePlateforme.note = "M";
    assessment.details.moquetteSalle.note = "S";
    assessment.details.siege.note = "A";
    assessment.details.plafond.note = "M";
    assessment.details.poubelles.note = "I";

    expect(computeNotesFromAssessment(assessment)).toEqual({
      WC: "I",
      Voitures: "A",
      "Local ASCT": "A",
      Extérieur: "M",
      Plateforme: "M",
    });
  });
});
