// Corre antes de `next build`: el build evalúa los módulos para recolectar
// datos de las páginas y en ese momento instrumentation.ts aún no ha corrido.
// Escribe las variables del secreto en .env.production.local, que Next.js lee
// al compilar. Sin ENV_SECRET_IDS (en local) no hace nada.
import fs from "fs";
import path from "path";
import { leerSecretosAws } from "../src/infrastructure/config/secretosAws";

async function main() {
  const valores = await leerSecretosAws();
  const total = Object.keys(valores).length;
  if (total === 0) return;

  // Comillas simples: dotenv las toma literales. Ningún valor las contiene.
  const contenido = Object.entries(valores)
    .map(([k, v]) => `${k}='${v}'`)
    .join("\n");
  fs.writeFileSync(path.join(process.cwd(), ".env.production.local"), contenido + "\n");
  console.log(`✅ ${total} variables cargadas desde AWS Secrets Manager`);
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});
