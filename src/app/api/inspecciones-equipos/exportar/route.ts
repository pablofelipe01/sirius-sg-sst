import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
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
// Colores y estilos
// ══════════════════════════════════════════════════════════
const COLORS = {
  HEADER_BLUE: "8DB4E2",
  WHITE: "FFFFFF",
  BLACK: "000000",
  LIGHT_GRAY: "F2F2F2",
};

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: `FF${COLORS.BLACK}` } },
  left: { style: "thin", color: { argb: `FF${COLORS.BLACK}` } },
  bottom: { style: "thin", color: { argb: `FF${COLORS.BLACK}` } },
  right: { style: "thin", color: { argb: `FF${COLORS.BLACK}` } },
};

const headerFill: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: `FF${COLORS.HEADER_BLUE}` },
};

const lightGrayFill: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: `FF${COLORS.LIGHT_GRAY}` },
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
        { key: "presionManometro", label: "Presión Manómetro" },
        { key: "manguera", label: "Manguera" },
        { key: "pinSeguridad", label: "Pin Seguridad" },
        { key: "soporteBase", label: "Soporte/Base" },
      ];
    case "Kit Derrames":
      return [
        ...base,
        { key: "completitud", label: "Completitud Elementos" },
        { key: "estadoContenedor", label: "Estado Contenedor" },
      ];
    case "Botiquin":
    case "Botiquín":
      return [
        ...base,
        { key: "completitud", label: "Completitud Elementos" },
        { key: "estadoContenedor", label: "Estado Contenedor" },
      ];
    case "Camilla":
      return [
        ...base,
        { key: "estructura", label: "Estructura" },
        { key: "correas", label: "Correas/Arnés" },
      ];
    default:
      return base;
  }
}

// Orden de categorías
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
// Generar hoja de inspección con formato institucional
// ══════════════════════════════════════════════════════════
function generarHojaInspeccion(
  wb: ExcelJS.Workbook,
  insp: InspeccionCompleta,
  logoId: number | null
) {
  const sheetName = insp.idInspeccion.substring(0, 31);
  const ws = wb.addWorksheet(sheetName, {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      paperSize: 9,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  // Columnas: Área | Equipo | Categoría | criterios... | Vencimiento | Observaciones
  // Usamos hasta 12 columnas para cubrir todas las categorías
  ws.columns = [
    { width: 18 },  // A: Área
    { width: 24 },  // B: Equipo
    { width: 14 },  // C: Categoría
    { width: 12 },  // D: Estado General
    { width: 12 },  // E: Señalización
    { width: 12 },  // F: Accesibilidad
    { width: 14 },  // G: Criterio 4 (Presión / Completitud / Estructura)
    { width: 14 },  // H: Criterio 5 (Manguera / Contenedor / Correas)
    { width: 12 },  // I: Criterio 6 (Pin Seg.)
    { width: 12 },  // J: Criterio 7 (Soporte)
    { width: 14 },  // K: Vencimiento
    { width: 30 },  // L: Observaciones
  ];

  let row = 1;

  // ═══════════════════════════════════════════════════════
  // ENCABEZADO INSTITUCIONAL
  // ═══════════════════════════════════════════════════════

  // Fila 1: Logo | Empresa | Código
  ws.mergeCells(row, 1, row + 2, 2);
  if (logoId !== null) {
    ws.addImage(logoId, {
      tl: { col: 0.1, row: row - 0.8 },
      ext: { width: 110, height: 38 },
    });
  }
  ws.getCell(row, 1).border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

  ws.mergeCells(row, 3, row, 10);
  const empresaCell = ws.getCell(row, 3);
  empresaCell.value = "SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC";
  empresaCell.font = { name: "Arial", size: 10, bold: true };
  empresaCell.alignment = { vertical: "middle", horizontal: "center" };
  empresaCell.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

  ws.mergeCells(row, 11, row, 12);
  const codigoCell = ws.getCell(row, 11);
  codigoCell.value = "CÓDIGO: FT-SST-065";
  codigoCell.font = { name: "Arial", size: 9, bold: true };
  codigoCell.alignment = { vertical: "middle", horizontal: "center" };
  codigoCell.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  ws.getRow(row).height = 18;
  row++;

  // Fila 2: NIT | Versión
  ws.mergeCells(row, 3, row, 10);
  const nitCell = ws.getCell(row, 3);
  nitCell.value = "NIT: 901.377.064-8";
  nitCell.font = { name: "Arial", size: 9 };
  nitCell.alignment = { vertical: "middle", horizontal: "center" };
  nitCell.border = { left: { style: "thin" }, right: { style: "thin" } };

  ws.mergeCells(row, 11, row, 12);
  const versionCell = ws.getCell(row, 11);
  versionCell.value = "VERSIÓN: 001";
  versionCell.font = { name: "Arial", size: 9 };
  versionCell.alignment = { vertical: "middle", horizontal: "center" };
  versionCell.border = { left: { style: "thin" }, right: { style: "thin" } };
  ws.getRow(row).height = 16;
  row++;

  // Fila 3: Nombre formato | Fecha edición
  ws.getCell(row, 1).border = { bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

  ws.mergeCells(row, 3, row, 10);
  const formatoCell = ws.getCell(row, 3);
  formatoCell.value = "FORMATO INSPECCIÓN DE EQUIPOS DE EMERGENCIA";
  formatoCell.font = { name: "Arial", size: 9, bold: true };
  formatoCell.alignment = { vertical: "middle", horizontal: "center" };
  formatoCell.border = { bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

  ws.mergeCells(row, 11, row, 12);
  const fechaEdCell = ws.getCell(row, 11);
  fechaEdCell.value = "FECHA EDICIÓN: 02-02-2026";
  fechaEdCell.font = { name: "Arial", size: 9 };
  fechaEdCell.alignment = { vertical: "middle", horizontal: "center" };
  fechaEdCell.border = { bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  ws.getRow(row).height = 18;
  row++;

  // ═══════════════════════════════════════════════════════
  // DATOS DE LA INSPECCIÓN
  // ═══════════════════════════════════════════════════════

  const responsableInsp = insp.responsables.find(r => parseIdFirma(r.idFirma).tipoReal === "SST")
    || insp.responsables.find(r => r.tipo === "Responsable")
    || { nombre: insp.inspector, cargo: "", cedula: "" };
  const responsableCOPASST = insp.responsables.find(r => parseIdFirma(r.idFirma).tipoReal === "COPASST")
    || insp.responsables.find(r => r.tipo === "COPASST")
    || { nombre: "", cargo: "Integrante COPASST", cedula: "" };

  // Fila: Fecha | Inspector
  ws.mergeCells(row, 1, row, 2);
  const fechaLabelCell = ws.getCell(row, 1);
  fechaLabelCell.value = "FECHA DE INSPECCIÓN:";
  fechaLabelCell.font = { name: "Arial", size: 9, bold: true };
  fechaLabelCell.alignment = { vertical: "middle", horizontal: "left" };
  fechaLabelCell.fill = headerFill;
  fechaLabelCell.border = thinBorder;

  ws.mergeCells(row, 3, row, 5);
  const fechaValCell = ws.getCell(row, 3);
  fechaValCell.value = formatFechaLarga(insp.fecha);
  fechaValCell.font = { name: "Arial", size: 9 };
  fechaValCell.alignment = { vertical: "middle", horizontal: "center" };
  fechaValCell.border = thinBorder;

  ws.mergeCells(row, 6, row, 8);
  const inspLabelCell = ws.getCell(row, 6);
  inspLabelCell.value = "RESPONSABLE INSPECCIÓN:";
  inspLabelCell.font = { name: "Arial", size: 9, bold: true };
  inspLabelCell.alignment = { vertical: "middle", horizontal: "left" };
  inspLabelCell.fill = headerFill;
  inspLabelCell.border = thinBorder;

  ws.mergeCells(row, 9, row, 12);
  const inspValCell = ws.getCell(row, 9);
  inspValCell.value = responsableInsp.nombre || insp.inspector;
  inspValCell.font = { name: "Arial", size: 9 };
  inspValCell.alignment = { vertical: "middle", horizontal: "center" };
  inspValCell.border = thinBorder;
  ws.getRow(row).height = 20;
  row++;

  // Fila: COPASST | Cargo
  ws.mergeCells(row, 1, row, 2);
  const copasstLabelCell = ws.getCell(row, 1);
  copasstLabelCell.value = "RESPONSABLE COPASST:";
  copasstLabelCell.font = { name: "Arial", size: 9, bold: true };
  copasstLabelCell.alignment = { vertical: "middle", horizontal: "left" };
  copasstLabelCell.fill = headerFill;
  copasstLabelCell.border = thinBorder;

  ws.mergeCells(row, 3, row, 5);
  const copasstValCell = ws.getCell(row, 3);
  copasstValCell.value = responsableCOPASST.nombre;
  copasstValCell.font = { name: "Arial", size: 9 };
  copasstValCell.alignment = { vertical: "middle", horizontal: "center" };
  copasstValCell.border = thinBorder;

  ws.mergeCells(row, 6, row, 8);
  const cargoLabelCell = ws.getCell(row, 6);
  cargoLabelCell.value = "CARGO:";
  cargoLabelCell.font = { name: "Arial", size: 9, bold: true };
  cargoLabelCell.alignment = { vertical: "middle", horizontal: "left" };
  cargoLabelCell.fill = headerFill;
  cargoLabelCell.border = thinBorder;

  ws.mergeCells(row, 9, row, 12);
  const cargoValCell = ws.getCell(row, 9);
  cargoValCell.value = responsableInsp.cargo;
  cargoValCell.font = { name: "Arial", size: 9 };
  cargoValCell.alignment = { vertical: "middle", horizontal: "center" };
  cargoValCell.border = thinBorder;
  ws.getRow(row).height = 20;
  row++;

  // Observaciones generales
  if (insp.observaciones) {
    ws.mergeCells(row, 1, row, 2);
    const obsLabelCell = ws.getCell(row, 1);
    obsLabelCell.value = "OBSERVACIONES GENERALES:";
    obsLabelCell.font = { name: "Arial", size: 9, bold: true };
    obsLabelCell.alignment = { vertical: "middle", horizontal: "left" };
    obsLabelCell.fill = headerFill;
    obsLabelCell.border = thinBorder;

    ws.mergeCells(row, 3, row, 12);
    const obsValCell = ws.getCell(row, 3);
    obsValCell.value = insp.observaciones;
    obsValCell.font = { name: "Arial", size: 8 };
    obsValCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    obsValCell.border = thinBorder;
    ws.getRow(row).height = 25;
    row++;
  }

  row++; // Espacio

  // ═══════════════════════════════════════════════════════
  // EQUIPOS AGRUPADOS POR ÁREA → CATEGORÍA
  // ═══════════════════════════════════════════════════════

  // Agrupar detalles por área
  const detallesPorArea: Record<string, DetalleEquipo[]> = {};
  insp.detalles.forEach((det) => {
    const area = det.area || "Sin Área";
    if (!detallesPorArea[area]) detallesPorArea[area] = [];
    detallesPorArea[area].push(det);
  });

  const areas = Object.keys(detallesPorArea).sort();

  // Identificar responsables globales (SST y COPASST)
  const respGlobalSST = insp.responsables.find(r => parseIdFirma(r.idFirma).tipoReal === "SST")
    || insp.responsables.find(r => r.tipo === "Responsable" && !r.idFirma?.includes("-AREA-"));
  const respGlobalCOPASST = insp.responsables.find(r => parseIdFirma(r.idFirma).tipoReal === "COPASST")
    || insp.responsables.find(r => r.tipo === "COPASST");

  areas.forEach((area) => {
    const detArea = detallesPorArea[area];

    // ── TÍTULO DE ÁREA ──
    ws.mergeCells(row, 1, row, 12);
    const areaTitleCell = ws.getCell(row, 1);
    areaTitleCell.value = `ÁREA: ${area.toUpperCase()} (${detArea.length} equipos)`;
    areaTitleCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    areaTitleCell.alignment = { vertical: "middle", horizontal: "center" };
    areaTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E7D32" } };
    areaTitleCell.border = thinBorder;
    ws.getRow(row).height = 24;
    row++;

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

    // Título de categoría
    ws.mergeCells(row, 1, row, 12);
    const catTitleCell = ws.getCell(row, 1);
    catTitleCell.value = `${categoria.toUpperCase()} (${detalles.length})`;
    catTitleCell.font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${COLORS.WHITE}` } };
    catTitleCell.alignment = { vertical: "middle", horizontal: "center" };
    catTitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    catTitleCell.border = thinBorder;
    ws.getRow(row).height = 22;
    row++;

    // Encabezados de columna
    const headers = ["Área", "Equipo", ...criterios.map(c => c.label), "Vencimiento", "Observaciones"];
    // Pad to fill columns
    while (headers.length < 12) {
      headers.splice(headers.length - 2, 0, ""); // Insert empty before Vencimiento
    }

    headers.forEach((h, idx) => {
      const cell = ws.getCell(row, idx + 1);
      cell.value = h;
      cell.font = { name: "Arial", size: 8, bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.fill = headerFill;
      cell.border = thinBorder;
    });
    ws.getRow(row).height = 22;
    row++;

    // Filas de datos
    detalles.forEach((det, detIdx) => {
      // Limpiar observaciones: quitar datos detallados serializados
      const separador = "---DATOS_DETALLADOS---";
      const obsIdx = det.observaciones.indexOf(separador);
      const obsLimpia = obsIdx === -1 ? det.observaciones : det.observaciones.substring(0, obsIdx).trim();

      const rowData: string[] = [
        det.area,
        det.equipoNombre || det.equipoCodigo || det.idDetalle,
      ];

      // Agregar valores de criterios
      criterios.forEach((c) => {
        const val = det[c.key] || "";
        rowData.push(val);
      });

      // Pad con vacíos para criterios faltantes
      while (rowData.length < 10) {
        rowData.push("");
      }

      rowData.push(formatFechaLarga(det.fechaVencimiento));
      rowData.push(obsLimpia);

      // Escribir fila
      const isAlternate = detIdx % 2 === 1;
      rowData.forEach((val, idx) => {
        const cell = ws.getCell(row, idx + 1);
        cell.value = val;
        cell.font = { name: "Arial", size: 8 };
        cell.alignment = {
          vertical: "middle",
          horizontal: idx <= 1 ? "left" : "center",
          wrapText: true,
        };
        cell.border = thinBorder;
        if (isAlternate) cell.fill = lightGrayFill;

        // Colorear estados
        if (idx >= 2 && idx < rowData.length - 2) {
          if (val === "Bueno") {
            cell.font = { name: "Arial", size: 8, color: { argb: "FF006100" } };
          } else if (val === "Malo") {
            cell.font = { name: "Arial", size: 8, bold: true, color: { argb: "FF9C0006" } };
          }
        }
      });

      ws.getRow(row).height = obsLimpia.length > 40 ? 32 : 18;
      row++;
    });

    row++; // Espacio entre categorías
    });

    // ═══════════════════════════════════════════════════════
    // FIRMAS DEL ÁREA
    // ═══════════════════════════════════════════════════════

    // Buscar responsable del área por ID de firma
    const respArea = insp.responsables.find(r => {
      const parsed = parseIdFirma(r.idFirma);
      return parsed.tipoReal === "AREA" && parsed.areaSlug === areaToSlug(area);
    });

    // Título de firmas del área
    ws.mergeCells(row, 1, row, 12);
    const firmasTitleCell = ws.getCell(row, 1);
    firmasTitleCell.value = `RESPONSABLES Y FIRMAS — ${area.toUpperCase()}`;
    firmasTitleCell.font = { name: "Arial", size: 9, bold: true };
    firmasTitleCell.alignment = { vertical: "middle", horizontal: "center" };
    firmasTitleCell.fill = headerFill;
    firmasTitleCell.border = thinBorder;
    ws.getRow(row).height = 20;
    row++;

    const firmaBoxes = [
      {
        titulo: "FIRMA RESPONSABLE DE ÁREA",
        nombre: respArea?.nombre || "",
        cargo: respArea?.cargo || "Responsable de Área",
        cedula: respArea?.cedula || "",
      },
      {
        titulo: "FIRMA RESPONSABLE SST",
        nombre: respGlobalSST?.nombre || insp.inspector,
        cargo: respGlobalSST?.cargo || "Responsable SST",
        cedula: respGlobalSST?.cedula || "",
      },
      {
        titulo: "FIRMA RESPONSABLE COPASST",
        nombre: respGlobalCOPASST?.nombre || "",
        cargo: respGlobalCOPASST?.cargo || "Integrante COPASST",
        cedula: respGlobalCOPASST?.cedula || "",
      },
    ];

    // Espacios para firmas (3 bloques de 4 columnas)
    firmaBoxes.forEach((_, idx) => {
      const colStart = idx * 4 + 1;
      const colEnd = colStart + 3;
      ws.mergeCells(row, colStart, row + 2, colEnd);
      const cell = ws.getCell(row, colStart);
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
    ws.getRow(row).height = 40;
    row += 3;

    // Títulos de firma
    firmaBoxes.forEach((fb, idx) => {
      const colStart = idx * 4 + 1;
      const colEnd = colStart + 3;
      ws.mergeCells(row, colStart, row, colEnd);
      const cell = ws.getCell(row, colStart);
      cell.value = fb.titulo;
      cell.font = { name: "Arial", size: 8, bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
    });
    ws.getRow(row).height = 16;
    row++;

    // Nombres
    firmaBoxes.forEach((fb, idx) => {
      const colStart = idx * 4 + 1;
      const colEnd = colStart + 3;
      ws.mergeCells(row, colStart, row, colEnd);
      const cell = ws.getCell(row, colStart);
      cell.value = fb.nombre;
      cell.font = { name: "Arial", size: 8 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { left: { style: "thin" }, right: { style: "thin" } };
    });
    ws.getRow(row).height = 14;
    row++;

    // Cargos + Cédulas
    firmaBoxes.forEach((fb, idx) => {
      const colStart = idx * 4 + 1;
      const colEnd = colStart + 3;
      ws.mergeCells(row, colStart, row, colEnd);
      const cell = ws.getCell(row, colStart);
      const cedulaText = fb.cedula ? ` — C.C. ${fb.cedula}` : "";
      cell.value = `${fb.cargo}${cedulaText}`;
      cell.font = { name: "Arial", size: 7 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
    });
    ws.getRow(row).height = 14;
    row++;

    row += 2; // Espacio entre áreas
  });
}

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-equipos/exportar
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const { idInspeccion } = await request.json();

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
          observaciones: (r.fields[detalleEquiposFields.OBSERVACIONES] as string) || "",
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
        });
      });
    });

    // ── 4. Construir inspecciones completas ─────────────
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

    // ── 5. Generar Excel ────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = "Sirius SG-SST";
    wb.created = new Date();

    let logoId: number | null = null;
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      if (fs.existsSync(logoPath)) {
        logoId = wb.addImage({ filename: logoPath, extension: "png" });
      }
    } catch { /* ignore */ }

    inspecciones.forEach((insp) => {
      generarHojaInspeccion(wb, insp, logoId);
    });

    const buffer = await wb.xlsx.writeBuffer();
    const filename = idInspeccion
      ? `Inspeccion_Equipos_${idInspeccion}.xlsx`
      : `Inspecciones_Equipos_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-equipos/exportar:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
