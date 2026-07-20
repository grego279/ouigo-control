import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  Anomaly,
  ControlAssessment,
  ControlData,
  Notes,
  PhotoEntry,
  SAMI_CATEGORIES,
  SAMI_COLORS,
  SAMI_LABELS,
  SAMI_VALUES,
  TM_COLORS,
  VALISE_NEC_ITEMS,
  ValiseItem,
  buildPresenceNecText,
  controlToExcelRow,
  countSami,
  excelTrackingHeaders,
  formatDateCompact,
  formatDateDisplay,
  formatDateForFilename,
  globalEvaluation,
  missingValiseLabels,
  photoFilename,
  photoLocalization,
  scoreOn20,
  trackingFilename,
  wordFilename,
} from "./ouigo-domain";

export type GeneratedAttachment = {
  name: string;
  file: File;
};

type CellOptions = {
  fill?: string;
  color?: string;
  bold?: boolean;
  width?: number;
  align?: "left" | "center";
};

function stripAlpha(argb: string) {
  return argb.length === 8 ? argb.slice(2) : argb;
}

function docCell(text: string | number, options: CellOptions = {}) {
  return new TableCell({
    shading: options.fill ? { fill: stripAlpha(options.fill) } : undefined,
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 130, bottom: 130, left: 130, right: 130 },
    children: [
      new Paragraph({
        alignment: options.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text: String(text), bold: options.bold, color: options.color ? stripAlpha(options.color) : undefined, size: 20 })],
      }),
    ],
  });
}

function samiDocCell(value: string) {
  const color = ["S", "A", "M", "I"].includes(value) ? SAMI_COLORS[value as keyof typeof SAMI_COLORS] : "FFFFFFFF";
  return docCell(value, { fill: color, bold: true, align: "center" });
}

function title(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text, bold: true, color: "E6007E", size: 32 })],
  });
}

function paragraph(text: string, bold = false) {
  return new Paragraph({ children: [new TextRun({ text, bold, size: 21 })] });
}

function buildAssessmentComment(assessment?: ControlAssessment, key?: keyof ControlAssessment["details"], fallback = "RAS") {
  if (!assessment || !key) return fallback;
  return assessment.details[key].comment.trim() || fallback;
}

function summarizeAnomalies(anomalies: Anomaly[], category: string): string {
  const filtered = anomalies.filter((a) => a.location?.includes(category) || a.zone?.includes(category) || a.element?.includes(category));
  if (!filtered.length) return "RAS";
  return filtered.map((a) => `${a.location ?? a.zone}: ${a.element} — ${a.comment}`).join("; ");
}

function buildVoitureComment(assessment: ControlAssessment | undefined, anomalies: Anomaly[]) {
  const parts = [
    buildAssessmentComment(assessment, "moquetteSalle", ""),
    buildAssessmentComment(assessment, "siege", ""),
    buildAssessmentComment(assessment, "plafond", ""),
    buildAssessmentComment(assessment, "poubelles", ""),
    buildAssessmentComment(assessment, "localAsct", ""),
  ].filter(Boolean);
  const anomalySummary = summarizeAnomalies(anomalies, "Voiture");
  if (anomalySummary !== "RAS") parts.push(anomalySummary);
  return parts.length ? parts.join("\n") : "RAS";
}

// ─── Helpers for the exact Word template layout ─────────────────────────────

/** DXA widths from the original template (8 columns) */
const COL_WIDTHS_DXA = [2067, 2067, 2040, 2040, 1782, 1544, 1231, 1231];

type DocCellOpts = {
  fill?: string;   // 6-char hex (no alpha)
  color?: string;  // 6-char hex
  bold?: boolean;
  size?: number;   // half-points
  colSpan?: number;
  rowSpan?: number;
  align?: "left" | "center" | "right";
  vAlign?: "top" | "center" | "bottom";
  multiline?: string[]; // multiple paragraphs
};

function wCell(text: string, opts: DocCellOpts = {}): TableCell {
  const { fill, color, bold, size = 22, colSpan, rowSpan, align = "left", vAlign = "center", multiline } = opts;
  const paragraphs = (multiline ?? [text]).map(
    (line) =>
      new Paragraph({
        alignment: align === "center" ? AlignmentType.CENTER : align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text: line, bold, color, size })],
      }),
  );
  return new TableCell({
    shading: fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    columnSpan: colSpan,
    rowSpan,
    verticalAlign: vAlign === "center" ? "center" : vAlign === "bottom" ? "bottom" : "top",
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: paragraphs,
  });
}

function samiCell(sami: string): TableCell {
  const fill = ["S", "A", "M", "I"].includes(sami) ? SAMI_COLORS[sami as keyof typeof SAMI_COLORS].slice(2) : "FFFFFF";
  const textColor = sami === "I" ? "FFFFFF" : "000000";
  return wCell(sami, { fill, color: textColor, bold: true, size: 36, colSpan: 2, align: "center", vAlign: "center" });
}

function makeTable(rows: TableRow[]): Table {
  return new Table({
    width: { size: 14002, type: WidthType.DXA },
    columnWidths: COL_WIDTHS_DXA,
    rows,
  });
}

export async function generateWordReport(
  control: ControlData,
  notes: Notes,
  anomalies: Anomaly[],
  valise: ValiseItem[],
  assessment?: ControlAssessment,
  skippedLabels: string[] = [],
): Promise<GeneratedAttachment> {
  const note = scoreOn20(notes);
  const counts = countSami(notes);
  const missingValise = missingValiseLabels(valise);
  const presenceNec = buildPresenceNecText(control, missingValise);

  // ── Build comment strings for each marker ─────────────────────────────────
  const wcComment = buildAssessmentComment(assessment, "wc", "");
  const reapprosPct = assessment?.details.wc.percent ? `${assessment.details.wc.percent}%` : "";
  const hhhh = wcComment || summarizeAnomalies(anomalies, "WC") || "RAS";
  const iiii = reapprosPct ? `Réappros WC moyen : ${reapprosPct}` : "";

  const cccc = buildAssessmentComment(assessment, "moquetteSalle", "");
  const dddd = buildAssessmentComment(assessment, "siege", "");
  const eeee = buildAssessmentComment(assessment, "plafond", "");
  const ffff = buildAssessmentComment(assessment, "poubelles", "");
  const kkkk = buildAssessmentComment(assessment, "localAsct", "");
  const jjjj = assessment?.exterior.comment.trim() || summarizeAnomalies(anomalies, "Extérieur") || "RAS";
  const bbbb = buildAssessmentComment(assessment, "moquettePlateforme", "");
  const gggg = buildAssessmentComment(assessment, "escalier", "");

  const samiWC = notes.WC || "—";
  const samiVoiture = notes.Voitures || "—";
  const samiAsct = notes["Local ASCT"] || "—";
  const samiExt = notes.Extérieur || "—";
  const samiPlateforme = notes.Plateforme || "—";

  // ── Row 8 (Livrée) content ─────────────────────────────────────────────────
  const tmLabel = control.tm || "TM";
  const nnn = control.opNettoyage || "NNN";
  const typeVal = control.controlType || "TYPE";
  const ooo = control.lieu || "OOO";
  const ssss = control.presenceNec || "";
  const qqqq = missingValise.length ? missingValise.join(", ") : "";
  const livreeContent = `${tmLabel} – ${nnn} – ${typeVal} – ${ooo}${ssss ? ` – ${ssss}` : ""}${qqqq ? ` – manque : ${qqqq}` : ""}`;

  // ── Row 7 (Vision Client) detail ───────────────────────────────────────────
  const visionDetail = [
    `Nb Items « Satisfaisant » : ${counts.S}(${counts.S * SAMI_VALUES.S})`,
    `Nb Items « Acceptable » : ${counts.A}(${counts.A * SAMI_VALUES.A})`,
    `Nb Items « Moyen » : ${counts.M}(${counts.M * SAMI_VALUES.M})`,
    `Nb Items « Insuffisant » : ${counts.I}(${counts.I * SAMI_VALUES.I})`,
  ];

  // ── Build the 10-row table ─────────────────────────────────────────────────
  // Row 0: header — cols [0-1] merged vertically (rowSpan 2) | [2-3] "Date" | [4] date | [5] "Rame/Train" | [6] rame/train | [7] config
  // Row 1: (vMerge continue for [0-1]) | [2-4] merged "Satisfaction Client…" | [5-7] merged "Commentaires"
  // Rows 2-6: data rows
  // Row 7: Vision Client
  // Row 8: Livrée
  // Row 9: Évaluation

  const tableRows: TableRow[] = [
    // ── Row 0 ──────────────────────────────────────────────────────────────
    new TableRow({
      children: [
        wCell("Contrôle Propreté", { fill: "D9D9D9", bold: true, size: 22, colSpan: 2, rowSpan: 2, vAlign: "center" }),
        wCell("Date", { fill: "D9D9D9", bold: true, size: 22, colSpan: 2 }),
        wCell(formatDateDisplay(control.date), { fill: "D9D9D9", bold: true, size: 28 }),
        wCell("Rame/Train n°", { fill: "D9D9D9", bold: true, size: 22 }),
        wCell(`${control.rame || "RRR"} / ${control.train || "TTTT"}`, { fill: "D9D9D9", color: "2F5496", size: 22 }),
        wCell(control.trainConfig || "OUIGO", { fill: "D9D9D9", bold: true, size: 28 }),
      ],
    }),
    // ── Row 1 ──────────────────────────────────────────────────────────────
    new TableRow({
      children: [
        // cols 0-1 are continuation of rowSpan from row 0
        wCell("Satisfaction Client (S ou A ou M ou I)", { fill: "D9D9D9", size: 22, colSpan: 3 }),
        wCell("Commentaires", { fill: "D9D9D9", size: 22, colSpan: 3 }),
      ],
    }),
    // ── Row 2: WC ──────────────────────────────────────────────────────────
    new TableRow({
      children: [
        wCell("WC", { bold: true, size: 22, colSpan: 2 }),
        wCell("Sol /cuvette / Lavabo / Accessoires.\n(Savon et Papier WC)", { size: 18 }),
        samiCell(samiWC),
        wCell([hhhh, iiii].filter(Boolean).join("\n") || "RAS", { size: 22, colSpan: 3 }),
      ],
    }),
    // ── Row 3: Voiture R1 à R8 ─────────────────────────────────────────────
    new TableRow({
      children: [
        wCell("Voiture R1 à R8", { bold: true, size: 22, colSpan: 2 }),
        wCell("Sol, Sièges\nTablettes,\nBoite à déchets individuels", { size: 18, rowSpan: 2 }),
        samiCell(samiVoiture),
        wCell([cccc, dddd, eeee, ffff, kkkk].filter(Boolean).join("\n") || "RAS", { size: 22, colSpan: 3, rowSpan: 2 }),
      ],
    }),
    // ── Row 4: Local ASCT ──────────────────────────────────────────────────
    new TableRow({
      children: [
        wCell("Local ASCT", { bold: true, size: 22, colSpan: 2 }),
        // col 2 is rowSpan continuation
        samiCell(samiAsct),
        // cols 5-7 are rowSpan continuation
      ],
    }),
    // ── Row 5: Extérieur ───────────────────────────────────────────────────
    new TableRow({
      children: [
        wCell("Extérieur", { bold: true, size: 22, colSpan: 2 }),
        wCell("Nez /façades /baies/portes", { size: 18 }),
        samiCell(samiExt),
        wCell(jjjj, { size: 22, colSpan: 3 }),
      ],
    }),
    // ── Row 6: Plateforme ──────────────────────────────────────────────────
    new TableRow({
      children: [
        wCell("Plateforme", { bold: true, size: 22, colSpan: 2 }),
        wCell("Sol", { size: 18 }),
        samiCell(samiPlateforme),
        wCell([bbbb, gggg].filter(Boolean).join("\n") || "RAS", { size: 22, colSpan: 3 }),
      ],
    }),
    // ── Row 7: Vision Client Globale Propreté ──────────────────────────────
    new TableRow({
      children: [
        wCell("Vision Client Globale Propreté", { fill: "336699", color: "FFFFFF", bold: true, size: 22, colSpan: 2 }),
        wCell(visionDetail.join("\n"), { fill: "FFFFFF", size: 22, colSpan: 3 }),
        wCell(`NOTE  ${note}/20`, { fill: "0070C0", color: "FFFFFF", bold: true, size: 32, colSpan: 3, align: "center" }),
      ],
    }),
    // ── Row 8: Livrée ──────────────────────────────────────────────────────
    new TableRow({
      children: [
        wCell("Livrée\u00a0:", { fill: "BDD6EE", size: 22 }),
        wCell(livreeContent, { fill: "BDD6EE", size: 22, colSpan: 7 }),
      ],
    }),
    // ── Row 9: Évaluation prestation nettoyage ─────────────────────────────────────────────────────────────────────────────────────────
    new TableRow({
      children: [
        wCell("Évaluation prestation nettoyage\u00a0:", { fill: "BDD6EE", size: 22 }),
        wCell(
          skippedLabels.length > 0
            ? `${globalEvaluation(note)} - Rames non observées : ${skippedLabels.join(", ")}`
            : globalEvaluation(note),
          { fill: "BDD6EE", size: 22, colSpan: 7 }
        ),
      ],
    }),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, bottom: 720, left: 1418, right: 1418 },
          },
        },
        children: [
          title(`KN1 propreté ${control.rame || "RRR"} ${formatDateDisplay(control.date)}`),
          paragraph(`Contrôleur : ${control.agent || "Nom contrôleur"} | TM : ${control.tm || "TM"} | Train : ${control.train || "TTTT"}`),
          makeTable(tableRows),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const name = wordFilename(control);
  return { name, file: new File([blob], name, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }) };
}

function setSamiCellStyle(cell: ExcelJS.Cell, value: unknown) {
  const key = String(value || "").trim() as keyof typeof SAMI_COLORS;
  if (key in SAMI_COLORS) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SAMI_COLORS[key] } };
    cell.font = { bold: true, color: { argb: key === "I" ? "FFFFFFFF" : "FF000000" } };
  }
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
}

function applyNote(cell: ExcelJS.Cell, note: string) {
  if (note.trim()) {
    cell.note = { texts: [{ text: note.trim() }] } as unknown as ExcelJS.Cell["note"];
  }
}

export async function generateTrackingExcel(control: ControlData, notes: Notes, assessment?: ControlAssessment, valise: ValiseItem[] = [], skippedLabels: string[] = []): Promise<GeneratedAttachment> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ligne suivi propreté");
  const headers = excelTrackingHeaders();
  sheet.addRow([`Ligne Excel suivi propreté rame ${control.rame || "XXX"} - ${formatDateDisplay(control.date)}`]);
  sheet.mergeCells(1, 1, 1, headers.length);
  sheet.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6007E" } };
  sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  sheet.addRow(headers);
  sheet.addRow(controlToExcelRow(control, notes, assessment));

  sheet.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00A9B7" } };
  sheet.getRow(2).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  sheet.getRow(3).height = 35;

  const tmColor = TM_COLORS[control.tm.toUpperCase()];
  if (tmColor) sheet.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: tmColor } };
  for (let col = 8; col <= 23; col += 1) setSamiCellStyle(sheet.getRow(3).getCell(col), sheet.getRow(3).getCell(col).value);
  setSamiCellStyle(sheet.getCell("W3"), assessment?.exterior.manual ?? notes.Extérieur);
  sheet.getCell("X3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6007E" } };
  sheet.getCell("X3").font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getCell("Y3").value = buildPresenceNecText(control, missingValiseLabels(valise));
  sheet.getCell("Y3").alignment = { wrapText: true, vertical: "middle" };
  if (skippedLabels.length > 0) {
    // Reconstruire la valeur de E3 depuis control (lieu + type) pour éviter de lire une cellule non matérialisée
    const lieuControlType = `${control.lieu} - ${control.controlType}`;
    sheet.getCell("E3").value = `${lieuControlType} - Non observées : ${skippedLabels.join(", ")}`;
    sheet.getCell("E3").alignment = { wrapText: true, vertical: "middle" };
  }

  if (assessment) {
    Object.values(assessment.details).forEach((detail) => {
      detail.excelColumns.forEach((column) => applyNote(sheet.getCell(`${column}3`), detail.comment));
    });
    applyNote(sheet.getCell("W3"), assessment.exterior.comment);
  }

  sheet.columns.forEach((column, index) => {
    column.width = index <= 6 ? 17 : index === 24 ? 38 : 15;
    column.alignment = { vertical: "middle", horizontal: index >= 7 && index <= 23 ? "center" : "left", wrapText: true };
  });
  sheet.views = [{ state: "frozen", ySplit: 2 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const name = trackingFilename(control);
  return { name, file: new File([buffer], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
}

function dataUrlToExtension(dataUrl: string): "png" | "jpeg" {
  return dataUrl.startsWith("data:image/png") ? "png" : "jpeg";
}

function normalizePhotos(anomaliesOrPhotos: Array<Anomaly | PhotoEntry>): PhotoEntry[] {
  return anomaliesOrPhotos
    .filter((entry) => Boolean(entry.photoDataUrl))
    .map((entry) => {
      if ("localization" in entry) return entry;
      return {
        id: entry.id,
        localization: photoLocalization(entry),
        comment: entry.comment,
        photoDataUrl: entry.photoDataUrl,
        photoName: entry.photoName,
        photoSizeKb: entry.photoSizeKb,
      };
    });
}

export async function generatePhotoExcel(control: ControlData, anomaliesOrPhotos: Array<Anomaly | PhotoEntry>): Promise<GeneratedAttachment | null> {
  const photos = normalizePhotos(anomaliesOrPhotos);
  if (!photos.length) return null;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Photos");
  sheet.addRow([`Photos du contrôle de la rame ${control.rame || "XXX"} réalisé le ${formatDateDisplay(control.date)}`]);
  sheet.mergeCells("A1:C1");
  sheet.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6007E" } };
  sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  sheet.addRow(["Localisation", "Commentaire", "Photo"]);
  sheet.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00A9B7" } };
  sheet.columns = [{ width: 34 }, { width: 52 }, { width: 34 }];

  photos.forEach((photo, index) => {
    const rowIndex = index + 3;
    sheet.addRow([photo.localization, photo.comment, ""]);
    sheet.getRow(rowIndex).height = 135;
    if (photo.photoDataUrl) {
      const imageId = workbook.addImage({ base64: photo.photoDataUrl, extension: dataUrlToExtension(photo.photoDataUrl) });
      sheet.addImage(imageId, {
        tl: { col: 2.12, row: rowIndex - 0.86 },
        ext: { width: 175, height: 125 },
        editAs: "oneCell",
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const name = photoFilename(control);
  return { name, file: new File([buffer], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
}

export async function generateAllAttachments(
  control: ControlData,
  notes: Notes,
  anomalies: Anomaly[],
  valise: ValiseItem[],
  assessment?: ControlAssessment,
  photos: PhotoEntry[] = [],
  skippedLabels: string[] = [],
): Promise<GeneratedAttachment[]> {
  const attachments = [
    await generateWordReport(control, notes, anomalies, valise, assessment, skippedLabels),
    await generateTrackingExcel(control, notes, assessment, valise, skippedLabels),
  ];
  const photoExcel = await generatePhotoExcel(control, photos.length ? photos : anomalies);
  if (photoExcel) attachments.push(photoExcel);
  return attachments;
}

export function downloadAttachments(attachments: GeneratedAttachment[]) {
  attachments.forEach((attachment) => saveAs(attachment.file, attachment.name));
}

function emailSubject(control: ControlData): string {
  return `Contrôle propreté OUIGO rame ${control.rame || "XXX"} du ${formatDateForFilename(control.date)}`;
}

function emailBody(control: ControlData, attachments: GeneratedAttachment[]): string {
  return [
    `Bonjour,`,
    ``,
    `Veuillez trouver les fichiers du contrôle propreté OUIGO de la rame ${control.rame || "XXX"}, train ${control.train || "XXXX"}.`,
    ``,
    `Fichiers en PJ :`,
    ...attachments.map((attachment) => `- ${attachment.name}`),
    ``,
    `Cordialement,`,
    ``,
    control.agent || "Nom contrôleur",
  ].join("\n");
}

export function buildMailto(control: ControlData, recipient: string, attachments: GeneratedAttachment[]): string {
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(emailSubject(control))}&body=${encodeURIComponent(emailBody(control, attachments))}`;
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(binary).replace(/(.{76})/g, "$1\r\n");
}

export async function generateEmailDraft(control: ControlData, recipient: string, attachments: GeneratedAttachment[]): Promise<GeneratedAttachment> {
  const boundary = `ouigo-control-${Date.now()}`;
  const lines = [
    `To: ${recipient}`,
    `Subject: ${emailSubject(control)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    emailBody(control, attachments),
  ];

  for (const attachment of attachments) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${attachment.file.type || "application/octet-stream"}; name="${attachment.name}"`,
      `Content-Disposition: attachment; filename="${attachment.name}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      await fileToBase64(attachment.file),
    );
  }

  lines.push(`--${boundary}--`, ``);
  const name = `email_controle_proprete_${control.rame || "XXX"}_${formatDateForFilename(control.date)}.eml`;
  const file = new File([lines.join("\r\n")], name, { type: "message/rfc822" });
  return { name, file };
}

export async function shareAttachmentsIfSupported(attachments: GeneratedAttachment[]): Promise<boolean> {
  if (typeof navigator === "undefined" || !("canShare" in navigator) || !("share" in navigator)) return false;
  if (!navigator.canShare({ files: attachments.map((attachment) => attachment.file) })) return false;
  await navigator.share({
    title: "Contrôle propreté OUIGO",
    text: "Fichiers de contrôle propreté OUIGO",
    files: attachments.map((attachment) => attachment.file),
  });
  return true;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Compression image impossible."))), "image/jpeg", quality);
  });
}

export async function compressImageToDataUrl(file: File, maxKb = 250): Promise<{ dataUrl: string; sizeKb: number }> {
  const originalDataUrl = await fileToDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const canvas = document.createElement("canvas");
  const maxSide = 1400;
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible pour la compression photo.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.86;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size / 1024 > maxKb && quality > 0.3) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }

  let workingCanvas = canvas;
  while (blob.size / 1024 > maxKb && Math.max(workingCanvas.width, workingCanvas.height) > 360) {
    const smaller = document.createElement("canvas");
    smaller.width = Math.max(1, Math.round(workingCanvas.width * 0.72));
    smaller.height = Math.max(1, Math.round(workingCanvas.height * 0.72));
    const smallerCtx = smaller.getContext("2d");
    if (!smallerCtx) throw new Error("Canvas indisponible pour la compression photo.");
    smallerCtx.drawImage(workingCanvas, 0, 0, smaller.width, smaller.height);
    workingCanvas = smaller;
    quality = 0.58;
    blob = await canvasToBlob(workingCanvas, quality);
    while (blob.size / 1024 > maxKb && quality > 0.22) {
      quality -= 0.06;
      blob = await canvasToBlob(workingCanvas, quality);
    }
  }

  if (blob.size / 1024 > maxKb) {
    throw new Error(`La photo reste supérieure à ${maxKb} Ko après compression. Reprenez une photo moins lourde ou recadrez-la.`);
  }

  const dataUrl = await fileToDataUrl(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
  return { dataUrl, sizeKb: Math.round(blob.size / 1024) };
}
