/**
 * 力导向布局 —— Fruchterman–Reingold + 矩形碰撞 + 分量装箱
 *
 * 直接照搬「看起来差不多」的斥力/引力很容易得到一坨糊状物。
 * 这里拆成三件被反复验证过的事：
 *
 *  1. 力模型   —— Fruchterman & Reingold (1991) 的 k²/d · d²/k，配合降温退火。
 *                关键是所有边共用一个理想长度 k，节点间距才会均匀、不打结。
 *
 *  2. 碰撞约束 —— 借鉴 d3-force 的 forceCollide：不重叠是一等约束，不是事后补丁。
 *                节点是卡片不是圆点，所以用 AABB（含 padding）做分离，
 *                沿穿透量最小的轴推开，几个 pass 就能收敛到零重叠。
 *
 *  3. 分量装箱 —— 借鉴 cytoscape-fcose 的 component packing：每个连通分量
 *                独立求解后再整齐装箱。否则互不相关的簇会在画布上互相缠绕，
 *                读起来像噪声。
 *
 * 另外加了一道 barycenter 平滑（Sugiyama 里常用的启发式）：
 * 把节点往邻居的重心轻推，能明显压低连线交叉数。
 */

export interface LayoutNodeSpec {
  id: string;
  width: number;
  height: number;
}

export interface LayoutEdgeSpec {
  source: string;
  target: string;
}

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface ForceLayoutOptions {
  /** 同样的数据换一个 seed 会得到另一套同样整洁的排布 */
  seed?: number;
  iterations?: number;
  /** 边的理想长度；默认按节点尺寸推导 */
  idealLength?: number;
  /** 节点之间的最小留白 —— 同时也是紧缩的下限 */
  padding?: number;
  /** 分量之间的间距 */
  componentGap?: number;
  /** 装箱目标宽高比；给成画布比例，fitView 的缩放比最大 */
  aspect?: number;
  /** 求解后再向质心紧缩到「留白允许的最密」 */
  compact?: boolean;
  /** 分块依据：同一个 key 的节点一定排在一起（比如同一个主题） */
  clusterOf?: (id: string) => string;
  /** 块与块之间的留白，明显大于块内留白 */
  blockGap?: number;
}

interface SimNode {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  hw: number;
  hh: number;
  degree: number;
}

/** mulberry32：小、够用、可复现 */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function componentsOf(nodes: LayoutNodeSpec[], edges: LayoutEdgeSpec[]): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  for (const n of nodes) parent.set(n.id, n.id);
  for (const e of edges) {
    if (!parent.has(e.source) || !parent.has(e.target)) continue;
    const a = find(e.source);
    const b = find(e.target);
    if (a !== b) parent.set(a, b);
  }
  const groups = new Map<string, string[]>();
  for (const n of nodes) {
    const root = find(n.id);
    const bucket = groups.get(root);
    if (bucket) bucket.push(n.id);
    else groups.set(root, [n.id]);
  }
  // 大的分量排前面，装箱时更好看
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

/**
 * 按外部给的分块依据分组（例如「同一个主题」）。
 *
 * 连通分量是按「有没有连线」分的，同一个主题的想法未必互相连着，
 * 结果就会散在各处。要「一个主题在一起」，分块就必须按主题走。
 */
function clustersOf(
  nodes: LayoutNodeSpec[],
  clusterOf: (id: string) => string,
): string[][] {
  const groups = new Map<string, string[]>();
  for (const n of nodes) {
    const key = clusterOf(n.id) || "__none__";
    const bucket = groups.get(key);
    if (bucket) bucket.push(n.id);
    else groups.set(key, [n.id]);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

/**
 * 单个连通分量的力导向求解。
 * 返回相对自身 bbox 左上角的坐标。
 */
function solveComponent(
  ids: string[],
  spec: Map<string, LayoutNodeSpec>,
  edges: LayoutEdgeSpec[],
  rng: () => number,
  options: Required<Pick<ForceLayoutOptions, "iterations" | "idealLength" | "padding">> & { compact?: boolean },
): LayoutPoint[] {
  const n = ids.length;
  const index = new Map(ids.map((id, i) => [id, i]));
  const nodes: SimNode[] = ids.map((id) => {
    const s = spec.get(id)!;
    return {
      id,
      x: 0,
      y: 0,
      dx: 0,
      dy: 0,
      hw: s.width / 2,
      hh: s.height / 2,
      degree: 0,
    };
  });

  const links = edges
    .map((e) => ({ s: index.get(e.source), t: index.get(e.target) }))
    .filter((l): l is { s: number; t: number } => l.s !== undefined && l.t !== undefined && l.s !== l.t);
  for (const l of links) {
    nodes[l.s].degree += 1;
    nodes[l.t].degree += 1;
  }

  // 初始：圆周上均匀散开，带一点抖动打破对称，避免力平衡时卡在正多边形
  const k = options.idealLength;
  const radius = Math.max(k, (k * Math.sqrt(n)) / 1.6);
  nodes.forEach((node, i) => {
    const angle = (i / n) * Math.PI * 2 + rng() * 0.25;
    node.x = Math.cos(angle) * radius + (rng() - 0.5) * k * 0.3;
    node.y = Math.sin(angle) * radius + (rng() - 0.5) * k * 0.3;
  });

  const { iterations, padding } = options;

  for (let iter = 0; iter < iterations; iter++) {
    const t = k * 0.32 * (1 - iter / iterations); // 降温：前期允许大步长，后期微调

    for (const node of nodes) {
      node.dx = 0;
      node.dy = 0;
    }

    // 斥力 k²/d
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let vx = a.x - b.x;
        let vy = a.y - b.y;
        let d = Math.hypot(vx, vy);
        if (d < 0.01) {
          vx = (rng() - 0.5) * 0.1;
          vy = (rng() - 0.5) * 0.1;
          d = 0.01;
        }
        const f = (k * k) / d;
        const ux = vx / d;
        const uy = vy / d;
        a.dx += ux * f;
        a.dy += uy * f;
        b.dx -= ux * f;
        b.dy -= uy * f;
      }
    }

    // 引力 d²/k
    for (const l of links) {
      const a = nodes[l.s];
      const b = nodes[l.t];
      const vx = a.x - b.x;
      const vy = a.y - b.y;
      const d = Math.max(0.01, Math.hypot(vx, vy));
      const f = (d * d) / k;
      const ux = vx / d;
      const uy = vy / d;
      a.dx -= ux * f;
      a.dy -= uy * f;
      b.dx += ux * f;
      b.dy += uy * f;
    }

    // 向心力：度数越大拉得越紧，簇才不会散架（ForceAtlas2 的做法）
    let cx = 0;
    let cy = 0;
    for (const node of nodes) {
      cx += node.x;
      cy += node.y;
    }
    cx /= n;
    cy /= n;
    for (const node of nodes) {
      const gravity = 0.22 * (1 + node.degree * 0.25);
      node.dx += (cx - node.x) * gravity;
      node.dy += (cy - node.y) * gravity;
    }

    // barycenter 平滑：往邻居重心轻推，压低连线交叉
    if (iter > iterations * 0.35) {
      const acc = nodes.map(() => ({ x: 0, y: 0, c: 0 }));
      for (const l of links) {
        acc[l.s].x += nodes[l.t].x;
        acc[l.s].y += nodes[l.t].y;
        acc[l.s].c += 1;
        acc[l.t].x += nodes[l.s].x;
        acc[l.t].y += nodes[l.s].y;
        acc[l.t].c += 1;
      }
      nodes.forEach((node, i) => {
        if (acc[i].c === 0) return;
        const w = 0.14 * (iter / iterations);
        node.dx += (acc[i].x / acc[i].c - node.x) * w;
        node.dy += (acc[i].y / acc[i].c - node.y) * w;
      });
    }

    // 位移不超过当前温度
    for (const node of nodes) {
      const len = Math.hypot(node.dx, node.dy);
      const limit = Math.max(t, 0.01);
      const scale = len > limit ? limit / len : 1;
      node.x += node.dx * scale;
      node.y += node.dy * scale;
    }

    resolveOverlaps(nodes, padding, iter > iterations * 0.5 ? 3 : 1);
  }

  resolveOverlaps(nodes, padding, 8);
  if (options.compact !== false) compact(nodes, padding);
  // 块内先压一轮交叉：块内打结最难读，而且块间换位不影响块内结构
  reduceCrossings(nodes, links, padding, 14);

  // 归一到左上角 (0,0)
  let minX = Infinity;
  let minY = Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.hw);
    minY = Math.min(minY, node.y - node.hh);
  }
  return nodes.map((node) => ({ x: node.x - node.hw - minX, y: node.y - node.hh - minY }));
}

interface Link { s: number; t: number }

function cross(o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** 两条线段是否严格相交（共享端点不算 —— 那是一条链，不是交叉） */
function segmentsIntersect(
  p1: { x: number; y: number }, p2: { x: number; y: number },
  q1: { x: number; y: number }, q2: { x: number; y: number },
): boolean {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * 数一数连线的交叉数。
 *
 * 这是「关系是否看得清」最直接的指标：两条线打结，读者就得自己猜谁连着谁。
 * 用节点中心连线做近似（贝塞尔是端点间的单调形变，拓扑一致）。
 */
export function countEdgeCrossings(nodes: SimNode[], links: Link[]): number {
  const pts = nodes.map((n) => ({ x: n.x, y: n.y }));
  let count = 0;
  for (let i = 0; i < links.length; i++) {
    const a = links[i];
    for (let j = i + 1; j < links.length; j++) {
      const b = links[j];
      // 共享端点的两条线不算交叉
      if (a.s === b.s || a.s === b.t || a.t === b.s || a.t === b.t) continue;
      if (segmentsIntersect(pts[a.s], pts[a.t], pts[b.s], pts[b.t])) count++;
    }
  }
  return count;
}

/**
 * 交叉数极小化的局部搜索。
 *
 * dagre 的「排序阶段」也是这个思路：不断尝试相邻节点换位，
 * 只保留能减少交叉的移动。这里加上碰撞约束做否决条件，
 * 所以交叉数只会降不会升，且永远不会压出重叠。
 */
function reduceCrossings(
  nodes: SimNode[],
  links: Link[],
  padding: number,
  rounds: number,
  /** 限定只能同一组（块）内换位 —— 跨块换位会把分好的块打散 */
  sameGroup?: (a: number, b: number) => boolean,
) {
  if (nodes.length < 3 || links.length < 2) return;
  let best = countEdgeCrossings(nodes, links);
  if (best === 0) return;

  for (let r = 0; r < rounds && best > 0; r++) {
    let improved = false;
    for (let i = 0; i < nodes.length && best > 0; i++) {
      for (let j = i + 1; j < nodes.length && best > 0; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (sameGroup && !sameGroup(i, j)) continue;
        // 只交换离得近的：换得太远会把好不容易调好的簇结构拆掉
        if (Math.hypot(a.x - b.x, a.y - b.y) > 620) continue;

        [a.x, b.x] = [b.x, a.x];
        [a.y, b.y] = [b.y, a.y];
        if (overlapsAny(nodes, i, j, padding)) {
          [a.x, b.x] = [b.x, a.x];
          [a.y, b.y] = [b.y, a.y];
          continue;
        }
        const now = countEdgeCrossings(nodes, links);
        if (now < best) {
          best = now;
          improved = true;
        } else {
          [a.x, b.x] = [b.x, a.x];
          [a.y, b.y] = [b.y, a.y];
        }
      }
    }
    if (!improved) return;
  }
}

/** 换位后 i / j 有没有和别人（彼此也算）压在一起 —— 有的话这次换位不接受 */
function overlapsAny(nodes: SimNode[], i: number, j: number, padding: number): boolean {
  const hits = (a: SimNode, skip: Set<number>): boolean => {
    for (let k = 0; k < nodes.length; k++) {
      if (skip.has(k)) continue;
      const b = nodes[k];
      const ox = a.hw + b.hw + padding - Math.abs(a.x - b.x);
      const oy = a.hh + b.hh + padding - Math.abs(a.y - b.y);
      if (ox > 0 && oy > 0) return true;
    }
    return false;
  };
  if (hits(nodes[i], new Set())) return true; // 含 i vs j
  if (hits(nodes[j], new Set([i]))) return true;
  return false;
}

/**
 * 向质心匀速收拢，碰撞约束负责顶住。
 *
 * 这是把「好看但很散」变成「好看且紧凑」的关键一步：
 * 力导向本身收敛到的是平衡态，间距往往比需要的大得多。
 * 这里在保持相对结构的前提下把多余留白挤掉，
 * 收敛到 padding 允许的最密状态 —— 于是 fitView 的缩放比能上去，
 * 字号不用跟着缩到读不了。
 */
function compact(nodes: SimNode[], padding: number, maxIters = 80) {
  if (nodes.length < 2) return;
  for (let i = 0; i < maxIters; i++) {
    const before = bboxArea(nodes);
    let cx = 0;
    let cy = 0;
    for (const n of nodes) {
      cx += n.x;
      cy += n.y;
    }
    cx /= nodes.length;
    cy /= nodes.length;
    for (const n of nodes) {
      n.x = cx + (n.x - cx) * 0.955;
      n.y = cy + (n.y - cy) * 0.955;
    }
    resolveOverlaps(nodes, padding, 3);
    if (bboxArea(nodes) > before * 0.998) return;
  }
}

function bboxArea(nodes: SimNode[]): number {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.x - n.hw);
    y0 = Math.min(y0, n.y - n.hh);
    x1 = Math.max(x1, n.x + n.hw);
    y1 = Math.max(y1, n.y + n.hh);
  }
  return Math.max(1, (x1 - x0) * (y1 - y0));
}

/**
 * AABB 分离：沿穿透量最小的轴推开，直到不再重叠。
 * 这一步是「整洁」的来源 —— 只靠力模型总会留下几处压在一起的卡片。
 */
function resolveOverlaps(nodes: SimNode[], padding: number, passes: number) {
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const overlapX = a.hw + b.hw + padding - Math.abs(a.x - b.x);
        const overlapY = a.hh + b.hh + padding - Math.abs(a.y - b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;

        if (overlapX < overlapY) {
          const dir = a.x < b.x ? -1 : 1;
          const push = (overlapX / 2 + 0.01) * dir;
          a.x += push;
          b.x -= push;
        } else {
          const dir = a.y < b.y ? -1 : 1;
          const push = (overlapY / 2 + 0.01) * dir;
          a.y += push;
          b.y -= push;
        }
      }
    }
  }
}

/**
 * 分量装箱：按高度降序做 shelf packing。
 * 比起把所有分量丢进一个力场，这样排出来永远是「几块整齐的簇」。
 */
function shelfOnce(
  blocks: { w: number; h: number }[],
  gap: number,
  rowWidth: number,
  given?: number[],
): { out: LayoutPoint[]; w: number; h: number } {
  const order = given
    ? given.map((i) => ({ ...blocks[i], i }))
    : blocks
        .map((b, i) => ({ ...b, i }))
        .sort((a, b) => b.h - a.h || b.w - a.w);

  const out: LayoutPoint[] = new Array(blocks.length);
  let x = 0;
  let y = 0;
  let rowH = 0;
  let maxX = 0;

  for (const b of order) {
    if (x > 0 && x + b.w > rowWidth) {
      x = 0;
      y += rowH + gap;
      rowH = 0;
    }
    out[b.i] = { x, y };
    x += b.w + gap;
    maxX = Math.max(maxX, x - gap);
    rowH = Math.max(rowH, b.h);
  }
  return { out, w: maxX, h: y + rowH };
}

/**
 * 装箱时「搜」一个行宽，让结果的宽高比贴近画布。
 *
 * 只按面积开根号定行宽是不够的 —— greedy shelf 会留下空洞，
 * 结果往往又窄又高。而画布是宽的，fitView 就被高度卡住，只能缩得很小。
 * 这里试几个行宽取值，挑宽高比最贴合、面积最小的那次，
 * 于是同一套排版能占到更大的屏幕比例。
 */
function packShelves(
  blocks: { w: number; h: number }[],
  gap: number,
  aspect: number,
  given?: number[],
): LayoutPoint[] {
  const totalArea = blocks.reduce((s, b) => s + (b.w + gap) * (b.h + gap), 0);
  const minRow = blocks.reduce((m, b) => Math.max(m, b.w), 0);
  const base = Math.sqrt(totalArea);

  let best: { out: LayoutPoint[]; score: number } | null = null;
  for (const scale of [1, 1.15, 1.3, 1.5, 1.7, 1.95, 2.25, 2.6, 3]) {
    const rowWidth = Math.max(minRow, base * scale);
    const r = shelfOnce(blocks, gap, rowWidth, given);
    const got = r.w / Math.max(1, r.h);
    // 比例越贴合越好；同等贴合时取面积更小的
    const score = Math.abs(Math.log(got / aspect)) + (r.w * r.h) / (totalArea * 40);
    if (!best || score < best.score) best = { out: r.out, score };
  }
  return best!.out;
}

export interface LayoutBlock {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function forceLayoutDetailed(
  nodeSpecs: LayoutNodeSpec[],
  edgeSpecs: LayoutEdgeSpec[],
  options: ForceLayoutOptions = {},
): { positions: Record<string, LayoutPoint>; blocks: LayoutBlock[] } {
  const positions: Record<string, LayoutPoint> = {};
  const blocks: LayoutBlock[] = [];
  if (nodeSpecs.length === 0) return { positions, blocks };

  const rng = makeRng(options.seed ?? 20260922);
  const iterations = options.iterations ?? 320;
  const padding = options.padding ?? 26;
  const componentGap = options.blockGap ?? options.componentGap ?? 38;

  const spec = new Map(nodeSpecs.map((s) => [s.id, s]));

  // 理想长度由节点实际尺寸推导，卡片越大，离得越远
  const avgDiag =
    nodeSpecs.reduce((s, n) => s + Math.hypot(n.width, n.height), 0) / nodeSpecs.length;
  const avgMax =
    nodeSpecs.reduce((s, n) => s + Math.max(n.width, n.height), 0) / nodeSpecs.length;
  const idealLength = options.idealLength ?? Math.round(Math.max(avgDiag * 0.98, avgMax * 1.12));

  const groups = options.clusterOf
    ? clustersOf(nodeSpecs, options.clusterOf)
    : componentsOf(nodeSpecs, edgeSpecs);

  // 各分量独立求解
  const solved = groups.map((ids) => {
    const key = options.clusterOf ? options.clusterOf(ids[0]) : ids[0];
    const pts = solveComponent(ids, spec, edgeSpecs, rng, {
      iterations,
      idealLength,
      padding,
      compact: options.compact,
    });
    let maxX = 0;
    let maxY = 0;
    ids.forEach((id, i) => {
      maxX = Math.max(maxX, pts[i].x + spec.get(id)!.width);
      maxY = Math.max(maxY, pts[i].y + spec.get(id)!.height);
    });
    return { ids, pts, w: maxX, h: maxY, key };
  });

  const boxes = solved.map((b) => ({ w: b.w, h: b.h }));

  /** 按给定的块顺序装出一套全局布局，只为评估「这个顺序好不好」 */
  const layoutForOrder = (order: number[]): SimNode[] => {
    const origins = packShelves(boxes, componentGap, options.aspect ?? 1.45, order);
    const list: SimNode[] = [];
    solved.forEach((block, bi) => {
      const origin = origins[bi];
      block.ids.forEach((id, i) => {
        const sp = spec.get(id)!;
        list.push({
          id,
          x: origin.x + block.pts[i].x + sp.width / 2,
          y: origin.y + block.pts[i].y + sp.height / 2,
          dx: 0,
          dy: 0,
          hw: sp.width / 2,
          hh: sp.height / 2,
          degree: 0,
        });
      });
    });
    return list;
  };

  const linkList = (nodes: SimNode[]): Link[] => {
    const index = new Map(nodes.map((n, i) => [n.id, i]));
    const out: Link[] = [];
    for (const e of edgeSpecs) {
      const a = index.get(e.source);
      const b = index.get(e.target);
      if (a !== undefined && b !== undefined && a !== b) out.push({ s: a, t: b });
    }
    return out;
  };

  /**
   * 块的排列顺序也会影响交叉数 —— 关联紧密的块挨着放，
   * 跨块连线就短，就不必绕过别的块，交叉自然少。
   * 这里试几种顺序，挑交叉最少的（并列时取面积更小的）。
   */
  const orderCandidates: number[][] = [];
  const byHeight = solved
    .map((b, i) => ({ i, h: b.h, w: b.w }))
    .sort((a, b) => b.h - a.h || b.w - a.w)
    .map((x) => x.i);
  orderCandidates.push(byHeight);
  orderCandidates.push([...byHeight].reverse());
  orderCandidates.push(solved.map((_, i) => i));

  // 贪心：从最大的块出发，每次都接上「和已放置块连线最多」的那块
  const weights: number[][] = solved.map(() => solved.map(() => 0));
  for (const e of edgeSpecs) {
    const a = solved.findIndex((b) => b.ids.includes(e.source));
    const b = solved.findIndex((b) => b.ids.includes(e.target));
    if (a !== -1 && b !== -1 && a !== b) {
      weights[a][b] += 1;
      weights[b][a] += 1;
    }
  }
  {
    const placed: number[] = [];
    const left = new Set(solved.map((_, i) => i));
    let start = 0;
    for (let i = 1; i < solved.length; i++) if (solved[i].ids.length > solved[start].ids.length) start = i;
    placed.push(start);
    left.delete(start);
    while (left.size > 0) {
      let best = -1;
      let bestScore = -1;
      for (const c of left) {
        let w = 0;
        for (const p of placed) w += weights[c][p];
        const score = w * 100 + solved[c].ids.length;
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (best === -1) break;
      placed.push(best);
      left.delete(best);
    }
    orderCandidates.push(placed, [...placed].reverse());
  }

  let bestOrder = orderCandidates[0];
  let bestCross = Infinity;
  let bestArea = Infinity;
  for (const order of orderCandidates) {
    const cand = layoutForOrder(order);
    const cross = countEdgeCrossings(cand, linkList(cand));
    const area = candArea(cand);
    if (cross < bestCross || (cross === bestCross && area < bestArea)) {
      bestCross = cross;
      bestArea = area;
      bestOrder = order;
    }
  }

  let all = layoutForOrder(bestOrder);

  /**
   * 全局阶段只做两件事：解开重叠、压交叉。
   *
   * 刻意不在这层做「向质心紧缩」—— 那会把块间的留白压到 padding
   * （块内 26px 那一档），块与块在视觉上就糊在一起了。
   * 分块的物理分离由装箱时的 blockGap 保证，块内紧缩在 solveComponent 里已经做完了。
   */
  resolveOverlaps(all, padding, 40);

  const blockOf = new Map<string, number>();
  solved.forEach((block, bi) => block.ids.forEach((id) => blockOf.set(id, bi)));
  const indexById = new Map(all.map((n, i) => [n.id, i]));
  const linksAll = linkList(all);
  reduceCrossings(all, linksAll, padding, 24, (i, j) =>
    blockOf.get(all[i].id) === blockOf.get(all[j].id),
  );
  resolveOverlaps(all, padding, 8);
  void indexById;

  for (const n of all) {
    positions[n.id] = { x: Math.round(n.x - n.hw), y: Math.round(n.y - n.hh) };
  }

  // 紧缩会改动块的实际占位，这里按最终坐标重算每个块的包围盒
  for (const block of solved) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of block.ids) {
      const s = spec.get(id)!;
      const p = positions[id];
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x + s.width);
      y1 = Math.max(y1, p.y + s.height);
    }
    blocks.push({ key: block.key, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }

  return { positions, blocks };
}

function candArea(nodes: SimNode[]): number {
  if (nodes.length === 0) return 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.x - n.hw);
    y0 = Math.min(y0, n.y - n.hh);
    x1 = Math.max(x1, n.x + n.hw);
    y1 = Math.max(y1, n.y + n.hh);
  }
  return (x1 - x0) * (y1 - y0);
}

export function forceLayout(
  nodeSpecs: LayoutNodeSpec[],
  edgeSpecs: LayoutEdgeSpec[],
  options: ForceLayoutOptions = {},
): Record<string, LayoutPoint> {
  return forceLayoutDetailed(nodeSpecs, edgeSpecs, options).positions;
}

/** 节点尺寸随内容轻微浮动 —— 不是流程图方框 */
export function nodeSizeFor(idea: {
  title?: string;
  content: string;
  tags: string[];
}): { width: number; height: number } {
  const text = `${idea.title ?? ""} ${idea.content}`;
  const weight =
    Math.min(1, text.length / 180) * 0.45 + Math.min(1, idea.tags.length / 3) * 0.15;
  return {
    width: Math.round(210 + weight * 58),
    height: Math.round(112 + weight * 30),
  };
}
