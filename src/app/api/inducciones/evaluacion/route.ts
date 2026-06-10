// ══════════════════════════════════════════════════════════
// GET /api/inducciones/evaluacion?induccionId=X
// Evaluación completa de 26 preguntas para Inducción/Reinducción
// SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC
// ══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { induccionesRepository } from "@/infrastructure/repositories/airtableInduccionesRepository";
import type { EstadoEvaluacion } from "@/shared/types/inducciones";

export async function GET(request: NextRequest) {
  const induccionId = request.nextUrl.searchParams.get("induccionId");
  const idEmpleadoCore = request.nextUrl.searchParams.get("idEmpleadoCore");

  if (!induccionId || !idEmpleadoCore) {
    return NextResponse.json(
      { success: false, message: "induccionId y idEmpleadoCore requeridos" },
      { status: 400 }
    );
  }

  try {
    // 26 preguntas de la evaluación oficial
    const preguntas = [
      // Bloque 1: Normativa y Reglamento Interno
      {
        ppId: "pp1",
        preguntaId: "p1",
        orden: 1,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "¿El Reglamento Interno de Trabajo habla de mecanismos de prevención para abuso laboral y el procedimiento interno para solucionarlo?",
        tipo: "Selección Única",
        opciones: ["Sí", "No"],
        respuestaCorrecta: "Sí",
        explicacion: "",
      },
      {
        ppId: "pp2",
        preguntaId: "p2",
        orden: 2,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "¿El Reglamento Interno de Trabajo habla del cumplimiento laboral?",
        tipo: "Selección Única",
        opciones: ["Sí", "No"],
        respuestaCorrecta: "Sí",
        explicacion: "",
      },
      // Bloque 2: Contratación
      {
        ppId: "pp3",
        preguntaId: "p3",
        orden: 3,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "En la contratación laboral usted queda afiliado a:",
        tipo: "Selección Única",
        opciones: [
          "Seguro de Responsabilidad Civil",
          "Sistema de Seguridad Social (ARL, EPS, AFP, CAJA DE COMPENSACION)",
          "Sistema de Vigilancia Privada, SOAT y ARL",
          "Ninguna de las anteriores",
        ],
        respuestaCorrecta: "Sistema de Seguridad Social (ARL, EPS, AFP, CAJA DE COMPENSACION)",
        explicacion: "",
      },
      // Bloque 3: Políticas
      {
        ppId: "pp4",
        preguntaId: "p4",
        orden: 4,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "Seleccione qué políticas tiene la empresa:",
        tipo: "Selección Única",
        opciones: [
          "Política de EPP",
          "Política Ambiental",
          "Política de Acoso laboral",
          "Política de SST",
          "Política de alcohol y drogas y sustancias psicoactivas",
          "Política de Seguridad Vial",
          "Todas las anteriores",
        ],
        respuestaCorrecta: "Todas las anteriores",
        explicacion: "",
      },
      {
        ppId: "pp5",
        preguntaId: "p5",
        orden: 5,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "¿En SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC respetamos las leyes laborales?",
        tipo: "Selección Única",
        opciones: ["Sí", "No"],
        respuestaCorrecta: "Sí",
        explicacion: "",
      },
      // Bloque 4: Reglamento de Higiene
      {
        ppId: "pp6",
        preguntaId: "p6",
        orden: 6,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "¿Qué es el Reglamento de Higiene y Seguridad Industrial?",
        tipo: "Selección Única",
        opciones: [
          "Son los EPP que se deben usar",
          "Son los derechos y deberes en una empresa",
          "Documento con disposiciones legales sobre prevención de accidentes y enfermedades profesionales",
          "Ninguna de las anteriores",
        ],
        respuestaCorrecta: "Documento con disposiciones legales sobre prevención de accidentes y enfermedades profesionales",
        explicacion: "",
      },
      // Bloque 5: Responsabilidades SST
      {
        ppId: "pp7",
        preguntaId: "p7",
        orden: 7,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "Responsabilidades de los trabajadores con el SG-SST:",
        tipo: "Selección Única",
        opciones: [
          "Suministrar información clara sobre su estado de salud",
          "Reportar inmediatamente accidentes de trabajo o incidentes",
          "Cumplir con las políticas de SST",
          "Todas las anteriores",
        ],
        respuestaCorrecta: "Todas las anteriores",
        explicacion: "",
      },
      {
        ppId: "pp8",
        preguntaId: "p8",
        orden: 8,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "Definición de Seguridad y Salud en el Trabajo:",
        tipo: "Selección Única",
        opciones: [
          "Prevenir lesiones y enfermedades causadas por condiciones de trabajo",
          "Proteger y promover la salud",
          "Mejorar las condiciones y el medio ambiente de trabajo",
          "Todas las anteriores",
        ],
        respuestaCorrecta: "Todas las anteriores",
        explicacion: "",
      },
      // Bloque 6: Brigadas (Declarativa - no califica)
      {
        ppId: "pp9",
        preguntaId: "p9",
        orden: 9,
        puntajeAsignado: 0,
        obligatoria: true,
        tipo: "Selección Múltiple",
        texto: "Tipos de brigadas de emergencia (marque las que aplican):",
        opciones: [
          "Primeros Auxilios",
          "Uso Obligatorio de EPP",
          "Control de Incendios",
          "Evacuación y Rescate",
        ],
        respuestaCorrecta: "Primeros Auxilios|Uso Obligatorio de EPP|Control de Incendios|Evacuación y Rescate",
        explicacion: "Pregunta declarativa - todas son brigadas válidas",
      },
      // Bloque 6.1: Identificación visual (adaptada a formato textual)
      {
        ppId: "pp10",
        preguntaId: "p10",
        orden: 10,
        puntajeAsignado: 0,
        obligatoria: true,
        tipo: "Selección Múltiple",
        texto: "¿Cuáles de las siguientes afirmaciones sobre el uso de EPP son correctas? (pregunta declarativa):",
        opciones: [
          "Debo usar el EPP solo si lo considero necesario",
          "Es obligatorio usar el EPP asignado según el riesgo de mi labor",
          "Puedo prestar mi EPP a compañeros si me lo solicitan",
          "Debo inspeccionar el estado del EPP antes de usarlo",
          "Si el EPP está dañado, debo reportarlo inmediatamente",
          "El EPP es responsabilidad exclusiva de la empresa",
          "Debo mantener el EPP limpio y guardado correctamente",
        ],
        respuestaCorrecta:
          "Es obligatorio usar el EPP asignado según el riesgo de mi labor|Debo inspeccionar el estado del EPP antes de usarlo|Si el EPP está dañado, debo reportarlo inmediatamente|Debo mantener el EPP limpio y guardado correctamente",
        explicacion: "Pregunta declarativa (no suma puntaje).",
      },
      {
        ppId: "pp11",
        preguntaId: "p11",
        orden: 11,
        puntajeAsignado: 0,
        obligatoria: true,
        tipo: "Selección Múltiple",
        texto: "¿Cuáles son responsabilidades del trabajador en materia de SST? (pregunta declarativa):",
        opciones: [
          "Informar condiciones inseguras que identifique",
          "Esperar a que SST solucione todos los problemas",
          "Participar en las capacitaciones programadas",
          "Usar correctamente los EPP y herramientas",
          "Cumplir las normas de seguridad solo cuando hay supervisión",
          "Cuidar mi salud y la de mis compañeros",
          "Reportar accidentes e incidentes laborales",
        ],
        respuestaCorrecta:
          "Informar condiciones inseguras que identifique|Participar en las capacitaciones programadas|Usar correctamente los EPP y herramientas|Cuidar mi salud y la de mis compañeros|Reportar accidentes e incidentes laborales",
        explicacion: "Pregunta declarativa (no suma puntaje).",
      },
      // Bloque 7: COPASST
      {
        ppId: "pp12",
        preguntaId: "p12",
        orden: 12,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "Responsabilidades del COPASST:",
        tipo: "Selección Única",
        opciones: [
          "Realizar inspecciones de seguridad",
          "Proponer y participar en capacitaciones en SST",
          "Participar en investigación de accidentes",
          "Todas las anteriores",
        ],
        respuestaCorrecta: "Todas las anteriores",
        explicacion: "",
      },
      // Bloque 7.1: Ordenamiento de pasos (adaptado a selección única)
      {
        ppId: "pp13",
        preguntaId: "p13",
        orden: 13,
        puntajeAsignado: 0,
        obligatoria: true,
        texto: "En el procedimiento para reportar un accidente, ¿cuál es el paso inicial? (pregunta declarativa)",
        tipo: "Selección Única",
        opciones: [
          "Informar de inmediato al jefe inmediato y/o SST",
          "Esperar al final de la jornada",
          "Publicarlo en redes sociales",
          "No reportar si parece leve",
        ],
        respuestaCorrecta: "Informar de inmediato al jefe inmediato y/o SST",
        explicacion: "Pregunta declarativa (no suma puntaje).",
      },
      // Bloque 8: Vías de ingreso
      {
        ppId: "pp14",
        preguntaId: "p14",
        orden: 14,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "Vías de ingreso al manipular productos químicos:",
        tipo: "Selección Múltiple",
        opciones: ["Inhalación", "Visual", "Dérmica", "Tejidos Blandos", "Todas las anteriores"],
        respuestaCorrecta: "Inhalación|Visual|Dérmica",
        explicacion: "Las vías correctas son inhalación, visual (ojos) y dérmica (piel)",
      },
      // Bloque 8.1: Ordenamiento de emergencia (adaptado a selección única)
      {
        ppId: "pp15",
        preguntaId: "p15",
        orden: 15,
        puntajeAsignado: 0,
        obligatoria: true,
        texto: "En una emergencia, ¿qué debe hacerse primero? (pregunta declarativa)",
        tipo: "Selección Única",
        opciones: [
          "Conservar la calma y activar el reporte por el canal definido",
          "Salir corriendo sin avisar",
          "Esperar a que alguien más actúe",
          "Ignorar la situación",
        ],
        respuestaCorrecta: "Conservar la calma y activar el reporte por el canal definido",
        explicacion: "Pregunta declarativa (no suma puntaje).",
      },
      // Bloque 9: ARL
      {
        ppId: "pp16",
        preguntaId: "p16",
        orden: 16,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "¿A qué ARL afilia la empresa SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC?",
        tipo: "Selección Única",
        opciones: ["Sura", "Positiva", "La Equidad", "Colmena"],
        respuestaCorrecta: "Positiva",
        explicacion: "",
      },
      // Bloque 10: Acoso laboral
      {
        ppId: "pp17",
        preguntaId: "p17",
        orden: 17,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "¿Qué es acoso laboral y qué debo hacer?",
        tipo: "Selección Única",
        opciones: [
          "Agresión física, verbal y sexual",
          "Hostigamiento, maltrato, humillación y burlas",
          "Avisar al jefe inmediato, al área de SST y al área administrativa",
          "Todas las anteriores",
        ],
        respuestaCorrecta: "Todas las anteriores",
        explicacion: "",
      },
      {
        ppId: "pp18",
        preguntaId: "p18",
        orden: 18,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "Funciones del COCOLAB:",
        tipo: "Selección Única",
        opciones: [
          "Prevenir el Acoso Laboral",
          "Realiza actividades lúdicas",
          "Previene accidentes",
          "Todas las anteriores",
        ],
        respuestaCorrecta: "Prevenir el Acoso Laboral",
        explicacion: "",
      },
      // Bloque 11: Riesgo y Peligro
      {
        ppId: "pp19",
        preguntaId: "p19",
        orden: 19,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "Definición de Riesgo y Peligro:",
        tipo: "Selección Única",
        opciones: [
          "Lesiones personales",
          "Probabilidad que ocurra un accidente y fuente principal que ocasiona un daño",
          "Imprudencias de los actos y condiciones seguras",
          "Todas las anteriores",
        ],
        respuestaCorrecta: "Probabilidad que ocurra un accidente y fuente principal que ocasiona un daño",
        explicacion: "",
      },
      // Bloque 12: Herramientas
      {
        ppId: "pp20",
        preguntaId: "p20",
        orden: 20,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "Riesgos al manipular herramientas manuales y no manuales:",
        tipo: "Selección Única",
        opciones: [
          "Aplastamientos",
          "Cortaduras y amputaciones",
          "Quemaduras",
          "Todas las anteriores",
        ],
        respuestaCorrecta: "Todas las anteriores",
        explicacion: "",
      },
      {
        ppId: "pp21",
        preguntaId: "p21",
        orden: 21,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "Si la carga es muy pesada, usted debe:",
        tipo: "Selección Única",
        opciones: [
          "Levantarla solo",
          "Realizar un sobreesfuerzo",
          "Solicitar ayuda a un compañero",
          "Ninguna de las anteriores",
        ],
        respuestaCorrecta: "Solicitar ayuda a un compañero",
        explicacion: "",
      },
      // Bloque 12.1: Identificación de peligros (adaptada a selección múltiple)
      {
        ppId: "pp22",
        preguntaId: "p22",
        orden: 22,
        puntajeAsignado: 0,
        obligatoria: true,
        texto: "¿Cuáles de las siguientes acciones son correctas ante una situación de riesgo? (pregunta declarativa):",
        tipo: "Selección Múltiple",
        opciones: [
          "Improvisar soluciones rápidas para ganar tiempo",
          "Reportar la situación a mi supervisor o al área de SST",
          "Seguir trabajando si el riesgo parece menor",
          "Alertar a mis compañeros sobre el peligro",
          "Tomar medidas preventivas si está en mi capacidad",
          "Ignorar el riesgo si no me afecta directamente",
          "Esperar instrucciones antes de actuar en emergencias",
          "Priorizar siempre la seguridad sobre la productividad",
        ],
        respuestaCorrecta:
          "Reportar la situación a mi supervisor o al área de SST|Alertar a mis compañeros sobre el peligro|Tomar medidas preventivas si está en mi capacidad|Priorizar siempre la seguridad sobre la productividad",
        explicacion: "Pregunta declarativa (no suma puntaje).",
      },
      {
        ppId: "pp23",
        preguntaId: "p23",
        orden: 23,
        puntajeAsignado: 0,
        obligatoria: true,
        texto: "Seleccione las correspondencias correctas entre residuo y caneca (pregunta declarativa):",
        tipo: "Selección Múltiple",
        opciones: [
          "Blanca - aprovechables (papel, cartón, plástico, vidrio y metales)",
          "Verde - orgánicos aprovechables",
          "Negra - no aprovechables",
          "Roja - residuos biosanitarios o de riesgo biológico",
          "Amarilla - residuos químicos o peligrosos según rotulación interna",
        ],
        respuestaCorrecta:
          "Blanca - aprovechables (papel, cartón, plástico, vidrio y metales)|Verde - orgánicos aprovechables|Negra - no aprovechables|Roja - residuos biosanitarios o de riesgo biológico|Amarilla - residuos químicos o peligrosos según rotulación interna",
        explicacion: "Pregunta declarativa (no suma puntaje).",
      },
      {
        ppId: "pp24",
        preguntaId: "p24",
        orden: 24,
        puntajeAsignado: 0,
        obligatoria: true,
        texto: "Seleccione relaciones correctas entre aspecto e impacto ambiental (pregunta declarativa):",
        tipo: "Selección Múltiple",
        opciones: [
          "Derrame de combustible - contaminación de suelo y agua",
          "Emisión de humo - deterioro de la calidad del aire",
          "Disposición inadecuada de residuos - proliferación de vectores",
          "Ruido excesivo - afectación a la salud auditiva",
          "Consumo ineficiente de agua - agotamiento del recurso hídrico",
        ],
        respuestaCorrecta:
          "Derrame de combustible - contaminación de suelo y agua|Emisión de humo - deterioro de la calidad del aire|Disposición inadecuada de residuos - proliferación de vectores|Ruido excesivo - afectación a la salud auditiva|Consumo ineficiente de agua - agotamiento del recurso hídrico",
        explicacion: "Pregunta declarativa (no suma puntaje).",
      },
      // Bloque 13: Derrames
      {
        ppId: "pp25",
        preguntaId: "p25",
        orden: 25,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "¿Qué tipo de derrames debo reportar?",
        tipo: "Selección Única",
        opciones: [
          "Derrame de gaseosas y jugos",
          "Derrame de agua residual, lodos, aceites, combustibles y químicos",
          "Todas las anteriores",
        ],
        respuestaCorrecta: "Derrame de agua residual, lodos, aceites, combustibles y químicos",
        explicacion: "",
      },
      {
        ppId: "pp26",
        preguntaId: "p26",
        orden: 26,
        puntajeAsignado: 1,
        obligatoria: true,
        texto: "¿A quién reportar en caso de incendio forestal?",
        tipo: "Selección Única",
        opciones: [
          "Jefe inmediato, Brigadistas",
          "Departamento de gestión ambiental",
          "Departamento de SST",
          "Todas las anteriores",
        ],
        respuestaCorrecta: "Todas las anteriores",
        explicacion: "",
      },
    ];

    const plantilla = {
      id: "plnt-ind-2026",
      codigo: "PLNT-IND-2026",
      nombre: "Evaluación de Inducción y/o Reinducción del Personal",
      descripcion: "SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC - Evaluación completa de SST, normativa laboral y medio ambiente",
      tipo: "Inducción",
      puntajeMinimo: 80, // 80% para aprobar
      tiempoLimite: 45, // 45 minutos
      intentosPermitidos: 3,
      mostrarRetro: true,
    };

    return NextResponse.json({
      success: true,
      pendientes: [
        {
          id: plantilla.id,
          nombre: plantilla.nombre,
          descripcion: plantilla.descripcion,
          tipo: plantilla.tipo,
          puntajeMinimo: plantilla.puntajeMinimo,
          tiempoLimite: plantilla.tiempoLimite,
          intentosPermitidos: plantilla.intentosPermitidos,
          intentosRealizados: 0,
          aprobada: false,
          disponible: true,
        },
      ],
      plantilla,
      preguntas,
    });
  } catch (error: any) {
    console.error("[Inducción Eval] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/inducciones/evaluacion
// Guarda el resultado final de la evaluación en el registro de inducción
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      induccionId,
      idEmpleadoCore,
      puntajeEvaluacion,
      estadoEvaluacion,
    } = body as {
      induccionId?: string;
      idEmpleadoCore?: string;
      puntajeEvaluacion?: number;
      estadoEvaluacion?: EstadoEvaluacion;
    };

    if (!induccionId || !idEmpleadoCore) {
      return NextResponse.json(
        { success: false, message: "induccionId y idEmpleadoCore son requeridos" },
        { status: 400 }
      );
    }

    if (typeof puntajeEvaluacion !== "number" || Number.isNaN(puntajeEvaluacion) || puntajeEvaluacion < 0 || puntajeEvaluacion > 100) {
      return NextResponse.json(
        { success: false, message: "puntajeEvaluacion debe ser un número entre 0 y 100" },
        { status: 400 }
      );
    }

    const estadosValidos: EstadoEvaluacion[] = ["Aprobada", "Pendiente", "No_Presentada"];
    if (!estadoEvaluacion || !estadosValidos.includes(estadoEvaluacion)) {
      return NextResponse.json(
        { success: false, message: "estadoEvaluacion inválido" },
        { status: 400 }
      );
    }

    const registro = await induccionesRepository.obtenerRegistroPorIdInduccion(induccionId);

    if (!registro || !registro.id) {
      return NextResponse.json(
        { success: false, message: "Inducción no encontrada" },
        { status: 404 }
      );
    }

    if (registro.idEmpleadoCore !== idEmpleadoCore) {
      return NextResponse.json(
        { success: false, message: "El empleado no coincide con la inducción" },
        { status: 403 }
      );
    }

    const actualizado = await induccionesRepository.actualizarRegistro(registro.id, {
      puntajeEvaluacion,
      estadoEvaluacion,
    });

    return NextResponse.json({
      success: true,
      message: "Resultado de evaluación guardado",
      data: actualizado,
    });
  } catch (error: any) {
    console.error("[Inducción Eval][POST] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
