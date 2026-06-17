// ══════════════════════════════════════════════════════════
// Generador PDF — Perfil Sociodemográfico
// Formato corporativo Sirius basado en FT-SST-060
// Patrón de diseño: Encabezado 3 columnas · Panel de datos ·
// Secciones organizadas · Gráficos · Pie corporativo
// ══════════════════════════════════════════════════════════
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";
import type { Campana, Respuesta } from "@/modules/sociodemografico/domain/entities";

// ── Paleta corporativa ───────────────────────────────────
const C = {
  VERDE:      [0, 182, 2]     as [number, number, number], // #00B602
  AZUL:       [1, 84, 172]    as [number, number, number], // #0154AC
  NEGRO:      [26, 26, 51]    as [number, number, number], // #1A1A33
  BLANCO:     [255, 255, 255] as [number, number, number],
  GRIS_CLARO: [242, 242, 242] as [number, number, number],
  GRIS_TEXTO: [100, 100, 115] as [number, number, number],
  VIOLETA:    [88, 28, 135]   as [number, number, number],
  VERDE_OK:   [30, 140, 60]   as [number, number, number],
} as const;

// ── Datos fijos de la empresa ────────────────────────────
const EMPRESA    = "SIRIUS";
const RAZON_SOCIAL = "SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC.";
const NIT        = "901.377.064-8";
const TELEFONO   = "320 9568566";
const CORREO     = "adm@siriusregenerative.com";
const PLANTACION = "Barranca de Upía, km 7 vía Cabuyaro, Meta, Colombia";

// ── Metadatos del formato ────────────────────────────────
const FORMATO = {
  codigo:       "FT-SST-060",
  version:      "01",
  fechaEdicion: "08/06/2024",
  nombre:       "PERFIL SOCIODEMOGRÁFICO",
} as const;

// ── Etiquetas legibles ────────────────────────────────────
const ETIQUETAS: Record<string, string> = {
  No_binario: "No binario",
  Prefiero_no_decir: "Prefiere no decir",
  Union_libre: "Unión libre",
  "4_o_mas": "4 o más",
  Tecnico_Tecnologo: "Técnico/Tecnólogo",
  Termino_fijo: "Término fijo",
  Termino_indefinido: "Término indefinido",
  Prestacion_servicios: "Prestación de servicios",
  Pirolisis: "Pirólisis",
  Jornada_completa: "Jornada completa",
  Media_jornada: "Media jornada",
  Por_turnos: "Por turnos",
  A_pie: "A pie",
  Bus_Transmilenio: "Bus/TransMilenio",
  Bicicleta: "Bicicleta",
  Moto: "Moto",
  Carro_particular: "Carro particular",
  Ruta_empresa: "Ruta de empresa",
  Menos_30min: "Menos de 30 min",
  "30_60min": "30 a 60 min",
  "1_2horas": "1 a 2 horas",
  Mas_2horas: "Más de 2 horas",
  Familia_amigos: "Familia/amigos",
  Deportes: "Deportes",
  Leer: "Leer",
  Musica: "Música",
  Videojuegos: "Videojuegos",
  Series_peliculas: "Series/películas",
  Actividades_religiosas: "Actividades religiosas",
  Otro: "Otro",
  Si: "Sí",
  No: "No",
  Exfumador: "Exfumador",
  Nunca: "Nunca",
  Ocasionalmente: "Ocasionalmente",
  Frecuentemente: "Frecuentemente",
};

function etiqueta(valor: string | undefined): string {
  if (!valor) return "—";
  return ETIQUETAS[valor] ?? valor.replace(/_/g, " ");
}

function calcularEdad(fechaNacimiento: Date): number {
  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const mes = hoy.getMonth() - fechaNacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
    edad--;
  }
  return edad;
}

// ── Tipo auxiliar para jsPDF-AutoTable ───────────────────
type DocAT = jsPDF & { lastAutoTable: { finalY: number } };

interface BuildPdfOptions {
  campana: Campana;
  respuestas: Respuesta[];
  logoBase64?: string | null;
}

interface EstadisticasCampana {
  totalRespuestas: number;
  distribucionGenero: Record<string, number>;
  distribucionEdad: Record<string, number>;
  edadPromedio: number;
  distribucionEstadoCivil: Record<string, number>;
  distribucionEstrato: Record<string, number>;
  distribucionEscolaridad: Record<string, number>;
  distribucionAreaTrabajo: Record<string, number>;
  distribucionTipoContrato: Record<string, number>;
  distribucionMedioTransporte: Record<string, number>;
  distribucionTiempoDesplazamiento: Record<string, number>;
}

export async function generarPdfPerfilSociodemografico(
  options: BuildPdfOptions
): Promise<Buffer> {
  const { campana, respuestas } = options;

  if (respuestas.length === 0) {
    throw new Error("No hay respuestas para generar el informe");
  }

  // Calcular estadísticas
  const stats = calcularEstadisticas(respuestas);

  // Cargar logo desde public/
  let logo64: string | null = options.logoBase64 ?? null;
  if (!logo64) {
    try {
      const p = path.join(process.cwd(), "public", "logo.png");
      if (fs.existsSync(p)) logo64 = fs.readFileSync(p).toString("base64");
    } catch { /* continuar sin logo */ }
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const PW = doc.internal.pageSize.getWidth();   // 215.9 mm
  const PH = doc.internal.pageSize.getHeight();  // 279.4 mm
  const M  = 12;
  const CW = PW - M * 2;
  const FH = 24; // altura reservada pie de página

  let y = M;

  y = renderEncabezado(doc, y, M, CW, logo64);
  y = renderTitulo(doc, y, M, CW, campana);
  y = renderPanelDatos(doc, y, M, CW, campana, stats);
  y = renderResumenEjecutivo(doc, y, M, CW, PH, FH, stats);
  y = renderDistribucionDemografica(doc, y, M, CW, PH, FH, stats);
  y = renderDistribucionLaboral(doc, y, M, CW, PH, FH, stats);
  y = renderDistribucionMovilidad(doc, y, M, CW, PH, FH, stats);
  y = renderRegistroIndividual(doc, y, M, CW, PH, FH, respuestas);
  y = renderFichasIndividuales(doc, y, M, CW, PH, FH, respuestas);

  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    renderPiePagina(doc, M, CW, PW, PH, p, totalPaginas, campana);
  }

  return Buffer.from(doc.output("arraybuffer"));
}

// ══════════════════════════════════════════════════════════
// CÁLCULO DE ESTADÍSTICAS
// ══════════════════════════════════════════════════════════

function calcularEstadisticas(respuestas: Respuesta[]): EstadisticasCampana {
  const total = respuestas.length;

  // Distribución por género
  const distribucionGenero: Record<string, number> = {};
  respuestas.forEach(r => {
    const g = r.genero || "No especificado";
    distribucionGenero[g] = (distribucionGenero[g] || 0) + 1;
  });

  // Distribución por edad (rangos)
  const distribucionEdad: Record<string, number> = {
    "18-25": 0,
    "26-35": 0,
    "36-45": 0,
    "46-55": 0,
    "56+": 0,
  };
  let sumaEdades = 0;
  respuestas.forEach(r => {
    const edad = calcularEdad(r.fechaNacimiento);
    sumaEdades += edad;
    if (edad <= 25) distribucionEdad["18-25"]++;
    else if (edad <= 35) distribucionEdad["26-35"]++;
    else if (edad <= 45) distribucionEdad["36-45"]++;
    else if (edad <= 55) distribucionEdad["46-55"]++;
    else distribucionEdad["56+"]++;
  });
  const edadPromedio = Math.round(sumaEdades / total);

  // Distribución por estado civil
  const distribucionEstadoCivil: Record<string, number> = {};
  respuestas.forEach(r => {
    const ec = r.estadoCivil || "No especificado";
    distribucionEstadoCivil[ec] = (distribucionEstadoCivil[ec] || 0) + 1;
  });

  // Distribución por estrato
  const distribucionEstrato: Record<string, number> = {};
  respuestas.forEach(r => {
    const e = r.estrato ? `Estrato ${r.estrato}` : "No especificado";
    distribucionEstrato[e] = (distribucionEstrato[e] || 0) + 1;
  });

  // Distribución por escolaridad
  const distribucionEscolaridad: Record<string, number> = {};
  respuestas.forEach(r => {
    const esc = r.escolaridad || "No especificado";
    distribucionEscolaridad[esc] = (distribucionEscolaridad[esc] || 0) + 1;
  });

  // Distribución por área de trabajo
  const distribucionAreaTrabajo: Record<string, number> = {};
  respuestas.forEach(r => {
    const area = r.areaTrabajo || "No especificado";
    distribucionAreaTrabajo[area] = (distribucionAreaTrabajo[area] || 0) + 1;
  });

  // Distribución por tipo de contrato
  const distribucionTipoContrato: Record<string, number> = {};
  respuestas.forEach(r => {
    const tc = r.tipoContrato || "No especificado";
    distribucionTipoContrato[tc] = (distribucionTipoContrato[tc] || 0) + 1;
  });

  // Distribución por medio de transporte
  const distribucionMedioTransporte: Record<string, number> = {};
  respuestas.forEach(r => {
    const mt = r.medioTransporte || "No especificado";
    distribucionMedioTransporte[mt] = (distribucionMedioTransporte[mt] || 0) + 1;
  });

  // Distribución por tiempo de desplazamiento
  const distribucionTiempoDesplazamiento: Record<string, number> = {};
  respuestas.forEach(r => {
    const td = r.tiempoDesplazamiento || "No especificado";
    distribucionTiempoDesplazamiento[td] = (distribucionTiempoDesplazamiento[td] || 0) + 1;
  });

  return {
    totalRespuestas: total,
    distribucionGenero,
    distribucionEdad,
    edadPromedio,
    distribucionEstadoCivil,
    distribucionEstrato,
    distribucionEscolaridad,
    distribucionAreaTrabajo,
    distribucionTipoContrato,
    distribucionMedioTransporte,
    distribucionTiempoDesplazamiento,
  };
}

// ══════════════════════════════════════════════════════════
// LAYOUT HELPERS
// ══════════════════════════════════════════════════════════

function lh(fontSize: number): number {
  return (fontSize / 72) * 25.4 * 1.45;
}

function checkPage(doc: jsPDF, y: number, needed: number, PH: number, FH: number): number {
  if (y + needed > PH - FH - 4) { doc.addPage(); return 16; }
  return y;
}

function secTitle(doc: jsPDF, titulo: string, x: number, w: number, y: number): number {
  const top = 5;
  doc.setFillColor(...C.AZUL);
  doc.rect(x, y + top, w, 7.5, "F");
  doc.setTextColor(...C.BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(titulo, x + 3, y + top + 5.4);
  return y + top + 7.5 + 4;
}

function parrafo(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  opts: { fs?: number; style?: string; color?: [number, number, number]; indent?: number } = {}
): number {
  const { fs: fontSize = 9, style = "normal", color = C.NEGRO, indent = 0 } = opts;
  doc.setFont("helvetica", style);
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxW - indent) as string[];
  doc.text(lines, x + indent, y);
  return y + lines.length * lh(fontSize) + 3;
}

function drawLogoFallback(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  doc.setFillColor(...C.VERDE);
  doc.roundedRect(x + 3, y + 3, w - 6, h - 6, 2, 2, "F");
  doc.setTextColor(...C.BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("SIRIUS", x + w / 2, y + h / 2 + 1.5, { align: "center" });
}

// ══════════════════════════════════════════════════════════
// SECCIONES ESTRUCTURALES
// ══════════════════════════════════════════════════════════

function renderEncabezado(
  doc: jsPDF, y: number, M: number, CW: number, logo64: string | null
): number {
  const H  = 33;
  const cL = 40;  // col logo
  const cC = 54;  // col código
  const cM = CW - cL - cC;

  doc.setDrawColor(...C.NEGRO);
  doc.setLineWidth(0.4);
  doc.rect(M, y, CW, H);
  doc.line(M + cL,      y, M + cL,      y + H);
  doc.line(M + cL + cM, y, M + cL + cM, y + H);

  // Col 1: Logo
  if (logo64) {
    try {
      doc.addImage("data:image/png;base64," + logo64, "PNG", M + 4, y + 4, cL - 8, H - 8);
    } catch { drawLogoFallback(doc, M, y, cL, H); }
  } else {
    drawLogoFallback(doc, M, y, cL, H);
  }

  // Col 2: Empresa + nombre formato
  const cx = M + cL;
  doc.setTextColor(...C.NEGRO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(RAZON_SOCIAL, cx + cM / 2, y + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`NIT. ${NIT}`, cx + cM / 2, y + 13.5, { align: "center" });
  doc.setDrawColor(...C.GRIS_TEXTO);
  doc.setLineWidth(0.15);
  doc.line(cx + 5, y + 17, cx + cM - 5, y + 17);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.AZUL);
  doc.text("FORMATO DE PERFIL SOCIODEMOGRÁFICO", cx + cM / 2, y + 24, { align: "center" });

  // Col 3: Código / versión / fecha
  const ccx = M + cL + cM;
  const rH  = H / 3;
  doc.setDrawColor(...C.NEGRO);
  doc.setLineWidth(0.3);
  doc.line(ccx, y + rH,     ccx + cC, y + rH);
  doc.line(ccx, y + 2 * rH, ccx + cC, y + 2 * rH);
  doc.setTextColor(...C.NEGRO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(`CODIGO: ${FORMATO.codigo}`,             ccx + cC / 2, y + rH / 2 + 1.5,           { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(`VERSION: ${FORMATO.version}`,            ccx + cC / 2, y + rH + rH / 2 + 1.5,     { align: "center" });
  doc.text(`FECHA EDICION: ${FORMATO.fechaEdicion}`, ccx + cC / 2, y + 2 * rH + rH / 2 + 1.5, { align: "center" });

  return y + H + 3;
}

function renderTitulo(
  doc: jsPDF, y: number, M: number, CW: number, campana: Campana
): number {
  doc.setFillColor(...C.NEGRO);
  doc.rect(M, y, CW, 9.5, "F");
  doc.setTextColor(...C.BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(`${FORMATO.nombre} - ${campana.nombre}`.toUpperCase(), M + CW / 2, y + 6.6, { align: "center" });
  return y + 14;
}

function renderPanelDatos(
  doc: jsPDF, y: number, M: number, CW: number,
  campana: Campana, stats: EstadisticasCampana
): number {
  const cW = CW / 2;
  const fechaGeneracion = new Date().toLocaleDateString("es-CO", {
    year: "numeric", month: "long", day: "numeric", timeZone: "America/Bogota",
  });

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 28 },
    tableWidth: CW,
    theme: "plain",
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      lineColor: C.NEGRO, lineWidth: 0.3,
      textColor: C.NEGRO, overflow: "linebreak",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: cW * 0.30, fillColor: C.GRIS_CLARO },
      1: { fontStyle: "normal", cellWidth: cW * 0.70 },
      2: { fontStyle: "bold", cellWidth: cW * 0.30, fillColor: C.GRIS_CLARO },
      3: { fontStyle: "normal", cellWidth: cW * 0.70 },
    },
    body: [
      ["Empresa:",      EMPRESA,                   "Campaña:",           campana.nombre],
      ["Periodo:",      `${campana.periodo} ${campana.año}`, "Total respuestas:", `${stats.totalRespuestas} colaboradores`],
      ["Estado:",       campana.estado,             "Fecha de cierre:",  campana.fechaCierre ? new Date(campana.fechaCierre).toLocaleDateString("es-CO", { timeZone: "America/Bogota" }) : "—"],
      ["Generado:",     fechaGeneracion,           "Edad promedio:",    `${stats.edadPromedio} años`],
    ],
  });
  return (doc as DocAT).lastAutoTable.finalY + 6;
}

function renderPiePagina(
  doc: jsPDF, M: number, CW: number, PW: number, PH: number,
  pagina: number, total: number, campana: Campana
): void {
  const y0 = PH - 22;
  doc.setDrawColor(...C.VERDE);
  doc.setLineWidth(0.8);
  doc.line(M, y0, M + CW, y0);

  const footerLine1 =
    `Sirius Regenerative Solutions SAS Zomac / Nit: ${NIT} / Teléfono: ${TELEFONO} / Correo: ${CORREO}`;
  const footerLine2 = `Plantación: ${PLANTACION}`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.NEGRO);
  doc.text(footerLine1, M + CW / 2, y0 + 4.5, { align: "center" });
  doc.text(footerLine2, M + CW / 2, y0 + 9,   { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.GRIS_TEXTO);
  doc.text(`Pág. ${pagina} / ${total}`, PW - M, y0 + 9, { align: "right" });
}

// ══════════════════════════════════════════════════════════
// SECCIONES DE CONTENIDO
// ══════════════════════════════════════════════════════════

function renderResumenEjecutivo(
  doc: jsPDF, y: number, M: number, CW: number, PH: number, FH: number,
  stats: EstadisticasCampana
): number {
  y = checkPage(doc, y, 60, PH, FH);
  y = secTitle(doc, "1. RESUMEN EJECUTIVO", M, CW, y);

  y = parrafo(doc,
    `El presente perfil sociodemográfico caracteriza a la población trabajadora de ${EMPRESA}, ` +
    `con un total de ${stats.totalRespuestas} colaboradores evaluados. Este documento constituye ` +
    `una herramienta fundamental para el diseño e implementación de programas de prevención de riesgos ` +
    `laborales específicos, adaptados al perfil real de la organización, en cumplimiento de la ` +
    `Resolución 0312 de 2019 y los estándares del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST).`,
    M, y, CW);

  y += 2;

  // Panel de indicadores clave
  const indicadores = [
    [`Total de colaboradores evaluados:`, `${stats.totalRespuestas}`],
    [`Edad promedio de la población:`, `${stats.edadPromedio} años`],
    [`Distribución por género:`, formatearDistribucion(stats.distribucionGenero)],
    [`Nivel educativo predominante:`, obtenerMayoritario(stats.distribucionEscolaridad)],
    [`Área de trabajo principal:`, obtenerMayoritario(stats.distribucionAreaTrabajo)],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 28 },
    tableWidth: CW,
    theme: "plain",
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      lineColor: C.NEGRO, lineWidth: 0.3,
      textColor: C.NEGRO, overflow: "linebreak",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: CW * 0.40, fillColor: C.GRIS_CLARO },
      1: { fontStyle: "normal", cellWidth: CW * 0.60 },
    },
    body: indicadores,
  });

  return (doc as DocAT).lastAutoTable.finalY + 8;
}

function renderDistribucionDemografica(
  doc: jsPDF, y: number, M: number, CW: number, PH: number, FH: number,
  stats: EstadisticasCampana
): number {
  y = checkPage(doc, y, 80, PH, FH);
  y = secTitle(doc, "2. CARACTERIZACIÓN DEMOGRÁFICA", M, CW, y);

  // 2.1 Distribución por género
  y = parrafo(doc, "2.1. Distribución por género", M, y, CW, { fs: 9, style: "bold", color: C.AZUL });
  y = renderTablaDistribucion(doc, y, M, CW, stats.distribucionGenero, stats.totalRespuestas);

  // 2.2 Distribución por rangos de edad
  y = checkPage(doc, y, 40, PH, FH);
  y = parrafo(doc, "2.2. Distribución por rangos de edad", M, y, CW, { fs: 9, style: "bold", color: C.AZUL });
  y = renderTablaDistribucion(doc, y, M, CW, stats.distribucionEdad, stats.totalRespuestas);

  // 2.3 Estado civil
  y = checkPage(doc, y, 40, PH, FH);
  y = parrafo(doc, "2.3. Estado civil", M, y, CW, { fs: 9, style: "bold", color: C.AZUL });
  y = renderTablaDistribucion(doc, y, M, CW, stats.distribucionEstadoCivil, stats.totalRespuestas);

  // 2.4 Estrato socioeconómico
  y = checkPage(doc, y, 40, PH, FH);
  y = parrafo(doc, "2.4. Estrato socioeconómico", M, y, CW, { fs: 9, style: "bold", color: C.AZUL });
  y = renderTablaDistribucion(doc, y, M, CW, stats.distribucionEstrato, stats.totalRespuestas);

  return y + 4;
}

function renderDistribucionLaboral(
  doc: jsPDF, y: number, M: number, CW: number, PH: number, FH: number,
  stats: EstadisticasCampana
): number {
  y = checkPage(doc, y, 80, PH, FH);
  y = secTitle(doc, "3. CARACTERIZACIÓN LABORAL", M, CW, y);

  // 3.1 Nivel de escolaridad
  y = parrafo(doc, "3.1. Nivel de escolaridad", M, y, CW, { fs: 9, style: "bold", color: C.AZUL });
  y = renderTablaDistribucion(doc, y, M, CW, stats.distribucionEscolaridad, stats.totalRespuestas);

  // 3.2 Distribución por área de trabajo
  y = checkPage(doc, y, 40, PH, FH);
  y = parrafo(doc, "3.2. Distribución por área de trabajo", M, y, CW, { fs: 9, style: "bold", color: C.AZUL });
  y = renderTablaDistribucion(doc, y, M, CW, stats.distribucionAreaTrabajo, stats.totalRespuestas);

  // 3.3 Tipo de contrato
  y = checkPage(doc, y, 40, PH, FH);
  y = parrafo(doc, "3.3. Tipo de contrato", M, y, CW, { fs: 9, style: "bold", color: C.AZUL });
  y = renderTablaDistribucion(doc, y, M, CW, stats.distribucionTipoContrato, stats.totalRespuestas);

  return y + 4;
}

function renderDistribucionMovilidad(
  doc: jsPDF, y: number, M: number, CW: number, PH: number, FH: number,
  stats: EstadisticasCampana
): number {
  y = checkPage(doc, y, 60, PH, FH);
  y = secTitle(doc, "4. MOVILIDAD Y DESPLAZAMIENTO", M, CW, y);

  y = parrafo(doc,
    "El análisis de la movilidad permite identificar factores de riesgo asociados al desplazamiento " +
    "casa-trabajo, fundamentales para el diseño de estrategias de prevención de accidentes in itinere.",
    M, y, CW, { fs: 8.5, style: "italic", color: C.GRIS_TEXTO });

  // 4.1 Medio de transporte principal
  y = parrafo(doc, "4.1. Medio de transporte principal", M, y, CW, { fs: 9, style: "bold", color: C.AZUL });
  y = renderTablaDistribucion(doc, y, M, CW, stats.distribucionMedioTransporte, stats.totalRespuestas);

  // 4.2 Tiempo de desplazamiento
  y = checkPage(doc, y, 40, PH, FH);
  y = parrafo(doc, "4.2. Tiempo de desplazamiento (ida)", M, y, CW, { fs: 9, style: "bold", color: C.AZUL });
  y = renderTablaDistribucion(doc, y, M, CW, stats.distribucionTiempoDesplazamiento, stats.totalRespuestas);

  return y + 4;
}

function renderRegistroIndividual(
  doc: jsPDF, y: number, M: number, CW: number, PH: number, FH: number,
  respuestas: Respuesta[]
): number {
  y = checkPage(doc, y, 60, PH, FH);
  y = secTitle(doc, "5. REGISTRO INDIVIDUAL DE COLABORADORES", M, CW, y);

  y = parrafo(doc,
    "A continuación se presenta el registro detallado de cada colaborador evaluado, conforme a la " +
    "Resolución 2346 de 2007 sobre evaluaciones médicas ocupacionales y el manejo de información confidencial.",
    M, y, CW, { fs: 8.5, style: "italic", color: C.GRIS_TEXTO });

  // Tabla resumen
  const datosTabla = respuestas.map((r, index) => [
    (index + 1).toString(),
    r.nombreCompleto,
    calcularEdad(r.fechaNacimiento).toString(),
    etiqueta(r.genero),
    etiqueta(r.estadoCivil),
    r.municipioResidencia,
    r.estrato,
    etiqueta(r.escolaridad),
    etiqueta(r.areaTrabajo),
    r.cargo,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 28 },
    tableWidth: CW,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      textColor: C.NEGRO,
      lineColor: C.NEGRO,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: C.AZUL,
      textColor: C.BLANCO,
      fontStyle: "bold",
      halign: "center",
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 32 },
      2: { cellWidth: 10, halign: "center" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 18, halign: "center" },
      5: { cellWidth: 24 },
      6: { cellWidth: 10, halign: "center" },
      7: { cellWidth: 20 },
      8: { cellWidth: 18 },
      9: { cellWidth: 24 },
    },
    head: [["#", "Nombre Completo", "Edad", "Género", "Estado Civil", "Municipio", "Estrato", "Escolaridad", "Área", "Cargo"]],
    body: datosTabla,
  });

  return (doc as DocAT).lastAutoTable.finalY + 8;
}

function renderFichasIndividuales(
  doc: jsPDF, y: number, M: number, CW: number, PH: number, FH: number,
  respuestas: Respuesta[]
): number {
  y = checkPage(doc, y, 60, PH, FH);
  y = secTitle(doc, "6. FICHAS INDIVIDUALES DETALLADAS", M, CW, y);

  y = parrafo(doc,
    "A continuación se presenta la información detallada y completa de cada colaborador evaluado, " +
    "incluyendo datos demográficos, laborales, de salud, hábitos y movilidad. Esta información es " +
    "confidencial y de uso exclusivo para el diseño de programas de prevención en el marco del SG-SST.",
    M, y, CW, { fs: 8.5, style: "italic", color: C.GRIS_TEXTO });

  respuestas.forEach((resp, index) => {
    // Nueva página para cada colaborador
    doc.addPage();
    y = 16;

    // ═══════════════════════════════════════════════════════
    // ENCABEZADO DE FICHA
    // ═══════════════════════════════════════════════════════
    doc.setFillColor(...C.AZUL);
    doc.rect(M, y, CW, 9, "F");
    doc.setTextColor(...C.BLANCO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`FICHA ${index + 1} / ${respuestas.length}: ${resp.nombreCompleto.toUpperCase()}`, M + 3, y + 6.2);
    y += 13;

    // ═══════════════════════════════════════════════════════
    // SECCIÓN 1: DATOS PERSONALES
    // ═══════════════════════════════════════════════════════
    y = renderSubtitulo(doc, "1. DATOS PERSONALES", M, CW, y);

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 28 },
      tableWidth: CW,
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: C.NEGRO, lineWidth: 0.2,
        textColor: C.NEGRO, overflow: "linebreak",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: CW * 0.30, fillColor: C.GRIS_CLARO },
        1: { fontStyle: "normal", cellWidth: CW * 0.70 },
      },
      body: [
        ["Nombre completo:", resp.nombreCompleto],
        ["Número de documento:", resp.numeroDocumento],
        ["Fecha de nacimiento:", formatearFecha(resp.fechaNacimiento)],
        ["Edad:", `${calcularEdad(resp.fechaNacimiento)} años`],
        ["Género:", etiqueta(resp.genero)],
        ["Estado civil:", etiqueta(resp.estadoCivil)],
      ],
    });
    y = (doc as DocAT).lastAutoTable.finalY + 6;

    // ═══════════════════════════════════════════════════════
    // SECCIÓN 2: VIVIENDA Y SITUACIÓN SOCIOECONÓMICA
    // ═══════════════════════════════════════════════════════
    y = renderSubtitulo(doc, "2. VIVIENDA Y SITUACIÓN SOCIOECONÓMICA", M, CW, y);

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 28 },
      tableWidth: CW,
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: C.NEGRO, lineWidth: 0.2,
        textColor: C.NEGRO, overflow: "linebreak",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: CW * 0.30, fillColor: C.GRIS_CLARO },
        1: { fontStyle: "normal", cellWidth: CW * 0.70 },
      },
      body: [
        ["Municipio de residencia:", resp.municipioResidencia],
        ["Estrato socioeconómico:", `Estrato ${resp.estrato}`],
        ["Tipo de vivienda:", etiqueta(resp.tipoVivienda)],
        ["Personas a cargo:", etiqueta(resp.personasACargo)],
      ],
    });
    y = (doc as DocAT).lastAutoTable.finalY + 6;

    // ═══════════════════════════════════════════════════════
    // SECCIÓN 3: EDUCACIÓN Y FORMACIÓN
    // ═══════════════════════════════════════════════════════
    y = renderSubtitulo(doc, "3. EDUCACIÓN Y FORMACIÓN", M, CW, y);

    const datosEducacion: Array<[string, string]> = [
      ["Nivel de escolaridad:", etiqueta(resp.escolaridad)],
      ["¿Estudia actualmente?:", resp.estudiandoActualmente ? "Sí" : "No"],
    ];

    if (resp.estudiandoActualmente && resp.carreraActual) {
      datosEducacion.push(["Programa que cursa:", resp.carreraActual]);
    }

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 28 },
      tableWidth: CW,
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: C.NEGRO, lineWidth: 0.2,
        textColor: C.NEGRO, overflow: "linebreak",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: CW * 0.30, fillColor: C.GRIS_CLARO },
        1: { fontStyle: "normal", cellWidth: CW * 0.70 },
      },
      body: datosEducacion,
    });
    y = (doc as DocAT).lastAutoTable.finalY + 6;

    // ═══════════════════════════════════════════════════════
    // SECCIÓN 4: INFORMACIÓN LABORAL
    // ═══════════════════════════════════════════════════════
    y = renderSubtitulo(doc, "4. INFORMACIÓN LABORAL", M, CW, y);

    const datosLaborales: Array<[string, string]> = [
      ["Área de trabajo:", etiqueta(resp.areaTrabajo)],
      ["Cargo:", resp.cargo],
      ["Tipo de contrato:", etiqueta(resp.tipoContrato)],
      ["Fecha de ingreso a Sirius:", formatearFecha(resp.fechaIngresoSirius)],
      ["Jornada/turno de trabajo:", etiqueta(resp.turnoTrabajo)],
      ["¿Tiene otro empleo?:", resp.otroEmpleo ? "Sí" : "No"],
    ];

    if (resp.otroEmpleo && resp.descripcionOtroEmpleo) {
      datosLaborales.push(["Descripción del otro empleo:", resp.descripcionOtroEmpleo]);
    }

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 28 },
      tableWidth: CW,
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: C.NEGRO, lineWidth: 0.2,
        textColor: C.NEGRO, overflow: "linebreak",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: CW * 0.30, fillColor: C.GRIS_CLARO },
        1: { fontStyle: "normal", cellWidth: CW * 0.70 },
      },
      body: datosLaborales,
    });
    y = (doc as DocAT).lastAutoTable.finalY + 6;

    // ═══════════════════════════════════════════════════════
    // SECCIÓN 5: CONDICIONES DE SALUD
    // ═══════════════════════════════════════════════════════
    y = renderSubtitulo(doc, "5. CONDICIONES DE SALUD", M, CW, y);

    const datosSalud: Array<[string, string]> = [
      ["¿Enfermedad crónica diagnosticada?:", resp.enfermedadCronica ? "Sí" : "No"],
    ];
    if (resp.enfermedadCronica && resp.cualEnfermedadCronica) {
      datosSalud.push(["Enfermedad(es) crónica(s):", resp.cualEnfermedadCronica]);
    }

    datosSalud.push(["¿Tiene alguna discapacidad?:", resp.discapacidad ? "Sí" : "No"]);
    if (resp.discapacidad && resp.cualDiscapacidad) {
      datosSalud.push(["Tipo de discapacidad:", resp.cualDiscapacidad]);
    }

    datosSalud.push(["¿Tratamiento médico actual?:", resp.tratamientoMedico ? "Sí" : "No"]);
    if (resp.tratamientoMedico && resp.descripcionTratamiento) {
      datosSalud.push(["Descripción del tratamiento:", resp.descripcionTratamiento]);
    }

    datosSalud.push(["¿Accidentes de trabajo previos?:", resp.accidentesTrabajoPrevios ? "Sí" : "No"]);
    if (resp.accidentesTrabajoPrevios && resp.descripcionAccidentes) {
      datosSalud.push(["Descripción de accidentes:", resp.descripcionAccidentes]);
    }

    datosSalud.push(["¿Enfermedad laboral diagnosticada?:", resp.enfermedadLaboralPrevia ? "Sí" : "No"]);
    if (resp.enfermedadLaboralPrevia && resp.descripcionEnfLaboral) {
      datosSalud.push(["Descripción enfermedad laboral:", resp.descripcionEnfLaboral]);
    }

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 28 },
      tableWidth: CW,
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: C.NEGRO, lineWidth: 0.2,
        textColor: C.NEGRO, overflow: "linebreak",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: CW * 0.30, fillColor: C.GRIS_CLARO },
        1: { fontStyle: "normal", cellWidth: CW * 0.70 },
      },
      body: datosSalud,
    });
    y = (doc as DocAT).lastAutoTable.finalY + 6;

    // ═══════════════════════════════════════════════════════
    // SECCIÓN 6: HÁBITOS Y ESTILO DE VIDA
    // ═══════════════════════════════════════════════════════
    y = renderSubtitulo(doc, "6. HÁBITOS Y ESTILO DE VIDA", M, CW, y);

    const datosHabitos: Array<[string, string]> = [
      ["¿Fuma?:", etiqueta(resp.fuma)],
      ["Consumo de alcohol:", etiqueta(resp.alcohol)],
      ["¿Practica deporte?:", resp.practicaDeporte ? "Sí" : "No"],
    ];

    if (resp.practicaDeporte && resp.cualDeporte) {
      datosHabitos.push(["Deporte(s) que practica:", resp.cualDeporte]);
    }

    const actividadesTL = resp.tiempoLibre.map(t => etiqueta(t)).join(", ");
    datosHabitos.push(["Actividades en tiempo libre:", actividadesTL]);

    if (resp.tiempoLibre.includes("Otro") && resp.descripcionOtroTiempoLibre) {
      datosHabitos.push(["Otra actividad especificada:", resp.descripcionOtroTiempoLibre]);
    }

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 28 },
      tableWidth: CW,
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: C.NEGRO, lineWidth: 0.2,
        textColor: C.NEGRO, overflow: "linebreak",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: CW * 0.30, fillColor: C.GRIS_CLARO },
        1: { fontStyle: "normal", cellWidth: CW * 0.70 },
      },
      body: datosHabitos,
    });
    y = (doc as DocAT).lastAutoTable.finalY + 6;

    // ═══════════════════════════════════════════════════════
    // SECCIÓN 7: TRANSPORTE Y MOVILIDAD
    // ═══════════════════════════════════════════════════════
    y = renderSubtitulo(doc, "7. TRANSPORTE Y MOVILIDAD", M, CW, y);

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 28 },
      tableWidth: CW,
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: C.NEGRO, lineWidth: 0.2,
        textColor: C.NEGRO, overflow: "linebreak",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: CW * 0.30, fillColor: C.GRIS_CLARO },
        1: { fontStyle: "normal", cellWidth: CW * 0.70 },
      },
      body: [
        ["Medio de transporte principal:", etiqueta(resp.medioTransporte)],
        ["Tiempo de desplazamiento (ida):", etiqueta(resp.tiempoDesplazamiento)],
      ],
    });
    y = (doc as DocAT).lastAutoTable.finalY + 6;

    // ═══════════════════════════════════════════════════════
    // SECCIÓN 8: CONSENTIMIENTO Y DECLARACIONES
    // ═══════════════════════════════════════════════════════
    y = renderSubtitulo(doc, "8. CONSENTIMIENTO Y DECLARACIONES", M, CW, y);

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 28 },
      tableWidth: CW,
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: C.NEGRO, lineWidth: 0.2,
        textColor: C.NEGRO, overflow: "linebreak",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: CW * 0.50, fillColor: C.GRIS_CLARO },
        1: { fontStyle: "normal", cellWidth: CW * 0.50, halign: "center" },
      },
      body: [
        ["Acepta política de tratamiento de datos personales (Ley 1581/2012):", resp.aceptaPoliticaDatos ? "✓ Aceptado" : "✗ No aceptado"],
        ["Declara que la información es veraz y completa:", resp.firmaVeracidad ? "✓ Declarado" : "✗ No declarado"],
        ["Fecha de respuesta:", resp.createdTime ? formatearFechaHora(resp.createdTime) : "—"],
      ],
    });
    y = (doc as DocAT).lastAutoTable.finalY + 6;

    // Nota de confidencialidad al final de cada ficha
    y = checkPage(doc, y, 20, PH, FH);
    doc.setFillColor(...C.GRIS_CLARO);
    doc.rect(M, y, CW, 14, "F");
    doc.setTextColor(...C.GRIS_TEXTO);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    const textoConf = doc.splitTextToSize(
      "CONFIDENCIAL: Esta información es de carácter privado y está protegida por la Ley 1581 de 2012 (Habeas Data). " +
      "Su uso está restringido exclusivamente para fines del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) " +
      "de Sirius Regenerative Solutions S.A.S. Prohibida su divulgación a terceros no autorizados.",
      CW - 6
    ) as string[];
    doc.text(textoConf, M + 3, y + 4);
  });

  return y;
}

// ══════════════════════════════════════════════════════════
// HELPERS ADICIONALES
// ══════════════════════════════════════════════════════════

function renderSubtitulo(doc: jsPDF, titulo: string, x: number, w: number, y: number): number {
  doc.setFillColor(...C.VERDE);
  doc.rect(x, y, w, 6.5, "F");
  doc.setTextColor(...C.BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(titulo, x + 3, y + 4.5);
  return y + 6.5 + 3;
}

function formatearFecha(fecha: Date): string {
  if (!fecha) return "—";
  try {
    return new Date(fecha).toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatearFechaHora(fecha: Date): string {
  if (!fecha) return "—";
  try {
    return new Date(fecha).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

// ══════════════════════════════════════════════════════════
// HELPERS PARA TABLAS DE DISTRIBUCIÓN
// ══════════════════════════════════════════════════════════

function renderTablaDistribucion(
  doc: jsPDF, y: number, M: number, CW: number,
  distribucion: Record<string, number>, total: number
): number {
  const entradas = Object.entries(distribucion)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entradas.length === 0) {
    return parrafo(doc, "Sin datos registrados.", M, y, CW, { style: "italic", color: C.GRIS_TEXTO });
  }

  const datosTabla = entradas.map(([clave, valor]) => {
    const pct = Math.round((valor / total) * 100);
    return [etiqueta(clave), valor.toString(), `${pct}%`];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 28 },
    tableWidth: CW,
    theme: "striped",
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      lineColor: C.NEGRO,
      lineWidth: 0.2,
      textColor: C.NEGRO,
    },
    headStyles: {
      fillColor: C.VERDE,
      textColor: C.BLANCO,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: C.GRIS_CLARO },
    columnStyles: {
      0: { cellWidth: CW * 0.60 },
      1: { cellWidth: CW * 0.20, halign: "center" },
      2: { cellWidth: CW * 0.20, halign: "center", fontStyle: "bold" },
    },
    head: [["Categoría", "Cantidad", "Porcentaje"]],
    body: datosTabla,
  });

  return (doc as DocAT).lastAutoTable.finalY + 4;
}

// ══════════════════════════════════════════════════════════
// UTILIDADES
// ══════════════════════════════════════════════════════════

function formatearDistribucion(dist: Record<string, number>): string {
  const entradas = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  if (entradas.length === 0) return "Sin datos";
  return entradas.map(([k, v]) => `${etiqueta(k)}: ${v}`).join(", ");
}

function obtenerMayoritario(dist: Record<string, number>): string {
  const entradas = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  if (entradas.length === 0) return "Sin datos";
  const [clave, valor] = entradas[0];
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const pct = Math.round((valor / total) * 100);
  return `${etiqueta(clave)} (${pct}%)`;
}
