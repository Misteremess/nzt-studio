// app/(private)/delivery-workspace/page.tsx
// Delivery Workspace — post-sale tracking of the MVPs NZT Studio decides to
// build and ship. Status lifecycle, checklist, repo/deploy links and notes.

import { getDeliveryBoard } from "@/features/delivery-workspace/lib/store";
import { DeliveryWorkspaceView } from "@/features/delivery-workspace/components/delivery-workspace-view";

export default async function DeliveryWorkspacePage() {
  const data = await getDeliveryBoard();

  return (
    <div className="mx-auto h-full w-full max-w-7xl">
      <DeliveryWorkspaceView initialData={data} />
    </div>
  );
}
