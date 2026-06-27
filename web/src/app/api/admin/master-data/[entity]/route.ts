import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getMasterDataEntity } from "@/lib/admin/master-data";
import {
  buildMasterDataMetadata,
  createMasterDataRow,
  getMasterDataRelationOptions,
  listMasterDataRows,
} from "@/lib/admin/master-data-service";

async function guardAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return null;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo procesar la solicitud";
  const status = message.includes("obligatorio") || message.includes("inválido") || message.includes("formato") ? 400 : 500;
  if (message.includes("Unique constraint") || message.includes("UNIQUE constraint")) {
    return NextResponse.json({ error: "Ya existe un registro con esos datos" }, { status: 409 });
  }
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const deny = await guardAdmin();
  if (deny) return deny;

  const { entity: entityKey } = await params;
  const entity = getMasterDataEntity(entityKey);
  if (!entity) return NextResponse.json({ error: "Entidad inválida" }, { status: 404 });

  const relationOptions = await getMasterDataRelationOptions(entity);
  const rows = await listMasterDataRows(entity);

  return NextResponse.json({ metadata: buildMasterDataMetadata(entity, relationOptions), rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const deny = await guardAdmin();
  if (deny) return deny;

  const { entity: entityKey } = await params;
  const entity = getMasterDataEntity(entityKey);
  if (!entity) return NextResponse.json({ error: "Entidad inválida" }, { status: 404 });

  try {
    const body = await req.json();
    const row = await createMasterDataRow(entity, body?.values ?? {});
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
