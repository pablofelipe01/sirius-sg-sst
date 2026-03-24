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

interface Criterio {
  id: string;
  inspeccionId: string;
  categoria: string;
  criterio: string;
  condicion: string;
  observacion: string;
}

interface Accion {
  id: string;
  inspeccionId: string;
  descripcion: string;
  tipo: string;
  responsable: string;
  fechaPropuesta: string;
  estado: string;
}

interface Responsable {
  id: string;
  inspeccionId: string;
  tipo: string;
  nombre: string;
  cedula: string;
  cargo: string;
  fechaFirma: string;
  firmaHash?: string;
}

interface InspeccionCompleta {
  id: string;
  recordId: string;
  idInspeccion: string;
  fecha: string;
  inspector: string;
  area: string;
  estado: string;
  observaciones: string;
  urlDocumento: string | null;
  fechaExportacion: string | null;
  criterios: Criterio[];
  acciones: Accion[];
  responsables: Responsable[];
}

// ══════════════════════════════════════════════════════════
// Colores (RGB)
// ══════════════════════════════════════════════════════════
const COLORS = {
  HEADER_BLUE: [141, 180, 226] as [number, number, number], // #8DB4E2
  WHITE: [255, 255, 255] as [number, number, number],
  BLACK: [0, 0, 0] as [number, number, number],
  LIGHT_GRAY: [242, 242, 242] as [number, number, number],
};

// ══════════════════════════════════════════════════════════
// Códigos de Formato por Área
// ══════════════════════════════════════════════════════════
const FORMATO_AREA: Record<string, { codigo: string; nombre: string }> = {
  Pirólisis: { codigo: "FT-SST-060", nombre: "FORMATO INSPECCIÓN ÁREA PLANTA DE PIRÓLISIS" },
  Laboratorio: { codigo: "FT-SST-061", nombre: "FORMATO INSPECCIÓN ÁREA LABORATORIO" },
  Bodega: { codigo: "FT-SST-062", nombre: "FORMATO INSPECCIÓN ÁREA BODEGA" },
  Administrativa: { codigo: "FT-SST-063", nombre: "FORMATO INSPECCIÓN ÁREA ADMINISTRATIVA" },
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

// Ordenar categorías según el formato oficial
const CATEGORIA_ORDER = [
  "Condiciones Locativas",
  "Equipos de proceso",
  "Seguridad y emergencias",
  "Riesgos Químicos",
  "Almacenamiento Temporal",
  "Uso de herramientas menores",
  "Riesgo Ambiental",
];

function sortCategorias(categorias: string[]): string[] {
  return categorias.sort((a, b) => {
    const idxA = CATEGORIA_ORDER.findIndex(c => c.toLowerCase() === a.toLowerCase());
    const idxB = CATEGORIA_ORDER.findIndex(c => c.toLowerCase() === b.toLowerCase());
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

// ══════════════════════════════════════════════════════════
// Generar PDF con formato institucional
// ══════════════════════════════════════════════════════════
function generarPDFInspeccion(insp: InspeccionCompleta, logoBase64: string | null): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let currentY = margin;

  const formatoArea = FORMATO_AREA[insp.area] || {
    codigo: "FT-SST-060",
    nombre: `FORMATO INSPECCIÓN ÁREA ${insp.area.toUpperCase()}`,
  };

  // ═══════════════════════════════════════════════════════
  // ENCABEZADO INSTITUCIONAL
  // ═══════════════════════════════════════════════════════
  const headerHeight = 22;
  const logoWidth = 35;
  const codigoWidth = 50;
  const empresaWidth = contentWidth - logoWidth - codigoWidth;

  // Fondo azul para encabezado
  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, headerHeight, "F");
  doc.setDrawColor(...COLORS.BLACK);
  doc.rect(margin, currentY, contentWidth, headerHeight, "S");

  // Logo
  doc.setFillColor(...COLORS.WHITE);
  doc.rect(margin, currentY, logoWidth, headerHeight, "F");
  doc.rect(margin, currentY, logoWidth, headerHeight, "S");
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin + 5, currentY + 3, 25, 16);
    } catch { /* ignore */ }
  }

  // Columna central: Empresa + NIT + Formato
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
  doc.text(formatoArea.nombre, empresaX + empresaWidth / 2, currentY + 2 * headerHeight / 3 + 5, { align: "center" });

  // Columna derecha: Código + Versión + Fecha
  const codigoX = margin + logoWidth + empresaWidth;
  doc.rect(codigoX, currentY, codigoWidth, headerHeight / 3, "S");
  doc.setFontSize(8);
  doc.text(`CÓDIGO: ${formatoArea.codigo}`, codigoX + codigoWidth / 2, currentY + 5, { align: "center" });

  doc.rect(codigoX, currentY + headerHeight / 3, codigoWidth, headerHeight / 3, "S");
  doc.setFont("helvetica", "normal");
  doc.text("VERSIÓN: 001", codigoX + codigoWidth / 2, currentY + headerHeight / 3 + 4.5, { align: "center" });

  doc.rect(codigoX, currentY + 2 * headerHeight / 3, codigoWidth, headerHeight / 3, "S");
  doc.setFontSize(7);
  doc.text("FECHA: 02-02-2026", codigoX + codigoWidth / 2, currentY + 2 * headerHeight / 3 + 5, { align: "center" });

  currentY += headerHeight + 5;

  // ═══════════════════════════════════════════════════════
  // DATOS DE LA INSPECCIÓN - Buscar con los tipos correctos
  // ═══════════════════════════════════════════════════════
  
  // Tipos correctos según Airtable
  const responsableArea = insp.responsables.find(r => 
    r.tipo === "Responsable Área" || r.tipo === "Responsable del Área"
  );
  const responsableInsp = insp.responsables.find(r => 
    r.tipo === "Responsable" || r.tipo === "Responsable SST" || r.tipo === "Responsable de Inspección"
  );

  const rowHeight = 8;
  const col1Width = contentWidth * 0.25;
  const col2Width = contentWidth * 0.25;
  const col3Width = contentWidth * 0.25;
  const col4Width = contentWidth * 0.25;

  // Fila 1: Fecha + Responsable del Área
  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin, currentY, col1Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.WHITE);
  doc.rect(margin + col1Width, currentY, col2Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin + col1Width + col2Width, currentY, col3Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.WHITE);
  doc.rect(margin + col1Width + col2Width + col3Width, currentY, col4Width, rowHeight, "FD");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("FECHA INSPECCIÓN:", margin + 2, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(formatFechaLarga(insp.fecha), margin + col1Width + col2Width / 2, currentY + 5.5, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text("RESPONSABLE ÁREA:", margin + col1Width + col2Width + 2, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  const nombreArea = responsableArea?.nombre || "";
  doc.setFontSize(nombreArea.length > 25 ? 7 : 8);
  doc.text(nombreArea, margin + col1Width + col2Width + col3Width + col4Width / 2, currentY + 5.5, { align: "center" });
  currentY += rowHeight;

  // Fila 2: Responsable Inspección + Cargo Área
  doc.setFontSize(9);
  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin, currentY, col1Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.WHITE);
  doc.rect(margin + col1Width, currentY, col2Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin + col1Width + col2Width, currentY, col3Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.WHITE);
  doc.rect(margin + col1Width + col2Width + col3Width, currentY, col4Width, rowHeight, "FD");

  doc.setFont("helvetica", "bold");
  doc.text("RESP. INSPECCIÓN:", margin + 2, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  const nombreInsp = responsableInsp?.nombre || insp.inspector;
  doc.setFontSize(nombreInsp.length > 25 ? 7 : 8);
  doc.text(nombreInsp, margin + col1Width + col2Width / 2, currentY + 5.5, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("CARGO:", margin + col1Width + col2Width + 2, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  const cargoArea = responsableArea?.cargo || "";
  doc.setFontSize(cargoArea.length > 20 ? 7 : 8);
  doc.text(cargoArea, margin + col1Width + col2Width + col3Width + col4Width / 2, currentY + 5.5, { align: "center" });
  currentY += rowHeight;

  // Fila 3: Cargo Inspector
  doc.setFontSize(9);
  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin, currentY, col1Width, rowHeight, "FD");
  doc.setFillColor(...COLORS.WHITE);
  doc.rect(margin + col1Width, currentY, contentWidth - col1Width, rowHeight, "FD");

  doc.setFont("helvetica", "bold");
  doc.text("CARGO INSPECTOR:", margin + 2, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  const cargoInsp = responsableInsp?.cargo || "";
  doc.setFontSize(cargoInsp.length > 50 ? 7 : 8);
  doc.text(cargoInsp, margin + col1Width + 3, currentY + 5.5);
  currentY += rowHeight + 5;

  // ═══════════════════════════════════════════════════════
  // TABLA DE CRITERIOS
  // ═══════════════════════════════════════════════════════

  const criteriosPorCategoria: Record<string, Criterio[]> = {};
  insp.criterios.forEach(c => {
    if (!criteriosPorCategoria[c.categoria]) {
      criteriosPorCategoria[c.categoria] = [];
    }
    criteriosPorCategoria[c.categoria].push(c);
  });

  const categorias = sortCategorias(Object.keys(criteriosPorCategoria));

  // Preparar datos para autoTable
  const tableBody: (string | { content: string; styles?: object })[][] = [];

  categorias.forEach(categoria => {
    // Fila de categoría
    tableBody.push([
      { content: categoria, styles: { fillColor: COLORS.HEADER_BLUE, fontStyle: "bold", halign: "left" as const } },
      { content: "", styles: { fillColor: COLORS.HEADER_BLUE } },
      { content: "", styles: { fillColor: COLORS.HEADER_BLUE } },
      { content: "", styles: { fillColor: COLORS.HEADER_BLUE } },
      { content: "", styles: { fillColor: COLORS.HEADER_BLUE } },
    ]);

    // Criterios de esta categoría
    const criterios = criteriosPorCategoria[categoria];
    criterios.forEach(crit => {
      tableBody.push([
        crit.criterio,
        crit.condicion === "Bueno" ? "X" : "",
        crit.condicion === "Malo" ? "X" : "",
        crit.condicion === "NA" ? "X" : "",
        crit.observacion || "",
      ]);
    });
  });

  autoTable(doc, {
    startY: currentY,
    head: [[
      { content: "ELEMENTOS A INSPECCIONAR", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "B", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "M", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "N/A", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "OBSERVACIÓN", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
    ]],
    body: tableBody,
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 10, halign: "center" as const },
      2: { cellWidth: 10, halign: "center" as const },
      3: { cellWidth: 10, halign: "center" as const },
      4: { cellWidth: "auto" },
    },
    headStyles: {
      fillColor: COLORS.HEADER_BLUE,
      textColor: COLORS.BLACK,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: COLORS.BLACK,
    },
    tableLineColor: COLORS.BLACK,
    tableLineWidth: 0.1,
    margin: { left: margin, right: margin },
    theme: "grid",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentY = (doc as any).lastAutoTable.finalY + 5;

  // ═══════════════════════════════════════════════════════
  // ACCIONES CORRECTIVAS
  // ═══════════════════════════════════════════════════════

  const accionesBody: string[][] = [];
  const minAcciones = Math.max(insp.acciones.length, 3);

  for (let i = 0; i < minAcciones; i++) {
    const accion = insp.acciones[i];
    accionesBody.push([
      accion?.descripcion || "",
      accion?.responsable || "",
      accion ? formatFechaLarga(accion.fechaPropuesta) : "",
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [[
      { content: "ACCIONES PREVENTIVAS, CORRECTIVAS O DE MEJORA", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "RESPONSABLE", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      { content: "FECHA PROPUESTA", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
    ]],
    body: accionesBody,
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 40, halign: "center" as const },
      2: { cellWidth: 35, halign: "center" as const },
    },
    headStyles: {
      fillColor: COLORS.HEADER_BLUE,
      textColor: COLORS.BLACK,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: COLORS.BLACK,
      minCellHeight: 10,
    },
    tableLineColor: COLORS.BLACK,
    tableLineWidth: 0.1,
    margin: { left: margin, right: margin },
    theme: "grid",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentY = (doc as any).lastAutoTable.finalY + 5;

  // ═══════════════════════════════════════════════════════
  // SECCIÓN DE FIRMAS - 3 PARTICIPANTES
  // Usar los tipos correctos según Airtable
  // ═══════════════════════════════════════════════════════

  // Buscar con los tipos correctos de Airtable
  const firmaCOPASST = insp.responsables.find(r => 
    r.tipo === "COPASST" || r.tipo === "Integrante COPASST" || r.tipo === "Responsable del COPASST"
  );
  
  const firmaResponsable = insp.responsables.find(r => 
    r.tipo === "Responsable" || r.tipo === "Responsable SST" || r.tipo === "Responsable de Inspección"
  );
  
  const firmaAreaResp = insp.responsables.find(r => 
    r.tipo === "Responsable Área" || r.tipo === "Responsable del Área"
  );

  // Verificar espacio disponible para firmas (necesitamos ~60mm)
  if (currentY + 60 > pageHeight - margin) {
    doc.addPage();
    currentY = margin;
  }

  // Ancho exacto para 3 columnas iguales sin espacio entre ellas
  const firmaWidth = contentWidth / 3;
  const firmaBoxHeight = 25;
  const firmaInfoHeight = 18;

  // Datos de los firmantes con sus firmas descifradas
  const firmas = [
    { 
      titulo: "FIRMA DEL RESPONSABLE\nDEL COPASST", 
      nombre: firmaCOPASST?.nombre || "", 
      cargo: firmaCOPASST?.cargo || "Integrante COPASST",
      cedula: firmaCOPASST?.cedula || "",
      firmaDataUrl: extractSignatureDataUrl(firmaCOPASST?.firmaHash)
    },
    { 
      titulo: "FIRMA DEL RESPONSABLE\nDE INSPECCIÓN", 
      nombre: firmaResponsable?.nombre || insp.inspector, 
      cargo: firmaResponsable?.cargo || "Responsable SST",
      cedula: firmaResponsable?.cedula || "",
      firmaDataUrl: extractSignatureDataUrl(firmaResponsable?.firmaHash)
    },
    { 
      titulo: "FIRMA RESPONSABLE\nDEL ÁREA", 
      nombre: firmaAreaResp?.nombre || "", 
      cargo: firmaAreaResp?.cargo || "Responsable del Área",
      cedula: firmaAreaResp?.cedula || "",
      firmaDataUrl: extractSignatureDataUrl(firmaAreaResp?.firmaHash)
    },
  ];

  // Título de sección
  doc.setFillColor(...COLORS.HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, 7, "FD");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("RESPONSABLES Y FIRMAS", margin + contentWidth / 2, currentY + 5, { align: "center" });
  currentY += 7;

  // Dibujar los 3 cuadros de firma (sin espacio entre ellos)
  firmas.forEach((firma, idx) => {
    const x = margin + idx * firmaWidth;

    // Cuadro para la firma
    doc.setDrawColor(...COLORS.BLACK);
    doc.setFillColor(...COLORS.WHITE);
    doc.rect(x, currentY, firmaWidth, firmaBoxHeight, "FD");

    // Añadir imagen de firma si existe
    if (firma.firmaDataUrl) {
      try {
        // La firma es un data URL PNG, añadirla centrada en el cuadro
        const imgWidth = firmaWidth - 10;
        const imgHeight = firmaBoxHeight - 6;
        const imgX = x + 5;
        const imgY = currentY + 3;
        doc.addImage(firma.firmaDataUrl, "PNG", imgX, imgY, imgWidth, imgHeight);
      } catch (e) {
        console.error("Error adding signature image:", e);
      }
    }

    // Título de la firma (debajo del cuadro)
    doc.setFillColor(...COLORS.HEADER_BLUE);
    doc.rect(x, currentY + firmaBoxHeight, firmaWidth, 8, "FD");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.BLACK);
    const tituloLines = firma.titulo.split("\n");
    doc.text(tituloLines[0], x + firmaWidth / 2, currentY + firmaBoxHeight + 3.5, { align: "center" });
    if (tituloLines[1]) {
      doc.text(tituloLines[1], x + firmaWidth / 2, currentY + firmaBoxHeight + 6.5, { align: "center" });
    }

    // Información del firmante
    doc.setFillColor(...COLORS.WHITE);
    doc.rect(x, currentY + firmaBoxHeight + 8, firmaWidth, firmaInfoHeight, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const infoY = currentY + firmaBoxHeight + 11;
    
    // Nombre
    doc.text("NOMBRE:", x + 2, infoY);
    doc.setFont("helvetica", "normal");
    const nombreText = firma.nombre || "(Sin firmar)";
    const nombreFontSize = nombreText.length > 25 ? 6 : 7;
    doc.setFontSize(nombreFontSize);
    doc.text(nombreText, x + 2, infoY + 3.5);

    // Cargo
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("CARGO:", x + 2, infoY + 8);
    doc.setFont("helvetica", "normal");
    const cargoText = firma.cargo;
    const cargoFontSize = cargoText.length > 30 ? 5 : cargoText.length > 20 ? 6 : 7;
    doc.setFontSize(cargoFontSize);
    doc.text(cargoText, x + 2, infoY + 11.5);
  });

  return Buffer.from(doc.output("arraybuffer"));
}

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-areas/exportar-pdf
// Exporta las inspecciones de áreas a PDF con formato institucional
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const { area, estado, idInspeccion } = await request.json();

    const {
      inspeccionesAreasFields,
      detalleInspeccionAreasFields,
      accionesCorrectivasAreasFields,
      respInspeccionAreasFields,
    } = airtableSGSSTConfig;

    // ── 1. Obtener inspecciones ─────────────────────────
    const url = getSGSSTUrl(airtableSGSSTConfig.inspeccionesAreasTableId);
    const filters: string[] = [];

    if (idInspeccion) {
      filters.push(`{${inspeccionesAreasFields.ID}} = '${idInspeccion}'`);
    } else {
      if (area && area !== "Todas") {
        filters.push(`{${inspeccionesAreasFields.AREA}} = '${area}'`);
      }
      if (estado && estado !== "Todos") {
        filters.push(`{${inspeccionesAreasFields.ESTADO}} = '${estado}'`);
      }
    }

    const filterFormula = filters.length > 0
      ? filters.length === 1 ? filters[0] : `AND(${filters.join(", ")})`
      : "";

    const extraParams: Record<string, string> = {
      [`sort[0][field]`]: inspeccionesAreasFields.FECHA,
      [`sort[0][direction]`]: "desc",
    };
    if (filterFormula) extraParams.filterByFormula = filterFormula;

    const cabeceraRecords = await fetchAllRecords(url, getSGSSTHeaders(), extraParams);

    if (cabeceraRecords.length === 0) {
      return NextResponse.json(
        { success: false, message: "No hay inspecciones para exportar" },
        { status: 400 }
      );
    }

    // ── 2. Obtener detalles (criterios) ─────────────────
    const detalleUrl = getSGSSTUrl(airtableSGSSTConfig.detalleInspeccionAreasTableId);
    const detalleRecords = await fetchAllRecords(detalleUrl, getSGSSTHeaders());

    const criteriosMap: Record<string, Criterio[]> = {};
    detalleRecords.forEach((r) => {
      const links = r.fields[detalleInspeccionAreasFields.INSPECCION_LINK] as string[] || [];
      links.forEach((inspId) => {
        if (!criteriosMap[inspId]) criteriosMap[inspId] = [];
        criteriosMap[inspId].push({
          id: r.id,
          inspeccionId: inspId,
          categoria: (r.fields[detalleInspeccionAreasFields.CATEGORIA] as string) || "",
          criterio: (r.fields[detalleInspeccionAreasFields.CRITERIO] as string) || "",
          condicion: (r.fields[detalleInspeccionAreasFields.CONDICION] as string) || "",
          observacion: (r.fields[detalleInspeccionAreasFields.OBSERVACION] as string) || "",
        });
      });
    });

    // ── 3. Obtener acciones correctivas ─────────────────
    const accionesUrl = getSGSSTUrl(airtableSGSSTConfig.accionesCorrectivasAreasTableId);
    const accionesRecords = await fetchAllRecords(accionesUrl, getSGSSTHeaders());

    const accionesMap: Record<string, Accion[]> = {};
    accionesRecords.forEach((r) => {
      const links = r.fields[accionesCorrectivasAreasFields.INSPECCION_LINK] as string[] || [];
      links.forEach((inspId) => {
        if (!accionesMap[inspId]) accionesMap[inspId] = [];
        accionesMap[inspId].push({
          id: r.id,
          inspeccionId: inspId,
          descripcion: (r.fields[accionesCorrectivasAreasFields.DESCRIPCION] as string) || "",
          tipo: (r.fields[accionesCorrectivasAreasFields.TIPO] as string) || "",
          responsable: (r.fields[accionesCorrectivasAreasFields.RESPONSABLE] as string) || "",
          fechaPropuesta: (r.fields[accionesCorrectivasAreasFields.FECHA_PROPUESTA] as string) || "",
          estado: (r.fields[accionesCorrectivasAreasFields.ESTADO] as string) || "",
        });
      });
    });

    // ── 4. Obtener responsables ─────────────────────────
    const respUrl = getSGSSTUrl(airtableSGSSTConfig.respInspeccionAreasTableId);
    const respRecords = await fetchAllRecords(respUrl, getSGSSTHeaders());

    const responsablesMap: Record<string, Responsable[]> = {};
    respRecords.forEach((r) => {
      const links = r.fields[respInspeccionAreasFields.INSPECCION_LINK] as string[] || [];
      links.forEach((inspId) => {
        if (!responsablesMap[inspId]) responsablesMap[inspId] = [];
        responsablesMap[inspId].push({
          id: r.id,
          inspeccionId: inspId,
          tipo: (r.fields[respInspeccionAreasFields.TIPO] as string) || "",
          nombre: (r.fields[respInspeccionAreasFields.NOMBRE] as string) || "",
          cedula: (r.fields[respInspeccionAreasFields.CEDULA] as string) || "",
          cargo: (r.fields[respInspeccionAreasFields.CARGO] as string) || "",
          fechaFirma: (r.fields[respInspeccionAreasFields.FECHA_FIRMA] as string) || "",
          firmaHash: (r.fields[respInspeccionAreasFields.FIRMA] as string) || undefined,
        });
      });
    });

    // ── 5. Cargar logo ──────────────────────────────────
    let logoBase64: string | null = null;
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      }
    } catch { /* ignore */ }

    // ── 6. Generar PDF ──────────────────────────────────
    // Si es una sola inspección, generar PDF único
    if (idInspeccion && cabeceraRecords.length === 1) {
      const r = cabeceraRecords[0];
      const insp: InspeccionCompleta = {
        id: r.fields[inspeccionesAreasFields.ID] as string,
        recordId: r.id,
        idInspeccion: r.fields[inspeccionesAreasFields.ID] as string,
        fecha: r.fields[inspeccionesAreasFields.FECHA] as string,
        inspector: r.fields[inspeccionesAreasFields.INSPECTOR] as string,
        area: r.fields[inspeccionesAreasFields.AREA] as string,
        estado: r.fields[inspeccionesAreasFields.ESTADO] as string,
        observaciones: (r.fields[inspeccionesAreasFields.OBSERVACIONES] as string) || "",
        urlDocumento: (r.fields[inspeccionesAreasFields.URL_DOCUMENTO] as string) || null,
        fechaExportacion: (r.fields[inspeccionesAreasFields.FECHA_EXPORTACION] as string) || null,
        criterios: criteriosMap[r.id] || [],
        acciones: accionesMap[r.id] || [],
        responsables: responsablesMap[r.id] || [],
      };

      const pdfBuffer = generarPDFInspeccion(insp, logoBase64);
      const filename = `Inspeccion_${idInspeccion}.pdf`;

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Si hay múltiples inspecciones, generar un PDF por cada una y combinar
    // Por simplicidad, generamos solo la primera
    const r = cabeceraRecords[0];
    const insp: InspeccionCompleta = {
      id: r.fields[inspeccionesAreasFields.ID] as string,
      recordId: r.id,
      idInspeccion: r.fields[inspeccionesAreasFields.ID] as string,
      fecha: r.fields[inspeccionesAreasFields.FECHA] as string,
      inspector: r.fields[inspeccionesAreasFields.INSPECTOR] as string,
      area: r.fields[inspeccionesAreasFields.AREA] as string,
      estado: r.fields[inspeccionesAreasFields.ESTADO] as string,
      observaciones: (r.fields[inspeccionesAreasFields.OBSERVACIONES] as string) || "",
      urlDocumento: (r.fields[inspeccionesAreasFields.URL_DOCUMENTO] as string) || null,
      fechaExportacion: (r.fields[inspeccionesAreasFields.FECHA_EXPORTACION] as string) || null,
      criterios: criteriosMap[r.id] || [],
      acciones: accionesMap[r.id] || [],
      responsables: responsablesMap[r.id] || [],
    };

    const pdfBuffer = generarPDFInspeccion(insp, logoBase64);
    const filename = `Inspecciones_Areas_${new Date().toISOString().split("T")[0]}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-areas/exportar-pdf:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
