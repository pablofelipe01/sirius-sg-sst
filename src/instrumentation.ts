// Next.js ejecuta register() una vez al arrancar cada servidor y lo espera
// antes de atender peticiones.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { leerSecretosAws } = await import("@/infrastructure/config/secretosAws");
  // El secreto manda: el runtime de Vercel define sus propias AWS_* y S3
  // necesita las de la cuenta de la empresa.
  Object.assign(process.env, await leerSecretosAws());
}
