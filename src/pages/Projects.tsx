import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageShell } from "@/components/ideas";
import { TopBar } from "@/components/layout";
import { Button, EmptyState, SectionLabel } from "@/components/ui";
import { relativeTime } from "@/lib/time";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";

export function ProjectsPage() {
  const projects = useWorkspace((s) => s.projects);
  const createProject = useWorkspace((s) => s.createProject);
  const toast = useUI((s) => s.toast);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;
    setSaving(true);
    try {
      const project = await createProject({
        name: trimmedName,
        description: description.trim() || undefined,
      });
      toast("项目已创建", "quiet");
      navigate(`/projects/${project.id}`);
    } catch {
      toast("创建失败，请重试");
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar
        title="项目"
        meta={`${projects.length} 个`}
        leading={undefined}
      />
      <PageShell className="mubu-projects">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <SectionLabel>作品</SectionLabel>
            <h2 className="mubu-page-title">把零散，汇聚成作品。</h2>
            <p className="mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-muted">
              项目是想法最终汇聚的地方。文章、产品、一本书，都是从这里长出来的。
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreating((value) => !value)}
          >
            <Plus size={13} strokeWidth={1.5} /> {creating ? "收起" : "新建项目"}
          </Button>
        </div>

        {creating ? (
          <form onSubmit={(event) => void submit(event)} className="mb-7 rounded-lg border border-line bg-[var(--bg-card)] p-4 sm:p-5">
            <p className="text-[13px] font-medium text-fg">从一个作品开始整理</p>
            <label className="mt-4 block text-[12px] text-muted" htmlFor="new-project-name">项目名称</label>
            <input
              id="new-project-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="例如：第一期视频"
              className="mt-1.5 w-full rounded-md border border-line bg-[var(--bg-raised)] px-3 py-2 text-[14px] text-fg placeholder:text-faint focus:border-accent-line focus:outline-none"
            />
            <label className="mt-3 block text-[12px] text-muted" htmlFor="new-project-description">想做成什么（可选）</label>
            <textarea
              id="new-project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="写下这个项目的目标，之后还可以修改"
              className="mt-1.5 w-full resize-y rounded-md border border-line bg-[var(--bg-raised)] px-3 py-2 text-[14px] leading-relaxed text-fg placeholder:text-faint focus:border-accent-line focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>取消</Button>
              <Button type="submit" size="sm" variant="accent" disabled={!name.trim() || saving}>
                {saving ? "创建中…" : "创建项目"}
              </Button>
            </div>
          </form>
        ) : null}

        {projects.length === 0 ? (
          <EmptyState
            title="每一个项目，都从一个念头开始。"
            body="先记下想法。等它们开始互相靠近，再回来建项目。"
            action={
              <Button
                variant="accent"
                onClick={() => setCreating(true)}
              >
                创建项目
              </Button>
            }
          />
        ) : (
          <ul className="mubu-project-grid">
            {projects.map((p, index) => (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}`}
                  className="mubu-project-card group quiet-hover"
                >
                  <span className="mubu-eyebrow">项目 / {String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="editorial text-[18px] text-fg">{p.name}</p>
                    {p.description ? (
                      <p className="mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
                        {p.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right text-[12px] tabular-nums text-faint">
                    <p>{p.ideaIds.length} 条想法</p>
                    <p className="mt-0.5">{relativeTime(p.updatedAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageShell>
    </>
  );
}
