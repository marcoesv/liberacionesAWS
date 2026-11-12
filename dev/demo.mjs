/**
 * demo.mjs — arma una versión de demostración de la página en dev/demo/:
 * un solo index.html con estilos y scripts incrustados, que responde /api/*
 * dentro del navegador con los datos de ejemplo, sin servidor.
 *
 * El index.html sale sin <html>, <head> ni <body>: es el contenido de la
 * página, listo para publicarse en un servicio que pone ese envoltorio.
 *
 *   node dev/demo.mjs
 */

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { crearApi } from "./api.mjs";
import * as datos from "./datos.mjs";

const FRONTEND = fileURLToPath(new URL("../frontend/", import.meta.url));
const SALIDA = fileURLToPath(new URL("./demo/", import.meta.url));
const IMAGENES = ["logo.png", "favicon.png", "impulsora-store.jpg"];

const leer = (nombre) => readFile(FRONTEND + nombre, "utf8");
const enScript = (codigo) => codigo.replace(/<\/script/gi, "<\\/script");

const usuario = Object.values(datos.USUARIOS)[0];
const orden = Object.values(datos.ORDENES)[0];

// Reemplaza fetch para las rutas /api/* y marca la página como demostración.
function simulacion(responder, demo) {
  const fetchReal = window.fetch.bind(window);
  window.fetch = async (ruta, opciones = {}) => {
    const url = new URL(ruta, location.href);
    const inicio = url.pathname.indexOf("/api/");
    if (inicio < 0) return fetchReal(ruta, opciones);

    let cuerpo = {};
    try { cuerpo = (opciones.body && JSON.parse(opciones.body)) || {}; } catch { /* cuerpo vacío */ }
    const token = (opciones.headers || {})["X-Session-Token"];
    const [estado, respuesta] = responder(`${opciones.method || "GET"} ${url.pathname.slice(inicio)}`, cuerpo, token);
    await new Promise((listo) => setTimeout(listo, 350));
    return new Response(JSON.stringify(respuesta), { status: estado, headers: { "content-type": "application/json" } });
  };

  const nota = (texto) => {
    const el = document.createElement("div");
    el.className = "demo-nota";
    el.textContent = texto;
    return el;
  };
  document.querySelector(".acceso-titulo").after(
    nota(`Demostración con datos de ejemplo. Código de acceso: ${demo.codigo}.`),
  );
  document.querySelector(".barra").after(
    nota(`Demostración · datos de ejemplo · orden de prueba ${demo.orden}`),
  );
  document.getElementById("usuario").value = demo.usuario;
  document.getElementById("correo").value = demo.correo;
}

const html = await leer("index.html");
const cuerpo = /<body>([\s\S]*)<\/body>/.exec(html)[1].replace(/<script src="[^"]+"><\/script>\s*/g, "");

const pagina = `<title>Liberaciones Impulsora Demo</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>
${await leer("styles.css")}
.demo-nota { padding: 7px 14px; background: var(--etiqueta); border-bottom: 1px solid var(--linea); font-size: 12px; font-weight: 500; color: var(--tenue); }
.acceso-panel .demo-nota { margin: -6px 0 16px; border: 1px solid var(--linea); padding: 8px 10px; }
</style>
${cuerpo.trim()}
<script>
(${enScript(simulacion.toString())})(
  (${enScript(crearApi.toString())})(${enScript(JSON.stringify({ ...datos }))}),
  ${enScript(JSON.stringify({ usuario: usuario.usuario, correo: usuario.correo, codigo: datos.CODIGO_VALIDO, orden: orden.numero }))}
);
</script>
<script>
${enScript(await leer("api.js"))}
</script>
<script>
${enScript(await leer("app.js"))}
</script>
`;

await mkdir(SALIDA, { recursive: true });
await writeFile(SALIDA + "index.html", pagina);
await Promise.all(IMAGENES.map((nombre) => copyFile(FRONTEND + nombre, SALIDA + nombre)));
console.log(`Demostración en ${SALIDA}`);
