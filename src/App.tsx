import { TooltipProvider } from "@/components/ui";
import { AppRoutes } from "@/pages";

export default function App() {
  return (
    <TooltipProvider delayDuration={260} skipDelayDuration={200}>
      <AppRoutes />
    </TooltipProvider>
  );
}
