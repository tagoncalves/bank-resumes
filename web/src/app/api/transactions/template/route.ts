import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  const rows = [
    {
      fecha: "14/06/2026",
      descripcion: "Supermercado Coto",
      importeArs: 45990.5,
      importeUsd: "",
      categoria: "Supermercado",
      tipoMovimiento: "gasto",
      esCuotas: "no",
      cuotaActual: "",
      cuotasTotales: "",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      "fecha",
      "descripcion",
      "importeArs",
      "importeUsd",
      "categoria",
      "tipoMovimiento",
      "esCuotas",
      "cuotaActual",
      "cuotasTotales",
    ],
  });

  const helpRows = [
    ["Campo", "Requerido", "Descripción", "Ejemplo"],
    ["fecha", "sí", "Fecha en formato dd/mm/aaaa", "14/06/2026"],
    ["descripcion", "sí", "Descripción o comercio", "Supermercado Coto"],
    ["importeArs", "sí", "Importe en ARS", "45990,50"],
    ["importeUsd", "no", "Importe en USD", ""],
    ["categoria", "no", "Nombre exacto de una categoría existente", "Supermercado"],
    ["tipoMovimiento", "sí", "gasto o ingreso", "gasto"],
    ["esCuotas", "no", "si o no", "no"],
    ["cuotaActual", "no", "Cuota actual si aplica", "3"],
    ["cuotasTotales", "no", "Cantidad total de cuotas si aplica", "6"],
  ];

  const helpSheet = XLSX.utils.aoa_to_sheet(helpRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "movimientos");
  XLSX.utils.book_append_sheet(workbook, helpSheet, "instrucciones");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-movimientos.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
