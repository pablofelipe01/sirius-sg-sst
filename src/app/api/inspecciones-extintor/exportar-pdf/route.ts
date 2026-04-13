import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

// ══════════════════════════════════════════════════════════
// AES-256-CBC Decryption para firmas
// ══════════════════════════════════════════════════════════
const AES_SECRET = process.env.AES_SIGNATURE_SECRET || "";

function decryptAES(encryptedStr: string): string | null {
  try {
    if (!encryptedStr || !AES_SECRET) return null;
    const [ivB64, encB64] = encryptedStr.split(":");
    if (!ivB64 || !encB64) return null;

    const key = crypto.createHash("sha256").update(AES_SECRET).digest();
    const iv = Buffer.from(ivB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    let decrypted = decipher.update(encB64, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

function extractSignatureDataUrl(encryptedFirma: string | undefined): string | null {
  if (!encryptedFirma) return null;
  const decrypted = decryptAES(encryptedFirma);
  if (!decrypted) return null;
  try {
    const firmaData = JSON.parse(decrypted);
    return firmaData.signature || null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

interface DetalleExtintor {
  id: string;
  extintorNombre: string;
  presion: string;
  selloGarantia: string;
  manometro: string;
  estadoCilindro: string;
  manija: string;
  boquillaManguera: string;
  anilloSeguridad: string;
  pinSeguridad: string;
  pintura: string;
  tarjetaInspeccion: string;
  observaciones: string;
  // Info snapshot
  claseAgente: string;
  tipoExtintor: string;
  capacidad: string;
  fechaProximaRecarga: string;
}

interface Responsable {
  id: string;
  tipo: string;
  nombre: string;
  cargo: string;
  firmado: boolean;
  fechaFirma: string;
}

interface InspeccionCompleta {
  recordId: string;
  idInspeccion: string;
  fecha: string;
  inspector: string;
  cargoInspector: string;
  estado: string;
  observaciones: string;
  detalles: DetalleExtintor[];
  responsables: Responsable[];
}

// ══════════════════════════════════════════════════════════
// Colores (RGB)
// ══════════════════════════════════════════════════════════
const COLORS = {
  HEADER_BLUE: [141, 180, 226] as [number, number, number],
  WHITE: [255, 255, 255] as [number, number, number],
  BLACK: [0, 0, 0] as [number, number, number],
  LIGHT_GRAY: [242, 242, 242] as [number, number, number],
  CAT_BLUE: [68, 114, 196] as [number, number, number],
};

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════
async function fetchAllRecords(
  url: string,
  headers: HeadersInit,
  extraParams: Record<string, string> = {}
): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({
      pageSize: "100",
      returnFieldsByFieldId: "true",
      ...extraParams,
    });
    if (offset) params.set("offset", offset);

    const res = await fetch(`${url}?${params.toString()}`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`);
    const data: AirtableResponse = await res.json();
    all.push(...data.records);
    offset = data.offset;
  } while (offset);

  return all;
}

function formatFechaLarga(iso: string | undefined | null): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    return date.toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ══════════════════════════════════════════════════════════
// Generar PDF de inspección de extintor
// ══════════════════════════════════════════════════════════
function generarPDFInspeccion(insp: InspeccionCompleta, logoBase64: string | null): Buffer {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // ═══════════════════════════════════════════════════════
  // ENCABEZADO INSTITUCIONAL
  // ═══════════════════════════════════════════════════════
  const headerHeight = 22;
  const logoWidth = 40;
  const codigoWidth = 55;
  const empresaWidth = contentWidth - logoWidth - codigoWidth;

  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, headerHeight, "F");
  doc.setDrawColor(...COLORS.BLACK);
  doc.rect(margin, currentY, contentWidth, headerHeight, "S");

  doc.setFillColor(...COLORS.WHITE);
  doc.rect(margin, currentY, logoWidth, headerHeight, "F");
  doc.rect(margin, currentY, logoWidth, headerHeight, "S");
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin + 5, currentY + 3, 30, 16);
    } catch { /* ignore */ }
  }

  const empresaX = margin + logoWidth;
  doc.rect(empresaX, currentY, empresaWidth, headerHeight / 3, "S");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.BLACK);
  doc.text("SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC", empresaX + empresaWidth / 2, currentY + 5, { align: "center" });

  doc.rect(empresaX, currentY + headerHeight / 3, empresaWidth, headerHeight / 3, "S");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("NIT: 901.377.064-8", empresaX + empresaWidth / 2, currentY + headerHeight / 3 + 4.5, { align: "center" });

  doc.rect(empresaX, currentY + 2 * headerHeight / 3, empresaWidth, headerHeight / 3, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("FORMATO INSPECCIÓN DE EXTINTORES", empresaX + empresaWidth / 2, currentY + 2 * headerHeight / 3 + 5, { align: "center" });

  const codigoX = margin + logoWidth + empresaWidth;
  doc.rect(codigoX, currentY, codigoWidth, headerHeight / 3, "S");
  doc.setFontSize(8);
  doc.text("CÓDIGO: FT-SST-066", codigoX + codigoWidth / 2, currentY + 5, { align: "center" });

  doc.rect(codigoX, currentY + headerHeight / 3, codigoWidth, headerHeight / 3, "S");
  doc.setFont("helvetica", "normal");
  doc.text("VERSIÓN: 001", codigoX + codigoWidth / 2, currentY + headerHeight / 3 + 4.5, { align: "center" });

  doc.rect(codigoX, currentY + 2 * headerHeight / 3, codigoWidth, headerHeight / 3, "S");
  doc.setFontSize(7);
  doc.text("FECHA: 02-02-2026", codigoX + codigoWidth / 2, currentY + 2 * headerHeight / 3 + 5, { align: "center" });

  currentY += headerHeight + 5;

  // ═══════════════════════════════════════════════════════
  // DATOS DE LA INSPECCIÓN
  // ═══════════════════════════════════════════════════════
  const rowHeight = 8;
  const col1Width = contentWidth * 0.20;
  const col2Width = contentWidth * 0.30;
  const col3Width = contentWidth * 0.20;
  const col4Width = contentWidth * 0.30;

  // Fila 1: Fecha | Inspector
  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin, currentY, col1Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.WHITE);
  doc.rect(margin + col1Width, currentY, col2Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin + col1Width + col2Width, currentY, col3Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.WHITE);
  doc.rect(margin + col1Width + col2Width + col3Width, currentY, col4Width, rowHeight, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("FECHA INSPECCIÓN:", margin + 2, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(formatFechaLarga(insp.fecha), margin + col1Width + col2Width / 2, currentY + 5.5, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text("INSPECTOR:", margin + col1Width + col2Width + 2, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(insp.inspector.length > 30 ? 6 : 7);
  doc.text(insp.inspector, margin + col1Width + col2Width + col3Width + col4Width / 2, currentY + 5.5, { align: "center" });
  currentY += rowHeight;

  // Fila 2: Cargo | Estado
  doc.setFontSize(8);
  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin, currentY, col1Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.WHITE);
  doc.rect(margin + col1Width, currentY, col2Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin + col1Width + col2Width, currentY, col3Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.WHITE);
  doc.rect(margin + col1Width + col2Width + col3Width, currentY, col4Width, rowHeight, "FD");

  doc.setFont("helvetica", "bold");
  doc.text("CARGO:", margin + 2, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(insp.cargoInspector || "", margin + col1Width + col2Width / 2, currentY + 5.5, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text("ESTADO:", margin + col1Width + col2Width + 2, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(insp.estado, margin + col1Width + col2Width + col3Width + col4Width / 2, currentY + 5.5, { align: "center" });
  currentY += rowHeight + 5;

  // ═══════════════════════════════════════════════════════
  // TABLA DE DETALLES POR EXTINTOR
  // ═══════════════════════════════════════════════════════

  if (insp.detalles.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No se registraron extintores en esta inspección", margin + contentWidth / 2, currentY + 10, { align: "center" });
    currentY += 20;
  } else {
    const head = [[
      { content: "Extintor", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "Presión", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "Sello", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "Manómetro", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "Cilindro", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "Manija", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "Boquilla", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "Anillo Seg.", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "Pin Seg.", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "Pintura", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "Tarjeta", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
    ]];

    const body = insp.detalles.map((det) => {
      const rowArr: (string | { content: string; styles?: object })[] = [
        det.extintorNombre,
      ];

      const criterios = [
        det.presion,
        det.selloGarantia,
        det.manometro,
        det.estadoCilindro,
        det.manija,
        det.boquillaManguera,
        det.anilloSeguridad,
        det.pinSeguridad,
        det.pintura,
        det.tarjetaInspeccion,
      ];

      criterios.forEach((val) => {
        const styles: Record<string, unknown> = { halign: "center" as const };
        if (val === "Bueno" || val === "Sí") styles.textColor = [0, 128, 0];
        if (val === "Malo" || val === "No") styles.textColor = [200, 0, 0];
        rowArr.push({ content: val || "", styles });
      });

      return rowArr;
    });

    autoTable(doc, {
      startY: currentY,
      head,
      body,
      headStyles: {
        fillColor: COLORS.HEADER_BLUE,
        textColor: COLORS.BLACK,
        fontStyle: "bold",
        fontSize: 6,
      },
      bodyStyles: {
        fontSize: 6,
        textColor: COLORS.BLACK,
      },
      alternateRowStyles: {
        fillColor: COLORS.LIGHT_GRAY,
      },
      tableLineColor: COLORS.BLACK,
      tableLineWidth: 0.1,
      margin: { left: margin, right: margin },
      theme: "grid",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentY = (doc as any).lastAutoTable.finalY + 5;

    // ═══════════════════════════════════════════════════════
    // INFORMACIÓN DETALLADA POR EXTINTOR
    // ═══════════════════════════════════════════════════════
    doc.setFillColor(...COLORS.CAT_BLUE);
    doc.rect(margin, currentY, contentWidth, 7, "FD");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.WHITE);
    doc.text("INFORMACIÓN DETALLADA DE EXTINTORES", margin + contentWidth / 2, currentY + 5, { align: "center" });
    doc.setTextColor(...COLORS.BLACK);
    currentY += 7;

    insp.detalles.forEach((det, idx) => {
      if (currentY + 30 > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
      }

      // Título del extintor
      doc.setFillColor(46, 125, 50);
      doc.rect(margin, currentY, contentWidth, 6, "FD");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.WHITE);
      doc.text(`${idx + 1}. ${det.extintorNombre}`, margin + 2, currentY + 4.5);
      doc.setTextColor(...COLORS.BLACK);
      currentY += 6;

      // Info snapshot
      doc.setFillColor(...COLORS.LIGHT_GRAY);
      doc.rect(margin, currentY, contentWidth, 6, "FD");
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const info = `Clase/Agente: ${det.claseAgente} | Tipo: ${det.tipoExtintor} | Capacidad: ${det.capacidad} | Próxima Recarga: ${formatFechaLarga(det.fechaProximaRecarga)}`;
      doc.text(info, margin + 2, currentY + 4);
      currentY += 6;

      // Observaciones
      if (det.observaciones) {
        doc.setFillColor(...COLORS.WHITE);
        doc.rect(margin, currentY, contentWidth, 8, "FD");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("Observaciones:", margin + 2, currentY + 3);
        doc.setFont("helvetica", "normal");
        doc.text(det.observaciones, margin + 2, currentY + 6, { maxWidth: contentWidth - 4 });
        currentY += 8;
      }

      currentY += 2;
    });
  }

  // ═══════════════════════════════════════════════════════
  // OBSERVACIONES GENERALES
  // ═══════════════════════════════════════════════════════
  if (insp.observaciones) {
    if (currentY + 20 > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFillColor(...COLORS.HEADER_BLUE);
    doc.rect(margin, currentY, contentWidth, 7, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.BLACK);
    doc.text("OBSERVACIONES GENERALES", margin + contentWidth / 2, currentY + 5, { align: "center" });
    currentY += 7;

    doc.setFillColor(...COLORS.WHITE);
    doc.rect(margin, currentY, contentWidth, 12, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(insp.observaciones, margin + 3, currentY + 5, { maxWidth: contentWidth - 6 });
    currentY += 14;
  }

  // ═══════════════════════════════════════════════════════
  // RESPONSABLES Y FIRMAS
  // ═══════════════════════════════════════════════════════
  if (currentY + 60 > pageHeight - margin) {
    doc.addPage();
    currentY = margin;
  }

  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, 7, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.BLACK);
  doc.text("RESPONSABLES Y FIRMAS", margin + contentWidth / 2, currentY + 5, { align: "center" });
  currentY += 7;

  const firmaWidth = contentWidth / Math.max(insp.responsables.length, 1);
  const firmaBoxHeight = 22;
  const firmaInfoHeight = 14;

  insp.responsables.forEach((resp, idx) => {
    const x = margin + idx * firmaWidth;

    // Cuadro para firma
    doc.setDrawColor(...COLORS.BLACK);
    doc.setFillColor(...COLORS.WHITE);
    doc.rect(x, currentY, firmaWidth, firmaBoxHeight, "FD");

    // Título de firma
    doc.setFillColor(...COLORS.HEADER_BLUE);
    doc.rect(x, currentY + firmaBoxHeight, firmaWidth, 8, "FD");
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.BLACK);
    doc.text(`FIRMA ${resp.tipo.toUpperCase()}`, x + firmaWidth / 2, currentY + firmaBoxHeight + 5, { align: "center" });

    // Info del firmante
    doc.setFillColor(...COLORS.WHITE);
    doc.rect(x, currentY + firmaBoxHeight + 8, firmaWidth, firmaInfoHeight, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    const infoY = currentY + firmaBoxHeight + 11;

    doc.text("NOMBRE:", x + 2, infoY);
    doc.setFont("helvetica", "normal");
    const nombreText = resp.nombre || "(Sin firmar)";
    doc.setFontSize(nombreText.length > 25 ? 5 : 6);
    doc.text(nombreText, x + 2, infoY + 3.5);

    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.text("CARGO:", x + 2, infoY + 7);
    doc.setFont("helvetica", "normal");
    const cargoText = resp.cargo;
    doc.setFontSize(cargoText.length > 25 ? 5 : 6);
    doc.text(cargoText, x + 2, infoY + 10);
  });

  return Buffer.from(doc.output("arraybuffer"));
}

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-extintor/exportar-pdf
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const { idInspeccion } = await request.json();

    const {
      inspExtintorFields,
      detalleExtintorFields,
      infoExtintorFields,
      respExtintorFields,
      extintoresFields,
    } = airtableSGSSTConfig;

    // ── 1. Obtener inspección ───────────────────────────
    const url = getSGSSTUrl(airtableSGSSTConfig.inspExtintorTableId);
    const extraParams: Record<string, string> = {};

    if (idInspeccion) {
      extraParams.filterByFormula = `{${inspExtintorFields.ID}} = '${idInspeccion}'`;
    }

    const cabeceraRecords = await fetchAllRecords(url, getSGSSTHeaders(), extraParams);

    if (cabeceraRecords.length === 0) {
      return NextResponse.json(
        { success: false, message: "No hay inspecciones para exportar" },
        { status: 400 }
      );
    }

    const inspRecord = cabeceraRecords[0];

    // ── 2. Obtener detalles ─────────────────────────────
    const detalleUrl = getSGSSTUrl(airtableSGSSTConfig.detalleExtintorTableId);
    const detalleFilter = `FIND('${inspRecord.id}', {${detalleExtintorFields.INSPECCION_LINK}}) > 0`;
    const detalleRecords = await fetchAllRecords(detalleUrl, getSGSSTHeaders(), { filterByFormula: detalleFilter });

    // ── 3. Obtener nombres de extintores ────────────────
    const extintorIds = detalleRecords
      .map((r) => (r.fields[detalleExtintorFields.EXTINTOR_LINK] as string[])?.[0])
      .filter(Boolean) as string[];

    const extintorNames: Record<string, string> = {};
    const uniqueExtintorIds = [...new Set(extintorIds)];

    for (let i = 0; i < uniqueExtintorIds.length; i += 10) {
      const batch = uniqueExtintorIds.slice(i, i + 10);
      const formula = `OR(${batch.map((eid) => `RECORD_ID()='${eid}'`).join(",")})`;
      const eqParams = new URLSearchParams({
        filterByFormula: formula,
        returnFieldsByFieldId: "true",
      });

      const eqRes = await fetch(
        `${getSGSSTUrl(airtableSGSSTConfig.extintoresTableId)}?${eqParams.toString()}`,
        { headers: getSGSSTHeaders(), cache: "no-store" }
      );

      if (eqRes.ok) {
        const eqData: AirtableResponse = await eqRes.json();
        eqData.records.forEach((r) => {
          extintorNames[r.id] = (r.fields[extintoresFields.NOMBRE] as string) || (r.fields[extintoresFields.CODIGO] as string) || "";
        });
      }
    }

    // ── 4. Obtener info snapshots ───────────────────────
    const snapshotIds = detalleRecords
      .map((r) => (r.fields[detalleExtintorFields.INFO_SNAPSHOT_LINK] as string[])?.[0])
      .filter(Boolean) as string[];

    const snapshotInfo: Record<string, { claseAgente: string; tipoExtintor: string; capacidad: string; fechaProximaRecarga: string }> = {};
    const uniqueSnapshotIds = [...new Set(snapshotIds)];

    for (let i = 0; i < uniqueSnapshotIds.length; i += 10) {
      const batch = uniqueSnapshotIds.slice(i, i + 10);
      const formula = `OR(${batch.map((sid) => `RECORD_ID()='${sid}'`).join(",")})`;
      const snapParams = new URLSearchParams({
        filterByFormula: formula,
        returnFieldsByFieldId: "true",
      });

      const snapRes = await fetch(
        `${getSGSSTUrl(airtableSGSSTConfig.infoExtintorTableId)}?${snapParams.toString()}`,
        { headers: getSGSSTHeaders(), cache: "no-store" }
      );

      if (snapRes.ok) {
        const snapData: AirtableResponse = await snapRes.json();
        snapData.records.forEach((r) => {
          snapshotInfo[r.id] = {
            claseAgente: (r.fields[infoExtintorFields.CLASE_AGENTE] as string) || "",
            tipoExtintor: (r.fields[infoExtintorFields.TIPO_EXTINTOR] as string) || "",
            capacidad: (r.fields[infoExtintorFields.CAPACIDAD] as string) || "",
            fechaProximaRecarga: (r.fields[infoExtintorFields.FECHA_PROXIMA_RECARGA] as string) || "",
          };
        });
      }
    }

    // ── 5. Mapear detalles ──────────────────────────────
    const detalles: DetalleExtintor[] = detalleRecords.map((r) => {
      const extintorLink = (r.fields[detalleExtintorFields.EXTINTOR_LINK] as string[])?.[0];
      const snapshotLink = (r.fields[detalleExtintorFields.INFO_SNAPSHOT_LINK] as string[])?.[0];
      const snapshot = snapshotLink ? snapshotInfo[snapshotLink] : undefined;

      return {
        id: r.id,
        extintorNombre: extintorLink ? extintorNames[extintorLink] : "",
        presion: (r.fields[detalleExtintorFields.PRESION] as string) || "",
        selloGarantia: (r.fields[detalleExtintorFields.SELLO_GARANTIA] as string) || "",
        manometro: (r.fields[detalleExtintorFields.MANOMETRO] as string) || "",
        estadoCilindro: (r.fields[detalleExtintorFields.ESTADO_CILINDRO] as string) || "",
        manija: (r.fields[detalleExtintorFields.MANIJA] as string) || "",
        boquillaManguera: (r.fields[detalleExtintorFields.BOQUILLA_MANGUERA] as string) || "",
        anilloSeguridad: (r.fields[detalleExtintorFields.ANILLO_SEGURIDAD] as string) || "",
        pinSeguridad: (r.fields[detalleExtintorFields.PIN_SEGURIDAD] as string) || "",
        pintura: (r.fields[detalleExtintorFields.PINTURA] as string) || "",
        tarjetaInspeccion: (r.fields[detalleExtintorFields.TARJETA_INSPECCION] as string) || "",
        observaciones: (r.fields[detalleExtintorFields.OBSERVACIONES] as string) || "",
        claseAgente: snapshot?.claseAgente || "",
        tipoExtintor: snapshot?.tipoExtintor || "",
        capacidad: snapshot?.capacidad || "",
        fechaProximaRecarga: snapshot?.fechaProximaRecarga || "",
      };
    });

    // ── 6. Obtener responsables ─────────────────────────
    const respUrl = getSGSSTUrl(airtableSGSSTConfig.respExtintorTableId);
    const respFilter = `FIND('${inspRecord.id}', {${respExtintorFields.INSPECCION_LINK}}) > 0`;
    const respRecords = await fetchAllRecords(respUrl, getSGSSTHeaders(), { filterByFormula: respFilter });

    const responsables: Responsable[] = respRecords.map((r) => ({
      id: r.id,
      tipo: (r.fields[respExtintorFields.TIPO] as string) || "",
      nombre: (r.fields[respExtintorFields.NOMBRE] as string) || "",
      cargo: (r.fields[respExtintorFields.CARGO] as string) || "",
      firmado: (r.fields[respExtintorFields.FIRMADO] as boolean) || false,
      fechaFirma: (r.fields[respExtintorFields.FECHA_FIRMA] as string) || "",
    }));

    // ── 7. Construir inspección completa ────────────────
    const inspeccion: InspeccionCompleta = {
      recordId: inspRecord.id,
      idInspeccion: (inspRecord.fields[inspExtintorFields.ID] as string) || "",
      fecha: (inspRecord.fields[inspExtintorFields.FECHA] as string) || "",
      inspector: (inspRecord.fields[inspExtintorFields.INSPECTOR] as string) || "",
      cargoInspector: (inspRecord.fields[inspExtintorFields.CARGO_INSPECTOR] as string) || "",
      estado: (inspRecord.fields[inspExtintorFields.ESTADO] as string) || "",
      observaciones: (inspRecord.fields[inspExtintorFields.OBSERVACIONES] as string) || "",
      detalles,
      responsables,
    };

    // ── 8. Cargar logo ──────────────────────────────────
    let logoBase64: string | null = null;
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      }
    } catch { /* ignore */ }

    // ── 9. Generar PDF ──────────────────────────────────
    const pdfBuffer = generarPDFInspeccion(inspeccion, logoBase64);
    const filename = `Inspeccion_Extintor_${inspeccion.idInspeccion}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-extintor/exportar-pdf:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
