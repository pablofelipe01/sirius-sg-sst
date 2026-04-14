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

interface DetalleEquipo {
  id: string;
  inspeccionRecordId: string;
  idDetalle: string;
  categoria: string;
  area: string;
  equipoNombre: string;
  equipoCodigo: string;
  estadoGeneral: string;
  senalizacion: string;
  accesibilidad: string;
  presionManometro: string;
  manguera: string;
  pinSeguridad: string;
  soporteBase: string;
  completitud: string;
  estadoContenedor: string;
  estructura: string;
  correas: string;
  fechaVencimiento: string;
  observaciones: string;
  // Datos detallados parseados de observaciones (JSON embebido)
  observacionesLimpias: string;
  criteriosExtintor?: Record<string, { estado: string | null }>;
  infoExtintor?: { claseAgente: string; tipoExtintor: string; capacidad: string; fechaProximaRecarga: string };
  elementosBotiquin?: Record<string, { estado: string | null; cantidad: string; fechaVencimiento: string }>;
  elementosCamilla?: Record<string, { estado: string | null }>;
  elementosKit?: Record<string, { estado: string | null; cantidad: string; fechaVencimiento: string }>;
  verificacionesKit?: Record<string, { respuesta: boolean | null }>;
}

interface Responsable {
  id: string;
  inspeccionRecordId: string;
  idFirma: string;
  tipo: string;
  nombre: string;
  cedula: string;
  cargo: string;
  fechaFirma: string;
  firmaHash?: string;
}

interface InspeccionCompleta {
  recordId: string;
  idInspeccion: string;
  fecha: string;
  inspector: string;
  estado: string;
  observaciones: string;
  detalles: DetalleEquipo[];
  responsables: Responsable[];
}

// ══════════════════════════════════════════════════════════
// Mapeo de categoría → formato oficial
// ══════════════════════════════════════════════════════════
const FORMATO_POR_CATEGORIA: Record<string, { codigo: string; nombre: string }> = {
  "Extintor":     { codigo: "FT-SST-033", nombre: "Formato de Inspección de Extintor" },
  "Botiquin":     { codigo: "FT-SST-032", nombre: "Formato de Inspección de Botiquín" },
  "Camilla":      { codigo: "FT-SST-037", nombre: "Formato de Inspección de Camilla" },
  "Kit Derrames": { codigo: "FT-SST-050", nombre: "Formato de Inspección de Kit de Derrames" },
};
const FORMATO_DEFAULT = {
  codigo: "FT-SST-065",
  nombre: "Formato Inspección de Equipos de Emergencia",
};

function normalizarCategoria(cat: string): string {
  return cat === "Botiquín" ? "Botiquin" : cat;
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
// Parser de datos detallados embebidos en observaciones
// ══════════════════════════════════════════════════════════
function parseObservacionesDetalladas(obs: string): {
  observacionesLimpias: string;
  criteriosExtintor?: Record<string, { estado: string | null }>;
  infoExtintor?: { claseAgente: string; tipoExtintor: string; capacidad: string; fechaProximaRecarga: string };
  elementosBotiquin?: Record<string, { estado: string | null; cantidad: string; fechaVencimiento: string }>;
  elementosCamilla?: Record<string, { estado: string | null }>;
  elementosKit?: Record<string, { estado: string | null; cantidad: string; fechaVencimiento: string }>;
  verificacionesKit?: Record<string, { respuesta: boolean | null }>;
} {
  const separador = "---DATOS_DETALLADOS---";
  const idx = obs.indexOf(separador);
  if (idx === -1) return { observacionesLimpias: obs };

  const obsLimpia = obs.substring(0, idx).trim();
  const jsonStr = obs.substring(idx + separador.length).trim();

  try {
    const datos = JSON.parse(jsonStr);
    return {
      observacionesLimpias: obsLimpia,
      criteriosExtintor: datos.criteriosExtintor || undefined,
      infoExtintor: datos.infoExtintor || undefined,
      elementosBotiquin: datos.elementosBotiquin || undefined,
      elementosCamilla: datos.elementosCamilla || undefined,
      elementosKit: datos.elementosKit || undefined,
      verificacionesKit: datos.verificacionesKit || undefined,
    };
  } catch {
    console.error("Error parseando datos detallados de observaciones");
    return { observacionesLimpias: obs };
  }
}

// Criterios por categoría
function getCriteriosCategoria(cat: string): { key: keyof DetalleEquipo; label: string }[] {
  const base: { key: keyof DetalleEquipo; label: string }[] = [
    { key: "estadoGeneral", label: "Estado General" },
    { key: "senalizacion", label: "Señalización" },
    { key: "accesibilidad", label: "Accesibilidad" },
  ];

  switch (cat) {
    case "Extintor":
      return [
        ...base,
        { key: "presionManometro", label: "Presión" },
        { key: "manguera", label: "Manguera" },
        { key: "pinSeguridad", label: "Pin Seg." },
        { key: "soporteBase", label: "Soporte" },
      ];
    case "Kit Derrames":
      return [
        ...base,
        { key: "completitud", label: "Completitud" },
        { key: "estadoContenedor", label: "Contenedor" },
      ];
    case "Botiquin":
    case "Botiquín":
      return [
        ...base,
        { key: "completitud", label: "Completitud" },
        { key: "estadoContenedor", label: "Contenedor" },
      ];
    case "Camilla":
      return [
        ...base,
        { key: "estructura", label: "Estructura" },
        { key: "correas", label: "Correas" },
      ];
    default:
      return base;
  }
}

const CATEGORIA_ORDER = ["Extintor", "Botiquin", "Botiquín", "Kit Derrames", "Camilla"];

function sortCategorias(categorias: string[]): string[] {
  return categorias.sort((a, b) => {
    const idxA = CATEGORIA_ORDER.indexOf(a);
    const idxB = CATEGORIA_ORDER.indexOf(b);
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

// Helpers para identificar tipo real de responsable por ID de firma
function parseIdFirma(idFirma: string): { tipoReal: "AREA" | "SST" | "COPASST"; areaSlug: string | null } {
  if (!idFirma) return { tipoReal: "SST", areaSlug: null };
  const matchArea = idFirma.match(/-AREA-(.+)$/);
  if (matchArea) return { tipoReal: "AREA", areaSlug: matchArea[1] };
  if (idFirma.includes("-COPASST-")) return { tipoReal: "COPASST", areaSlug: null };
  if (idFirma.includes("-SST-")) return { tipoReal: "SST", areaSlug: null };
  return { tipoReal: "SST", areaSlug: null };
}

function areaToSlug(area: string): string {
  return area.replace(/\s+/g, "");
}

// ══════════════════════════════════════════════════════════
// Generar PDF de inspección
// ══════════════════════════════════════════════════════════
function generarPDFInspeccion(
  insp: InspeccionCompleta,
  logoBase64: string | null,
  categoriaFiltro?: string,
): Buffer {
  // Filtrar detalles por categoría si se especifica
  const detallesFiltrados = categoriaFiltro
    ? insp.detalles.filter(
        (d) => normalizarCategoria(d.categoria) === normalizarCategoria(categoriaFiltro),
      )
    : insp.detalles;
  const insp_ = categoriaFiltro ? { ...insp, detalles: detallesFiltrados } : insp;

  // Formato oficial según la categoría
  const formato = categoriaFiltro
    ? (FORMATO_POR_CATEGORIA[normalizarCategoria(categoriaFiltro)] ?? FORMATO_DEFAULT)
    : FORMATO_DEFAULT;

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

  // Fondo azul encabezado
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
      doc.addImage(logoBase64, "PNG", margin + 5, currentY + 3, 30, 16);
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
  doc.text(formato.nombre.toUpperCase(), empresaX + empresaWidth / 2, currentY + 2 * headerHeight / 3 + 5, { align: "center" });

  // Columna derecha: Código + Versión + Fecha
  const codigoX = margin + logoWidth + empresaWidth;
  doc.rect(codigoX, currentY, codigoWidth, headerHeight / 3, "S");
  doc.setFontSize(8);
  doc.text(`CÓDIGO: ${formato.codigo}`, codigoX + codigoWidth / 2, currentY + 5, { align: "center" });

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

  const responsableInsp = insp.responsables.find(r => parseIdFirma(r.idFirma).tipoReal === "SST")
    || insp.responsables.find(r => r.tipo === "Responsable");
  const responsableCOPASST = insp.responsables.find(r => parseIdFirma(r.idFirma).tipoReal === "COPASST")
    || insp.responsables.find(r => r.tipo === "COPASST");

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
  doc.text("RESP. INSPECCIÓN:", margin + col1Width + col2Width + 2, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  const nombreInsp = responsableInsp?.nombre || insp.inspector;
  doc.setFontSize(nombreInsp.length > 30 ? 6 : 7);
  doc.text(nombreInsp, margin + col1Width + col2Width + col3Width + col4Width / 2, currentY + 5.5, { align: "center" });
  currentY += rowHeight;

  // Fila 2: COPASST | Cargo
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
  doc.text("RESP. COPASST:", margin + 2, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(responsableCOPASST?.nombre || "", margin + col1Width + col2Width / 2, currentY + 5.5, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text("CARGO:", margin + col1Width + col2Width + 2, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(responsableInsp?.cargo || "", margin + col1Width + col2Width + col3Width + col4Width / 2, currentY + 5.5, { align: "center" });
  currentY += rowHeight + 5;

  // ═══════════════════════════════════════════════════════
  // EQUIPOS AGRUPADOS POR ÁREA → CATEGORÍA
  // ═══════════════════════════════════════════════════════

  // Agrupar detalles por área
  const detallesPorArea: Record<string, DetalleEquipo[]> = {};
  insp_.detalles.forEach((det) => {
    const area = det.area || "Sin Área";
    if (!detallesPorArea[area]) detallesPorArea[area] = [];
    detallesPorArea[area].push(det);
  });

  const areas = Object.keys(detallesPorArea).sort();

  // Identificar responsables globales
  const respGlobalSST = insp.responsables.find(r => parseIdFirma(r.idFirma).tipoReal === "SST")
    || insp.responsables.find(r => r.tipo === "Responsable" && !r.idFirma?.includes("-AREA-"));
  const respGlobalCOPASST = insp.responsables.find(r => parseIdFirma(r.idFirma).tipoReal === "COPASST")
    || insp.responsables.find(r => r.tipo === "COPASST");

  areas.forEach((area) => {
    const detArea = detallesPorArea[area];

    // Verificar espacio para título de área
    if (currentY + 15 > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }

    // ── TÍTULO DE ÁREA ──
    doc.setFillColor(46, 125, 50); // Verde oscuro
    doc.rect(margin, currentY, contentWidth, 8, "FD");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.WHITE);
    doc.text(`ÁREA: ${area.toUpperCase()} (${detArea.length} equipos)`, margin + contentWidth / 2, currentY + 5.5, { align: "center" });
    doc.setTextColor(...COLORS.BLACK);
    currentY += 10;

    // Agrupar por categoría dentro del área
    const detallesPorCategoria: Record<string, DetalleEquipo[]> = {};
    detArea.forEach((det) => {
      const cat = det.categoria || "Otro";
      if (!detallesPorCategoria[cat]) detallesPorCategoria[cat] = [];
      detallesPorCategoria[cat].push(det);
    });

    const categorias = sortCategorias(Object.keys(detallesPorCategoria));

    categorias.forEach((categoria) => {
    const detalles = detallesPorCategoria[categoria];
    const criterios = getCriteriosCategoria(categoria);

    // Verificar espacio para tabla
    if (currentY + 30 > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }

    // Preparar datos para autoTable
    const head = [
      [
        { content: "Área", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
        { content: "Equipo", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
        ...criterios.map(c => ({
          content: c.label,
          styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const },
        })),
        { content: "Venc.", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
        { content: "Observaciones", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
      ],
    ];

    const body = detalles.map((det) => {
      const rowArr: (string | { content: string; styles?: object })[] = [
        det.area,
        det.equipoNombre || det.equipoCodigo || det.idDetalle,
      ];

      criterios.forEach((c) => {
        const rawVal = det[c.key];
        const val = typeof rawVal === "string" ? rawVal : "";
        const styles: Record<string, unknown> = { halign: "center" as const };
        if (val === "Bueno") styles.textColor = [0, 128, 0];
        if (val === "Malo") styles.textColor = [200, 0, 0];
        rowArr.push({ content: val, styles });
      });

      rowArr.push(formatFechaLarga(det.fechaVencimiento));
      rowArr.push(det.observacionesLimpias);
      return rowArr;
    });

    // Título de categoría
    doc.setFillColor(...COLORS.CAT_BLUE);
    doc.rect(margin, currentY, contentWidth, 7, "FD");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.WHITE);
    doc.text(`${categoria.toUpperCase()} (${detalles.length})`, margin + contentWidth / 2, currentY + 5, { align: "center" });
    doc.setTextColor(...COLORS.BLACK);
    currentY += 7;

    // Calcular anchos de columna
    const numCriterios = criterios.length;
    const areaWidth = 28;
    const equipoWidth = 38;
    const vencWidth = 22;
    const obsWidth = 35;
    const criterioTotalWidth = contentWidth - areaWidth - equipoWidth - vencWidth - obsWidth;
    const criterioWidth = criterioTotalWidth / numCriterios;

    const columnStyles: Record<number, object> = {
      0: { cellWidth: areaWidth },
      1: { cellWidth: equipoWidth },
    };
    criterios.forEach((_, idx) => {
      columnStyles[idx + 2] = { cellWidth: criterioWidth, halign: "center" as const };
    });
    columnStyles[numCriterios + 2] = { cellWidth: vencWidth, halign: "center" as const };
    columnStyles[numCriterios + 3] = { cellWidth: obsWidth };

    autoTable(doc, {
      startY: currentY,
      head,
      body,
      columnStyles,
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

    // ═══════════════════════════════════════════════════════
    // DETALLE ESPECÍFICO POR EQUIPO (datos de ---DATOS_DETALLADOS---)
    // ═══════════════════════════════════════════════════════
    const detallesConDatos = detalles.filter(
      (d) => d.criteriosExtintor || d.infoExtintor || d.elementosBotiquin || d.elementosCamilla || d.elementosKit || d.verificacionesKit
    );

    if (detallesConDatos.length > 0) {
      // Título de sección detallada
      if (currentY + 15 > pageHeight - margin) { doc.addPage(); currentY = margin; }
      doc.setFillColor(100, 100, 100);
      doc.rect(margin, currentY, contentWidth, 6, "FD");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.WHITE);
      doc.text(`DETALLE ESPECÍFICO — ${categoria.toUpperCase()}`, margin + contentWidth / 2, currentY + 4, { align: "center" });
      doc.setTextColor(...COLORS.BLACK);
      currentY += 8;

      detallesConDatos.forEach((det) => {
        const nombreEquipo = det.equipoNombre || det.equipoCodigo || det.idDetalle;

        // ── EXTINTOR ──
        if (det.criteriosExtintor || det.infoExtintor) {
          if (currentY + 25 > pageHeight - margin) { doc.addPage(); currentY = margin; }

          // Info snapshot del extintor
          if (det.infoExtintor) {
            doc.setFillColor(245, 245, 245);
            doc.rect(margin, currentY, contentWidth, 10, "FD");
            doc.setDrawColor(...COLORS.BLACK);
            doc.rect(margin, currentY, contentWidth, 10, "S");
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.text(`${nombreEquipo}`, margin + 3, currentY + 4);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            const infoText = [
              det.infoExtintor.claseAgente ? `Clase/Agente: ${det.infoExtintor.claseAgente}` : null,
              det.infoExtintor.tipoExtintor ? `Tipo: ${det.infoExtintor.tipoExtintor}` : null,
              det.infoExtintor.capacidad ? `Capacidad: ${det.infoExtintor.capacidad}` : null,
              det.infoExtintor.fechaProximaRecarga ? `Próxima Recarga: ${formatFechaLarga(det.infoExtintor.fechaProximaRecarga)}` : null,
            ].filter(Boolean).join("  |  ");
            doc.text(infoText, margin + 3, currentY + 8);
            currentY += 12;
          } else {
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.text(`${nombreEquipo}`, margin + 3, currentY + 4);
            currentY += 6;
          }

          // Tabla de criterios detallados del extintor
          if (det.criteriosExtintor) {
            const critEntries = Object.entries(det.criteriosExtintor);
            if (critEntries.length > 0) {
              const critHead = [[
                { content: "Criterio", styles: { fillColor: COLORS.HEADER_BLUE, halign: "left" as const } },
                { content: "Estado", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
              ]];
              const critBody = critEntries.map(([nombre, val]) => {
                const estado = val?.estado || "—";
                const styles: Record<string, unknown> = { halign: "center" as const };
                if (estado === "Bueno" || estado === "Sí") styles.textColor = [0, 128, 0];
                if (estado === "Malo" || estado === "No") styles.textColor = [200, 0, 0];
                return [nombre, { content: estado, styles }];
              });
              // Agregar observaciones del equipo como fila final
              if (det.observacionesLimpias) {
                critBody.push(["Observaciones", det.observacionesLimpias]);
              }

              autoTable(doc, {
                startY: currentY,
                head: critHead,
                body: critBody,
                columnStyles: { 0: { cellWidth: contentWidth * 0.6 }, 1: { cellWidth: contentWidth * 0.4, halign: "center" as const } },
                headStyles: { fillColor: COLORS.HEADER_BLUE, textColor: COLORS.BLACK, fontStyle: "bold", fontSize: 6.5 },
                bodyStyles: { fontSize: 6.5, textColor: COLORS.BLACK },
                alternateRowStyles: { fillColor: COLORS.LIGHT_GRAY },
                tableLineColor: COLORS.BLACK, tableLineWidth: 0.1,
                margin: { left: margin, right: margin },
                theme: "grid",
              });
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              currentY = (doc as any).lastAutoTable.finalY + 4;
            }
          }
        }

        // ── BOTIQUÍN ──
        if (det.elementosBotiquin) {
          if (currentY + 15 > pageHeight - margin) { doc.addPage(); currentY = margin; }
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.text(`${nombreEquipo}`, margin + 3, currentY + 4);
          currentY += 6;

          const elemEntries = Object.entries(det.elementosBotiquin);
          if (elemEntries.length > 0) {
            const elemHead = [[
              { content: "Elemento", styles: { fillColor: COLORS.HEADER_BLUE, halign: "left" as const } },
              { content: "Estado", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
              { content: "Cantidad", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
              { content: "Vencimiento", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
            ]];
            const elemBody = elemEntries.map(([nombre, val]) => {
              const estado = val?.estado || "—";
              const styles: Record<string, unknown> = { halign: "center" as const };
              if (estado === "Bueno") styles.textColor = [0, 128, 0];
              if (estado === "Malo") styles.textColor = [200, 0, 0];
              return [
                nombre,
                { content: estado, styles },
                { content: val?.cantidad || "—", styles: { halign: "center" as const } },
                { content: formatFechaLarga(val?.fechaVencimiento) || "—", styles: { halign: "center" as const } },
              ];
            });

            autoTable(doc, {
              startY: currentY,
              head: elemHead,
              body: elemBody,
              columnStyles: {
                0: { cellWidth: contentWidth * 0.35 },
                1: { cellWidth: contentWidth * 0.20, halign: "center" as const },
                2: { cellWidth: contentWidth * 0.20, halign: "center" as const },
                3: { cellWidth: contentWidth * 0.25, halign: "center" as const },
              },
              headStyles: { fillColor: COLORS.HEADER_BLUE, textColor: COLORS.BLACK, fontStyle: "bold", fontSize: 6.5 },
              bodyStyles: { fontSize: 6.5, textColor: COLORS.BLACK },
              alternateRowStyles: { fillColor: COLORS.LIGHT_GRAY },
              tableLineColor: COLORS.BLACK, tableLineWidth: 0.1,
              margin: { left: margin, right: margin },
              theme: "grid",
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            currentY = (doc as any).lastAutoTable.finalY + 4;
          }
        }

        // ── CAMILLA ──
        if (det.elementosCamilla) {
          if (currentY + 15 > pageHeight - margin) { doc.addPage(); currentY = margin; }
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.text(`${nombreEquipo}`, margin + 3, currentY + 4);
          currentY += 6;

          const elemEntries = Object.entries(det.elementosCamilla);
          if (elemEntries.length > 0) {
            const elemHead = [[
              { content: "Elemento", styles: { fillColor: COLORS.HEADER_BLUE, halign: "left" as const } },
              { content: "Estado", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
            ]];
            const elemBody = elemEntries.map(([nombre, val]) => {
              const estado = val?.estado || "—";
              const styles: Record<string, unknown> = { halign: "center" as const };
              if (estado === "Bueno") styles.textColor = [0, 128, 0];
              if (estado === "Malo") styles.textColor = [200, 0, 0];
              return [nombre, { content: estado, styles }];
            });

            autoTable(doc, {
              startY: currentY,
              head: elemHead,
              body: elemBody,
              columnStyles: {
                0: { cellWidth: contentWidth * 0.6 },
                1: { cellWidth: contentWidth * 0.4, halign: "center" as const },
              },
              headStyles: { fillColor: COLORS.HEADER_BLUE, textColor: COLORS.BLACK, fontStyle: "bold", fontSize: 6.5 },
              bodyStyles: { fontSize: 6.5, textColor: COLORS.BLACK },
              alternateRowStyles: { fillColor: COLORS.LIGHT_GRAY },
              tableLineColor: COLORS.BLACK, tableLineWidth: 0.1,
              margin: { left: margin, right: margin },
              theme: "grid",
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            currentY = (doc as any).lastAutoTable.finalY + 4;
          }
        }

        // ── KIT DERRAMES ──
        if (det.elementosKit) {
          if (currentY + 15 > pageHeight - margin) { doc.addPage(); currentY = margin; }
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.text(`${nombreEquipo}`, margin + 3, currentY + 4);
          currentY += 6;

          const elemEntries = Object.entries(det.elementosKit);
          if (elemEntries.length > 0) {
            const elemHead = [[
              { content: "Elemento", styles: { fillColor: COLORS.HEADER_BLUE, halign: "left" as const } },
              { content: "Estado", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
              { content: "Cantidad", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
              { content: "Vencimiento", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
            ]];
            const elemBody = elemEntries.map(([nombre, val]) => {
              const estado = val?.estado || "—";
              const styles: Record<string, unknown> = { halign: "center" as const };
              if (estado === "Bueno") styles.textColor = [0, 128, 0];
              if (estado === "Malo") styles.textColor = [200, 0, 0];
              return [
                nombre,
                { content: estado, styles },
                { content: val?.cantidad || "—", styles: { halign: "center" as const } },
                { content: formatFechaLarga(val?.fechaVencimiento) || "—", styles: { halign: "center" as const } },
              ];
            });

            autoTable(doc, {
              startY: currentY,
              head: elemHead,
              body: elemBody,
              columnStyles: {
                0: { cellWidth: contentWidth * 0.35 },
                1: { cellWidth: contentWidth * 0.20, halign: "center" as const },
                2: { cellWidth: contentWidth * 0.20, halign: "center" as const },
                3: { cellWidth: contentWidth * 0.25, halign: "center" as const },
              },
              headStyles: { fillColor: COLORS.HEADER_BLUE, textColor: COLORS.BLACK, fontStyle: "bold", fontSize: 6.5 },
              bodyStyles: { fontSize: 6.5, textColor: COLORS.BLACK },
              alternateRowStyles: { fillColor: COLORS.LIGHT_GRAY },
              tableLineColor: COLORS.BLACK, tableLineWidth: 0.1,
              margin: { left: margin, right: margin },
              theme: "grid",
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            currentY = (doc as any).lastAutoTable.finalY + 4;
          }

          // Verificaciones generales del kit
          if (det.verificacionesKit) {
            if (currentY + 15 > pageHeight - margin) { doc.addPage(); currentY = margin; }
            doc.setFillColor(100, 100, 100);
            doc.rect(margin, currentY, contentWidth, 6, "FD");
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...COLORS.WHITE);
            doc.text("VERIFICACIONES GENERALES DEL KIT", margin + contentWidth / 2, currentY + 4, { align: "center" });
            doc.setTextColor(...COLORS.BLACK);
            currentY += 7;

            const verHead = [[
              { content: "Criterio", styles: { fillColor: COLORS.HEADER_BLUE, halign: "left" as const } },
              { content: "Cumple", styles: { fillColor: COLORS.HEADER_BLUE, halign: "center" as const } },
            ]];
            const verBody = Object.entries(det.verificacionesKit).map(([nombre, val]) => {
              const cumple = val?.respuesta === true ? "Sí" : val?.respuesta === false ? "No" : "—";
              const styles: Record<string, unknown> = { halign: "center" as const };
              if (cumple === "Sí") styles.textColor = [0, 128, 0];
              if (cumple === "No") styles.textColor = [200, 0, 0];
              return [nombre, { content: cumple, styles }];
            });

            autoTable(doc, {
              startY: currentY,
              head: verHead,
              body: verBody,
              columnStyles: {
                0: { cellWidth: contentWidth * 0.7 },
                1: { cellWidth: contentWidth * 0.3, halign: "center" as const },
              },
              headStyles: { fillColor: COLORS.HEADER_BLUE, textColor: COLORS.BLACK, fontStyle: "bold", fontSize: 6.5 },
              bodyStyles: { fontSize: 6.5, textColor: COLORS.BLACK },
              alternateRowStyles: { fillColor: COLORS.LIGHT_GRAY },
              tableLineColor: COLORS.BLACK, tableLineWidth: 0.1,
              margin: { left: margin, right: margin },
              theme: "grid",
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            currentY = (doc as any).lastAutoTable.finalY + 4;
          }
        }
      }); // end detallesConDatos.forEach
    } // end if detallesConDatos

    });

    // ═══════════════════════════════════════════════════════
    // FIRMAS DEL ÁREA
    // ═══════════════════════════════════════════════════════

    // Buscar responsable del área por ID de firma
    const respArea = insp.responsables.find(r => {
      const parsed = parseIdFirma(r.idFirma);
      return parsed.tipoReal === "AREA" && parsed.areaSlug === areaToSlug(area);
    });

    if (currentY + 60 > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }

    const firmaWidth = contentWidth / 3;
    const firmaBoxHeight = 22;
    const firmaInfoHeight = 14;

    const firmas = [
      {
        titulo: "FIRMA RESPONSABLE\nDE ÁREA",
        nombre: respArea?.nombre || "",
        cargo: respArea?.cargo || "Responsable de Área",
        cedula: respArea?.cedula || "",
        firmaDataUrl: extractSignatureDataUrl(respArea?.firmaHash),
      },
      {
        titulo: "FIRMA RESPONSABLE\nSST",
        nombre: respGlobalSST?.nombre || insp.inspector,
        cargo: respGlobalSST?.cargo || "Responsable SST",
        cedula: respGlobalSST?.cedula || "",
        firmaDataUrl: extractSignatureDataUrl(respGlobalSST?.firmaHash),
      },
      {
        titulo: "FIRMA RESPONSABLE\nCOPASST",
        nombre: respGlobalCOPASST?.nombre || "",
        cargo: respGlobalCOPASST?.cargo || "Integrante COPASST",
        cedula: respGlobalCOPASST?.cedula || "",
        firmaDataUrl: extractSignatureDataUrl(respGlobalCOPASST?.firmaHash),
      },
    ];

    // Título de sección de firmas del área
    doc.setFillColor(...COLORS.HEADER_BLUE);
    doc.rect(margin, currentY, contentWidth, 7, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.BLACK);
    doc.text(`RESPONSABLES Y FIRMAS — ${area.toUpperCase()}`, margin + contentWidth / 2, currentY + 5, { align: "center" });
    currentY += 7;

    firmas.forEach((firma, idx) => {
      const x = margin + idx * firmaWidth;

      // Cuadro para firma
      doc.setDrawColor(...COLORS.BLACK);
      doc.setFillColor(...COLORS.WHITE);
      doc.rect(x, currentY, firmaWidth, firmaBoxHeight, "FD");

      // Imagen de firma si existe
      if (firma.firmaDataUrl) {
        try {
          const imgWidth = firmaWidth - 10;
          const imgHeight = firmaBoxHeight - 6;
          doc.addImage(firma.firmaDataUrl, "PNG", x + 5, currentY + 3, imgWidth, imgHeight);
        } catch (e) {
          console.error("Error adding signature image:", e);
        }
      }

      // Título de firma
      doc.setFillColor(...COLORS.HEADER_BLUE);
      doc.rect(x, currentY + firmaBoxHeight, firmaWidth, 8, "FD");
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.BLACK);
      const tituloLines = firma.titulo.split("\n");
      doc.text(tituloLines[0], x + firmaWidth / 2, currentY + firmaBoxHeight + 3.5, { align: "center" });
      if (tituloLines[1]) {
        doc.text(tituloLines[1], x + firmaWidth / 2, currentY + firmaBoxHeight + 6.5, { align: "center" });
      }

      // Info del firmante
      doc.setFillColor(...COLORS.WHITE);
      doc.rect(x, currentY + firmaBoxHeight + 8, firmaWidth, firmaInfoHeight, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      const infoY = currentY + firmaBoxHeight + 11;

      doc.text("NOMBRE:", x + 2, infoY);
      doc.setFont("helvetica", "normal");
      const nombreText = firma.nombre || "(Sin firmar)";
      doc.setFontSize(nombreText.length > 25 ? 5 : 6);
      doc.text(nombreText, x + 2, infoY + 3.5);

      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text("CARGO:", x + 2, infoY + 7);
      doc.setFont("helvetica", "normal");
      const cargoText = firma.cargo;
      doc.setFontSize(cargoText.length > 25 ? 5 : 6);
      doc.text(cargoText, x + 2, infoY + 10);
    });

    currentY += firmaBoxHeight + 8 + firmaInfoHeight + 8; // Espacio entre áreas
  });

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

  return Buffer.from(doc.output("arraybuffer"));
}

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-equipos/exportar-pdf
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const { idInspeccion, categoria } = await request.json();

    const {
      inspEquiposFields,
      detalleEquiposFields,
      respEquiposFields,
      equiposFields,
    } = airtableSGSSTConfig;

    // ── 1. Obtener inspección(es) ───────────────────────
    const url = getSGSSTUrl(airtableSGSSTConfig.inspEquiposTableId);
    const extraParams: Record<string, string> = {
      [`sort[0][field]`]: inspEquiposFields.FECHA,
      [`sort[0][direction]`]: "desc",
    };

    if (idInspeccion) {
      extraParams.filterByFormula = `{${inspEquiposFields.ID}} = '${idInspeccion}'`;
    }

    const cabeceraRecords = await fetchAllRecords(url, getSGSSTHeaders(), extraParams);

    if (cabeceraRecords.length === 0) {
      return NextResponse.json(
        { success: false, message: "No hay inspecciones para exportar" },
        { status: 400 }
      );
    }

    // ── 2. Obtener todos los detalles ───────────────────
    const detalleUrl = getSGSSTUrl(airtableSGSSTConfig.detalleEquiposTableId);
    const detalleRecords = await fetchAllRecords(detalleUrl, getSGSSTHeaders());

    // Resolver nombres de equipos
    const equipoIds = detalleRecords
      .map((r) => {
        const links = r.fields[detalleEquiposFields.EQUIPO_LINK] as string[] | undefined;
        return links?.[0];
      })
      .filter(Boolean) as string[];

    const equipoNames: Record<string, { nombre: string; codigo: string }> = {};
    const uniqueEquipoIds = [...new Set(equipoIds)];

    for (let i = 0; i < uniqueEquipoIds.length; i += 10) {
      const batch = uniqueEquipoIds.slice(i, i + 10);
      const formula = `OR(${batch.map((eid) => `RECORD_ID()='${eid}'`).join(",")})`;
      const eqParams = new URLSearchParams({
        filterByFormula: formula,
        returnFieldsByFieldId: "true",
      });

      const eqRes = await fetch(
        `${getSGSSTUrl(airtableSGSSTConfig.equiposTableId)}?${eqParams.toString()}`,
        { headers: getSGSSTHeaders(), cache: "no-store" }
      );

      if (eqRes.ok) {
        const eqData: AirtableResponse = await eqRes.json();
        eqData.records.forEach((r) => {
          equipoNames[r.id] = {
            nombre: (r.fields[equiposFields.NOMBRE] as string) || "",
            codigo: (r.fields[equiposFields.CODIGO] as string) || "",
          };
        });
      }
    }

    // Mapear detalles por inspección recordId
    const detallesMap: Record<string, DetalleEquipo[]> = {};
    detalleRecords.forEach((r) => {
      const links = r.fields[detalleEquiposFields.INSPECCION_LINK] as string[] || [];
      const equipoLink = (r.fields[detalleEquiposFields.EQUIPO_LINK] as string[])?.[0];
      const equipoInfo = equipoLink ? equipoNames[equipoLink] : undefined;

      links.forEach((inspId) => {
        if (!detallesMap[inspId]) detallesMap[inspId] = [];

        const obsRaw = (r.fields[detalleEquiposFields.OBSERVACIONES] as string) || "";
        const parsed = parseObservacionesDetalladas(obsRaw);

        detallesMap[inspId].push({
          id: r.id,
          inspeccionRecordId: inspId,
          idDetalle: (r.fields[detalleEquiposFields.ID] as string) || "",
          categoria: (r.fields[detalleEquiposFields.CATEGORIA] as string) || "",
          area: (r.fields[detalleEquiposFields.AREA] as string) || "",
          equipoNombre: equipoInfo?.nombre || "",
          equipoCodigo: equipoInfo?.codigo || "",
          estadoGeneral: (r.fields[detalleEquiposFields.ESTADO_GENERAL] as string) || "",
          senalizacion: (r.fields[detalleEquiposFields.SENALIZACION] as string) || "",
          accesibilidad: (r.fields[detalleEquiposFields.ACCESIBILIDAD] as string) || "",
          presionManometro: (r.fields[detalleEquiposFields.PRESION_MANOMETRO] as string) || "",
          manguera: (r.fields[detalleEquiposFields.MANGUERA] as string) || "",
          pinSeguridad: (r.fields[detalleEquiposFields.PIN_SEGURIDAD] as string) || "",
          soporteBase: (r.fields[detalleEquiposFields.SOPORTE_BASE] as string) || "",
          completitud: (r.fields[detalleEquiposFields.COMPLETITUD] as string) || "",
          estadoContenedor: (r.fields[detalleEquiposFields.ESTADO_CONTENEDOR] as string) || "",
          estructura: (r.fields[detalleEquiposFields.ESTRUCTURA] as string) || "",
          correas: (r.fields[detalleEquiposFields.CORREAS] as string) || "",
          fechaVencimiento: (r.fields[detalleEquiposFields.FECHA_VENCIMIENTO] as string) || "",
          observaciones: obsRaw,
          observacionesLimpias: parsed.observacionesLimpias,
          criteriosExtintor: parsed.criteriosExtintor,
          infoExtintor: parsed.infoExtintor,
          elementosBotiquin: parsed.elementosBotiquin,
          elementosCamilla: parsed.elementosCamilla,
          elementosKit: parsed.elementosKit,
          verificacionesKit: parsed.verificacionesKit,
        });
      });
    });

    // ── 3. Obtener responsables ─────────────────────────
    const respUrl = getSGSSTUrl(airtableSGSSTConfig.respEquiposTableId);
    const respRecords = await fetchAllRecords(respUrl, getSGSSTHeaders());

    const responsablesMap: Record<string, Responsable[]> = {};
    respRecords.forEach((r) => {
      const links = r.fields[respEquiposFields.INSPECCION_LINK] as string[] || [];
      links.forEach((inspId) => {
        if (!responsablesMap[inspId]) responsablesMap[inspId] = [];
        responsablesMap[inspId].push({
          id: r.id,
          inspeccionRecordId: inspId,
          idFirma: (r.fields[respEquiposFields.ID_FIRMA] as string) || "",
          tipo: (r.fields[respEquiposFields.TIPO] as string) || "",
          nombre: (r.fields[respEquiposFields.NOMBRE] as string) || "",
          cedula: (r.fields[respEquiposFields.CEDULA] as string) || "",
          cargo: (r.fields[respEquiposFields.CARGO] as string) || "",
          fechaFirma: (r.fields[respEquiposFields.FECHA_FIRMA] as string) || "",
          firmaHash: (r.fields[respEquiposFields.FIRMA] as string) || undefined,
        });
      });
    });

    // ── 4. Cargar logo ──────────────────────────────────
    let logoBase64: string | null = null;
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      }
    } catch { /* ignore */ }

    // ── 5. Generar PDF ──────────────────────────────────
    // Generar un PDF por inspección; si es individual, uno solo; si son todos, el primero
    // (para exportar todos se usa Excel; PDF es para reporte individual)
    const inspecciones: InspeccionCompleta[] = cabeceraRecords.map((r) => ({
      recordId: r.id,
      idInspeccion: (r.fields[inspEquiposFields.ID] as string) || "",
      fecha: (r.fields[inspEquiposFields.FECHA] as string) || "",
      inspector: (r.fields[inspEquiposFields.INSPECTOR] as string) || "",
      estado: (r.fields[inspEquiposFields.ESTADO] as string) || "",
      observaciones: (r.fields[inspEquiposFields.OBSERVACIONES] as string) || "",
      detalles: detallesMap[r.id] || [],
      responsables: responsablesMap[r.id] || [],
    }));

    // Para exportación masiva, generar PDF multipágina
    const targetInsp = inspecciones[0];
    if (!targetInsp) {
      return NextResponse.json(
        { success: false, message: "No hay inspecciones para exportar" },
        { status: 400 }
      );
    }

    const pdfBuffer = generarPDFInspeccion(targetInsp, logoBase64, categoria || undefined);
    const catSlug = categoria ? `_${categoria.replace(/\s+/g, "_")}` : "";
    const filename = idInspeccion
      ? `Inspeccion${catSlug}_${idInspeccion}.pdf`
      : `Inspecciones_Equipos_${new Date().toISOString().split("T")[0]}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-equipos/exportar-pdf:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
