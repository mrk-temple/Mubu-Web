import { motion } from "framer-motion";
import { BrandMark } from "./Brand";
import { Button } from "@/components/ui";
import { useUI } from "@/stores/useUI";

/**
 * 首次进入。没有步骤条、没有引导气泡 ——
 * 只有几句话，和一个「开始记录」。
 */
export function Welcome() {
  const seen = useUI((s) => s.welcomeSeen);
  const dismiss = useUI((s) => s.dismissWelcome);
  const openCapture = useUI((s) => s.openQuickCapture);

  if (seen) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-bg px-6">
      <motion.div
        initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
        className="max-w-[34rem]"
      >
        <BrandMark className="mb-7 text-accent" />
        <h1 className="editorial text-[30px] leading-[1.3] text-fg">
          欢迎来到幕布。
        </h1>
        <div className="mt-6 space-y-3 text-[15px] leading-[1.85] text-muted">
          <p>这里没有文件夹需要整理，</p>
          <p>也没有复杂的知识体系需要学习。</p>
          <p className="text-fg">只需要记录。</p>
          <p>剩下的关系，会慢慢出现。</p>
        </div>
        <div className="mt-9 flex items-center gap-4">
          <Button
            variant="accent"
            size="md"
            onClick={() => {
              dismiss();
              window.setTimeout(() => openCapture(), 220);
            }}
          >
            开始记录 →
          </Button>
          <button
            type="button"
            onClick={dismiss}
            className="text-[13px] text-faint quiet-hover rounded-md px-2 py-1"
          >
            先随便看看
          </button>
        </div>
        <p className="mt-10 text-[12px] tracking-[0.03em] text-faint">
          让想法彼此相遇。
        </p>
      </motion.div>
    </div>
  );
}
