/**
 * servidor.mjs — servidor local para revisar la página sin desplegar.
 * Sirve frontend/ y responde /api/* con los datos de ejemplo (dev/api.mjs, dev/datos.mjs).
 *
 *   node dev/servidor.mjs [puerto]     (por defecto 8080)
 */

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { crearApi } from "./api.mjs";
import * as datos from "./datos.mjs";

const RAIZ = fileURLToPath(new URL("../frontend/", import.meta.url));
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

const responder = crearApi(datos);

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname.startsWith("/api/")) {
    let texto = "";
    for await (const parte of req) texto += parte;
    let cuerpo = {};
    try { cuerpo = (texto && JSON.parse(texto)) || {}; } catch { /* cuerpo vacío */ }
    const [estado, respuesta] = responder(`${req.method} ${url.pathname}`, cuerpo, req.headers["x-session-token"]);
    res.writeHead(estado, { "content-type": "application/json" });
    return res.end(JSON.stringify(respuesta));
  }

  const relativa = normalize(url.pathname === "/" ? "index.html" : url.pathname).replace(/^([/\\]|\.\.)+/, "");
  try {
    const contenido = await readFile(join(RAIZ, relativa));
    res.writeHead(200, { "content-type": TIPOS[extname(relativa)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(contenido);
  } catch {
    res.writeHead(404);
    res.end("No encontrado");
  }
});

const puerto = Number(process.argv[2] ?? process.env.PORT ?? 8080);
servidor.listen(puerto, () => {
  console.log(`http://localhost:${servidor.address().port}`);
});
