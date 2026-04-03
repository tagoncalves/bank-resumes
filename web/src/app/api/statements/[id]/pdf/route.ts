import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "statements");

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const filePath = path.join(UPLOADS_DIR, `${params.id}.pdf`);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "PDF no disponible" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="resumen-${params.id}.pdf"`,
    },
  });
}
