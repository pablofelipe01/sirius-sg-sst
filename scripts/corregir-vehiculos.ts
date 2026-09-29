#!/usr/bin/env tsx
/**
 * Corrige el módulo vehicular contra la tabla de referencia.
 *
 * Por defecto simula. Para escribir de verdad:
 *   npm run corregir:vehiculos -- --aplicar
 *
 * Fases, en orden (cada una depende de la anterior):
 *   1. Reparar las 3 opciones de select corruptas del esquema
 *   2. Borrar vehículos espurios y sus documentos
 *   3. Borrar documentos y licencias duplicados
 *   4. Corregir campos de los vehículos existentes
 *   5. Crear los vehículos faltantes con sus documentos
 *   6. Corregir fechas de documentos y crear los que falten
 *   7. Crear las licencias faltantes
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { REFERENCIA } from './datos-vehiculos-referencia';

const APLICAR = process.argv.includes('--aplicar');
const API = 'https://api.airtable.com/v0';
const META = `${API}/meta/bases`;

const TOKEN = process.env.AIRTABLE_SGSST_API_TOKEN!;
const BASE = process.env.AIRTABLE_SGSST_BASE_ID!;
const T_VEH = process.env.AIRTABLE_VEH_VEHICULOS_TABLE_ID!;
const T_DOC = process.env.AIRTABLE_VEH_DOCUMENTOS_TABLE_ID!;
const T_LIC = process.env.AIRTABLE_VEH_LICENCIAS_TABLE_ID!;

// Field IDs (convención del proyecto: nunca nombres en escrituras)
const FV = {
  ID_PERSONAL: process.env.AIRTABLE_VEH_VEH_ID_PERSONAL_CORE!,
  PLACA: process.env.AIRTABLE_VEH_VEH_PLACA!,
  TIPO: process.env.AIRTABLE_VEH_VEH_TIPO_VEHICULO!,
  PROP_NOMBRE: process.env.AIRTABLE_VEH_VEH_PROPIETARIO_NOMBRE!,
  PROP_TIPO: process.env.AIRTABLE_VEH_VEH_PROPIETARIO_TIPO!,
  PROP_DOC: process.env.AIRTABLE_VEH_VEH_PROPIETARIO_DOCUMENTO!,
  ACTIVO: process.env.AIRTABLE_VEH_VEH_ACTIVO!,
  OBSERVACIONES: process.env.AIRTABLE_VEH_VEH_OBSERVACIONES!,
  CREATED_AT: process.env.AIRTABLE_VEH_VEH_CREATED_AT!,
  UPDATED_AT: process.env.AIRTABLE_VEH_VEH_UPDATED_AT!,
};
const FD = {
  VEHICULO: process.env.AIRTABLE_VEH_DOC_VEHICULO_LINK!,
  TIPO: process.env.AIRTABLE_VEH_DOC_TIPO_DOCUMENTO!,
  VENCE: process.env.AIRTABLE_VEH_DOC_FECHA_VENCIMIENTO!,
  CREATED_AT: process.env.AIRTABLE_VEH_DOC_CREATED_AT!,
};
const FL = {
  ID_PERSONAL: process.env.AIRTABLE_VEH_LIC_ID_PERSONAL_CORE!,
  VENCE: process.env.AIRTABLE_VEH_LIC_FECHA_VENCIMIENTO!,
  CREATED_AT: process.env.AIRTABLE_VEH_LIC_CREATED_AT!,
};

const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const ahora = () => new Date().toISOString();
const eq = (a: unknown, b: unknown) =>
  String(a ?? '').normalize('NFC').trim() === String(b ?? '').normalize('NFC').trim();

let escrituras = 0;
const fallos: string[] = [];

function log(fase: string, accion: string) {
  console.log(`  ${APLICAR ? '✓' : '·'} ${accion}`);
}

async function registros(tableId: string) {
  const out: any[] = [];
  let offset: string | undefined;
  do {
    const p = new URLSearchParams({ pageSize: '100' });
    if (offset) p.set('offset', offset);
    const res = await fetch(`${API}/${BASE}/${tableId}?${p}`, { headers });
    if (!res.ok) throw new Error(`Leyendo ${tableId}: ${res.status} ${await res.text()}`);
    const d = await res.json();
    out.push(...d.records);
    offset = d.offset;
  } while (offset);
  return out;
}

const trozos = <T,>(arr: T[], n = 10): T[][] =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function escribir(metodo: 'POST' | 'PATCH', tableId: string, records: any[], etiqueta: string) {
  if (!records.length) return;
  if (!APLICAR) { escrituras += records.length; return; }
  for (const lote of trozos(records)) {
    const res = await fetch(`${API}/${BASE}/${tableId}`, {
      method: metodo,
      headers,
      body: JSON.stringify({ records: lote, typecast: false }),
    });
    if (!res.ok) { fallos.push(`${etiqueta}: ${res.status} ${await res.text()}`); continue; }
    escrituras += lote.length;
  }
}

async function borrar(tableId: string, ids: string[], etiqueta: string) {
  if (!ids.length) return;
  if (!APLICAR) { escrituras += ids.length; return; }
  for (const lote of trozos(ids)) {
    const p = new URLSearchParams();
    lote.forEach((id) => p.append('records[]', id));
    const res = await fetch(`${API}/${BASE}/${tableId}?${p}`, { method: 'DELETE', headers });
    if (!res.ok) { fallos.push(`${etiqueta}: ${res.status} ${await res.text()}`); continue; }
    escrituras += lote.length;
  }
}

// ── Opciones de select ────────────────────────────────────────
// Tres opciones del módulo vehicular quedaron grabadas con U+FFFD en lugar de
// la vocal acentuada ("Autom?vil", "Cami?n", "Tecnomec?nica"). La API de
// Airtable no permite renombrar las opciones de un singleSelect, así que
// escribir el nombre canónico haría que Airtable lo tomara por una opción
// nueva y rechazara el registro. En su lugar se resuelve contra el nombre que
// la base tenga en ese momento: el script funciona igual antes y después de
// que alguien corrija los nombres a mano en la interfaz.
const esqueleto = (s: string) =>
  s.toLowerCase().normalize('NFC').replace(/[áéíóúñü�]/g, '?');

const opcionesPorCampo = new Map<string, Map<string, string>>();

async function cargarOpciones() {
  console.log('\n═══ FASE 1 · Resolver opciones del esquema ═══\n');
  const { tables } = await (await fetch(`${META}/${BASE}/tables`, { headers })).json();
  let corruptas = 0;

  for (const tableId of [T_VEH, T_DOC]) {
    const tabla = tables.find((t: any) => t.id === tableId);
    for (const campo of tabla.fields) {
      const choices = campo.options?.choices;
      if (!choices?.length) continue;
      const mapa = new Map<string, string>();
      for (const c of choices) {
        mapa.set(esqueleto(c.name), c.name);
        if (/�/.test(c.name)) {
          corruptas++;
          console.log(`  ! ${tabla.name}.${campo.name}: la base guarda "${c.name}"`);
        }
      }
      opcionesPorCampo.set(campo.id, mapa);
    }
  }
  if (!corruptas) console.log('  todas las opciones están bien escritas');
  else console.log(`\n  Se escribirán con el nombre que la base tiene hoy (${corruptas} opción/es).`);
}

/** Nombre vivo de la opción equivalente a `canonico`, o `canonico` si no existe. */
const opcion = (campoId: string, canonico: string) =>
  opcionesPorCampo.get(campoId)?.get(esqueleto(canonico)) ?? canonico;

/** Compara tipos ignorando la corrupción de tildes. */
const eqTipo = (a: unknown, b: unknown) =>
  esqueleto(String(a ?? '').trim()) === esqueleto(String(b ?? '').trim());

// ── Resto de fases ────────────────────────────────────────────
async function main() {
  console.log(APLICAR ? '*** MODO ESCRITURA ***' : '*** SIMULACIÓN (usa --aplicar para escribir) ***');

  await cargarOpciones();

  const vehiculos = await registros(T_VEH);
  const documentos = await registros(T_DOC);
  const licencias = await registros(T_LIC);

  const refPorPlaca = new Map(REFERENCIA.map((r) => [r.placa, r]));
  const porPlaca = new Map<string, any>();
  for (const v of vehiculos) porPlaca.set(String(v.fields['Placa'] ?? '').toUpperCase(), v);

  const docsPorVehiculo = new Map<string, any[]>();
  for (const d of documentos) {
    const link = (d.fields['Vehiculo'] ?? [])[0];
    if (!link) continue;
    if (!docsPorVehiculo.has(link)) docsPorVehiculo.set(link, []);
    docsPorVehiculo.get(link)!.push(d);
  }

  // FASE 2 — vehículos espurios
  console.log('\n═══ FASE 2 · Borrar vehículos espurios ═══\n');
  const espurios = vehiculos.filter((v) => !refPorPlaca.has(String(v.fields['Placa'] ?? '').toUpperCase()));
  const docsDeEspurios = espurios.flatMap((v) => (docsPorVehiculo.get(v.id) ?? []).map((d) => d.id));
  espurios.forEach((v) => log('2', `vehículo "${v.fields['Placa']}" (${v.id})`));
  if (docsDeEspurios.length) log('2', `${docsDeEspurios.length} documento(s) colgando de ellos`);
  if (!espurios.length) console.log('  (ninguno)');
  await borrar(T_DOC, docsDeEspurios, 'docs de espurios');
  await borrar(T_VEH, espurios.map((v) => v.id), 'vehículos espurios');

  // FASE 3 — duplicados
  console.log('\n═══ FASE 3 · Borrar duplicados ═══\n');
  const docsBorrar: string[] = [];
  for (const r of REFERENCIA) {
    const v = porPlaca.get(r.placa);
    if (!v) continue;
    for (const tipo of ['SOAT', 'Tecnomecánica']) {
      const delTipo = (docsPorVehiculo.get(v.id) ?? []).filter((d) => eqTipo(d.fields['Tipo_Documento'], tipo));
      delTipo.slice(1).forEach((d) => docsBorrar.push(d.id));
    }
  }
  const licPorPersona = new Map<string, any[]>();
  for (const l of licencias) {
    const k = String(l.fields['ID_Personal_Core'] ?? '');
    if (!licPorPersona.has(k)) licPorPersona.set(k, []);
    licPorPersona.get(k)!.push(l);
  }
  const licBorrar = [...licPorPersona.values()].flatMap((ls) => ls.slice(1).map((l) => l.id));
  log('3', `${docsBorrar.length} documento(s) duplicado(s)`);
  log('3', `${licBorrar.length} licencia(s) duplicada(s)`);
  await borrar(T_DOC, docsBorrar, 'docs duplicados');
  await borrar(T_LIC, licBorrar, 'licencias duplicadas');

  // FASE 4 — corregir vehículos existentes
  console.log('\n═══ FASE 4 · Corregir campos de vehículos ═══\n');
  const updVeh: any[] = [];
  for (const r of REFERENCIA) {
    const v = porPlaca.get(r.placa);
    if (!v) continue;
    const f = v.fields;
    const fields: Record<string, unknown> = {};
    if (!eqTipo(f['Tipo_Vehiculo'], r.tipo)) fields[FV.TIPO] = opcion(FV.TIPO, r.tipo);
    if (!eq(f['Propietario_Nombre'], r.propietarioNombre)) fields[FV.PROP_NOMBRE] = r.propietarioNombre;
    if (!eq(f['Propietario_Documento'], r.propietarioDocumento)) fields[FV.PROP_DOC] = r.propietarioDocumento;
    if (!eq(f['Propietario_Tipo'], r.propietarioTipo)) fields[FV.PROP_TIPO] = r.propietarioTipo;
    if (!eq(f['ID_Personal_Core'], r.idPersonal)) fields[FV.ID_PERSONAL] = r.idPersonal;
    if (!Object.keys(fields).length) continue;
    fields[FV.UPDATED_AT] = ahora();
    updVeh.push({ id: v.id, fields });
    log('4', `${r.placa}: ${Object.keys(fields).length - 1} campo(s)`);
  }
  if (!updVeh.length) console.log('  (nada que corregir)');
  await escribir('PATCH', T_VEH, updVeh, 'corregir vehículos');

  // FASE 5 — crear vehículos faltantes
  console.log('\n═══ FASE 5 · Crear vehículos faltantes ═══\n');
  const faltantes = REFERENCIA.filter((r) => !porPlaca.has(r.placa));
  const nuevos = faltantes.map((r) => ({
    fields: {
      [FV.ID_PERSONAL]: r.idPersonal,
      [FV.PLACA]: r.placa,
      [FV.TIPO]: opcion(FV.TIPO, r.tipo),
      [FV.PROP_NOMBRE]: r.propietarioNombre,
      [FV.PROP_TIPO]: r.propietarioTipo,
      [FV.PROP_DOC]: r.propietarioDocumento,
      [FV.ACTIVO]: true,
      [FV.OBSERVACIONES]: 'Cargado desde el control de transporte',
      [FV.CREATED_AT]: ahora(),
      [FV.UPDATED_AT]: ahora(),
    },
  }));
  faltantes.forEach((r) => log('5', `${r.placa} (${r.tipo}) → ${r.colaborador}`));
  if (!faltantes.length) console.log('  (ninguno)');

  const idsNuevos = new Map<string, string>();
  if (APLICAR && nuevos.length) {
    for (const lote of trozos(nuevos)) {
      const res = await fetch(`${API}/${BASE}/${T_VEH}`, {
        method: 'POST', headers, body: JSON.stringify({ records: lote, typecast: false }),
      });
      if (!res.ok) { fallos.push(`crear vehículos: ${res.status} ${await res.text()}`); continue; }
      const d = await res.json();
      d.records.forEach((rec: any) => idsNuevos.set(rec.fields[FV.PLACA] ?? rec.fields['Placa'], rec.id));
      escrituras += lote.length;
    }
  } else escrituras += nuevos.length;

  // FASE 6 — documentos
  console.log('\n═══ FASE 6 · Documentos (fechas y faltantes) ═══\n');
  const updDocs: any[] = [];
  const nuevosDocs: any[] = [];
  const borrados = new Set([...docsBorrar, ...docsDeEspurios]);

  for (const r of REFERENCIA) {
    const vehId = porPlaca.get(r.placa)?.id ?? idsNuevos.get(r.placa);
    if (!vehId) { if (APLICAR) fallos.push(`sin id de vehículo para ${r.placa}`); continue; }
    const propios = (docsPorVehiculo.get(vehId) ?? []).filter((d) => !borrados.has(d.id));

    for (const [tipo, esperada] of [['SOAT', r.soat], ['Tecnomecánica', r.tecno]] as const) {
      if (!esperada) continue;
      const existente = propios.find((d) => eqTipo(d.fields['Tipo_Documento'], tipo));
      if (!existente) {
        nuevosDocs.push({
          fields: {
            [FD.VEHICULO]: [vehId],
            [FD.TIPO]: opcion(FD.TIPO, tipo),
            [FD.VENCE]: esperada,
            [FD.CREATED_AT]: ahora(),
          },
        });
        log('6', `crear ${r.placa} · ${tipo} · ${esperada}`);
      } else if (!eq(existente.fields['Fecha_Vencimiento'], esperada)) {
        updDocs.push({ id: existente.id, fields: { [FD.VENCE]: esperada } });
        log('6', `corregir ${r.placa} · ${tipo}: ${existente.fields['Fecha_Vencimiento']} → ${esperada}`);
      }
    }
  }
  if (!updDocs.length && !nuevosDocs.length) console.log('  (nada que hacer)');
  await escribir('PATCH', T_DOC, updDocs, 'corregir documentos');
  await escribir('POST', T_DOC, nuevosDocs, 'crear documentos');

  // FASE 7 — licencias
  console.log('\n═══ FASE 7 · Licencias ═══\n');
  const licVigentes = new Map<string, any>();
  for (const [k, ls] of licPorPersona) licVigentes.set(k, ls[0]);

  const updLic: any[] = [];
  const nuevasLic: any[] = [];
  const vistos = new Set<string>();
  for (const r of REFERENCIA) {
    if (!r.licencia || vistos.has(r.idPersonal)) continue;
    vistos.add(r.idPersonal);
    const actual = licVigentes.get(r.idPersonal);
    if (!actual) {
      nuevasLic.push({
        fields: { [FL.ID_PERSONAL]: r.idPersonal, [FL.VENCE]: r.licencia, [FL.CREATED_AT]: ahora() },
      });
      log('7', `crear licencia ${r.idPersonal} (${r.colaborador}) → ${r.licencia}  ⚠ sin categoría`);
    } else if (!eq(actual.fields['Fecha_Vencimiento'], r.licencia)) {
      updLic.push({ id: actual.id, fields: { [FL.VENCE]: r.licencia } });
      log('7', `corregir ${r.idPersonal}: ${actual.fields['Fecha_Vencimiento']} → ${r.licencia}`);
    }
  }
  if (!updLic.length && !nuevasLic.length) console.log('  (nada que hacer)');
  await escribir('PATCH', T_LIC, updLic, 'corregir licencias');
  await escribir('POST', T_LIC, nuevasLic, 'crear licencias');

  // Resumen
  console.log('\n═══════════════════════════════════════════');
  console.log(`${APLICAR ? 'Escrituras realizadas' : 'Escrituras que se harían'}: ${escrituras}`);
  if (fallos.length) {
    console.log(`\n❌ Fallos (${fallos.length}):`);
    fallos.forEach((f) => console.log(`   ${f}`));
    process.exitCode = 1;
  } else if (APLICAR) {
    console.log('Sin fallos. Corre `npx tsx scripts/diff-vehiculos.ts` para verificar.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
