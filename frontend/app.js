const $ = (id) => document.getElementById(id);

const numero2 = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cantidad = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const porcentaje = (n) => `${numero2.format(n)}%`;

function esc(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// "2026-11-12" → "12/11/2026"
function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
}

function fechaHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX", {
    timeZone: "America/Monterrey",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function mostrar(el, texto) {
  el.textContent = texto;
  el.hidden = false;
}

function ocupado(boton, texto) {
  boton.dataset.texto = boton.dataset.texto || boton.textContent;
  boton.disabled = true;
  boton.textContent = texto;
}

function libre(boton) {
  boton.disabled = false;
  if (boton.dataset.texto) boton.textContent = boton.dataset.texto;
}

// ── Acceso ───────────────────────────────────────────────────────────────────

let tokenPendiente = "";
let usuarioPendiente = null;

function abrirAcceso() {
  $("vistaApp").hidden = true;
  $("vistaAcceso").hidden = false;
  cerrarHojas();
  irAPasoUsuario();
}

function irAPasoUsuario() {
  tokenPendiente = "";
  $("pasoCodigo").hidden = true;
  $("pasoUsuario").hidden = false;
  $("errorUsuario").hidden = true;
}

function irAPasoCodigo() {
  $("pasoUsuario").hidden = true;
  $("pasoCodigo").hidden = false;
  $("errorCodigo").hidden = true;
  $("notaCodigo").hidden = true;
  $("codigo").value = "";
  pintarCodigo();
  $("codigo").focus();
}

function pintarCodigo() {
  const valor = $("codigo").value;
  const enfocado = document.activeElement === $("codigo");
  document.querySelectorAll(".codigo-celdas span").forEach((celda, i) => {
    celda.textContent = valor[i] || "";
    celda.classList.toggle("activa", enfocado && i === Math.min(valor.length, 5));
  });
}

$("pasoUsuario").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("errorUsuario").hidden = true;
  const usuario = $("usuario").value.trim();
  const correo = $("correo").value.trim();
  if (!usuario || !correo) return mostrar($("errorUsuario"), "Escribe tu usuario y tu correo.");

  ocupado($("btnEntrar"), "Validando…");
  const { data } = await api.validarUsuario(usuario, correo);
  libre($("btnEntrar"));

  if (!data.mfaRequired) return mostrar($("errorUsuario"), data.error || "No se pudo validar el usuario.");
  tokenPendiente = data.pendingToken;
  usuarioPendiente = data.user;
  irAPasoCodigo();
});

$("codigo").addEventListener("input", () => {
  $("codigo").value = $("codigo").value.replace(/\D/g, "").slice(0, 6);
  pintarCodigo();
});

// Código de 6 dígitos dentro de un texto copiado ("123456" o "123 456"), o "".
function codigoEn(texto) {
  const m = /(?:^|\D)(\d{3})\s?(\d{3})(?!\d)/.exec(String(texto || ""));
  return m ? m[1] + m[2] : "";
}

function ponerCodigo(texto) {
  const codigo = codigoEn(texto);
  if (!codigo) return mostrar($("errorCodigo"), "Lo que copiaste no es un código de 6 dígitos.");
  $("errorCodigo").hidden = true;
  $("codigo").value = codigo;
  pintarCodigo();
}

$("codigo").addEventListener("paste", (e) => {
  e.preventDefault();
  ponerCodigo(e.clipboardData ? e.clipboardData.getData("text") : "");
});

$("btnPegar").addEventListener("click", async () => {
  $("errorCodigo").hidden = true;
  let copiado;
  try {
    copiado = await navigator.clipboard.readText();
  } catch {
    return mostrar($("errorCodigo"), "No se pudo leer lo copiado. Mantén presionados los recuadros y elige Pegar.");
  }
  ponerCodigo(copiado);
});
$("codigo").addEventListener("focus", pintarCodigo);
$("codigo").addEventListener("blur", pintarCodigo);

$("pasoCodigo").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("errorCodigo").hidden = true;
  const code = $("codigo").value;
  if (code.length !== 6) return mostrar($("errorCodigo"), "Escribe los 6 dígitos que muestra la app.");

  ocupado($("btnVerificar"), "Verificando…");
  const { data } = await api.verificarCodigo(tokenPendiente, code);
  libre($("btnVerificar"));

  if (data.valid) {
    sesion.guardar(data.token, data.user);
    return abrirApp();
  }
  if (data.pendingExpired) {
    irAPasoUsuario();
    return mostrar($("errorUsuario"), data.error || "Vuelve a entrar.");
  }
  $("codigo").value = "";
  pintarCodigo();
  mostrar($("errorCodigo"), data.error || "Código incorrecto.");
});

$("btnVolver").addEventListener("click", irAPasoUsuario);

$("btnConfigurar").addEventListener("click", async () => {
  $("errorCodigo").hidden = true;
  $("notaCodigo").hidden = true;
  $("btnConfigurar").disabled = true;
  const { data } = await api.configurarCodigo(tokenPendiente);
  $("btnConfigurar").disabled = false;

  if (data.sent) {
    return mostrar($("notaCodigo"), `Enviamos las instrucciones a ${data.sentTo}. Abre el correo en este celular y sigue los pasos.`);
  }
  if (data.pendingExpired) {
    irAPasoUsuario();
    return mostrar($("errorUsuario"), data.error || "Vuelve a entrar.");
  }
  mostrar($("errorCodigo"), data.error || "No se pudo enviar el correo.");
});

function alExpirarSesion() {
  sesion.cerrar();
  abrirAcceso();
  mostrar($("errorUsuario"), "Tu sesión terminó. Vuelve a entrar.");
}

// ── Búsqueda ─────────────────────────────────────────────────────────────────

let ordenActual = null;

function abrirApp() {
  const usuario = sesion.usuario();
  $("usuarioActivo").textContent = usuario ? usuario.usuario : "";
  $("vistaAcceso").hidden = true;
  $("vistaApp").hidden = false;
  reiniciarBusqueda();
}

function reiniciarBusqueda() {
  ordenActual = null;
  $("orden").hidden = true;
  $("resultado").hidden = true;
  $("acciones").hidden = true;
  $("errorBusqueda").hidden = true;
  $("busqueda").hidden = false;
  $("busqueda").classList.remove("compacta");
  $("numDoc").value = "";
}

function referencia(orden) {
  return [orden.tipo, orden.numero].filter(Boolean).join(" ");
}

$("numDoc").addEventListener("input", () => {
  $("numDoc").value = $("numDoc").value.replace(/\D/g, "").slice(0, 10);
});

$("formBusqueda").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("errorBusqueda").hidden = true;
  const tipo = $("tipoDoc").value;
  const numero = $("numDoc").value.trim();
  if (!numero) return mostrar($("errorBusqueda"), "Escribe el número de documento.");

  $("numDoc").blur();
  ocupado($("btnBuscar"), "Buscando…");
  const { ok, data } = await api.buscarOrden(tipo, numero);
  libre($("btnBuscar"));

  if (!ok || !data.encontrada) {
    $("orden").hidden = true;
    $("acciones").hidden = true;
    ordenActual = null;
    const ref = [tipo, numero].filter(Boolean).join(" ");
    return mostrar($("errorBusqueda"), data.error || `No se encontró la orden ${ref}.`);
  }
  pintarOrden(data.orden);
});

// ── Orden ────────────────────────────────────────────────────────────────────

function fila(etiqueta, valorHtml) {
  return `<tr><th>${esc(etiqueta)}</th><td>${valorHtml}</td></tr>`;
}

function texto(valor) {
  const v = String(valor ?? "").trim();
  return v ? esc(v) : `<span class="vacio">—</span>`;
}

// Código y descripción a la izquierda, valor numérico a la derecha.
function claveDescripcion(clave, descripcion, valor) {
  return `<span class="par"><span>${esc(clave)} <span class="desc">${esc(descripcion)}</span></span><span>${esc(valor)}</span></span>`;
}

function pintarOrden(orden) {
  ordenActual = orden;
  $("docNumero").textContent = referencia(orden);

  $("encabezado").innerHTML = [
    fila("Cliente", `${esc(orden.cliente.numero)}<span class="sub">${esc(orden.cliente.nombre)}</span>`),
    fila("Tipo de cliente", texto(orden.cliente.tipo)),
    fila("Condiciones cliente", claveDescripcion(orden.condiciones.codigo, orden.condiciones.descripcion, orden.condiciones.valor)),
    fila("Descuento encabezado", claveDescripcion(orden.descuento.codigo, orden.descuento.descripcion, orden.descuento.valor)),
    fila("Sucursal venta", texto(orden.sucursal)),
    fila("Zona cliente", texto(orden.zona)),
    fila("** IN **", texto(orden.in)),
    fila("Fecha orden", texto(fechaCorta(orden.fecha))),
    fila("Originador", texto(orden.originador)),
    fila("OC cliente", texto(orden.ocCliente)),
  ].join("");

  $("utilidad").textContent = porcentaje(orden.utilidad);

  const n = orden.partidas.length;
  $("numPartidas").textContent = `· ${n} ${n === 1 ? "artículo" : "artículos"}`;
  $("partidas").innerHTML = orden.partidas.map(filaPartida).join("");

  $("busqueda").classList.add("compacta");
  $("resultado").hidden = true;
  $("orden").hidden = false;
  $("acciones").hidden = false;
  window.scrollTo(0, 0);
}

function filaPartida(p, i) {
  const clase = p.diferencia < 0 ? "dif-neg" : "dif-pos";
  const promos = (p.promociones || []).length
    ? p.promociones.map((pr) => `<span class="promo">${esc(pr.descripcion)}<small>${esc(pr.vigencia)}</small></span>`).join("")
    : `<span class="vacio">Sin promociones</span>`;

  return `
    <tr class="partida" data-i="${i}" tabindex="0" role="button" aria-expanded="false">
      <td>
        <span class="art"><span class="flecha"></span>
          <span><span class="sku">${esc(p.sku)}</span><span class="unidad">${esc(p.um)} · ${esc(p.moneda)}</span></span>
        </span>
      </td>
      <td class="num">${cantidad.format(p.cantidad)}</td>
      <td class="num">${numero2.format(p.puMax)}</td>
      <td class="num">${numero2.format(p.puOrden)}</td>
      <td class="num dif ${clase}">${porcentaje(p.diferencia)}</td>
    </tr>
    <tr class="partida-detalle" data-detalle="${i}" hidden>
      <td colspan="5">
        <dl>
          <div class="renglon bloque"><dt>Descripción</dt><dd>${texto(p.descripcion)}</dd></div>
          <div class="renglon"><dt>Costo 42</dt><dd>${numero2.format(p.costo42)} ${esc(p.moneda)}</dd></div>
          <div class="renglon bloque"><dt>Promociones</dt><dd>${promos}</dd></div>
        </dl>
      </td>
    </tr>`;
}

function alternarPartida(filaEl) {
  const detalle = document.querySelector(`[data-detalle="${filaEl.dataset.i}"]`);
  const abrir = detalle.hidden;
  detalle.hidden = !abrir;
  filaEl.classList.toggle("abierta", abrir);
  filaEl.setAttribute("aria-expanded", String(abrir));
}

$("partidas").addEventListener("click", (e) => {
  const filaEl = e.target.closest(".partida");
  if (filaEl) alternarPartida(filaEl);
});
$("partidas").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const filaEl = e.target.closest(".partida");
  if (filaEl) { e.preventDefault(); alternarPartida(filaEl); }
});

// ── Liberar / rechazar ───────────────────────────────────────────────────────

function abrirHoja(id) {
  $("velo").hidden = false;
  $("hojaLiberar").hidden = id !== "hojaLiberar";
  $("hojaRechazar").hidden = id !== "hojaRechazar";
  document.body.style.overflow = "hidden";
}

function cerrarHojas() {
  $("velo").hidden = true;
  document.body.style.overflow = "";
}

$("velo").addEventListener("click", (e) => {
  if (e.target === $("velo") || e.target.closest("[data-cerrar]")) cerrarHojas();
});

$("btnLiberar").addEventListener("click", () => {
  const ref = referencia(ordenActual);
  $("tituloLiberar").textContent = `¿Liberar la orden ${ref}?`;
  $("textoLiberar").textContent = `¿Estás seguro? Se avisará por correo al originador (${ordenActual.originador}).`;
  $("resumenLiberar").innerHTML =
    fila("Cliente", `${esc(ordenActual.cliente.numero)}<span class="sub">${esc(ordenActual.cliente.nombre)}</span>`) +
    `<tr><th>Utilidad</th><td class="celda-utilidad">${esc(porcentaje(ordenActual.utilidad))}</td></tr>`;
  $("errorLiberar").hidden = true;
  abrirHoja("hojaLiberar");
});

$("btnRechazar").addEventListener("click", () => {
  const ref = referencia(ordenActual);
  $("tituloRechazar").textContent = `¿Rechazar la orden ${ref}?`;
  $("textoRechazar").textContent = `¿Estás seguro? Se avisará por correo al originador (${ordenActual.originador}).`;
  $("observacion").value = "";
  $("cuentaObservacion").textContent = "0";
  $("btnConfirmarRechazar").disabled = true;
  $("errorRechazar").hidden = true;
  abrirHoja("hojaRechazar");
});

$("observacion").addEventListener("input", () => {
  const valor = $("observacion").value;
  $("cuentaObservacion").textContent = String(valor.length);
  $("btnConfirmarRechazar").disabled = valor.trim().length === 0;
});

$("btnConfirmarLiberar").addEventListener("click", async () => {
  $("errorLiberar").hidden = true;
  ocupado($("btnConfirmarLiberar"), "Liberando…");
  const { ok, data } = await api.liberar(ordenActual.tipo, ordenActual.numero);
  libre($("btnConfirmarLiberar"));
  if (!ok || !data.ok) return mostrar($("errorLiberar"), data.error || "No se pudo liberar la orden.");
  pintarResultado("liberada", data);
});

$("btnConfirmarRechazar").addEventListener("click", async () => {
  $("errorRechazar").hidden = true;
  const observacion = $("observacion").value.trim();
  ocupado($("btnConfirmarRechazar"), "Rechazando…");
  const { ok, data } = await api.rechazar(ordenActual.tipo, ordenActual.numero, observacion);
  libre($("btnConfirmarRechazar"));
  if (!ok || !data.ok) return mostrar($("errorRechazar"), data.error || "No se pudo rechazar la orden.");
  pintarResultado("rechazada", { ...data, observacion });
});

// ── Resultado ────────────────────────────────────────────────────────────────

function pintarResultado(estado, data) {
  const orden = ordenActual;
  const ref = referencia(orden);
  const correo = data.correo || {};

  $("resultadoEstado").className = `resultado-estado ${estado}`;
  $("resultadoEstado").innerHTML =
    `${estado === "liberada" ? "Orden liberada" : "Orden rechazada"}<small>${esc(ref)}</small>`;

  const filas = [
    fila("Cliente", `${esc(orden.cliente.numero)}<span class="sub">${esc(orden.cliente.nombre)}</span>`),
    fila(estado === "liberada" ? "Liberó" : "Rechazó", texto(data.usuario)),
    fila("Fecha y hora", texto(fechaHora(data.fecha))),
  ];
  if (estado === "rechazada") filas.push(fila("Observación", `<span class="sub">${esc(data.observacion)}</span>`));
  filas.push(
    correo.enviado
      ? fila("Correo enviado a", `${texto(correo.para)}<span class="sub">Copia: ${texto(correo.copia)}</span>`)
      : fila("Correo", `<span class="sub">No se pudo enviar el aviso por correo.</span>`),
  );
  $("resultadoFicha").innerHTML = filas.join("");

  cerrarHojas();
  $("orden").hidden = true;
  $("acciones").hidden = true;
  $("busqueda").hidden = true;
  $("resultado").hidden = false;
  window.scrollTo(0, 0);
}

$("btnOtra").addEventListener("click", () => {
  reiniciarBusqueda();
  $("numDoc").focus();
});

$("btnSalir").addEventListener("click", () => {
  sesion.cerrar();
  abrirAcceso();
});

// ── Arranque ─────────────────────────────────────────────────────────────────

(async function iniciar() {
  if (!sesion.token()) return abrirAcceso();
  const { data } = await api.revisarSesion();
  if (data.valid) abrirApp();
  else if (!data.sessionExpired) { sesion.cerrar(); abrirAcceso(); }
})();
