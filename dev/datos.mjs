/**
 * datos.mjs — datos de ejemplo para dev/api.mjs.
 */

function partida(sku, cantidad, puMax, puOrden, um, descripcion, costo42, promociones = []) {
  return {
    sku, cantidad, puMax, puOrden, moneda: "MXP", um, descripcion, costo42, promociones,
    diferencia: ((puOrden - puMax) / puMax) * 100,
  };
}

export const USUARIOS = {
  MSALINAS: { usuario: "MSALINAS", nombre: "Marco Salinas", rol: "ADMIN", correo: "msalinas@impulsora.com" },
};

export const CODIGO_VALIDO = "123456";

// Dirección que recibe copia de cada aviso.
export const COPIA = "laura@impulsora.com";

export const ORDENES = {
  "SQ 5024098": {
    tipo: "SQ",
    numero: 5024098,
    cliente: { numero: "222111", nombre: "CLIENTE CONTADO MOSTRADOR", tipo: "MOS" },
    condiciones: { codigo: "CDO", descripcion: "Contado", valor: 0 },
    descuento: { codigo: "CDO", descripcion: "Contado", valor: 0 },
    sucursal: "1080",
    zona: "999",
    in: "NO",
    fecha: "2026-11-12",
    originador: "SMUGRABI",
    originadorCorreo: "smugrabi@impulsora.com",
    ocCliente: "",
    utilidad: 30.96,
    partidas: [
      partida("QO120", 24, 158.93, 158.49, "PZ", "ACEITE MOTOR 20W50 MULTIGRADO 946 ML", 121.37, [
        { descripcion: "Promoción noviembre 3%", vigencia: "01/11/2026 al 30/11/2026" },
      ]),
      partida("QO340", 2, 1573.01, 2000.00, "PZ", "ACEITE MOTOR DIESEL 15W40 CUBETA 19 L", 1380.72),
      partida("FA2210", 12, 96.50, 96.50, "PZ", "FILTRO DE ACEITE SELLADO LINEA LIGERA", 71.20),
      partida("BA4475", 4, 2315.00, 2190.00, "PZ", "BATERIA 12 V 550 CCA GRUPO 47", 1842.66, [
        { descripcion: "Volumen 4+ piezas 5%", vigencia: "15/10/2026 al 31/12/2026" },
        { descripcion: "Bonificación proveedor 2%", vigencia: "01/11/2026 al 30/11/2026" },
      ]),
      partida("LI0815", 1200, 12.40, 13.10, "LT", "ANTICONGELANTE CONCENTRADO VERDE A GRANEL", 9.85),
      partida("BU9003", 36, 48.75, 47.90, "PZ", "BUJIA DE IRIDIO ROSCA 14 MM", 33.10),
    ],
  },
};
