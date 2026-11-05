import { GraphCanvas } from "@/components/graph";
import { TopBar } from "@/components/layout";
import { useWorkspace } from "@/stores/useWorkspace";

export function GraphPage() {
  const ideas = useWorkspace((s) => s.ideas);
  const connections = useWorkspace((s) => s.connections);

  return (
    <>
      <TopBar
        title="思维网络"
        meta={`${ideas.length} 条想法 · ${connections.length} 条连接`}
      />
      <GraphCanvas />
    </>
  );
}
