import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { requireEnv } from "@/lib/env";

/** AES-256-GCM para segredos guardados no banco (tokens do Google). Formato: iv.tag.cifrado (base64url). */

function chave(): Buffer {
  const chave = Buffer.from(requireEnv("TOKEN_ENCRYPTION_KEY"), "base64");
  if (chave.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY deve ter 32 bytes em base64");
  }
  return chave;
}

export function criptografar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), cifrado].map((b) => b.toString("base64url")).join(".");
}

export function descriptografar(valor: string): string {
  const [iv, tag, cifrado] = valor.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString("utf8");
}
