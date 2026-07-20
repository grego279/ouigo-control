import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  createDefaultAssessment,
  DEFAULT_NOTES,
  emptyControl,
  SAMI_COLORS,
  TM_COLORS,
  type Anomaly,
} from "./ouigo-domain";
import { buildMailto, generateEmailDraft, generatePhotoExcel, generateTrackingExcel, generateWordReport } from "./ouigo-exports";

const control = {
  ...emptyControl(new Date("2026-02-17T00:00:00")),
  rame: "793",
  train: "7822",
  agent: "Nouara",
  lieu: "En crochet PMP",
  opNettoyage: "NSY+NWC",
  presenceNec: "Présence NEC",
  tm: "TLG",
};

const valise = [
  { label: "Tige de bambou", checked: true },
  { label: "Lingette anti-tag", checked: false },
];

const anomalies: Anomaly[] = [
  {
    id: "a1",
    zone: "R1",
    level: "H",
    location: "Toilettes",
    element: "WC",
    comment: "Sol humide devant lavabo",
  },
];

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lJxTkwAAAABJRU5ErkJggg==";

function getCellArgb(cell: ExcelJS.Cell): string | undefined {
  const fill = cell.fill;
  if (fill?.type !== "pattern") return undefined;
  return fill.fgColor?.argb;
}

function extractZipEntry(buffer: Buffer, entryName: string): string {
  const endSignature = 0x06054b50;
  let endOffset = -1;
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === endSignature) {
      endOffset = index;
      break;
    }
  }
  if (endOffset < 0) throw new Error("Central directory not found");

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x02014b50) throw new Error("Invalid central directory entry");

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    if (name === entryName) {
      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      const data = compressionMethod === 0 ? compressed : inflateRawSync(compressed);
      return data.toString("utf8");
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error(`Entry ${entryName} not found`);
}

describe("OUIGO Control exports", () => {
  it("génère la ligne Excel de suivi avec les 25 colonnes du fichier global", async () => {
    const attachment = await generateTrackingExcel(control, DEFAULT_NOTES);
    expect(attachment.name).toBe("Ligne_suivi_propreté_793_17_02_2026.xlsx");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await attachment.file.arrayBuffer());
    const sheet = workbook.getWorksheet("ligne suivi propreté");
    expect(sheet).toBeDefined();
    expect(sheet?.getRow(2).cellCount).toBe(25);
    expect(sheet?.getRow(2).getCell(1).value).toBe("TM");
    expect(sheet?.getRow(2).getCell(25).value).toBe("Présence NEC");
    expect(sheet?.getRow(3).getCell(1).value).toBe("TLG");
    expect(sheet?.getRow(3).getCell(2).value).toBe("793");
    expect(sheet?.getRow(3).getCell(3).value).toBe("7822");
    expect(sheet?.getRow(3).getCell(4).value).toBe("NSY+NWC");
    expect(sheet?.getRow(3).getCell(5).value).toBe("En crochet PMP - Premier départ");
    expect(sheet?.getRow(3).getCell(6).value).toBe("Nouara");
    expect(sheet?.getRow(3).getCell(7).value).toBe("17/02/2026");
    expect(sheet?.getRow(3).getCell(24).value).toBe(20);
  });

  it("applique les couleurs TM et SAMI exactes dans l’Excel de suivi", async () => {
    const assessment = createDefaultAssessment();
    assessment.details.moquettePlateforme.note = "A";
    assessment.details.moquetteSalle.note = "M";
    assessment.details.wc.note = "I";
    assessment.exterior.manual = "S";

    const attachment = await generateTrackingExcel(control, DEFAULT_NOTES, assessment, valise);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await attachment.file.arrayBuffer());
    const sheet = workbook.getWorksheet("ligne suivi propreté");

    expect(getCellArgb(sheet!.getCell("A3"))).toBe(TM_COLORS.TLG);
    expect(getCellArgb(sheet!.getCell("H3"))).toBe(SAMI_COLORS.A);
    expect(getCellArgb(sheet!.getCell("I3"))).toBe(SAMI_COLORS.M);
    expect(getCellArgb(sheet!.getCell("Q3"))).toBe(SAMI_COLORS.I);
    expect(getCellArgb(sheet!.getCell("W3"))).toBe(SAMI_COLORS.S);
  });

  it("génère le rapport Word nommé selon le modèle, remplace les marqueurs et n’intègre pas de photo", async () => {
    const attachment = await generateWordReport(control, DEFAULT_NOTES, anomalies, valise);
    expect(attachment.name).toBe("KN1 propreté 793 17_02_2026.docx");
    expect(attachment.file.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(attachment.file.size).toBeGreaterThan(1000);

    const documentXml = extractZipEntry(Buffer.from(await attachment.file.arrayBuffer()), "word/document.xml");
    expect(documentXml).toContain("TLG");
    expect(documentXml).toContain("793");
    expect(documentXml).toContain("7822");
    expect(documentXml).toContain("Nouara");
    expect(documentXml).toContain("Premier départ");
    expect(documentXml).toContain("NSY+NWC");
    expect(documentXml).toContain("En crochet PMP");
    expect(documentXml).toContain("17/02/2026");
    expect(documentXml).toContain("Sol humide devant lavabo");
    expect(documentXml).toContain("Lingette anti-tag");
    expect(documentXml).not.toContain("&gt;TM&lt;");
    expect(documentXml).not.toContain("RRR");
    expect(documentXml).not.toContain("TTTT");
    expect(documentXml).not.toContain("NNN");
    expect(documentXml).not.toContain("TYPE");
    expect(documentXml).not.toContain("OOO");
    expect(documentXml).not.toContain("XX/MM/AAAA");
  });

  it("génère un classeur photos séparé avec localisation automatique", async () => {
    const attachment = await generatePhotoExcel(control, [{ ...anomalies[0], photoDataUrl: tinyPng, photoSizeKb: 1 }]);
    expect(attachment).not.toBeNull();
    expect(attachment?.name).toBe("Photos_Contrôle-propreté_793_17022026.xlsx");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await attachment!.file.arrayBuffer());
    const sheet = workbook.getWorksheet("Photos");
    expect(sheet?.getRow(2).getCell(1).value).toBe("Localisation");
    expect(sheet?.getRow(3).getCell(1).value).toBe("WC R1H");
  });

  it("ne crée pas d’Excel photos lorsqu’aucune anomalie ne contient de photo", async () => {
    await expect(generatePhotoExcel(control, anomalies)).resolves.toBeNull();
  });

  it("prépare un brouillon e-mail .eml avec les pièces jointes générées", async () => {
    const tracking = await generateTrackingExcel(control, DEFAULT_NOTES);
    const draft = await generateEmailDraft(control, "destinataire@sncf.fr", [tracking]);
    const content = await draft.file.text();

    expect(draft.name).toBe("email_controle_proprete_793_17_02_2026.eml");
    expect(draft.file.type).toBe("message/rfc822");
    expect(content).toContain("To: destinataire@sncf.fr");
    expect(content).toContain(`filename=\"${tracking.name}\"`);
    expect(content).toContain("Content-Transfer-Encoding: base64");
  });

  it("prépare un lien mailto de secours avec le destinataire et le sujet du contrôle", () => {
    const href = buildMailto(control, "destinataire@sncf.fr", []);
    expect(decodeURIComponent(href)).toContain("mailto:destinataire@sncf.fr");
    expect(decodeURIComponent(href)).toContain("Contrôle propreté OUIGO rame 793");
  });
});

describe("skippedLabels — rames non observées dans les exports", () => {
  it("KN1 : la ligne évaluation prestation mentionne les numéros de rame non observés", async () => {
    const attachment = await generateWordReport(control, DEFAULT_NOTES, [], [], undefined, ["R3", "R5"]);
    const documentXml = extractZipEntry(Buffer.from(await attachment.file.arrayBuffer()), "word/document.xml");
    expect(documentXml).toContain("Rames non observ");
    expect(documentXml).toContain("R3");
    expect(documentXml).toContain("R5");
  });

  it("KN1 : sans rames non observées, la ligne évaluation ne mentionne pas 'non observées'", async () => {
    const attachment = await generateWordReport(control, DEFAULT_NOTES, [], [], undefined, []);
    const documentXml = extractZipEntry(Buffer.from(await attachment.file.arrayBuffer()), "word/document.xml");
    expect(documentXml).not.toContain("Rames non observ");
  });

  it("Excel suivi : E3 contient le lieu + les rames non observées si skippedLabels est renseigné", async () => {
    const attachment = await generateTrackingExcel(control, DEFAULT_NOTES, undefined, [], ["R2", "R4"]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await attachment.file.arrayBuffer());
    const sheet = workbook.getWorksheet("ligne suivi propreté");
    const e3 = String(sheet?.getCell("E3").value ?? "");
    // E3 doit conserver le lieu + type de contrôle existant
    expect(e3).toContain("Premier départ");
    // Et y ajouter les rames non observées
    expect(e3).toContain("R2");
    expect(e3).toContain("R4");
    expect(e3).toContain("Non observ");
  });

  it("Excel suivi : E3 contient uniquement le lieu si skippedLabels est vide", async () => {
    const attachment = await generateTrackingExcel(control, DEFAULT_NOTES, undefined, [], []);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await attachment.file.arrayBuffer());
    const sheet = workbook.getWorksheet("ligne suivi propreté");
    const e3 = String(sheet?.getCell("E3").value ?? "");
    expect(e3).not.toContain("Non observ");
    // Le lieu du contrôle doit toujours être présent
    expect(e3).toContain("Premier départ");
  });
});
