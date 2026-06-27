import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { listMasterDataEntities } from "@/lib/admin/master-data-service";

async function guardAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const deny = await guardAdmin();
  if (deny) return deny;

  const entities = await listMasterDataEntities();
  return NextResponse.json({ entities });
}
