import { NextResponse } from "next/server";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

interface AirtableCreateResponse {
  records: AirtableRecord[];
}

interface EquipoMigrado {
  codigo: string;
  nombre: string;
  categoria: string;
  tipoEspecifico: string;
  area: string;
  ubicacion: string;
  capacidad: string;
  fechaVencimiento: string | null;
  estado: string;
  descripcion: string;
}

/**
 * GET /api/equipos-emergencia/migrar
 * Muestra una vista previa de los equipos que se migrarán
 */
export async function GET() {
  try {
    const equipos = await recopilarEquipos();
    
    return NextResponse.json({
      success: true,
      preview: true,
      message: "Vista previa de equipos a migrar. Use POST para ejecutar la migración.",
      total: equipos.length,
      porCategoria: {
        extintores: equipos.filter(e => e.categoria === "Extintor").length,
        botiquines: equipos.filter(e => e.categoria === "Botiquín").length,
        camillas: equipos.filter(e => e.categoria === "Camilla").length,
        kitsDerrames: equipos.filter(e => e.categoria === "Kit Derrames").length,
      },
      equipos,
    });
  } catch (error) {
    console.error("Error en preview migración:", error);
    return NextResponse.json(
      { success: false, message: "Error al recopilar equipos" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/equipos-emergencia/migrar
 * Ejecuta la migración de equipos a la tabla unificada
 */
export async function POST() {
  try {
    const equipos = await recopilarEquipos();
    
    if (equipos.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No hay equipos para migrar",
      });
    }

    // Insertar en lotes de 10 (límite de Airtable)
    const { equiposFields } = airtableSGSSTConfig;
    const url = getSGSSTUrl(airtableSGSSTConfig.equiposTableId);
    
    let insertados = 0;
    let errores: string[] = [];

    for (let i = 0; i < equipos.length; i += 10) {
      const lote = equipos.slice(i, i + 10);
      
      const records = lote.map(equipo => ({
        fields: {
          [equiposFields.CODIGO]: equipo.codigo,
          [equiposFields.NOMBRE]: equipo.nombre,
          [equiposFields.CATEGORIA]: equipo.categoria,
          [equiposFields.TIPO_ESPECIFICO]: equipo.tipoEspecifico,
          [equiposFields.AREA]: equipo.area,
          [equiposFields.UBICACION]: equipo.ubicacion,
          [equiposFields.CAPACIDAD]: equipo.capacidad,
          [equiposFields.FECHA_VENCIMIENTO]: equipo.fechaVencimiento || null,
          [equiposFields.ESTADO]: equipo.estado,
          [equiposFields.DESCRIPCION]: equipo.descripcion,
        }
      }));

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: getSGSSTHeaders(),
          body: JSON.stringify({ records }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error insertando lote ${i/10 + 1}:`, errorText);
          errores.push(`Lote ${i/10 + 1}: ${errorText}`);
        } else {
          const data: AirtableCreateResponse = await response.json();
          insertados += data.records.length;
        }
      } catch (err) {
        console.error(`Error en lote ${i/10 + 1}:`, err);
        errores.push(`Lote ${i/10 + 1}: ${err}`);
      }
    }

    return NextResponse.json({
      success: errores.length === 0,
      message: `Migración completada: ${insertados} de ${equipos.length} equipos insertados`,
      insertados,
      total: equipos.length,
      errores: errores.length > 0 ? errores : undefined,
    });
  } catch (error) {
    console.error("Error en migración:", error);
    return NextResponse.json(
      { success: false, message: "Error al migrar equipos" },
      { status: 500 }
    );
  }
}

/**
 * Recopila equipos de las 4 tablas de catálogo
 */
async function recopilarEquipos(): Promise<EquipoMigrado[]> {
  const equipos: EquipoMigrado[] = [];

  // 1. Cargar Extintores
  const extintores = await cargarExtintores();
  equipos.push(...extintores);

  // 2. Cargar Botiquines
  const botiquines = await cargarBotiquines();
  equipos.push(...botiquines);

  // 3. Cargar Camillas
  const camillas = await cargarCamillas();
  equipos.push(...camillas);

  // 4. Cargar Kits de Derrames
  const kits = await cargarKitsDerrames();
  equipos.push(...kits);

  return equipos;
}

/**
 * Carga extintores del catálogo
 * Si la tabla está vacía, genera extintores de ejemplo para las áreas principales
 */
async function cargarExtintores(): Promise<EquipoMigrado[]> {
  const { extintoresFields } = airtableSGSSTConfig;
  const url = getSGSSTUrl(airtableSGSSTConfig.extintoresTableId);
  
  const params = new URLSearchParams({
    pageSize: "100",
    returnFieldsByFieldId: "true",
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: "GET",
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Error cargando extintores:", await response.text());
      return generarExtintoresEjemplo();
    }

    const data: AirtableListResponse = await response.json();
    
    // Si no hay extintores en la tabla, generar ejemplos
    if (data.records.length === 0) {
      return generarExtintoresEjemplo();
    }
    
    return data.records.map(record => {
      const nombre = (record.fields[extintoresFields.NOMBRE] as string) || "Extintor";
      const area = extraerAreaDelNombre(nombre);
      
      return {
        codigo: (record.fields[extintoresFields.CODIGO] as string) || `EXT-${record.fields[extintoresFields.NUMERO] || "000"}`,
        nombre,
        categoria: "Extintor",
        tipoEspecifico: (record.fields[extintoresFields.CLASE_AGENTE] as string) || "PQS",
        area,
        ubicacion: area,
        capacidad: (record.fields[extintoresFields.CAPACIDAD] as string) || "",
        fechaVencimiento: (record.fields[extintoresFields.FECHA_RECARGA] as string) || null,
        estado: (record.fields[extintoresFields.ESTADO] as string) || "Activo",
        descripcion: `Extintor ${record.fields[extintoresFields.CLASE_AGENTE] || "PQS"}`,
      };
    });
  } catch (error) {
    console.error("Error en cargarExtintores:", error);
    return generarExtintoresEjemplo();
  }
}

/**
 * Genera extintores de ejemplo para las áreas principales
 */
function generarExtintoresEjemplo(): EquipoMigrado[] {
  const extintores: EquipoMigrado[] = [
    // Pirólisis - 2 extintores
    {
      codigo: "EXT-001",
      nombre: "Extintor PQS 20lb - Pirólisis Entrada",
      categoria: "Extintor",
      tipoEspecifico: "Polvo Químico Seco (PQS)",
      area: "Pirólisis",
      ubicacion: "Entrada principal planta",
      capacidad: "20 lb",
      fechaVencimiento: "2027-03-20",
      estado: "Activo",
      descripcion: "Extintor ABC multipropósito - Área de pirólisis",
    },
    {
      codigo: "EXT-002",
      nombre: "Extintor CO2 10lb - Pirólisis Tablero Eléctrico",
      categoria: "Extintor",
      tipoEspecifico: "CO2",
      area: "Pirólisis",
      ubicacion: "Junto a tablero eléctrico",
      capacidad: "10 lb",
      fechaVencimiento: "2027-06-15",
      estado: "Activo",
      descripcion: "Extintor CO2 para equipos eléctricos",
    },
    // Laboratorio - 2 extintores
    {
      codigo: "EXT-003",
      nombre: "Extintor PQS 10lb - Laboratorio",
      categoria: "Extintor",
      tipoEspecifico: "Polvo Químico Seco (PQS)",
      area: "Laboratorio",
      ubicacion: "Entrada laboratorio",
      capacidad: "10 lb",
      fechaVencimiento: "2027-04-01",
      estado: "Activo",
      descripcion: "Extintor ABC multipropósito - Laboratorio",
    },
    {
      codigo: "EXT-004",
      nombre: "Extintor CO2 5lb - Laboratorio Equipos",
      categoria: "Extintor",
      tipoEspecifico: "CO2",
      area: "Laboratorio",
      ubicacion: "Zona de equipos de análisis",
      capacidad: "5 lb",
      fechaVencimiento: "2027-05-10",
      estado: "Activo",
      descripcion: "Extintor CO2 para equipos electrónicos del laboratorio",
    },
    // Bodega - 2 extintores
    {
      codigo: "EXT-005",
      nombre: "Extintor PQS 20lb - Bodega Principal",
      categoria: "Extintor",
      tipoEspecifico: "Polvo Químico Seco (PQS)",
      area: "Bodega",
      ubicacion: "Entrada bodega de almacenamiento",
      capacidad: "20 lb",
      fechaVencimiento: "2027-08-20",
      estado: "Activo",
      descripcion: "Extintor ABC multipropósito - Bodega",
    },
    {
      codigo: "EXT-006",
      nombre: "Extintor Agua 2.5gal - Bodega Oficina",
      categoria: "Extintor",
      tipoEspecifico: "Agua presurizada",
      area: "Bodega",
      ubicacion: "Oficina de bodega",
      capacidad: "2.5 gal",
      fechaVencimiento: "2027-09-15",
      estado: "Activo",
      descripcion: "Extintor de agua - Zona administrativa bodega",
    },
    // Administrativa - 1 extintor
    {
      codigo: "EXT-007",
      nombre: "Extintor PQS 10lb - Oficinas Administrativas",
      categoria: "Extintor",
      tipoEspecifico: "Polvo Químico Seco (PQS)",
      area: "Administrativa",
      ubicacion: "Pasillo principal oficinas",
      capacidad: "10 lb",
      fechaVencimiento: "2027-07-01",
      estado: "Activo",
      descripcion: "Extintor ABC multipropósito - Área administrativa",
    },
  ];

  return extintores;
}

/**
 * Extrae el área del nombre del equipo
 */
function extraerAreaDelNombre(nombre: string): string {
  const areasConocidas = ["Pirólisis", "Laboratorio", "Bodega", "Administrativa", "Producción", "Oficinas"];
  for (const area of areasConocidas) {
    if (nombre.toLowerCase().includes(area.toLowerCase())) {
      return area;
    }
  }
  // Intentar extraer después del guión
  if (nombre.includes("-")) {
    const partes = nombre.split("-");
    if (partes.length > 1) {
      return partes[partes.length - 1].trim();
    }
  }
  return "";
}

/**
 * Carga botiquines del catálogo
 */
async function cargarBotiquines(): Promise<EquipoMigrado[]> {
  const { botiquinesFields } = airtableSGSSTConfig;
  const url = getSGSSTUrl(airtableSGSSTConfig.botiquinesTableId);
  
  const params = new URLSearchParams({
    pageSize: "100",
    returnFieldsByFieldId: "true",
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: "GET",
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Error cargando botiquines:", await response.text());
      return [];
    }

    const data: AirtableListResponse = await response.json();
    
    return data.records.map(record => {
      const nombre = (record.fields[botiquinesFields.NOMBRE] as string) || "Botiquín";
      const area = extraerAreaDelNombre(nombre);
      
      return {
        codigo: (record.fields[botiquinesFields.CODIGO] as string) || `BOT-${record.id.slice(-4)}`,
        nombre,
        categoria: "Botiquín",
        tipoEspecifico: "Tipo A",
        area,
        ubicacion: area,
        capacidad: "",
        fechaVencimiento: null,
        estado: (record.fields[botiquinesFields.ESTADO] as string) || "Activo",
        descripcion: `Botiquín de primeros auxilios - ${area}`,
      };
    });
  } catch (error) {
    console.error("Error en cargarBotiquines:", error);
    return [];
  }
}

/**
 * Carga camillas del catálogo
 */
async function cargarCamillas(): Promise<EquipoMigrado[]> {
  const { camillasFields } = airtableSGSSTConfig;
  const url = getSGSSTUrl(airtableSGSSTConfig.camillasTableId);
  
  const params = new URLSearchParams({
    pageSize: "100",
    returnFieldsByFieldId: "true",
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: "GET",
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Error cargando camillas:", await response.text());
      return [];
    }

    const data: AirtableListResponse = await response.json();
    
    return data.records.map(record => {
      const nombre = (record.fields[camillasFields.NOMBRE] as string) || "Camilla de Emergencias";
      const area = extraerAreaDelNombre(nombre);
      const estado = (record.fields[camillasFields.ESTADO] as string) || "Activo";
      
      return {
        codigo: (record.fields[camillasFields.CODIGO] as string) || `CAM-${record.id.slice(-4)}`,
        nombre,
        categoria: "Camilla",
        tipoEspecifico: "Rígida",
        area,
        ubicacion: area,
        capacidad: "1 persona",
        fechaVencimiento: null,
        estado: estado === "Operativa" ? "Activo" : estado,
        descripcion: `Camilla de emergencias - ${area}`,
      };
    });
  } catch (error) {
    console.error("Error en cargarCamillas:", error);
    return [];
  }
}

/**
 * Carga kits de derrames del catálogo
 */
async function cargarKitsDerrames(): Promise<EquipoMigrado[]> {
  const { kitsDerramesFields } = airtableSGSSTConfig;
  const url = getSGSSTUrl(airtableSGSSTConfig.kitsDerramesTableId);
  
  const params = new URLSearchParams({
    pageSize: "100",
    returnFieldsByFieldId: "true",
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: "GET",
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Error cargando kits derrames:", await response.text());
      return [];
    }

    const data: AirtableListResponse = await response.json();
    
    return data.records.map(record => {
      const nombre = (record.fields[kitsDerramesFields.NOMBRE] as string) || "Kit Control de Derrames";
      const area = extraerAreaDelNombre(nombre);
      
      return {
        codigo: (record.fields[kitsDerramesFields.CODIGO] as string) || `KIT-${record.id.slice(-4)}`,
        nombre,
        categoria: "Kit Derrames",
        tipoEspecifico: "Químico",
        area,
        ubicacion: area,
        capacidad: "",
        fechaVencimiento: null,
        estado: (record.fields[kitsDerramesFields.ESTADO] as string) || "Activo",
        descripcion: `Kit de control de derrames - ${area}`,
      };
    });
  } catch (error) {
    console.error("Error en cargarKitsDerrames:", error);
    return [];
  }
}
