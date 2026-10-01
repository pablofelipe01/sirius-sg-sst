require('dotenv').config({ path: '.env.local' });

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_INSUMOS_API_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_INSUMOS_BASE_ID;
const INSUMO_TABLE_ID = process.env.AIRTABLE_INSUMO_TABLE_ID;

async function getTableSchema() {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  
  const insumoTable = data.tables.find(t => t.id === INSUMO_TABLE_ID);
  
  if (!insumoTable) {
    console.log('Tabla Insumo no encontrada');
    return;
  }

  console.log('\n=== CAMPOS DE LA TABLA INSUMO ===\n');
  console.log(`Tabla: ${insumoTable.name} (${insumoTable.id})\n`);
  
  insumoTable.fields.forEach(field => {
    console.log(`${field.name}`);
    console.log(`  ID: ${field.id}`);
    console.log(`  Tipo: ${field.type}`);
    console.log('');
  });
}

getTableSchema().catch(console.error);
