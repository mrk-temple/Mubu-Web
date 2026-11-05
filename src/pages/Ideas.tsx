import { IdeaBrowser } from "@/components/ideas";
import { PageShell } from "@/components/ideas";
import { TopBar } from "@/components/layout";
import { useWorkspace } from "@/stores/useWorkspace";

export function IdeasPage() {
  const count = useWorkspace((s) => s.ideas.length);
  return (
    <>
      <TopBar title="所有灵感" meta={`${count} 条`} />
      <PageShell>
        <IdeaBrowser />
      </PageShell>
    </>
  );
}
