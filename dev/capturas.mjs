/**
 * capturas.mjs — recorre la página en tamaño iPhone contra el servidor local
 * y guarda una captura de cada pantalla en dev/capturas/.
 *
 *   node dev/capturas.mjs
 */

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium, devices } = createRequire(import.meta.url)("playwright");

const SALIDA = fileURLToPath(new URL("./capturas/", import.meta.url));
const SERVIDOR = fileURLToPath(new URL("./servidor.mjs", import.meta.url));

function levantarServidor() {
  return new Promise((resolve, reject) => {
    const proceso = spawn(process.execPath, [SERVIDOR, "0"], { stdio: ["ignore", "pipe", "inherit"] });
    proceso.stdout.once("data", (linea) => resolve({ proceso, url: String(linea).trim() }));
    proceso.once("error", reject);
  });
}

function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(`Falló: ${mensaje}`);
  console.log(`ok  ${mensaje}`);
}

const { proceso, url } = await levantarServidor();
const navegador = await chromium.launch();
let n = 0;

try {
  await mkdir(SALIDA, { recursive: true });
  const contexto = await navegador.newContext({ ...devices["iPhone 14"], permissions: ["clipboard-read", "clipboard-write"] });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(e.message));

  // En las capturas completas la ventana crece al alto de la página, para que
  // la barra fija de acciones quede al final y no encima del contenido.
  const captura = async (nombre, completa = false) => {
    await pagina.waitForTimeout(250);
    const archivo = `${String(++n).padStart(2, "0")}-${nombre}.png`;
    const ventana = pagina.viewportSize();
    if (completa) {
      const alto = await pagina.evaluate(() => document.documentElement.scrollHeight);
      await pagina.setViewportSize({ width: ventana.width, height: Math.max(alto, ventana.height) });
    }
    await pagina.screenshot({ path: SALIDA + archivo });
    if (completa) await pagina.setViewportSize(ventana);
  };

  await pagina.goto(url, { waitUntil: "networkidle" });
  await captura("acceso");

  await pagina.fill("#usuario", "msalinas");
  await pagina.fill("#correo", "otro@impulsora.com");
  await pagina.click("#btnEntrar");
  await pagina.waitForSelector("#errorUsuario:not([hidden])");
  await captura("acceso-error");

  await pagina.fill("#correo", "msalinas@impulsora.com");
  await pagina.click("#btnEntrar");
  await pagina.waitForSelector("#pasoCodigo:not([hidden])");
  await captura("codigo");

  await pagina.click("#btnConfigurar");
  await pagina.waitForSelector("#notaCodigo:not([hidden])");
  await pagina.locator("#codigo").pressSequentially("123");
  await captura("codigo-configurar");

  await pagina.fill("#codigo", "000000");
  await pagina.click("#btnVerificar");
  await pagina.waitForSelector("#errorCodigo:not([hidden])");
  comprobar(await pagina.isHidden("#vistaApp"), "un código incorrecto no abre la sesión");

  await pagina.evaluate(() => navigator.clipboard.writeText("hola"));
  await pagina.click("#btnPegar");
  await pagina.waitForSelector("#errorCodigo:not([hidden])");
  comprobar((await pagina.inputValue("#codigo")) === "", "Pegar ignora un texto que no trae código");

  await pagina.evaluate(() => navigator.clipboard.writeText("Tu código es 123 456"));
  await pagina.click("#btnPegar");
  const pegado = await pagina
    .waitForFunction(() => document.getElementById("codigo").value === "123456", null, { timeout: 3000 })
    .then(() => true, () => false);
  comprobar(pegado, "Pegar toma el código de lo copiado");
  await captura("codigo-pegado");
  await pagina.click("#btnVerificar");
  await pagina.waitForSelector("#vistaApp:not([hidden])");
  await captura("busqueda");

  await pagina.fill("#numDoc", "999");
  await pagina.click("#btnBuscar");
  await pagina.waitForSelector("#errorBusqueda:not([hidden])");
  comprobar(await pagina.isHidden("#acciones"), "una orden que no existe no muestra Liberar ni Rechazar");
  await captura("no-encontrada");

  await pagina.fill("#numDoc", "5024098");
  await pagina.click("#btnBuscar");
  await pagina.waitForSelector("#orden:not([hidden])");
  comprobar((await pagina.textContent("#utilidad")) === "30.96%", "la utilidad se muestra con dos decimales");
  comprobar((await pagina.locator(".partida").count()) === 6, "se listan los 6 artículos");
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  comprobar(ancho <= 0, "la orden no se desborda a lo ancho");
  await captura("orden");
  await captura("orden-completa", true);

  await pagina.locator(".partida").nth(0).click();
  await pagina.locator(".partida").nth(3).click();
  comprobar(await pagina.isVisible('[data-detalle="0"]'), "al tocar un artículo se abre su detalle");
  await pagina.locator(".partida").nth(0).scrollIntoViewIfNeeded();
  await pagina.evaluate(() => window.scrollBy(0, 330));
  await captura("articulo-abierto");
  await captura("articulos-abiertos-completa", true);

  await pagina.click("#btnLiberar");
  await captura("confirmar-liberar");
  await pagina.click("#hojaLiberar [data-cerrar]");
  comprobar(await pagina.isHidden("#velo"), "Cancelar cierra la confirmación sin liberar");
  comprobar(await pagina.isVisible("#orden"), "tras cancelar la orden sigue en pantalla");

  await pagina.click("#btnRechazar");
  comprobar(await pagina.isDisabled("#btnConfirmarRechazar"), "no se puede rechazar sin observación");
  await captura("confirmar-rechazar");
  await pagina.fill("#observacion", "El precio del QO120 queda por debajo del máximo autorizado. Favor de ajustar y volver a enviar.");
  await captura("confirmar-rechazar-observacion");
  await pagina.click("#btnConfirmarRechazar");
  await pagina.waitForSelector("#resultado:not([hidden])");
  comprobar((await pagina.textContent("#resultadoFicha")).includes("QO120"), "el rechazo muestra la observación");
  await captura("resultado-rechazada");

  await pagina.click("#btnOtra");
  await pagina.fill("#numDoc", "5024098");
  await pagina.click("#btnBuscar");
  await pagina.waitForSelector("#orden:not([hidden])");
  await pagina.click("#btnLiberar");
  await pagina.click("#btnConfirmarLiberar");
  await pagina.waitForSelector("#resultado:not([hidden])");
  await captura("resultado-liberada");

  await pagina.reload({ waitUntil: "networkidle" });
  comprobar(await pagina.isVisible("#vistaApp"), "la sesión sigue abierta al recargar");
  await pagina.click("#btnSalir");
  comprobar(await pagina.isVisible("#vistaAcceso"), "Salir regresa al acceso");

  comprobar(errores.length === 0, `sin errores de JavaScript ${errores.join(" | ")}`);
  console.log(`${n} capturas en ${SALIDA}`);
} finally {
  await navegador.close();
  proceso.kill();
}
