import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getMasterDataEntity } from "@/lib/admin/master-data";
import { deleteMasterDataRow, updateMasterDataRow } from "@/lib/admin/master-data-service";

async function guardAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return null;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo procesar la solicitud";
  const status = message.startsWith("No se puede eliminar") ? 400 : 500;
  if (message.includes("obligatorio") || message.includes("inválido") || message.includes("formato")) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (message.includes("Unique constraint") || message.includes("UNIQUE constraint")) {
    return NextResponse.json({ error: "Ya existe un registro con esos datos" }, { status: 409 });
  }
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const deny = await guardAdmin();
  if (deny) return deny;

  const { entity: entityKey, id } = await params;
  const entity = getMasterDataEntity(entityKey);
  if (!entity) return NextResponse.json({ error: "Entidad inválida" }, { status: 404 });

  try {
    const body = await req.json();
    await updateMasterDataRow(entity, id, body?.values ?? {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const deny = await guardAdmin();
  if (deny) return deny;

  const { entity: entityKey, id } = await params;
  const entity = getMasterDataEntity(entityKey);
  if (!entity) return NextResponse.json({ error: "Entidad inválida" }, { status: 404 });

  try {
    await deleteMasterDataRow(entity, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
