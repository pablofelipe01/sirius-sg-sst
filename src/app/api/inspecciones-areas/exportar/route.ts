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
// Colores del Formato Institucional
// ══════════════════════════════════════════════════════════
const COLORS = {
  HEADER_BLUE: "8DB4E2",    // Color solicitado para encabezados
  WHITE: "FFFFFF",
  BLACK: "000000",
  LIGHT_GRAY: "F2F2F2",
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

// Estilos comunes
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
      orientation: "portrait", 
      fitToPage: true, 
      fitToWidth: 1,
      paperSize: 9,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
    },
  });

  // Configurar anchos de columna
  ws.columns = [
    { width: 45 },  // A: Elementos a inspeccionar
    { width: 6 },   // B: B (Bueno)
    { width: 6 },   // C: M (Malo)
    { width: 6 },   // D: N/A
    { width: 30 },  // E: Observación
  ];

  const formatoArea = FORMATO_AREA[insp.area] || { 
    codigo: "FT-SST-060", 
    nombre: `FORMATO INSPECCIÓN ÁREA ${insp.area.toUpperCase()}` 
  };

  let row = 1;

  // ═══════════════════════════════════════════════════════
  // ENCABEZADO INSTITUCIONAL
  // ═══════════════════════════════════════════════════════
  
  // Fila 1: Logo | Empresa | Código
  ws.mergeCells(row, 1, row + 2, 1);
  if (logoId !== null) {
    ws.addImage(logoId, {
      tl: { col: 0.1, row: row - 0.8 },
      ext: { width: 90, height: 35 },
    });
  }
  ws.getCell(row, 1).border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

  ws.mergeCells(row, 2, row, 4);
  const empresaCell = ws.getCell(row, 2);
  empresaCell.value = "SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC";
  empresaCell.font = { name: "Arial", size: 10, bold: true };
  empresaCell.alignment = { vertical: "middle", horizontal: "center" };
  empresaCell.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

  const codigoCell = ws.getCell(row, 5);
  codigoCell.value = `CÓDIGO: ${formatoArea.codigo}`;
  codigoCell.font = { name: "Arial", size: 9, bold: true };
  codigoCell.alignment = { vertical: "middle", horizontal: "center" };
  codigoCell.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  ws.getRow(row).height = 18;
  row++;

  // Fila 2: NIT | Versión
  ws.mergeCells(row, 2, row, 4);
  const nitCell = ws.getCell(row, 2);
  nitCell.value = "NIT: 901.377.064-8";
  nitCell.font = { name: "Arial", size: 9 };
  nitCell.alignment = { vertical: "middle", horizontal: "center" };
  nitCell.border = { left: { style: "thin" }, right: { style: "thin" } };

  const versionCell = ws.getCell(row, 5);
  versionCell.value = "VERSIÓN: 001";
  versionCell.font = { name: "Arial", size: 9 };
  versionCell.alignment = { vertical: "middle", horizontal: "center" };
  versionCell.border = { left: { style: "thin" }, right: { style: "thin" } };
  ws.getRow(row).height = 16;
  row++;

  // Fila 3: Nombre Formato | Fecha Edición
  ws.getCell(row, 1).border = { bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  
  ws.mergeCells(row, 2, row, 4);
  const formatoCell = ws.getCell(row, 2);
  formatoCell.value = formatoArea.nombre;
  formatoCell.font = { name: "Arial", size: 9, bold: true };
  formatoCell.alignment = { vertical: "middle", horizontal: "center" };
  formatoCell.border = { bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

  const fechaEdCell = ws.getCell(row, 5);
  fechaEdCell.value = "FECHA EDICIÓN: 02-02-2026";
  fechaEdCell.font = { name: "Arial", size: 9 };
  fechaEdCell.alignment = { vertical: "middle", horizontal: "center" };
  fechaEdCell.border = { bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  ws.getRow(row).height = 18;
  row++;

  // ═══════════════════════════════════════════════════════
  // DATOS DE LA INSPECCIÓN - Tipos correctos según Airtable
  // ═══════════════════════════════════════════════════════
  
  const responsableArea = insp.responsables.find(r => 
    r.tipo === "Responsable Área" || r.tipo === "Responsable del Área"
  ) || { nombre: "", cargo: "" };
  const responsableInsp = insp.responsables.find(r => 
    r.tipo === "Responsable" || r.tipo === "Responsable SST" || r.tipo === "Responsable de Inspección"
  ) || { nombre: insp.inspector, cargo: "" };

  // Fila: Fecha de Inspección | Nombre Responsable del Área
  ws.mergeCells(row, 1, row, 1);
  const fechaLabelCell = ws.getCell(row, 1);
  fechaLabelCell.value = "FECHA DE INSPECCIÓN:";
  fechaLabelCell.font = { name: "Arial", size: 9, bold: true };
  fechaLabelCell.alignment = { vertical: "middle", horizontal: "left" };
  fechaLabelCell.border = thinBorder;

  ws.mergeCells(row, 2, row, 2);
  const fechaValCell = ws.getCell(row, 2);
  fechaValCell.value = formatFechaLarga(insp.fecha);
  fechaValCell.font = { name: "Arial", size: 9 };
  fechaValCell.alignment = { vertical: "middle", horizontal: "center" };
  fechaValCell.border = thinBorder;

  ws.mergeCells(row, 3, row, 4);
  const respAreaLabelCell = ws.getCell(row, 3);
  respAreaLabelCell.value = "NOMBRE RESPONSABLE DEL ÁREA";
  respAreaLabelCell.font = { name: "Arial", size: 9, bold: true };
  respAreaLabelCell.alignment = { vertical: "middle", horizontal: "center" };
  respAreaLabelCell.border = thinBorder;

  const respAreaValCell = ws.getCell(row, 5);
  respAreaValCell.value = responsableArea.nombre;
  respAreaValCell.font = { name: "Arial", size: 9 };
  respAreaValCell.alignment = { vertical: "middle", horizontal: "center" };
  respAreaValCell.border = thinBorder;
  ws.getRow(row).height = 20;
  row++;

  // Fila: Nombre Responsable Inspección | Cargo área
  const inspLabelCell = ws.getCell(row, 1);
  inspLabelCell.value = "NOMBRE RESPONSABLE INSPECCIÓN:";
  inspLabelCell.font = { name: "Arial", size: 9, bold: true };
  inspLabelCell.alignment = { vertical: "middle", horizontal: "left" };
  inspLabelCell.border = thinBorder;

  const inspValCell = ws.getCell(row, 2);
  inspValCell.value = responsableInsp.nombre || insp.inspector;
  inspValCell.font = { name: "Arial", size: 9 };
  inspValCell.alignment = { vertical: "middle", horizontal: "center" };
  inspValCell.border = thinBorder;

  ws.mergeCells(row, 3, row, 4);
  const cargoLabelCell = ws.getCell(row, 3);
  cargoLabelCell.value = "CARGO";
  cargoLabelCell.font = { name: "Arial", size: 9, bold: true };
  cargoLabelCell.alignment = { vertical: "middle", horizontal: "center" };
  cargoLabelCell.border = thinBorder;

  const cargoValCell = ws.getCell(row, 5);
  cargoValCell.value = responsableArea.cargo;
  cargoValCell.font = { name: "Arial", size: 9 };
  cargoValCell.alignment = { vertical: "middle", horizontal: "center" };
  cargoValCell.border = thinBorder;
  ws.getRow(row).height = 20;
  row++;

  // Fila: Cargo inspector
  const cargoInspLabelCell = ws.getCell(row, 1);
  cargoInspLabelCell.value = "CARGO:";
  cargoInspLabelCell.font = { name: "Arial", size: 9, bold: true };
  cargoInspLabelCell.alignment = { vertical: "middle", horizontal: "left" };
  cargoInspLabelCell.border = thinBorder;

  ws.mergeCells(row, 2, row, 5);
  const cargoInspValCell = ws.getCell(row, 2);
  cargoInspValCell.value = responsableInsp.cargo;
  cargoInspValCell.font = { name: "Arial", size: 9 };
  cargoInspValCell.alignment = { vertical: "middle", horizontal: "left" };
  cargoInspValCell.border = thinBorder;
  ws.getRow(row).height = 20;
  row++;

  // ═══════════════════════════════════════════════════════
  // TABLA DE CRITERIOS POR CATEGORÍA
  // ═══════════════════════════════════════════════════════
  
  const criteriosPorCategoria: Record<string, Criterio[]> = {};
  insp.criterios.forEach(c => {
    if (!criteriosPorCategoria[c.categoria]) {
      criteriosPorCategoria[c.categoria] = [];
    }
    criteriosPorCategoria[c.categoria].push(c);
  });

  const categorias = sortCategorias(Object.keys(criteriosPorCategoria));

  // Header de la tabla
  ws.mergeCells(row, 1, row + 1, 1);
  const elemHeaderCell = ws.getCell(row, 1);
  elemHeaderCell.value = "ELEMENTOS A INSPECCIONAR";
  elemHeaderCell.font = { name: "Arial", size: 9, bold: true };
  elemHeaderCell.alignment = { vertical: "middle", horizontal: "center" };
  elemHeaderCell.fill = headerFill;
  elemHeaderCell.border = thinBorder;

  ws.mergeCells(row, 2, row, 5);
  const califHeaderCell = ws.getCell(row, 2);
  califHeaderCell.value = "CALIFICACIÓN";
  califHeaderCell.font = { name: "Arial", size: 9, bold: true };
  califHeaderCell.alignment = { vertical: "middle", horizontal: "center" };
  califHeaderCell.fill = headerFill;
  califHeaderCell.border = thinBorder;
  ws.getRow(row).height = 18;
  row++;

  // Sub-encabezados B | M | N/A | OBSERVACIÓN
  const subHeaders = [
    { col: 2, text: "B", width: 6 },
    { col: 3, text: "M", width: 6 },
    { col: 4, text: "N/A", width: 6 },
    { col: 5, text: "OBSERVACIÓN", width: 30 },
  ];
  subHeaders.forEach(h => {
    const cell = ws.getCell(row, h.col);
    cell.value = h.text;
    cell.font = { name: "Arial", size: 8, bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = headerFill;
    cell.border = thinBorder;
  });
  ws.getRow(row).height = 18;
  row++;

  // Iterar por cada categoría
  categorias.forEach(categoria => {
    // Fila de categoría
    const catCell = ws.getCell(row, 1);
    catCell.value = categoria;
    catCell.font = { name: "Arial", size: 9, bold: true };
    catCell.alignment = { vertical: "middle", horizontal: "left" };
    catCell.fill = headerFill;
    catCell.border = thinBorder;

    [2, 3, 4, 5].forEach(col => {
      const cell = ws.getCell(row, col);
      cell.fill = headerFill;
      cell.border = thinBorder;
    });
    ws.getRow(row).height = 18;
    row++;

    // Criterios de esta categoría
    const criterios = criteriosPorCategoria[categoria];
    criterios.forEach(crit => {
      const critCell = ws.getCell(row, 1);
      critCell.value = crit.criterio;
      critCell.font = { name: "Arial", size: 8 };
      critCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      critCell.border = thinBorder;

      const bCell = ws.getCell(row, 2);
      bCell.value = crit.condicion === "Bueno" ? "X" : "";
      bCell.font = { name: "Arial", size: 9, bold: true };
      bCell.alignment = { vertical: "middle", horizontal: "center" };
      bCell.border = thinBorder;

      const mCell = ws.getCell(row, 3);
      mCell.value = crit.condicion === "Malo" ? "X" : "";
      mCell.font = { name: "Arial", size: 9, bold: true };
      mCell.alignment = { vertical: "middle", horizontal: "center" };
      mCell.border = thinBorder;

      const naCell = ws.getCell(row, 4);
      naCell.value = crit.condicion === "NA" ? "X" : "";
      naCell.font = { name: "Arial", size: 9, bold: true };
      naCell.alignment = { vertical: "middle", horizontal: "center" };
      naCell.border = thinBorder;

      const obsCell = ws.getCell(row, 5);
      obsCell.value = crit.observacion || "";
      obsCell.font = { name: "Arial", size: 8 };
      obsCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      obsCell.border = thinBorder;

      ws.getRow(row).height = crit.criterio.length > 60 ? 30 : 18;
      row++;
    });
  });

  // ═══════════════════════════════════════════════════════
  // SECCIÓN DE ACCIONES CORRECTIVAS
  // ═══════════════════════════════════════════════════════
  
  ws.mergeCells(row, 1, row, 2);
  const accHeaderCell = ws.getCell(row, 1);
  accHeaderCell.value = "ACCIONES PREVENTIVAS, CORRECTIVAS O DE MEJORA";
  accHeaderCell.font = { name: "Arial", size: 9, bold: true };
  accHeaderCell.alignment = { vertical: "middle", horizontal: "center" };
  accHeaderCell.fill = headerFill;
  accHeaderCell.border = thinBorder;

  const respHeaderCell = ws.getCell(row, 3);
  respHeaderCell.value = "RESPONSABLE";
  respHeaderCell.font = { name: "Arial", size: 9, bold: true };
  respHeaderCell.alignment = { vertical: "middle", horizontal: "center" };
  respHeaderCell.fill = headerFill;
  respHeaderCell.border = thinBorder;

  ws.mergeCells(row, 4, row, 5);
  const fechaPropHeaderCell = ws.getCell(row, 4);
  fechaPropHeaderCell.value = "FECHA PROPUESTA DE CIERRE";
  fechaPropHeaderCell.font = { name: "Arial", size: 9, bold: true };
  fechaPropHeaderCell.alignment = { vertical: "middle", horizontal: "center" };
  fechaPropHeaderCell.fill = headerFill;
  fechaPropHeaderCell.border = thinBorder;
  ws.getRow(row).height = 20;
  row++;

  // Filas de acciones
  const minAcciones = Math.max(insp.acciones.length, 3);
  for (let i = 0; i < minAcciones; i++) {
    const accion = insp.acciones[i];

    ws.mergeCells(row, 1, row, 2);
    const accCell = ws.getCell(row, 1);
    accCell.value = accion?.descripcion || "";
    accCell.font = { name: "Arial", size: 8 };
    accCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    accCell.border = thinBorder;

    const respAccCell = ws.getCell(row, 3);
    respAccCell.value = accion?.responsable || "";
    respAccCell.font = { name: "Arial", size: 8 };
    respAccCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    respAccCell.border = thinBorder;

    ws.mergeCells(row, 4, row, 5);
    const fechaPropCell = ws.getCell(row, 4);
    fechaPropCell.value = accion ? formatFechaLarga(accion.fechaPropuesta) : "";
    fechaPropCell.font = { name: "Arial", size: 8 };
    fechaPropCell.alignment = { vertical: "middle", horizontal: "center" };
    fechaPropCell.border = thinBorder;

    ws.getRow(row).height = 25;
    row++;
  }

  // ═══════════════════════════════════════════════════════
  // SECCIÓN DE FIRMAS - 3 PARTICIPANTES (Tipos correctos)
  // ═══════════════════════════════════════════════════════
  row += 2;

  // Obtener los 3 responsables - Tipos correctos según Airtable
  const firmaSST = insp.responsables.find(r => 
    r.tipo === "Responsable" || r.tipo === "Responsable SST" || r.tipo === "Responsable de Inspección"
  ) || { nombre: insp.inspector, cargo: "Responsable SST", cedula: "" };
  
  const firmaCOPASST = insp.responsables.find(r => 
    r.tipo === "COPASST" || r.tipo === "Integrante COPASST" || r.tipo === "Responsable del COPASST"
  ) || { nombre: "", cargo: "Integrante COPASST", cedula: "" };
  
  const firmaAreaResp = insp.responsables.find(r => 
    r.tipo === "Responsable Área" || r.tipo === "Responsable del Área"
  ) || { nombre: "", cargo: "Responsable del Área", cedula: "" };

  // Espacios para las firmas (3 columnas)
  // Primera columna: Responsable COPASST
  ws.mergeCells(row, 1, row + 3, 1);
  const firmaCopasstBox = ws.getCell(row, 1);
  firmaCopasstBox.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  ws.getRow(row).height = 50;

  // Segunda columna: Responsable de Inspección
  ws.mergeCells(row, 2, row + 3, 3);
  const firmaInspBox = ws.getCell(row, 2);
  firmaInspBox.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

  // Tercera columna: Responsable del Área
  ws.mergeCells(row, 4, row + 3, 5);
  const firmaAreaBox = ws.getCell(row, 4);
  firmaAreaBox.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

  row += 4;

  // Títulos de firma
  const titleFirmaCopasst = ws.getCell(row, 1);
  titleFirmaCopasst.value = "FIRMA DEL RESPONSABLE DEL COPASST";
  titleFirmaCopasst.font = { name: "Arial", size: 8, bold: true };
  titleFirmaCopasst.alignment = { vertical: "middle", horizontal: "center" };
  titleFirmaCopasst.border = { left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };

  ws.mergeCells(row, 2, row, 3);
  const titleFirmaInsp = ws.getCell(row, 2);
  titleFirmaInsp.value = "FIRMA DEL RESPONSABLE DE INSPECCIÓN";
  titleFirmaInsp.font = { name: "Arial", size: 8, bold: true };
  titleFirmaInsp.alignment = { vertical: "middle", horizontal: "center" };
  titleFirmaInsp.border = { left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };

  ws.mergeCells(row, 4, row, 5);
  const titleFirmaArea = ws.getCell(row, 4);
  titleFirmaArea.value = "FIRMA RESPONSABLE DEL ÁREA";
  titleFirmaArea.font = { name: "Arial", size: 8, bold: true };
  titleFirmaArea.alignment = { vertical: "middle", horizontal: "center" };
  titleFirmaArea.border = { left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
  ws.getRow(row).height = 18;
  row++;

  // Nombres de firmantes
  const nombreCopasst = ws.getCell(row, 1);
  nombreCopasst.value = firmaCOPASST.nombre || "";
  nombreCopasst.font = { name: "Arial", size: 8 };
  nombreCopasst.alignment = { vertical: "middle", horizontal: "center" };
  nombreCopasst.border = { left: { style: "thin" }, right: { style: "thin" } };

  ws.mergeCells(row, 2, row, 3);
  const nombreInsp = ws.getCell(row, 2);
  nombreInsp.value = firmaSST.nombre || insp.inspector;
  nombreInsp.font = { name: "Arial", size: 8 };
  nombreInsp.alignment = { vertical: "middle", horizontal: "center" };
  nombreInsp.border = { left: { style: "thin" }, right: { style: "thin" } };

  ws.mergeCells(row, 4, row, 5);
  const nombreArea = ws.getCell(row, 4);
  nombreArea.value = firmaAreaResp.nombre || "";
  nombreArea.font = { name: "Arial", size: 8 };
  nombreArea.alignment = { vertical: "middle", horizontal: "center" };
  nombreArea.border = { left: { style: "thin" }, right: { style: "thin" } };
  ws.getRow(row).height = 16;
  row++;

  // Cargos de firmantes
  const cargoCopasst = ws.getCell(row, 1);
  cargoCopasst.value = `CARGO: ${firmaCOPASST.cargo || "Integrante COPASST"}`;
  cargoCopasst.font = { name: "Arial", size: 7 };
  cargoCopasst.alignment = { vertical: "middle", horizontal: "center" };
  cargoCopasst.border = { left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };

  ws.mergeCells(row, 2, row, 3);
  const cargoInsp = ws.getCell(row, 2);
  cargoInsp.value = `CARGO: ${firmaSST.cargo || "Responsable SST"}`;
  cargoInsp.font = { name: "Arial", size: 7 };
  cargoInsp.alignment = { vertical: "middle", horizontal: "center" };
  cargoInsp.border = { left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };

  ws.mergeCells(row, 4, row, 5);
  const cargoArea = ws.getCell(row, 4);
  cargoArea.value = `CARGO: ${firmaAreaResp.cargo || "Responsable del Área"}`;
  cargoArea.font = { name: "Arial", size: 7 };
  cargoArea.alignment = { vertical: "middle", horizontal: "center" };
  cargoArea.border = { left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
  ws.getRow(row).height = 16;
}

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-areas/exportar
// Exporta las inspecciones de áreas a Excel con formato institucional
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
        });
      });
    });

    // ── 5. Construir lista completa ─────────────────────
    const inspecciones: InspeccionCompleta[] = cabeceraRecords.map((r) => ({
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
    }));

    // ══════════════════════════════════════════════════════
    // Generar Excel
    // ══════════════════════════════════════════════════════
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
      ? `Inspeccion_${idInspeccion}.xlsx`
      : `Inspecciones_Areas_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-areas/exportar:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
