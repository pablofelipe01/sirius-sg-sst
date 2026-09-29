// Sube .env.local a AWS Secrets Manager, repartido en secretos de < 60 KB
// (el límite por secreto es 64 KB). Imprime lo que hay que poner en Vercel.
//
// Uso:
//   npm run subir:env-aws -- --dry-run          # solo muestra el reparto
//   npm run subir:env-aws -- [prefijo]          # sube (por defecto sirius-sgsst/prod)

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import {
  SecretsManagerClient,
  PutSecretValueCommand,
  CreateSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

const MAX_BYTES = 60_000;

// Se quedan en Vercel: NEXT_PUBLIC_* se incrusta en el build, y las demás
// son las que necesita instrumentation.ts para leer el secreto.
const QUEDAN_EN_VERCEL = (k: string) =>
  k.startsWith("NEXT_PUBLIC_") || k.startsWith("SST_SECRETS_") || k === "ENV_SECRET_IDS";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const prefijo = args.find((a) => !a.startsWith("--")) ?? "sirius-sgsst/prod";

const env = dotenv.parse(fs.readFileSync(path.join(process.cwd(), ".env.local")));

const lotes: Record<string, string>[] = [{}];
for (const [k, v] of Object.entries(env)) {
  if (QUEDAN_EN_VERCEL(k)) continue;
  const actual = lotes[lotes.length - 1];
  if (Buffer.byteLength(JSON.stringify({ ...actual, [k]: v })) > MAX_BYTES) {
    lotes.push({ [k]: v });
  } else {
    actual[k] = v;
  }
}

const nombres = lotes.map((_, i) => `${prefijo}-${i + 1}`);

for (const [i, lote] of lotes.entries()) {
  const bytes = Buffer.byteLength(JSON.stringify(lote));
  console.log(`${nombres[i]}: ${Object.keys(lote).length} variables, ${(bytes / 1024).toFixed(1)} KB`);
}

async function main() {
  if (!dryRun) {
    const client = new SecretsManagerClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });

    for (const [i, lote] of lotes.entries()) {
      const SecretString = JSON.stringify(lote);
      try {
        await client.send(new PutSecretValueCommand({ SecretId: nombres[i], SecretString }));
        console.log(`✅ Actualizado ${nombres[i]}`);
      } catch (error) {
        if (!(error instanceof ResourceNotFoundException)) throw error;
        await client.send(new CreateSecretCommand({ Name: nombres[i], SecretString }));
        console.log(`✅ Creado ${nombres[i]}`);
      }
    }
  }

  console.log("\nVariables para Vercel (Production):");
  console.log(`  ENV_SECRET_IDS=${nombres.join(",")}`);
  console.log(`  SST_SECRETS_REGION=${env.AWS_REGION}`);
  console.log("  SST_SECRETS_ACCESS_KEY_ID=<clave con permiso secretsmanager:GetSecretValue>");
  console.log("  SST_SECRETS_SECRET_ACCESS_KEY=<su secreto>");
  for (const k of Object.keys(env).filter((k) => k.startsWith("NEXT_PUBLIC_"))) {
    console.log(`  ${k}=${env[k]}`);
  }
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});
