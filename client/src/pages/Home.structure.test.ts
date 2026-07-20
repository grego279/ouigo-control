import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const domainSource = readFileSync(resolve(process.cwd(), "client/src/lib/ouigo-domain.ts"), "utf8");
const combinedSource = `${homeSource}\n${domainSource}`;
describe("OUIGO Control mobile-first structure", () => {
  it("branche le logo OUIGO Control fourni et les six entrées de navigation demandées", () => {
    // Le logo est stocké sous le nom uploadé (avec hash) — on vérifie juste la présence de manus-storage
    expect(homeSource).toContain("/manus-storage/");
    expect(homeSource).toContain("OUIGOControl");
    ["Accueil", "Aspect extérieur", "Aspect intérieur", "SAMI intérieur", "Photos", "Export"].forEach((label) => {
      expect(homeSource).toContain(label);
    });
  });
  it("expose les champs d'accueil nécessaires au mapping Excel A à G", () => {
    [
      "TM",
      "Numéro de rame",
      "Numéro train",
      "OP de nettoyage",
      "Lieu du contrôle",
      "Nom du contrôleur",
      "Date",
    ].forEach((label) => {
      expect(homeSource).toContain(label);
    });
  });
  it("décrit les contrôles extérieur, intérieur OUIGO/TANGO et SAMI intérieur détaillé", () => {
    [
      "Motrices",
      "remorques",
      "baies vitrées",
      "portes",
      "OUIGO",
      "TANGO",
      "extrémité",
      "Plateforme",
      "Salle",
      "Siège",
      "Plafond",
      "Poubelles",
      "Graffitis",
      "Nuisibles",
      "Escalier",
      "WC",
    ].forEach((label) => {
      expect(combinedSource).toContain(label);
    });
  });
});
