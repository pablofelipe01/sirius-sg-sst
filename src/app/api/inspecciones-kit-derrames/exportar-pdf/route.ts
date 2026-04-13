import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

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

interface DetalleKitDer {
  id: string;
  kitNombre: string;
  elementoNombre: string;
  estadoElemento: string;
  cantidad: string;
  fechaVencimiento: string;
  observaciones: string;
}

interface Verificacion {
  conoceProcedimiento: string;
  almacenamientoAdecuado: string;
  rotuladoSenalizado: string;
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
  detalles: DetalleKitDer[];
  verificaciones: Verificacion | null;
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
// Generar PDF de inspección de kit de derrames
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
  doc.text("FORMATO INSPECCIÓN DE KITS DE DERRAMES", empresaX + empresaWidth / 2, currentY + 2 * headerHeight / 3 + 5, { align: "center" });

  const codigoX = margin + logoWidth + empresaWidth;
  doc.rect(codigoX, currentY, codigoWidth, headerHeight / 3, "S");
  doc.setFontSize(8);
  doc.text("CÓDIGO: FT-SST-069", codigoX + codigoWidth / 2, currentY + 5, { align: "center" });

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
  // TABLA DE DETALLES POR KIT
  // ═══════════════════════════════════════════════════════
  if (insp.detalles.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No se registraron elementos en esta inspección", margin + contentWidth / 2, currentY + 10, { align: "center" });
    currentY += 20;
  } else {
    // Agrupar por kit
    const detallesPorKit: Record<string, DetalleKitDer[]> = {};
    insp.detalles.forEach((det) => {
      const kit = det.kitNombre || "Sin Kit";
      if (!detallesPorKit[kit]) detallesPorKit[kit] = [];
      detallesPorKit[kit].push(det);
    });

    const kits = Object.keys(detallesPorKit).sort();

    kits.forEach((kit) => {
      const elementos = detallesPorKit[kit];

      if (currentY + 30 > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
      }

      // Título del kit
      doc.setFillColor(46, 125, 50);
      doc.rect(margin, currentY, contentWidth, 7, "FD");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.WHITE);
      doc.text(`${kit.toUpperCase()} (${elementos.length} elementos)`, margin + contentWidth / 2, currentY + 5, { align: "center" });
      doc.setTextColor(...COLORS.BLACK);
      currentY += 7;

      const head = [[
        { content: "Elemento", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
        { content: "Estado", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
        { content: "Cantidad", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
        { content: "Vencimiento", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
        { content: "Observaciones", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      ]];

      const body = elementos.map((det) => {
        const rowArr: (string | { content: string; styles?: object })[] = [
          det.elementoNombre,
        ];

        const styles: Record<string, unknown> = { halign: "center" as const };
        if (det.estadoElemento === "Bueno") styles.textColor = [0, 128, 0];
        if (det.estadoElemento === "Malo") styles.textColor = [200, 0, 0];
        rowArr.push({ content: det.estadoElemento || "", styles });

        rowArr.push(det.cantidad || "");
        rowArr.push(formatFechaLarga(det.fechaVencimiento));
        rowArr.push(det.observaciones || "");

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
          fontSize: 7,
        },
        bodyStyles: {
          fontSize: 7,
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
    });
  }

  // ═══════════════════════════════════════════════════════
  // VERIFICACIONES GENERALES DEL KIT
  // ═══════════════════════════════════════════════════════
  if (insp.verificaciones) {
    if (currentY + 30 > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFillColor(...COLORS.CAT_BLUE);
    doc.rect(margin, currentY, contentWidth, 7, "FD");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.WHITE);
    doc.text("VERIFICACIONES GENERALES DEL KIT", margin + contentWidth / 2, currentY + 5, { align: "center" });
    doc.setTextColor(...COLORS.BLACK);
    currentY += 7;

    const verHead = [[
      { content: "Criterio", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "Cumple", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
    ]];

    const verBody = [
      ["Responsable conoce procedimiento", insp.verificaciones.conoceProcedimiento],
      ["Almacenamiento adecuado", insp.verificaciones.almacenamientoAdecuado],
      ["Rotulado/señalizado", insp.verificaciones.rotuladoSenalizado],
    ].map((row) => {
      const styles: Record<string, unknown> = { halign: "center" as const };
      if (row[1] === "Sí") styles.textColor = [0, 128, 0];
      if (row[1] === "No") styles.textColor = [200, 0, 0];
      return [row[0], { content: row[1], styles }];
    });

    autoTable(doc, {
      startY: currentY,
      head: verHead,
      body: verBody,
      headStyles: {
        fillColor: COLORS.HEADER_BLUE,
        textColor: COLORS.BLACK,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
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

    doc.setDrawColor(...COLORS.BLACK);
    doc.setFillColor(...COLORS.WHITE);
    doc.rect(x, currentY, firmaWidth, firmaBoxHeight, "FD");

    doc.setFillColor(...COLORS.HEADER_BLUE);
    doc.rect(x, currentY + firmaBoxHeight, firmaWidth, 8, "FD");
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.BLACK);
    doc.text(`FIRMA ${resp.tipo.toUpperCase()}`, x + firmaWidth / 2, currentY + firmaBoxHeight + 5, { align: "center" });

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
// POST /api/inspecciones-kit-derrames/exportar-pdf
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const { idInspeccion } = await request.json();

    const {
      inspKitDerFields,
      detalleKitDerFields,
      verificacionesKitDerFields,
      respKitDerFields,
      kitsDerFields,
      elementosKitDerFields,
    } = airtableSGSSTConfig;

    // ── 1. Obtener inspección ───────────────────────────
    const url = getSGSSTUrl(airtableSGSSTConfig.inspKitDerTableId);
    const extraParams: Record<string, string> = {};

    if (idInspeccion) {
      extraParams.filterByFormula = `{${inspKitDerFields.ID}} = '${idInspeccion}'`;
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
    const detalleUrl = getSGSSTUrl(airtableSGSSTConfig.detalleKitDerTableId);
    const detalleFilter = `FIND('${inspRecord.id}', {${detalleKitDerFields.INSPECCION_LINK}}) > 0`;
    const detalleRecords = await fetchAllRecords(detalleUrl, getSGSSTHeaders(), { filterByFormula: detalleFilter });

    // ── 3. Obtener nombres de kits ──────────────────────
    const kitIds = detalleRecords
      .map((r) => (r.fields[detalleKitDerFields.KIT_LINK] as string[])?.[0])
      .filter(Boolean) as string[];

    const kitNames: Record<string, string> = {};
    const uniqueKitIds = [...new Set(kitIds)];

    for (let i = 0; i < uniqueKitIds.length; i += 10) {
      const batch = uniqueKitIds.slice(i, i + 10);
      const formula = `OR(${batch.map((kid) => `RECORD_ID()='${kid}'`).join(",")})`;
      const ktParams = new URLSearchParams({
        filterByFormula: formula,
        returnFieldsByFieldId: "true",
      });

      const ktRes = await fetch(
        `${getSGSSTUrl(airtableSGSSTConfig.kitsDerTableId)}?${ktParams.toString()}`,
        { headers: getSGSSTHeaders(), cache: "no-store" }
      );

      if (ktRes.ok) {
        const ktData: AirtableResponse = await ktRes.json();
        ktData.records.forEach((r) => {
          kitNames[r.id] = (r.fields[kitsDerFields.NOMBRE] as string) || (r.fields[kitsDerFields.CODIGO] as string) || "";
        });
      }
    }

    // ── 4. Obtener nombres de elementos ─────────────────
    const elementoIds = detalleRecords
      .map((r) => (r.fields[detalleKitDerFields.ELEMENTO_LINK] as string[])?.[0])
      .filter(Boolean) as string[];

    const elementoNames: Record<string, string> = {};
    const uniqueElementoIds = [...new Set(elementoIds)];

    for (let i = 0; i < uniqueElementoIds.length; i += 10) {
      const batch = uniqueElementoIds.slice(i, i + 10);
      const formula = `OR(${batch.map((eid) => `RECORD_ID()='${eid}'`).join(",")})`;
      const elParams = new URLSearchParams({
        filterByFormula: formula,
        returnFieldsByFieldId: "true",
      });

      const elRes = await fetch(
        `${getSGSSTUrl(airtableSGSSTConfig.elementosKitDerTableId)}?${elParams.toString()}`,
        { headers: getSGSSTHeaders(), cache: "no-store" }
      );

      if (elRes.ok) {
        const elData: AirtableResponse = await elRes.json();
        elData.records.forEach((r) => {
          elementoNames[r.id] = (r.fields[elementosKitDerFields.NOMBRE] as string) || "";
        });
      }
    }

    // ── 5. Mapear detalles ──────────────────────────────
    const detalles: DetalleKitDer[] = detalleRecords.map((r) => {
      const kitLink = (r.fields[detalleKitDerFields.KIT_LINK] as string[])?.[0];
      const elementoLink = (r.fields[detalleKitDerFields.ELEMENTO_LINK] as string[])?.[0];

      return {
        id: r.id,
        kitNombre: kitLink ? kitNames[kitLink] : "",
        elementoNombre: elementoLink ? elementoNames[elementoLink] : "",
        estadoElemento: (r.fields[detalleKitDerFields.ESTADO_ELEMENTO] as string) || "",
        cantidad: (r.fields[detalleKitDerFields.CANTIDAD] as string) || "",
        fechaVencimiento: (r.fields[detalleKitDerFields.FECHA_VENCIMIENTO] as string) || "",
        observaciones: (r.fields[detalleKitDerFields.OBSERVACIONES] as string) || "",
      };
    });

    // ── 6. Obtener verificaciones ───────────────────────
    const verUrl = getSGSSTUrl(airtableSGSSTConfig.verificacionesKitDerTableId);
    const verFilter = `FIND('${inspRecord.id}', {${verificacionesKitDerFields.INSPECCION_LINK}}) > 0`;
    const verRecords = await fetchAllRecords(verUrl, getSGSSTHeaders(), { filterByFormula: verFilter });

    const verificaciones: Verificacion | null = verRecords.length > 0 ? {
      conoceProcedimiento: (verRecords[0].fields[verificacionesKitDerFields.CONOCE_PROCEDIMIENTO] as string) || "",
      almacenamientoAdecuado: (verRecords[0].fields[verificacionesKitDerFields.ALMACENAMIENTO_ADECUADO] as string) || "",
      rotuladoSenalizado: (verRecords[0].fields[verificacionesKitDerFields.ROTULADO_SENALIZADO] as string) || "",
    } : null;

    // ── 7. Obtener responsables ─────────────────────────
    const respUrl = getSGSSTUrl(airtableSGSSTConfig.respKitDerTableId);
    const respFilter = `FIND('${inspRecord.id}', {${respKitDerFields.INSPECCION_LINK}}) > 0`;
    const respRecords = await fetchAllRecords(respUrl, getSGSSTHeaders(), { filterByFormula: respFilter });

    const responsables: Responsable[] = respRecords.map((r) => ({
      id: r.id,
      tipo: (r.fields[respKitDerFields.TIPO] as string) || "",
      nombre: (r.fields[respKitDerFields.NOMBRE] as string) || "",
      cargo: (r.fields[respKitDerFields.CARGO] as string) || "",
      firmado: (r.fields[respKitDerFields.FIRMADO] as boolean) || false,
      fechaFirma: (r.fields[respKitDerFields.FECHA_FIRMA] as string) || "",
    }));

    // ── 8. Construir inspección completa ────────────────
    const inspeccion: InspeccionCompleta = {
      recordId: inspRecord.id,
      idInspeccion: (inspRecord.fields[inspKitDerFields.ID] as string) || "",
      fecha: (inspRecord.fields[inspKitDerFields.FECHA] as string) || "",
      inspector: (inspRecord.fields[inspKitDerFields.INSPECTOR] as string) || "",
      cargoInspector: (inspRecord.fields[inspKitDerFields.CARGO_INSPECTOR] as string) || "",
      estado: (inspRecord.fields[inspKitDerFields.ESTADO] as string) || "",
      observaciones: (inspRecord.fields[inspKitDerFields.OBSERVACIONES] as string) || "",
      detalles,
      verificaciones,
      responsables,
    };

    // ── 9. Cargar logo ──────────────────────────────────
    let logoBase64: string | null = null;
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      }
    } catch { /* ignore */ }

    // ── 10. Generar PDF ─────────────────────────────────
    const pdfBuffer = generarPDFInspeccion(inspeccion, logoBase64);
    const filename = `Inspeccion_KitDerrames_${inspeccion.idInspeccion}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-kit-derrames/exportar-pdf:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
