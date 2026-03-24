"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
  Calendar,
  Save,
  PenTool,
  Eraser,
  Check,
  MapPin,
  ShieldCheck,
  AlertCircle,
  Plus,
  Trash2,
  History,
} from "lucide-react";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
type TipoArea = "Laboratorio" | "Pirólisis" | "Bodega" | "Administrativa";
type CondicionCriterio = "Bueno" | "Malo" | "NA" | null;
type PageState = "idle" | "saving" | "success" | "error";

interface CriterioEvaluado {
  id: string;
  categoria: string;
  criterio: string;
  condicion: CondicionCriterio;
  observacion: string;
}

interface AccionCorrectiva {
  id: string;
  descripcion: string;
  tipo: "Preventiva" | "Correctiva" | "Mejora";
  responsable: string;
  fechaPropuestaCierre: string;
  criterioRelacionado: string; // ID del criterio (CriterioEvaluado.id)
}

interface FirmaResponsable {
  tipo: "Responsable" | "COPASST" | "Responsable Área";
  nombre: string;
  cedula: string;
  cargo: string;
  firma: string | null;
}

// ══════════════════════════════════════════════════════════
// Constantes — Criterios por Área
// ══════════════════════════════════════════════════════════
const AREAS: TipoArea[] = ["Laboratorio", "Pirólisis", "Bodega", "Administrativa"];

const CRITERIOS_COMUNES = [
  { categoria: "Condiciones locativas", criterio: "Pisos en buen estado, sin huecos, grietas ni superficies resbalosas" },
  { categoria: "Condiciones locativas", criterio: "Techos y paredes sin filtraciones o desprendimientos" },
  { categoria: "Condiciones locativas", criterio: "Iluminación adecuada y funcional" },
  { categoria: "Condiciones locativas", criterio: "Ventilación natural o mecánica suficiente" },
  { categoria: "Condiciones locativas", criterio: "Señalización visible (salidas, rutas de evacuación, prohibiciones)" },
  { categoria: "Seguridad y emergencias", criterio: "Extintores disponibles, señalizados y vigentes" },
  { categoria: "Seguridad y emergencias", criterio: "Accesos a equipos de emergencia libres" },
  { categoria: "Seguridad y emergencias", criterio: "Plan de emergencias socializado" },
  { categoria: "Seguridad y emergencias", criterio: "Rutas de evacuación despejadas" },
  { categoria: "Riesgos químicos", criterio: "Hojas de seguridad (SDS) disponibles y actualizadas" },
  { categoria: "Riesgos químicos", criterio: "Sustancias en recipientes debidamente etiquetados (SGA)" },
  { categoria: "Riesgos químicos", criterio: "Personal con EPP para manipulación de químicos" },
  { categoria: "Riesgos químicos", criterio: "Productos organizados por incompatibilidad" },
  { categoria: "Riesgos químicos", criterio: "Kit antiderrames disponible" },
  { categoria: "Riesgo ambiental", criterio: "Punto ecológico para separación en la fuente debidamente rotulado" },
  { categoria: "Riesgo ambiental", criterio: "Sin derrames visibles de sólidos, líquidos o polvos" },
];

// Criterios específicos para Bodega (según formato de inspección)
const CRITERIOS_BODEGA = [
  // 1. Condiciones locativas
  { categoria: "Condiciones locativas", criterio: "Pisos en buen estado, sin huecos, grietas ni superficies resbalosas" },
  { categoria: "Condiciones locativas", criterio: "Techos y paredes sin filtraciones o desprendimientos" },
  { categoria: "Condiciones locativas", criterio: "Iluminación adecuada y funcional" },
  { categoria: "Condiciones locativas", criterio: "Ventilación natural o mecánica suficiente" },
  { categoria: "Condiciones locativas", criterio: "Señalización visible (salidas, rutas de evacuación, prohibiciones)" },
  // 2. Almacenamiento de materiales
  { categoria: "Almacenamiento de materiales", criterio: "Materiales almacenados según tipo (materia prima, producto, residuos)" },
  { categoria: "Almacenamiento de materiales", criterio: "Altura de apilamiento segura y definida" },
  { categoria: "Almacenamiento de materiales", criterio: "Pasillos despejados y demarcados" },
  { categoria: "Almacenamiento de materiales", criterio: "Big bags / Lonas / Estibas en buen estado" },
  { categoria: "Almacenamiento de materiales", criterio: "Identificación clara de materiales" },
  // 3. Seguridad y emergencias
  { categoria: "Seguridad y emergencias", criterio: "Extintores disponibles, señalizados y vigentes" },
  { categoria: "Seguridad y emergencias", criterio: "Accesos a equipos de emergencia libres" },
  { categoria: "Seguridad y emergencias", criterio: "Plan de emergencias socializado" },
  { categoria: "Seguridad y emergencias", criterio: "Plano y Rutas de evacuación despejadas" },
  // 4. Riesgos mecánicos y físicos
  { categoria: "Riesgos mecánicos y físicos", criterio: "No hay riesgo de caída de objetos" },
  { categoria: "Riesgos mecánicos y físicos", criterio: "Herramientas y equipos almacenados correctamente" },
  { categoria: "Riesgos mecánicos y físicos", criterio: "Control de polvo / material particulado" },
  { categoria: "Riesgos mecánicos y físicos", criterio: "Control de ruido si aplica" },
  // 5. Riesgos químicos
  { categoria: "Riesgos químicos", criterio: "Están disponibles las hojas de seguridad de las sustancias químicas almacenadas" },
  { categoria: "Riesgos químicos", criterio: "Las sustancias se re-envasan en recipientes originales o en recipientes debidamente etiquetados" },
  { categoria: "Riesgos químicos", criterio: "El personal cuenta con elementos de protección personal para manipulación de sustancias químicas" },
  { categoria: "Riesgos químicos", criterio: "Se encuentran organizados los productos químicos de acuerdo con su incompatibilidad. Los frascos de productos químicos cuentan con las etiquetas adecuadas para facilitar su identificación" },
  { categoria: "Riesgos químicos", criterio: "El almacenamiento cuenta con kit antiderrames" },
  // 6. Riesgos Ambientales
  { categoria: "Riesgos Ambientales", criterio: "Punto ecológico para separación en la fuente debidamente rotulado" },
  { categoria: "Riesgos Ambientales", criterio: "Área de almacenamiento sin derrames visibles de sólidos, líquidos o polvos" },
  { categoria: "Riesgos Ambientales", criterio: "Materias primas y productos protegidos contra lluvia, viento y humedad" },
];

// Criterios específicos para Laboratorio (según formato de inspección)
const CRITERIOS_LABORATORIO = [
  // Condiciones locativas
  { categoria: "Condiciones locativas", criterio: "Orden y aseo adecuadas" },
  { categoria: "Condiciones locativas", criterio: "Mesones y superficies limpias y resistentes" },
  { categoria: "Condiciones locativas", criterio: "Iluminación suficiente" },
  { categoria: "Condiciones locativas", criterio: "Ventilación adecuada" },
  { categoria: "Condiciones locativas", criterio: "Área delimitada y de acceso controlado" },
  { categoria: "Condiciones locativas", criterio: "Señalización visible (salidas, rutas de evacuación, prohibiciones)" },
  // Bioseguridad
  { categoria: "Bioseguridad", criterio: "Procedimientos escritos de bioseguridad" },
  { categoria: "Bioseguridad", criterio: "Personal capacitado en riesgos biológicos" },
  { categoria: "Bioseguridad", criterio: "Lavamanos con jabón antibacterial y desinfectante" },
  { categoria: "Bioseguridad", criterio: "Protocolos de ingreso y salida del laboratorio" },
  { categoria: "Bioseguridad", criterio: "Control de contaminación cruzada" },
  // Equipos de laboratorio
  { categoria: "Equipos de laboratorio", criterio: "Equipos calibrados y con mantenimiento vigente" },
  { categoria: "Equipos de laboratorio", criterio: "Cables, conexiones y enchufes en buen estado" },
  { categoria: "Equipos de laboratorio", criterio: "Manuales disponibles" },
  // Seguridad y emergencias
  { categoria: "Seguridad y emergencias", criterio: "Extintores disponibles, señalizados y vigentes" },
  { categoria: "Seguridad y emergencias", criterio: "Accesos a equipos de emergencia libres" },
  { categoria: "Seguridad y emergencias", criterio: "Duchas lava ojos" },
  { categoria: "Seguridad y emergencias", criterio: "Plan de emergencias socializado" },
  { categoria: "Seguridad y emergencias", criterio: "Plano y Rutas de evacuación despejadas" },
  { categoria: "Seguridad y emergencias", criterio: "Señalización de riesgo químico y biológico" },
  // Riesgos químicos
  { categoria: "Riesgos químicos", criterio: "Sustancias debidamente rotuladas (SGA)" },
  { categoria: "Riesgos químicos", criterio: "Hojas de Seguridad (SDS) disponibles y actualizadas" },
  { categoria: "Riesgos químicos", criterio: "El personal cuenta con elementos de protección personal para manipulación de sustancias químicas" },
  { categoria: "Riesgos químicos", criterio: "Se encuentran organizados los productos químicos de acuerdo con su incompatibilidad. Los frascos de productos químicos cuentan con las etiquetas adecuadas para facilitar su identificación" },
  { categoria: "Riesgos químicos", criterio: "Control de fechas de vencimiento de productos" },
  { categoria: "Riesgos químicos", criterio: "El almacenamiento cuenta con kit antiderrames" },
  // Riesgo Ambiental
  { categoria: "Riesgo Ambiental", criterio: "Punto ecológico para separación en la fuente debidamente rotulado" },
  { categoria: "Riesgo Ambiental", criterio: "Residuos biológicos segregados correctamente" },
  { categoria: "Riesgo Ambiental", criterio: "No se evidencian vertimientos sin tratamiento" },
];

// Criterios específicos para Pirólisis (según formato de inspección)
const CRITERIOS_PIROLISIS = [
  // 1. Condiciones Locativas
  { categoria: "Condiciones Locativas", criterio: "Orden y Aseo permanente" },
  { categoria: "Condiciones Locativas", criterio: "Pisos industriales en buen estado" },
  { categoria: "Condiciones Locativas", criterio: "Barandas, guardas y protecciones instaladas" },
  { categoria: "Condiciones Locativas", criterio: "Iluminación industrial adecuada" },
  { categoria: "Condiciones Locativas", criterio: "Señalización de alto riesgo visible" },
  { categoria: "Condiciones Locativas", criterio: "Áreas delimitadas y de acceso controlado" },
  { categoria: "Condiciones Locativas", criterio: "Señalización visible (salidas, rutas de evacuación, prohibiciones)" },
  // 2. Equipos de Proceso
  { categoria: "Equipos de Proceso", criterio: "Reactor, horno y sistemas asociados en buen estado" },
  { categoria: "Equipos de Proceso", criterio: "Instrumentación funcional (temperatura, presión)" },
  { categoria: "Equipos de Proceso", criterio: "Sistemas de parada de emergencia operativos" },
  { categoria: "Equipos de Proceso", criterio: "Mantenimiento documentado" },
  { categoria: "Equipos de Proceso", criterio: "Control de altas temperaturas" },
  { categoria: "Equipos de Proceso", criterio: "Ventilación/filtración operativa" },
  { categoria: "Equipos de Proceso", criterio: "Equipos de control y monitoreo operativos" },
  { categoria: "Equipos de Proceso", criterio: "Tableros eléctricos, señalizados y sellados" },
  // 3. Seguridad y Emergencias
  { categoria: "Seguridad y Emergencias", criterio: "Extintores disponibles, señalizados y vigentes" },
  { categoria: "Seguridad y Emergencias", criterio: "Accesos a equipos de emergencia libres" },
  { categoria: "Seguridad y Emergencias", criterio: "Duchas lava-ojos" },
  { categoria: "Seguridad y Emergencias", criterio: "Plan de emergencias socializado" },
  { categoria: "Seguridad y Emergencias", criterio: "Plano y rutas de evacuación despejadas" },
  { categoria: "Seguridad y Emergencias", criterio: "Señalización de riesgo químico y biológico" },
  { categoria: "Seguridad y Emergencias", criterio: "Uso obligatorio de EPP según área" },
  // 4. Riesgos Químicos
  { categoria: "Riesgos Químicos", criterio: "Sustancias debidamente rotuladas (SGA)" },
  { categoria: "Riesgos Químicos", criterio: "Hojas de Seguridad (SDS) disponibles y actualizadas" },
  { categoria: "Riesgos Químicos", criterio: "El personal cuenta con elementos de protección personal para manipulación de sustancias" },
  { categoria: "Riesgos Químicos", criterio: "Se organizan los productos químicos de acuerdo con su incompatibilidad. Los frascos cuentan con las etiquetas adecuadas para su identificación" },
  { categoria: "Riesgos Químicos", criterio: "Control de fechas de vencimiento de productos" },
  // 5. Almacenamiento Temporal
  { categoria: "Almacenamiento Temporal", criterio: "El almacenamiento cuenta con kit antiderrames" },
  { categoria: "Almacenamiento Temporal", criterio: "Área exclusiva delimitada para biochar" },
  { categoria: "Almacenamiento Temporal", criterio: "Biochar almacenado en big bags adecuados y señalizados" },
  // 6. Uso de Herramientas Menores
  { categoria: "Uso de Herramientas Menores", criterio: "Área definida para almacenamiento" },
  { categoria: "Uso de Herramientas Menores", criterio: "Herramientas en buen estado" },
  { categoria: "Uso de Herramientas Menores", criterio: "Cables y conexiones adecuados" },
  { categoria: "Uso de Herramientas Menores", criterio: "Procedimientos para soldadura y corte" },
  // 7. Riesgo Ambiental
  { categoria: "Riesgo Ambiental", criterio: "Punto ecológico para separación en la fuente debidamente rotulado" },
  { categoria: "Riesgo Ambiental", criterio: "No se evidencian vertimientos sin tratamiento" },
  { categoria: "Riesgo Ambiental", criterio: "Área definida y señalizada para almacenamiento temporal de chatarra" },
  { categoria: "Riesgo Ambiental", criterio: "Clasificación clara: chatarra aprovechable / residuos no aprovechables" },
  { categoria: "Riesgo Ambiental", criterio: "No se evidencia dispersión de restos metálicos en áreas de tránsito" },
];

// Criterios específicos para Administrativa (según formato de inspección)
const CRITERIOS_ADMINISTRATIVA = [
  // 1. Condiciones locativas
  { categoria: "Condiciones locativas", criterio: "Pisos, paredes y techos en buen estado" },
  { categoria: "Condiciones locativas", criterio: "Iluminación adecuada" },
  { categoria: "Condiciones locativas", criterio: "Ventilación natural o mecánica" },
  { categoria: "Condiciones locativas", criterio: "Señalización de emergencias visible" },
  { categoria: "Condiciones locativas", criterio: "Paredes y techos sin humedad, grietas o desprendimientos" },
  // 2. Puestos de trabajo
  { categoria: "Puestos de trabajo", criterio: "Sillas ergonómicas en buen estado" },
  { categoria: "Puestos de trabajo", criterio: "Pantallas a la altura adecuada" },
  { categoria: "Puestos de trabajo", criterio: "Escritorios organizados" },
  { categoria: "Puestos de trabajo", criterio: "Espacio suficiente para movilidad" },
  { categoria: "Puestos de trabajo", criterio: "Pausas activas promovidas" },
  // 3. Riesgo eléctrico
  { categoria: "Riesgo eléctrico", criterio: "Tomas y cables en buen estado" },
  { categoria: "Riesgo eléctrico", criterio: "No hay sobrecargas" },
  { categoria: "Riesgo eléctrico", criterio: "Uso obligatorio de EPP según área" },
  // 4. Emergencia
  { categoria: "Emergencia", criterio: "Extintor disponible y vigente" },
  { categoria: "Emergencia", criterio: "Botiquín accesible" },
  { categoria: "Emergencia", criterio: "Rutas de evacuación despejadas" },
  // 5. Riesgo Ambiental
  { categoria: "Riesgo Ambiental", criterio: "Punto ecológico para separación en la fuente debidamente rotulado" },
  { categoria: "Riesgo Ambiental", criterio: "Uso eficiente de energía (luces y equipos apagados cuando no se usan)" },
  { categoria: "Riesgo Ambiental", criterio: "Prácticas de oficina sostenible promovidas" },
];

function getCriteriosForArea(area: TipoArea | null): typeof CRITERIOS_COMUNES {
  if (!area) return [];

  // Laboratorio, Pirólisis y Bodega tienen su propio set de criterios (no mezclan con comunes)
  if (area === "Laboratorio") {
    return CRITERIOS_LABORATORIO;
  }
  if (area === "Pirólisis") {
    return CRITERIOS_PIROLISIS;
  }
  if (area === "Bodega") {
    return CRITERIOS_BODEGA;
  }
  if (area === "Administrativa") {
    return CRITERIOS_ADMINISTRATIVA;
  }

  return [];
}

const CONDICION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Bueno: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
  Malo:  { bg: "bg-red-100",   text: "text-red-700",   border: "border-red-300" },
  NA:    { bg: "bg-gray-100",  text: "text-gray-500",  border: "border-gray-300" },
};

// Colores sutiles por categoría para diferenciar secciones visualmente
const CATEGORIA_COLORS: Record<string, { header: string; row: string }> = {
  // Laboratorio y Bodega
  "Condiciones locativas":  { header: "bg-blue-500/20 border-l-4 border-blue-400", row: "bg-blue-500/5" },
  "Bioseguridad":           { header: "bg-emerald-500/20 border-l-4 border-emerald-400", row: "bg-emerald-500/5" },
  "Equipos de laboratorio": { header: "bg-violet-500/20 border-l-4 border-violet-400", row: "bg-violet-500/5" },
  "Seguridad y emergencias":{ header: "bg-orange-500/20 border-l-4 border-orange-400", row: "bg-orange-500/5" },
  "Riesgos químicos":       { header: "bg-amber-500/20 border-l-4 border-amber-400", row: "bg-amber-500/5" },
  "Riesgo Ambiental":       { header: "bg-lime-500/20 border-l-4 border-lime-400", row: "bg-lime-500/5" },
  "Riesgo ambiental":       { header: "bg-lime-500/20 border-l-4 border-lime-400", row: "bg-lime-500/5" },
  "Riesgos Ambientales":    { header: "bg-lime-500/20 border-l-4 border-lime-400", row: "bg-lime-500/5" },
  // Pirólisis
  "Condiciones Locativas":  { header: "bg-sky-500/20 border-l-4 border-sky-400", row: "bg-sky-500/5" },
  "Equipos de Proceso":     { header: "bg-purple-500/20 border-l-4 border-purple-400", row: "bg-purple-500/5" },
  "Seguridad y Emergencias":{ header: "bg-orange-500/20 border-l-4 border-orange-400", row: "bg-orange-500/5" },
  "Riesgos Químicos":       { header: "bg-amber-500/20 border-l-4 border-amber-400", row: "bg-amber-500/5" },
  "Almacenamiento Temporal": { header: "bg-teal-500/20 border-l-4 border-teal-400", row: "bg-teal-500/5" },
  "Uso de Herramientas Menores": { header: "bg-indigo-500/20 border-l-4 border-indigo-400", row: "bg-indigo-500/5" },
  // Bodega
  "Almacenamiento de materiales": { header: "bg-cyan-500/20 border-l-4 border-cyan-400", row: "bg-cyan-500/5" },
  "Riesgos mecánicos y físicos":  { header: "bg-red-500/20 border-l-4 border-red-400", row: "bg-red-500/5" },
  // Administrativa
  "Puestos de trabajo":     { header: "bg-pink-500/20 border-l-4 border-pink-400", row: "bg-pink-500/5" },
  "Riesgo eléctrico":       { header: "bg-yellow-500/20 border-l-4 border-yellow-400", row: "bg-yellow-500/5" },
  "Emergencia":             { header: "bg-rose-500/20 border-l-4 border-rose-400", row: "bg-rose-500/5" },
};

// ══════════════════════════════════════════════════════════
// Componente Canvas de Firma (reutilizado de inspecciones-equipos)
// ══════════════════════════════════════════════════════════
function SignatureCanvas({
  onConfirm,
  onCancel,
  titulo,
}: {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
  titulo: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasStrokes = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
    hasStrokes.current = true;
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasStrokes.current = false;
    setIsEmpty(true);
  };

  const confirmSignature = () => {
    if (!canvasRef.current || !hasStrokes.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onConfirm(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Firma</h3>
          <p className="text-sm text-white/60 mt-1">{titulo}</p>
        </div>
        <div className="p-4">
          <div className="relative rounded-xl overflow-hidden border border-white/20 bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full h-[160px] cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-400 text-sm flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Firme aquí
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={clearCanvas}
              className="flex-1 py-2.5 rounded-lg bg-white/10 border border-white/15 text-white/60 text-sm font-medium hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Eraser className="w-4 h-4" />
              Limpiar
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={confirmSignature}
              disabled={isEmpty}
              className="flex-1 py-2.5 rounded-lg bg-green-500/25 border border-green-400/30 text-green-300 text-sm font-semibold hover:bg-green-500/35 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Componente Selector de Condición
// ══════════════════════════════════════════════════════════
function CondicionSelector({
  value,
  onChange,
}: {
  value: CondicionCriterio;
  onChange: (val: CondicionCriterio) => void;
}) {
  const opciones: { val: CondicionCriterio; label: string }[] = [
    { val: "Bueno", label: "B" },
    { val: "Malo",  label: "M" },
    { val: "NA",    label: "N/A" },
  ];

  return (
    <div className="flex gap-1 justify-center">
      {opciones.map((op) => {
        const isSelected = value === op.val;
        const colors = op.val ? CONDICION_COLORS[op.val] : null;

        return (
          <button
            key={op.val}
            onClick={() => onChange(isSelected ? null : op.val)}
            className={`
              w-8 h-7 rounded text-xs font-bold transition-all cursor-pointer
              ${
                isSelected && colors
                  ? `${colors.bg} ${colors.text} ${colors.border} border`
                  : "bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/60"
              }
            `}
            title={op.val || ""}
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Componente principal
// ══════════════════════════════════════════════════════════
export default function InspeccionAreasPage() {
  const router = useRouter();

  // Estados principales
  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Responsables SST (dropdown de inspectores)
  const [responsablesSST, setResponsablesSST] = useState<{ id: string; nombre: string; cedula: string; cargo: string }[]>([]);
  const [loadingResponsables, setLoadingResponsables] = useState(true);

  // Todos los empleados (para Responsable Área)
  const [todosEmpleados, setTodosEmpleados] = useState<{ id: string; nombreCompleto: string; numeroDocumento: string; tipoPersonal: string }[]>([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(true);

  // Datos del formulario
  const [fechaInspeccion, setFechaInspeccion] = useState(
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  );
  const [inspector, setInspector] = useState("");
  const [areaSeleccionada, setAreaSeleccionada] = useState<TipoArea | null>(null);
  const [observacionesGenerales, setObservacionesGenerales] = useState("");

  // Criterios evaluados
  const [criterios, setCriterios] = useState<CriterioEvaluado[]>([]);

  // Acciones correctivas
  const [acciones, setAcciones] = useState<AccionCorrectiva[]>([]);

  // Firmas
  const [firmas, setFirmas] = useState<FirmaResponsable[]>([
    { tipo: "Responsable", nombre: "", cedula: "", cargo: "", firma: null },
    { tipo: "COPASST", nombre: "", cedula: "", cargo: "", firma: null },
    { tipo: "Responsable Área", nombre: "", cedula: "", cargo: "", firma: null },
  ]);
  const [firmandoIndex, setFirmandoIndex] = useState<number | null>(null);

  // Cargar responsables del área SST
  useEffect(() => {
    async function fetchResponsablesSST() {
      try {
        const res = await fetch("/api/inspecciones-areas?responsables=true");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.responsables)) {
            setResponsablesSST(data.responsables);
          }
        }
      } catch (err) {
        console.error("Error cargando responsables SST:", err);
      } finally {
        setLoadingResponsables(false);
      }
    }
    fetchResponsablesSST();
  }, []);

  // Cargar todos los empleados para dropdown de Responsable Área
  useEffect(() => {
    async function fetchTodosEmpleados() {
      try {
        const res = await fetch("/api/personal");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setTodosEmpleados(
              data.data.map((emp: any) => ({
                id: emp.id,
                nombreCompleto: emp.nombreCompleto,
                numeroDocumento: emp.numeroDocumento,
                tipoPersonal: emp.tipoPersonal,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Error cargando empleados:", err);
      } finally {
        setLoadingEmpleados(false);
      }
    }
    fetchTodosEmpleados();
  }, []);

  // Sincronizar "Responsable Inspección" con firma "Responsable"
  useEffect(() => {
    if (inspector && responsablesSST.length > 0) {
      const inspectorData = responsablesSST.find((r) => r.nombre === inspector);
      if (inspectorData) {
        setFirmas((prev) =>
          prev.map((f, i) =>
            i === 0 && f.tipo === "Responsable"
              ? {
                  ...f,
                  nombre: inspectorData.nombre,
                  cedula: inspectorData.cedula,
                  cargo: inspectorData.cargo,
                }
              : f
          )
        );
      }
    }
  }, [inspector, responsablesSST]);

  // Cargar criterios al seleccionar área
  useEffect(() => {
    if (areaSeleccionada) {
      const criteriosParaArea = getCriteriosForArea(areaSeleccionada);
      setCriterios(
        criteriosParaArea.map((c, idx) => ({
          id: `crit-${idx}`,
          categoria: c.categoria,
          criterio: c.criterio,
          condicion: null,
          observacion: "",
        }))
      );
    } else {
      setCriterios([]);
    }
  }, [areaSeleccionada]);

  // Agrupar criterios por categoría
  const criteriosPorCategoria = criterios.reduce(
    (acc, c) => {
      if (!acc[c.categoria]) acc[c.categoria] = [];
      acc[c.categoria].push(c);
      return acc;
    },
    {} as Record<string, CriterioEvaluado[]>
  );

  // Actualizar condición
  const actualizarCondicion = (id: string, condicion: CondicionCriterio) => {
    setCriterios((prev) =>
      prev.map((c) => (c.id === id ? { ...c, condicion } : c))
    );
  };

  // Actualizar observación
  const actualizarObservacion = (id: string, observacion: string) => {
    setCriterios((prev) =>
      prev.map((c) => (c.id === id ? { ...c, observacion } : c))
    );
  };

  // Agregar acción correctiva
  const agregarAccion = () => {
    setAcciones((prev) => [
      ...prev,
      {
        id: `acc-${Date.now()}`,
        descripcion: "",
        tipo: "Correctiva",
        responsable: "",
        fechaPropuestaCierre: "",
        criterioRelacionado: "",
      },
    ]);
  };

  // Eliminar acción
  const eliminarAccion = (id: string) => {
    setAcciones((prev) => prev.filter((a) => a.id !== id));
  };

  // Actualizar acción
  const actualizarAccion = (
    id: string,
    field: keyof AccionCorrectiva,
    value: string
  ) => {
    setAcciones((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  // Actualizar firma
  const actualizarFirmaData = (
    index: number,
    field: keyof FirmaResponsable,
    value: string
  ) => {
    setFirmas((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  };

  const confirmarFirma = (dataUrl: string) => {
    if (firmandoIndex === null) return;
    setFirmas((prev) =>
      prev.map((f, i) => (i === firmandoIndex ? { ...f, firma: dataUrl } : f))
    );
    setFirmandoIndex(null);
  };

  // Llenar con datos de prueba
  const llenarDatosPrueba = (area: TipoArea) => {
    setAreaSeleccionada(area);

    // Esperar a que los criterios se carguen
    setTimeout(() => {
      const criteriosParaArea = getCriteriosForArea(area);

      // Evaluar criterios de forma realista
      const criteriosEvaluados = criteriosParaArea.map((c, idx) => {
        let condicion: CondicionCriterio = null;
        let observacion = "";

        // Distribuir: 60% Bueno, 25% Malo, 15% NA
        const rand = Math.random();
        if (rand < 0.6) {
          condicion = "Bueno";
        } else if (rand < 0.85) {
          condicion = "Malo";
          // Observaciones realistas según el criterio
          if (c.criterio.toLowerCase().includes("extintor")) {
            observacion = "Extintor vencido desde hace 3 meses, requiere recarga inmediata";
          } else if (c.criterio.toLowerCase().includes("señalización")) {
            observacion = "Señalización deteriorada y poco visible, requiere reemplazo";
          } else if (c.criterio.toLowerCase().includes("iluminación")) {
            observacion = "Luminarias fundidas en esquina suroeste del área";
          } else if (c.criterio.toLowerCase().includes("orden") || c.criterio.toLowerCase().includes("aseo")) {
            observacion = "Acumulación de material en pasillos, obstaculiza evacuación";
          } else if (c.criterio.toLowerCase().includes("eléctric")) {
            observacion = "Cables expuestos sin canalización, riesgo de cortocircuito";
          } else if (c.criterio.toLowerCase().includes("ventilación")) {
            observacion = "Sistema de ventilación con filtros saturados";
          } else if (c.criterio.toLowerCase().includes("químic")) {
            observacion = "Sustancias sin rotular según SGA, falta hojas de seguridad";
          } else if (c.criterio.toLowerCase().includes("botiquín")) {
            observacion = "Botiquín con medicamentos vencidos";
          } else if (c.criterio.toLowerCase().includes("ruta")) {
            observacion = "Ruta de evacuación obstruida con equipos";
          } else {
            observacion = "Requiere corrección inmediata según normativa vigente";
          }
        } else {
          condicion = "NA";
        }

        return {
          id: `crit-${idx}`,
          categoria: c.categoria,
          criterio: c.criterio,
          condicion,
          observacion,
        };
      });

      setCriterios(criteriosEvaluados);

      // Crear acciones correctivas para criterios malos
      const criteriosMalos = criteriosEvaluados.filter((c) => c.condicion === "Malo");
      const accionesPrueba: AccionCorrectiva[] = criteriosMalos.slice(0, 3).map((c, idx) => {
        let descripcion = "";
        let tipo: "Preventiva" | "Correctiva" | "Mejora" = "Correctiva";

        if (c.criterio.toLowerCase().includes("extintor")) {
          descripcion = "Realizar recarga y mantenimiento de extintor según NTC 2885. Programar inspección mensual.";
        } else if (c.criterio.toLowerCase().includes("señalización")) {
          descripcion = "Reemplazar señalización deteriorada por material fotoluminiscente. Verificar cumplimiento NTC 1461.";
        } else if (c.criterio.toLowerCase().includes("iluminación")) {
          descripcion = "Reemplazar luminarias fundidas. Verificar nivel de iluminación según Resolución 2400.";
        } else if (c.criterio.toLowerCase().includes("orden") || c.criterio.toLowerCase().includes("aseo")) {
          descripcion = "Implementar programa 5S. Despejar pasillos y rutas de evacuación inmediatamente.";
          tipo = "Preventiva";
        } else if (c.criterio.toLowerCase().includes("eléctric")) {
          descripcion = "Canalizar cables expuestos. Realizar inspección eléctrica completa del área.";
        } else if (c.criterio.toLowerCase().includes("químic")) {
          descripcion = "Etiquetar sustancias químicas según SGA. Actualizar matriz de compatibilidad química.";
        } else {
          descripcion = `Corregir hallazgo: ${c.criterio}. Verificar cumplimiento normativo.`;
        }

        const fechaPropuesta = new Date();
        fechaPropuesta.setDate(fechaPropuesta.getDate() + 15); // 15 días

        return {
          id: `acc-${Date.now()}-${idx}`,
          descripcion,
          tipo,
          responsable: "",
          fechaPropuestaCierre: fechaPropuesta.toISOString().split("T")[0],
          criterioRelacionado: c.id,
        };
      });

      setAcciones(accionesPrueba);

      // Observaciones generales
      const observacionesGenerales = `Inspección de prueba realizada en ${area}.
Se identificaron ${criteriosMalos.length} hallazgos que requieren atención.
Priorizar acciones correctivas relacionadas con seguridad de personas.`;

      setObservacionesGenerales(observacionesGenerales);
    }, 100);
  };

  // Estadísticas
  const criteriosEvaluados = criterios.filter((c) => c.condicion !== null).length;
  const firmasCompletas = firmas.filter((f) => f.firma !== null).length;

  // Guardar inspección
  const guardarInspeccion = async () => {
    if (!areaSeleccionada) {
      setErrorMessage("Debe seleccionar un área");
      return;
    }

    if (criteriosEvaluados === 0) {
      setErrorMessage("Debe evaluar al menos un criterio");
      return;
    }

    if (firmasCompletas === 0) {
      setErrorMessage("Debe incluir al menos una firma");
      return;
    }

    setPageState("saving");
    setErrorMessage(null);

    try {
      const payload = {
        fechaInspeccion,
        inspector,
        area: areaSeleccionada,
        observacionesGenerales,
        criterios: criterios
          .filter((c) => c.condicion !== null)
          .map((c) => ({
            id: c.id,
            categoria: c.categoria,
            criterio: c.criterio,
            condicion: c.condicion!,
            observacion: c.observacion,
          })),
        accionesCorrectivas: acciones
          .filter((a) => a.descripcion.trim() !== "")
          .map((a) => ({
            descripcion: a.descripcion,
            tipo: a.tipo,
            responsable: a.responsable,
            fechaPropuestaCierre: a.fechaPropuestaCierre,
            criterioRelacionado: a.criterioRelacionado,
          })),
        responsables: firmas
          .filter((f) => f.firma !== null && f.nombre.trim() !== "")
          .map((f) => ({
            tipo: f.tipo,
            nombre: f.nombre,
            cedula: f.cedula,
            cargo: f.cargo,
            firma: f.firma!,
          })),
      };

      // DEBUG: Log del payload
      console.log("[Frontend] Payload a enviar:", {
        criterios: payload.criterios.length,
        acciones: payload.accionesCorrectivas.length,
        responsables: payload.responsables.length,
        primerCriterio: payload.criterios[0],
        primerAccion: payload.accionesCorrectivas[0],
        primerResp: payload.responsables[0] ? { ...payload.responsables[0], firma: "..." } : null,
      });

      const res = await fetch("/api/inspecciones-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        setPageState("success");
      } else {
        throw new Error(json.message || "Error al guardar");
      }
    } catch (err) {
      setPageState("error");
      setErrorMessage(err instanceof Error ? err.message : "Error desconocido");
    }
  };

  // ══════════════════════════════════════════════════════════
  // Renderizado
  // ══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="/20032025-DSC_3717.jpg"
          alt=""
          fill
          className="object-cover"
          priority
          quality={85}
        />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard/inspecciones")}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/20 backdrop-blur-sm">
                  <MapPin className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Inspección de Áreas Físicas</h1>
                  <p className="text-xs text-white/60">Condiciones de seguridad y salud en el trabajo</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/dashboard/inspecciones-areas/historial")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
              >
                <History size={18} />
                <span className="hidden sm:inline">Historial</span>
              </button>
              <button
                onClick={guardarInspeccion}
                disabled={pageState === "saving" || !areaSeleccionada || criteriosEvaluados === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {pageState === "saving" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                <span className="hidden sm:inline">Guardar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Mensajes */}
        {errorMessage && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-white">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm">{errorMessage}</p>
            <button onClick={() => setErrorMessage(null)} className="ml-auto p-1 hover:bg-white/10 rounded">
              <X size={16} />
            </button>
          </div>
        )}

        {pageState === "success" && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/20 border border-green-500/30 text-white">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p>Inspección guardada exitosamente</p>
          </div>
        )}

        {/* Datos generales */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Datos de la Inspección
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Fecha</label>
              <input
                type="date"
                value={fechaInspeccion}
                onChange={(e) => setFechaInspeccion(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Responsable Inspección *</label>
              <select
                value={inspector}
                onChange={(e) => setInspector(e.target.value)}
                disabled={loadingResponsables}
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="" className="bg-slate-800">
                  {loadingResponsables ? "Cargando..." : "Seleccionar responsable..."}
                </option>
                {responsablesSST.map((r) => (
                  <option key={r.id} value={r.nombre} className="bg-slate-800">
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Área *</label>
              <select
                value={areaSeleccionada || ""}
                onChange={(e) => setAreaSeleccionada((e.target.value as TipoArea) || null)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-800">Seleccionar área...</option>
                {AREAS.map((a) => (
                  <option key={a} value={a} className="bg-slate-800">{a}</option>
                ))}
              </select>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => llenarDatosPrueba("Laboratorio")}
                  className="flex-1 px-2 py-1.5 text-xs rounded bg-purple-500/20 border border-purple-400/30 text-purple-300 hover:bg-purple-500/30 transition-all"
                >
                  🧪 Prueba Lab
                </button>
                <button
                  onClick={() => llenarDatosPrueba("Pirólisis")}
                  className="flex-1 px-2 py-1.5 text-xs rounded bg-orange-500/20 border border-orange-400/30 text-orange-300 hover:bg-orange-500/30 transition-all"
                >
                  🔥 Prueba Pir
                </button>
                <button
                  onClick={() => llenarDatosPrueba("Bodega")}
                  className="flex-1 px-2 py-1.5 text-xs rounded bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/30 transition-all"
                >
                  📦 Prueba Bod
                </button>
                <button
                  onClick={() => llenarDatosPrueba("Administrativa")}
                  className="flex-1 px-2 py-1.5 text-xs rounded bg-blue-500/20 border border-blue-400/30 text-blue-300 hover:bg-blue-500/30 transition-all"
                >
                  💼 Prueba Adm
                </button>
              </div>
            </div>
            <div className="flex items-end">
              <div className="w-full px-4 py-2.5 rounded-lg bg-blue-500/20 border border-blue-500/30">
                <p className="text-xs text-white/60">Criterios evaluados</p>
                <p className="text-xl font-bold text-blue-400">
                  {criteriosEvaluados} / {criterios.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Criterios de evaluación */}
        {areaSeleccionada && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-400" />
              Criterios de Evaluación — {areaSeleccionada}
            </h2>

            <div className="space-y-4">
              {Object.entries(criteriosPorCategoria).map(([categoria, items]) => {
                const colores = CATEGORIA_COLORS[categoria] || { header: "bg-white/10", row: "bg-white/5" };
                return (
                <div key={categoria} className="space-y-2">
                  <h3 className={`text-sm font-semibold text-white/90 px-3 py-2 rounded-lg ${colores.header}`}>
                    {categoria}
                  </h3>
                  <div className="space-y-1">
                    {items.map((criterio) => (
                      <div
                        key={criterio.id}
                        className={`grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-2 items-center p-3 rounded-lg ${colores.row} hover:bg-white/10 transition-colors`}
                      >
                        <div className="text-sm text-white/90">{criterio.criterio}</div>
                        <CondicionSelector
                          value={criterio.condicion}
                          onChange={(val) => actualizarCondicion(criterio.id, val)}
                        />
                        <input
                          type="text"
                          value={criterio.observacion}
                          onChange={(e) => actualizarObservacion(criterio.id, e.target.value)}
                          placeholder="Observaciones..."
                          className="w-full px-3 py-1.5 text-sm rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-400/50"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
              })}
            </div>
          </div>
        )}

        {/* Acciones correctivas */}
        {areaSeleccionada && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-400" />
                Acciones Correctivas / Preventivas
              </h2>
              <button
                onClick={agregarAccion}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-400/30 text-orange-300 text-sm font-medium hover:bg-orange-500/30 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>

            {acciones.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-4">No hay acciones registradas</p>
            ) : (
              <div className="space-y-3">
                {acciones.map((accion, idx) => (
                  <div key={accion.id} className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/60">Acción #{idx + 1}</span>
                      <button
                        onClick={() => eliminarAccion(accion.id)}
                        className="p-1 rounded hover:bg-white/10 text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      value={accion.descripcion}
                      onChange={(e) => actualizarAccion(accion.id, "descripcion", e.target.value)}
                      placeholder="Descripción de la acción..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-orange-400/50 resize-none"
                    />
                    <select
                      value={accion.criterioRelacionado}
                      onChange={(e) => actualizarAccion(accion.id, "criterioRelacionado", e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-orange-400/50 appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-slate-800">Seleccionar criterio relacionado...</option>
                      {criterios.filter((c) => c.condicion !== null).map((c) => (
                        <option key={c.id} value={c.id} className="bg-slate-800">
                          {c.categoria} → {c.criterio} ({c.condicion})
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={accion.tipo}
                        onChange={(e) => actualizarAccion(accion.id, "tipo", e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-orange-400/50 appearance-none cursor-pointer"
                      >
                        <option value="Correctiva" className="bg-slate-800">Correctiva</option>
                        <option value="Preventiva" className="bg-slate-800">Preventiva</option>
                        <option value="Mejora" className="bg-slate-800">Mejora</option>
                      </select>
                      <input
                        type="text"
                        value={accion.responsable}
                        onChange={(e) => actualizarAccion(accion.id, "responsable", e.target.value)}
                        placeholder="Responsable"
                        className="px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-orange-400/50"
                      />
                      <input
                        type="date"
                        value={accion.fechaPropuestaCierre}
                        onChange={(e) => actualizarAccion(accion.id, "fechaPropuestaCierre", e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-orange-400/50"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Firmas */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            Firmas de Responsables
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {firmas.map((firma, idx) => {
              // Filtrar responsables ya seleccionados en otras firmas o como inspector
              const nombresUsados = new Set<string>();
              if (inspector) nombresUsados.add(inspector);
              firmas.forEach((f, i) => {
                if (i !== idx && f.nombre) nombresUsados.add(f.nombre);
              });
              const responsablesDisponibles = responsablesSST.filter(
                (r) => !nombresUsados.has(r.nombre) || r.nombre === firma.nombre
              );

              return (
              <div key={firma.tipo} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{firma.tipo}</h3>
                  {firma.firma ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-medium text-green-400">Firmado</span>
                      <button
                        onClick={() => setFirmas((prev) => prev.map((f, i) => (i === idx ? { ...f, firma: null } : f)))}
                        className="ml-2 p-1 rounded hover:bg-white/10 text-white/40"
                        title="Borrar firma"
                      >
                        <Eraser className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {firma.tipo === "Responsable Área" ? (
                    // Dropdown de TODOS los empleados para Responsable Área
                    <select
                      value={firma.nombre}
                      onChange={(e) => {
                        const selectedNombre = e.target.value;
                        const selectedEmp = todosEmpleados.find((emp) => emp.nombreCompleto === selectedNombre);
                        setFirmas((prev) =>
                          prev.map((f, i) =>
                            i === idx
                              ? {
                                  ...f,
                                  nombre: selectedNombre,
                                  cedula: selectedEmp?.numeroDocumento || "",
                                  cargo: selectedEmp?.tipoPersonal || "",
                                }
                              : f
                          )
                        );
                      }}
                      disabled={loadingEmpleados}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-blue-400/50 appearance-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="" className="bg-slate-800">
                        {loadingEmpleados ? "Cargando..." : "Seleccionar empleado..."}
                      </option>
                      {todosEmpleados.map((emp) => (
                        <option key={emp.id} value={emp.nombreCompleto} className="bg-slate-800">
                          {emp.nombreCompleto}
                        </option>
                      ))}
                    </select>
                  ) : (
                    // Dropdown de responsables SST para Responsable y COPASST
                    <select
                      value={firma.nombre}
                      onChange={(e) => {
                        const selectedNombre = e.target.value;
                        const selectedResp = responsablesSST.find((r) => r.nombre === selectedNombre);
                        setFirmas((prev) =>
                          prev.map((f, i) =>
                            i === idx
                              ? {
                                  ...f,
                                  nombre: selectedNombre,
                                  cedula: selectedResp?.cedula || "",
                                  cargo: selectedResp?.cargo || "",
                                }
                              : f
                          )
                        );
                      }}
                      disabled={loadingResponsables}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-blue-400/50 appearance-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="" className="bg-slate-800">
                        {loadingResponsables ? "Cargando..." : "Seleccionar responsable..."}
                      </option>
                      {responsablesDisponibles.map((r) => (
                        <option key={r.id} value={r.nombre} className="bg-slate-800">
                          {r.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={firma.cedula}
                      onChange={(e) => actualizarFirmaData(idx, "cedula", e.target.value)}
                      placeholder="Cédula"
                      className="px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-blue-400/50 placeholder-white/40"
                    />
                    <input
                      type="text"
                      value={firma.cargo}
                      onChange={(e) => actualizarFirmaData(idx, "cargo", e.target.value)}
                      placeholder="Cargo"
                      className="px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-blue-400/50 placeholder-white/40"
                    />
                  </div>
                </div>
                {!firma.firma ? (
                  <button
                    onClick={() => setFirmandoIndex(idx)}
                    disabled={!firma.nombre.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300 text-sm font-medium hover:bg-blue-500/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <PenTool className="w-4 h-4" />
                    Firmar
                  </button>
                ) : null}
              </div>
            );
            })}
          </div>
        </div>

        {/* Leyenda */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-3 flex flex-wrap gap-4 text-xs text-white/60">
          <span className="font-medium text-white/80">Leyenda:</span>
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-green-100 text-green-700 flex items-center justify-center font-bold text-[10px]">B</span>
            Bueno
          </span>
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold text-[10px]">M</span>
            Malo
          </span>
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-[10px]">N/A</span>
            No Aplica
          </span>
        </div>
      </main>

      {/* Modal de firma */}
      {firmandoIndex !== null && (
        <SignatureCanvas
          titulo={`${firmas[firmandoIndex].tipo} — ${firmas[firmandoIndex].nombre}`}
          onConfirm={confirmarFirma}
          onCancel={() => setFirmandoIndex(null)}
        />
      )}
    </div>
  );
}
