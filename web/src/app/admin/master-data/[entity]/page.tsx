import { MasterDataEntityPage } from "@/components/admin/master-data/master-data-entity-page";

export default async function AdminMasterDataEntityRoute({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  return <MasterDataEntityPage entityKey={entity} />;
}
