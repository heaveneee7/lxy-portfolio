"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { blenderWorks, chainItems, navigation, PORTFOLIO_VERSION, surveyDocuments } from "./portfolio-data";

type LightboxItem = { src: string; title: string; caption?: string };
type ChainPoint = { x: number; y: number; px: number; py: number };

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function useForegroundReveals() {
  useEffect(() => {
    const selector = [
      ".project-section > .section-head",
      ".petroleum-layout",
      ".video-frame",
      ".book-stage",
      ".thesis-research-board",
      ".thesis-archive-board",
      ".blender-grid",
      ".about-photo",
      ".about-copy",
    ].join(",");
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (!nodes.length) return;
    document.documentElement.classList.add("reveal-ready");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    nodes.forEach((node, index) => {
      node.dataset.reveal = index % 3 === 1 ? "soft-left" : "rise";
      observer.observe(node);
    });
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("reveal-ready");
    };
  }, []);
}

function AsciiBackdrop() {
  return (
    <pre className="ascii-backdrop" aria-hidden="true">{`+---------------- LXY::PORTFOLIO_${PORTFOLIO_VERSION} ----------------+
|  field_notes / reporting / moving_image / archive  |
|  ....::::....::::....::::....::::....::::....::::  |
|  [01] collect  [02] verify  [03] tell  [04] make   |
+----------------------------------------------------+
     *        o          ( )        O        .
  /\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\
     01001100 01011000 01011001 00110011 00101110 00110000`}</pre>
  );
}

function MagneticCurtain({ onMetal, soundOn }: { onMetal: (strength?: number) => void; soundOn: boolean }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const chainsRef = useRef<ChainPoint[][]>([]);
  const pointerRef = useRef({ x: -999, y: -999, vx: 0, vy: 0, active: false });
  const hoveredRef = useRef(-1);
  const reduced = useReducedMotion();
  const [catReachProgress, setCatReachProgress] = useState(0);
  const [catHandoffProgress, setCatHandoffProgress] = useState(0);
  const [reachIdleFrame, setReachIdleFrame] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => setReachIdleFrame((frame) => frame === 0 ? 1 : 0), 820);
    return () => window.clearInterval(timer);
  }, [reduced]);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const area = areaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      const next = clamp((innerHeight * .84 - rect.top) / Math.max(rect.height * .7, 1));
      setCatReachProgress(next);
      /* Pose timing and scene hand-off are intentionally independent: the
         cat can hold its upright reach while the toys remain on screen, then
         disappear only when the chain field itself reaches the next scene. */
      setCatHandoffProgress(clamp((innerHeight * .48 - rect.bottom) / Math.max(innerHeight * .42, 1)));
    };
    const request = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", request);
      removeEventListener("resize", request);
    };
  }, []);

  useEffect(() => {
    const area = areaRef.current;
    const canvas = canvasRef.current;
    if (!area || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const geometry = (index: number) => {
      if (width < 680) {
        return {
          x: width * (((index % 2) + 0.5) / 2),
          length: index < 2 ? 210 + index * 45 : index < 4 ? 465 + (index - 2) * 45 : 725 + (index - 4) * 45,
        };
      }
      return { x: width * ((index + 0.63) / chainItems.length), length: Math.min(height * chainItems[index].length, 450) };
    };

    const reset = () => {
      const rect = area.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      chainsRef.current = chainItems.map((_, index) => {
        const target = geometry(index);
        return Array.from({ length: 11 }, (__, pointIndex) => {
          const y = 30 + ((target.length - 30) / 10) * pointIndex;
          return { x: target.x, y, px: target.x, py: y };
        });
      });
    };

    const solve = (points: ChainPoint[], anchorX: number, segmentLength: number) => {
      for (let iteration = 0; iteration < 7; iteration += 1) {
        points[0].x = anchorX;
        points[0].y = 30;
        for (let index = 1; index < points.length; index += 1) {
          const a = points[index - 1];
          const b = points[index];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.max(Math.hypot(dx, dy), 0.001);
          const correction = (distance - segmentLength) / distance;
          const aw = index === 1 ? 0 : 0.47;
          const bw = index === points.length - 1 ? 0.64 : 0.53;
          a.x += dx * correction * aw;
          a.y += dy * correction * aw;
          b.x -= dx * correction * bw;
          b.y -= dy * correction * bw;
        }
      }
    };

    const tick = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const pointer = pointerRef.current;
      const speed = Math.hypot(pointer.vx, pointer.vy);
      let magnet = -1;
      let nearest = 230;
      if (pointer.active && speed < 7 && hoveredRef.current < 0 && !reduced) {
        chainsRef.current.forEach((points, index) => {
          const end = points[points.length - 1];
          const distance = Math.hypot(end.x - pointer.x, end.y - pointer.y);
          if (distance < nearest) { nearest = distance; magnet = index; }
        });
      }

      chainsRef.current.forEach((points, chainIndex) => {
        const target = geometry(chainIndex);
        const segmentLength = (target.length - 30) / (points.length - 1);
        const locked = hoveredRef.current === chainIndex;
        for (let index = 1; index < points.length; index += 1) {
          const point = points[index];
          const damping = reduced ? 0 : locked ? 0.84 : 0.98;
          const vx = (point.x - point.px) * damping;
          const vy = (point.y - point.py) * damping;
          point.px = point.x;
          point.py = point.y;
          point.x += vx;
          point.y += vy + (reduced ? 0 : 0.35 + index * 0.012);
          if (pointer.active && speed >= 7 && !reduced) {
            const dx = point.x - pointer.x;
            const dy = point.y - pointer.y;
            const distance = Math.max(Math.hypot(dx, dy), 1);
            if (distance < 155) {
              const force = (1 - distance / 155) * Math.min(6, speed * 0.11);
              point.x += (dx / distance) * force + clamp(pointer.vx * 0.035, -2.5, 2.5);
              point.y += (dy / distance) * force + clamp(pointer.vy * 0.02, -1.6, 1.6);
            }
          }
        }
        if (chainIndex === magnet && !reduced) {
          const end = points[points.length - 1];
          end.x += (pointer.x - end.x) * 0.052;
          end.y += (pointer.y + 20 - end.y) * 0.045;
        }
        solve(points, target.x, segmentLength);

        ctx.strokeStyle = "rgba(24,24,22,.82)";
        ctx.lineWidth = 3.6;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.stroke();
        ctx.strokeStyle = "rgba(250,246,236,.58)";
        ctx.lineWidth = 0.9;
        for (let index = 1; index < points.length; index += 1) {
          const a = points[index - 1];
          const b = points[index];
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          ctx.beginPath();
          ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, 3.8, segmentLength * 0.4, angle, 0, Math.PI * 2);
          ctx.stroke();
        }
        const end = points[points.length - 1];
        const before = points[points.length - 2];
        const angle = Math.atan2(end.y - before.y, end.x - before.x) - Math.PI / 2;
        const node = itemRefs.current[chainIndex];
        if (node) node.style.transform = `translate3d(${end.x}px,${end.y}px,0) translate(-50%,-8px) rotate(${angle}rad)`;
      });
      pointer.vx *= 0.8;
      pointer.vy *= 0.8;
      raf = requestAnimationFrame(tick);
    };

    reset();
    window.addEventListener("resize", reset);
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("resize", reset); cancelAnimationFrame(raf); };
  }, [reduced]);

  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextX = event.clientX - rect.left;
    const nextY = event.clientY - rect.top;
    const pointer = pointerRef.current;
    pointer.vx = pointer.active ? clamp(nextX - pointer.x, -46, 46) : 0;
    pointer.vy = pointer.active ? clamp(nextY - pointer.y, -34, 34) : 0;
    pointer.x = nextX;
    pointer.y = nextY;
    pointer.active = true;
  };

  /* The cat rises through one pose at a time.  Once upright, frames four and
     five alternate as a tiny pawing idle; near the section boundary the sixth
     frame lowers the same cat into the crouch that begins the rooftop route. */
  const reachPoseProgress = clamp(catReachProgress / 0.58);
  const reachExitRaw = catHandoffProgress;
  const reachExit = reachExitRaw * reachExitRaw * (3 - 2 * reachExitRaw);
  const reachIdle = catReachProgress >= 0.5 && catReachProgress < 0.88 && reachExit < 0.08;
  const reachFrame = catReachProgress >= 0.88
    ? 5
    : reachIdle
      ? 3 + reachIdleFrame
      : Math.min(4, Math.round(reachPoseProgress * 4));
  const reachHandoff = clamp((catReachProgress - 0.82) / 0.18);
  const reachFrameSrc = (index: number) => `/assets/illustrations/cat-reach-v1/cat-reach-${String(index + 1).padStart(2, "0")}.png`;

  return (
    <section className="curtain-section" id="index">
      <div className="section-head curtain-heading">
        <div><p className="eyebrow">[ INTERACTIVE_INDEX ]</p><h2>每一件悬挂物，<br /><i>都通向真实作品。</i></h2></div>
        <p>点击你感兴趣的经历，快速跳转<small>{soundOn ? "SOUND::ON" : "SOUND::OFF"}</small></p>
      </div>
      <div className="chain-field" ref={areaRef} onPointerMove={pointerMove} onPointerLeave={() => { pointerRef.current.active = false; hoveredRef.current = -1; }}>
        <div className="chain-beam"><span>+ LXY_ARCHIVE / SELECT_A_WORK +</span></div>
        <canvas ref={canvasRef} aria-hidden="true" />
        {chainItems.map((item, index) => (
          <a
            key={item.href}
            ref={(node) => { itemRefs.current[index] = node; }}
            href={item.href}
            className={`pendant pendant-${item.kind}`}
            onPointerEnter={() => { hoveredRef.current = index; onMetal(0.16 + index * 0.018); }}
            onPointerLeave={() => { hoveredRef.current = -1; }}
            onClick={() => onMetal(0.34)}
          >
            <span className={`pendant-object ${item.kind}`} aria-hidden="true">
              {item.kind === "umbrella" && <span>傘</span>}
              {item.kind === "plate" && <b>12·9</b>}
              {item.kind === "helmet" && <span>⌒</span>}
              {item.kind === "book" && <span>冊</span>}
              {item.kind === "moon" && <span>☾</span>}
              {item.kind === "building" && <img src="/assets/blender/zhigong-building.png" alt="" />}
              {item.kind === "figure" && <span>◇</span>}
            </span>
            <span className="pendant-label"><b>{item.label}</b><small>{item.sub}</small></span>
          </a>
        ))}
        <div
          className="index-reach-cat"
          data-reaching={catReachProgress > .22 && catReachProgress < .96 ? "true" : "false"}
          data-idle={reachIdle ? "true" : "false"}
          data-handoff={reachHandoff > .05 ? "true" : "false"}
          style={{
            "--index-cat-opacity": 1 - reachExit,
            "--index-cat-x": `${reachHandoff * 44}px`,
            "--index-cat-y": `${reachHandoff * -22}px`,
            "--index-cat-scale": 1 - reachHandoff * .08,
          } as CSSProperties}
          aria-hidden="true"
        >
          <img src={reachFrameSrc(reachFrame)} alt="" />
        </div>
        <div className="index-cat-status" style={{ "--index-cat-opacity": 1 - reachExit } as CSSProperties} aria-hidden="true">
          <b>PLAYER_01 / BLACK_CAT</b>
          <span>待机中 · 正在追踪吊坠</span>
          <i><em /></i>
        </div>
        <p className="chain-hint">MOVE_FAST::WIND / HOLD_STILL::MAGNET / CLICK::ENTER</p>
      </div>
    </section>
  );
}

function ScrollCatWorld({ children }: { children: ReactNode }) {
  const worldRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [worldEntered, setWorldEntered] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<1 | -1>(1);
  const previousProgressRef = useRef<number | null>(null);
  const targetProgressRef = useRef(0);
  const animatedProgressRef = useRef(0);
  const [thesisProgress, setThesisProgress] = useState(0);
  const [newspaperProgress, setNewspaperProgress] = useState(0);
  const [routeAnchors, setRouteAnchors] = useState({ newspaper: 0.24, thesis: 0.7 });
  const reduced = useReducedMotion();

  useEffect(() => {
    const catFrames = Array.from(
      { length: 12 },
      (_, index) => `/assets/illustrations/cat-scroll-v7/cat-${String(index + 1).padStart(2, "0")}.png`,
    );
    catFrames.forEach((src) => {
      const frame = new Image();
      frame.decoding = "async";
      frame.src = src;
    });
  }, []);

  useEffect(() => {
    let raf = 0;
    let initialized = false;
    const animateProgress = () => {
      const target = targetProgressRef.current;
      const current = animatedProgressRef.current;
      const eased = reduced ? target : current + (target - current) * 0.2;
      const next = Math.abs(target - eased) < 0.000025 ? target : eased;
      animatedProgressRef.current = next;
      setProgress(next);
      if (next !== target) raf = requestAnimationFrame(animateProgress);
    };
    const update = () => {
      const world = worldRef.current;
      if (!world) return;
      const rect = world.getBoundingClientRect();
      const distance = Math.max(world.offsetHeight - innerHeight, 1);
      const nextProgress = clamp(-rect.top / distance);
      setWorldEntered(rect.top <= innerHeight * 0.015);
      const previousProgress = previousProgressRef.current;
      if (previousProgress !== null) {
        const delta = nextProgress - previousProgress;
        /* Face the direction in which the visitor is actually travelling.
           The old implementation only knew the route's forward-reading
           direction, so rewinding the scroll made the cat run backwards. */
        if (Math.abs(delta) > 0.00035) setScrollDirection(delta > 0 ? 1 : -1);
      }
      previousProgressRef.current = nextProgress;
      targetProgressRef.current = nextProgress;
      if (!initialized) {
        initialized = true;
        animatedProgressRef.current = nextProgress;
        setProgress(nextProgress);
      } else {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(animateProgress);
      }
      const anchorAt = (element: HTMLElement | null, fallback: number) => {
        if (!element) return fallback;
        const elementRect = element.getBoundingClientRect();
        const topInsideWorld = elementRect.top - rect.top;
        return clamp((topInsideWorld + elementRect.height * 0.5 - innerHeight * 0.5) / distance);
      };
      const thesis = document.getElementById("thesis");
      if (thesis) {
        const thesisRect = thesis.getBoundingClientRect();
        const thesisDistance = Math.max(thesisRect.height + innerHeight * 0.58, 1);
        setThesisProgress(clamp((innerHeight * 0.78 - thesisRect.top) / thesisDistance));
      }
      const newspaper = document.getElementById("newspaper-scene");
      if (newspaper) {
        const paperRect = newspaper.getBoundingClientRect();
        setNewspaperProgress(clamp((innerHeight * 0.72 - paperRect.top) / Math.max(paperRect.height + innerHeight * 0.45, 1)));
      }
      const nextAnchors = {
        newspaper: anchorAt(newspaper, 0.24),
        thesis: anchorAt(thesis, 0.7),
      };
      setRouteAnchors((current) => (
        Math.abs(current.newspaper - nextAnchors.newspaper) > 0.0005
        || Math.abs(current.thesis - nextAnchors.thesis) > 0.0005
          ? nextAnchors
          : current
      ));
    };
    const request = () => update();
    update();
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    return () => { cancelAnimationFrame(raf); removeEventListener("scroll", request); removeEventListener("resize", request); };
  }, [reduced]);

  /* One responsive SVG coordinate system owns both position and pose.  The
     newspaper/thesis anchors are measured inside the long page and inserted
     into this same route.  They never pull the cat with a second timeline. */
  const smooth = (value: number) => value * value * (3 - 2 * value);
  const smoother = (value: number) => value * value * value * (value * (value * 6 - 15) + 10);
  const thesisActive = thesisProgress > 0.08 && thesisProgress < 0.97;
  const moonMerge = clamp(thesisProgress / 0.38);
  /* Keep the three landing circles on one continuous trajectory while the
     thesis tableau forms and dissolves.  The old thesisActive ternary reset
     the merge to zero in a single frame; because the cat can be standing on
     one of these circles, that visual reset also teleported the cat. */
  const circleMergeIn = smoother(clamp((thesisProgress - 0.04) / 0.34));
  const circleMergeOut = 1 - smoother(clamp((thesisProgress - 0.78) / 0.19));
  const circleMerge = circleMergeIn * circleMergeOut;
  const moonSettle = clamp((thesisProgress - 0.25) / 0.3);
  const moonFade = clamp((thesisProgress - 0.12) / 0.2) * (1 - clamp((thesisProgress - 0.9) / 0.1));

  const orbBase = {
    a: { x: 190, y: 220, r: 116, color: "#6b96c2" },
    b: { x: 810, y: 230, r: 83, color: "#f05a00" },
    c: { x: 755, y: 460, r: 132, color: "#faca4c" },
  } as const;
  const orbIds = ["a", "b", "c"] as const;
  type OrbId = typeof orbIds[number];
  const circlePulse = (sampleProgress: number, start: number, end: number, strength: number) => {
    const local = clamp((sampleProgress - start) / Math.max(end - start, .001));
    return Math.sin(local * Math.PI) * strength;
  };
  const circleChoreographyAt = (sampleProgress: number) => Math.max(
    circlePulse(sampleProgress, .035, .17, .38),
    circlePulse(sampleProgress, .2, .39, .5),
    circlePulse(sampleProgress, .43, .61, .34),
  );
  const orbAt = (id: OrbId, index: number, sampleProgress: number, mergeAmount: number) => {
    const base = orbBase[id];
    const scrollWave = sampleProgress * Math.PI * (5.4 + index * 0.72) + index * 1.7;
    /* Each colour landing travels on its own loose orbit.  The amplitude is
       intentionally large enough to read as spatial motion at a glance. */
    let ox = Math.sin(scrollWave) * (42 + index * 12);
    let oy = Math.cos(scrollWave * 0.78) * (30 + index * 8);
    ox += Math.sin(sampleProgress * Math.PI * 2.4 + index * 2.1) * 30;
    oy += Math.cos(sampleProgress * Math.PI * 3.1 + index * 1.35) * 22;
    let sx = 1 + Math.sin(scrollWave * 0.66) * 0.095;
    let sy = 1 + Math.cos(scrollWave * 0.7) * 0.085;
    if (mergeAmount > 0) {
      const moonX = 515;
      const moonY = 330;
      ox += (moonX - base.x) * mergeAmount;
      oy += (moonY - base.y) * mergeAmount;
      sx *= 1 - mergeAmount * 0.76;
      sy *= 1 - mergeAmount * 0.76;
    }
    return { ...base, x: base.x + ox, y: base.y + oy, sx, sy };
  };
  const circleGather = 1 - (1 - circleChoreographyAt(progress)) * (1 - circleMerge);
  const orbState = Object.fromEntries(orbIds.map((id, index) => (
    [id, orbAt(id, index, progress, circleGather)]
  ))) as Record<OrbId, { x: number; y: number; r: number; color: string; sx: number; sy: number }>;

  type RouteTarget = "a" | "b" | "c" | "paper" | "thesis";
  type RouteStop = { at: number; target: RouteTarget };
  const newspaperAnchor = clamp(routeAnchors.newspaper, 0.14, 0.46);
  const thesisAnchor = clamp(Math.max(routeAnchors.thesis, newspaperAnchor + 0.2), 0.54, 0.86);
  const paperIn = newspaperAnchor - 0.035;
  const paperOut = newspaperAnchor + 0.055;
  const thesisIn = thesisAnchor - 0.045;
  const thesisOut = thesisAnchor + 0.065;
  const routeStops: RouteStop[] = [
    { at: 0, target: "a" },
    { at: Math.max(0.055, newspaperAnchor - 0.13), target: "c" },
    { at: paperIn, target: "paper" },
    { at: paperOut, target: "paper" },
    { at: paperOut + (thesisIn - paperOut) * 0.48, target: "b" },
    { at: thesisIn, target: "thesis" },
    { at: thesisOut, target: "thesis" },
    /* Forward reading must never send the cat back to an already-passed
       landing.  The old thesis -> C -> A tail made a correctly forward-facing
       side pose travel towards circles behind its body, which read as
       backwards running.  Thesis is the final narrative landing: the cat
       settles there and the remaining scroll distance is a pose hold.  When
       the visitor scrolls upward, the same continuous route naturally
       reverses from thesis back through B, paper, C and A. */
    { at: 1, target: "thesis" },
  ];
  let scene = routeStops.length - 2;
  for (let index = 0; index < routeStops.length - 1; index += 1) {
    if (progress <= routeStops[index + 1].at) {
      scene = index;
      break;
    }
  }
  const from = routeStops[scene];
  const to = routeStops[scene + 1];
  const phase = clamp((progress - from.at) / Math.max(to.at - from.at, 0.0001));
  /* The visible circles keep drifting, but every jump locks its departure and
     arrival positions at the segment boundaries.  A moving endpoint was the
     source of the former mid-air teleport. */
  const pointFor = (target: RouteTarget, sampleAt: number) => {
    /* Keep the newspaper landing near the route instead of at the far-left
       edge.  The former 170px target forced the cat to cover a very long
       distance inside a short scroll segment, which read as a teleport even
       though the coordinates were mathematically continuous. */
    /* These two narrative holds now continue the left-to-right rooftop path.
       Their former x positions (212 and 655) sat behind the colour landing
       the cat had just reached, producing a conspicuous c -> left -> b and
       b -> left reversal.  The cat still pauses beside the newspaper and on
       the thesis moon, but reaches each one as the next forward landing. */
    if (target === "paper") return { x: 260, y: 530 };
    if (target === "thesis") return { x: 812, y: 398 };
    const index = orbIds.indexOf(target);
    const orb = orbAt(target, index, sampleAt, circleChoreographyAt(sampleAt));
    /* The circles are broad colour fields rather than tiny waypoints.  Land
       on the route-facing side of each field so consecutive jumps form one
       flowing roof-top path and do not waste scroll distance crossing an
       entire circle diameter.  Offsets are radius-relative and therefore
       remain responsive at every viewport size. */
    const routeOffset = target === "a"
      ? orb.r * 0.18
      : target === "b"
        ? -orb.r * 0.48
        : -orb.r * 0.44;
    return { x: orb.x + routeOffset, y: orb.y };
  };
  const fromPoint = pointFor(from.target, from.at);
  const toPoint = pointFor(to.target, to.at);
  const holdTarget = from.target === to.target ? from.target : null;
  const newspaperHold = holdTarget === "paper";
  const thesisHold = holdTarget === "thesis";

  /* Allocate anticipation and landing by *global scroll distance*, not by a
     fixed fraction of each route segment. Short sections used to compress the
     whole jump into a few wheel ticks, so a mathematically continuous cat
     still appeared to teleport. Every jump now gets a readable crouch and
     landing while keeping most of the section genuinely airborne. */
  const segmentSpan = Math.max(to.at - from.at, 0.001);
  const takeoffEnd = clamp(0.022 / segmentSpan, 0.16, 0.3);
  const landingBand = clamp(0.014 / segmentSpan, 0.08, 0.2);
  const landingStart = 1 - landingBand;
  const settleEnd = 0.995;
  const rawTravel = clamp((phase - takeoffEnd) / (landingStart - takeoffEnd));
  /* Use cubic smoothstep for spatial travel.  Quintic smootherstep is useful
     for tiny UI transitions, but its steeper middle derivative condensed too
     much of a long leap into a few wheel ticks and made the cat look as if it
     snapped through the apex.  Cubic smoothstep still has zero velocity at
     take-off/landing while spreading the flight more evenly across scroll. */
  const travel = smooth(rawTravel);
  const airborne = !holdTarget && phase >= takeoffEnd && phase < landingStart;
  const launchCompression = !holdTarget && phase < takeoffEnd ? Math.sin((phase / takeoffEnd) * Math.PI) : 0;
  const landingCompression = !holdTarget && phase >= landingStart && phase < settleEnd
    ? Math.sin(((phase - landingStart) / (settleEnd - landingStart)) * Math.PI)
    : 0;

  let x = fromPoint.x;
  let y = fromPoint.y;
  let rotate = 0;
  let activeOrb: "a" | "b" | "c" | "none" = from.target === "a" || from.target === "b" || from.target === "c" ? from.target : "none";
  let travelDirection = Math.sign(toPoint.x - fromPoint.x);
  if (!travelDirection) {
    for (let index = scene - 1; index >= 0; index -= 1) {
      const before = pointFor(routeStops[index].target, routeStops[index].at);
      const after = pointFor(routeStops[index + 1].target, routeStops[index + 1].at);
      travelDirection = Math.sign(after.x - before.x);
      if (travelDirection) break;
    }
  }
  travelDirection ||= 1;
  /* `travelDirection` describes the route when reading downward;
     `scrollDirection` describes the visitor's real movement through that
     route. Multiplying them prevents backwards running when the timeline is
     scrubbed in reverse while keeping every pose fully reversible. */
  /* Do not flip an idle cat merely because the wheel moved inside a pose-hold
     interval.  The cat turns only when it actually leaves the landing and
     starts travelling along the route. */
  const facingDirection = (holdTarget
    ? travelDirection
    : travelDirection * scrollDirection) as 1 | -1;
  if (holdTarget) {
    x = fromPoint.x;
    y = fromPoint.y;
    rotate = holdTarget === "paper" ? -3 : 1.5;
  } else if (phase < takeoffEnd) {
    /* Anticipation stays anchored to the source orb, with only a tiny recoil. */
    x = fromPoint.x - travelDirection * launchCompression * 8;
    y = fromPoint.y + launchCompression * 7;
    rotate = -travelDirection * launchCompression * 2.4;
  } else if (phase < landingStart) {
    x = fromPoint.x + (toPoint.x - fromPoint.x) * travel;
    /* Build the arc from the already-smoothed travel value. The previous
       sin(t)^0.78 envelope rose almost vertically at takeoff, creating a
       visible ~56px jump. This curve has zero slope at both endpoints while
       keeping a broad, readable airborne interval. */
    const flightArc = 4 * travel * (1 - travel);
    /* A long crossing may climb high; a short hop stays lower. This keeps the
       velocity per scroll tick consistent instead of forcing every segment
       through the same 180px vertical excursion. */
    const flightHeight = clamp(40 + segmentSpan * 420, 72, 138);
    y = fromPoint.y + (toPoint.y - fromPoint.y) * travel - flightArc * flightHeight;
    const tangentY = (toPoint.y - fromPoint.y) - (4 - 8 * travel) * flightHeight;
    const tangentAngle = Math.atan2(tangentY, Math.max(Math.abs(toPoint.x - fromPoint.x), 1)) * (180 / Math.PI);
    rotate = clamp(tangentAngle * 0.32, -7.5, 7.5);
    activeOrb = rawTravel < 0.24 && (from.target === "a" || from.target === "b" || from.target === "c")
      ? from.target
      : rawTravel > 0.76 && (to.target === "a" || to.target === "b" || to.target === "c")
        ? to.target
        : "none";
  } else {
    const settle = clamp((phase - landingStart) / (settleEnd - landingStart));
    const rebound = Math.sin(settle * Math.PI * 2) * (1 - settle) * 7;
    x = toPoint.x + travelDirection * Math.sin(settle * Math.PI) * (1 - settle) * 5;
    y = toPoint.y + rebound + landingCompression * 5;
    rotate = travelDirection * (-3.8 + smooth(settle) * 2.2);
    activeOrb = to.target === "a" || to.target === "b" || to.target === "c" ? to.target : "none";
  }

  /* Keep the whole painted cat inside the stage.  Without this guard the
     flight arc could lift part of the sprite beyond the SVG viewBox, which
     looked like an incompletely cut-out cat appearing in pieces. */
  y = clamp(y, 232, 650);

  const newspaperSceneActive = newspaperProgress > 0.12 && newspaperProgress < 0.9;
  if (holdTarget) activeOrb = "none";

  /* The hand-painted sequence follows an animal rhythm rather than uniform
     motion: settle, tail lift, crouch, explosive take-off, a long apex hold,
     descent, landing compression and rebound. The first route begins from the
     supplied back view; later jumps begin from the relaxed front-facing sit. */
  /* Keep one readable silhouette through most of a jump.  Cycling through
     four near-identical airborne stills made the cat advance like a flipbook
     with missing pages.  Spatial motion is now continuously eased, while the
     pose changes only inside the compressed take-off and landing beats. */
  const poseStops = [
    { at: 0, frame: scene === 0 ? 0 : 8 },
    { at: takeoffEnd * 0.48, frame: scene === 0 ? 1 : 8 },
    { at: takeoffEnd * 0.86, frame: 2 },
    { at: takeoffEnd, frame: 3 },
    { at: landingStart, frame: 3 },
    { at: landingStart + (settleEnd - landingStart) * 0.56, frame: 7 },
    { at: settleEnd, frame: 8 },
    { at: 1, frame: 8 },
  ] as const;
  let poseIndex = poseStops.length - 2;
  for (let index = 0; index < poseStops.length - 1; index += 1) {
    if (phase <= poseStops[index + 1].at) {
      poseIndex = index;
      break;
    }
  }
  const poseFrom = poseStops[poseIndex];
  const poseTo = poseStops[poseIndex + 1];
  const poseMix = smoother(clamp((phase - poseFrom.at) / Math.max(poseTo.at - poseFrom.at, 0.001)));
  const regularBaseFrame = poseFrom.frame;
  const regularNextFrame = poseTo.frame;
  let baseFrame: number = regularBaseFrame;
  let nextFrame: number = regularNextFrame;
  let frameMix = poseMix;
  if (thesisHold) {
    /* The final thesis hold finishes the reference storyboard: seated breath,
       a long stretch, then the deliberately exaggerated sleepy yawn. */
    if (phase < 0.28) {
      baseFrame = 8;
      nextFrame = 8;
      frameMix = 0;
    } else if (phase < 0.52) {
      baseFrame = 8;
      nextFrame = 10;
      frameMix = smoother((phase - 0.28) / 0.24);
    } else if (phase < 0.74) {
      baseFrame = 10;
      nextFrame = 11;
      frameMix = smoother((phase - 0.52) / 0.22);
    } else {
      baseFrame = 11;
      nextFrame = 11;
      frameMix = 0;
    }
  }
  if (newspaperHold) {
    /* The newspaper landing gets the short lick-paw loop from the storyboard;
       it returns to the same seated pose before the next route segment. */
    if (phase < 0.22) {
      baseFrame = 8;
      nextFrame = 9;
      frameMix = smoother(phase / 0.22);
    } else if (phase > 0.8) {
      baseFrame = 9;
      nextFrame = 8;
      frameMix = smoother((phase - 0.8) / 0.2);
    } else {
      baseFrame = 9;
      nextFrame = 9;
      frameMix = 0;
    }
  }
  /* Long dissolves between very different silhouettes read as two cats. Keep
     only a brief eight-percent blend around the frame boundary: spatial
     movement stays continuous, while the animal's outline remains crisp. */
  const visualFrameMix = smoother(clamp((frameMix - 0.46) / 0.08));
  /* Never dissolve two silhouettes over one another.  The route itself stays
     continuously interpolated, while the hand-painted pose advances on the
     midpoint like a traditional animation exposure sheet.  This removes the
     detached-tail ghost and the accidental appearance of two cats. */
  const visibleFrame = visualFrameMix < 0.5 ? baseFrame : nextFrame;
  const frameFloat = visibleFrame;
  const catMode = newspaperHold ? "groom" : thesisHold ? "moon" : airborne ? "leap" : "crouch";
  const poseHold = Boolean(holdTarget) || (!airborne && phase >= settleEnd);
  const catFrameSrc = (index: number) => `/assets/illustrations/cat-scroll-v7/cat-${String(index + 1).padStart(2, "0")}.png`;
  const frameWidth = 180;
  const frameHeight = 240;
  const frameX = -frameWidth / 2;
  const frameY = -frameHeight * .94;
  const compression = Math.max(launchCompression, landingCompression);
  const catScaleX = 1 + compression * 0.075;
  const catScaleY = 1 - compression * 0.09;
  const renderRiggedCat = () => (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${facingDirection * catScaleX} ${catScaleY})`}>
      <g className="cat-raster-motion">
        <image
          className="cat-raster-image cat-raster-frame"
          href={catFrameSrc(visibleFrame)}
          x={frameX}
          y={frameY}
          width={frameWidth}
          height={frameHeight}
          preserveAspectRatio="xMidYMid meet"
          opacity={1}
        />
      </g>
    </g>
  );

  const style = {
    "--thesis-p": thesisProgress,
    "--moon-merge": moonMerge,
    "--moon-settle": moonSettle,
    "--moon-opacity": moonFade,
    "--moon-scale": 0.56 + moonSettle * 0.44,
  } as CSSProperties;

  return (
    <section className="cat-world" ref={worldRef} style={style} data-world-entered={worldEntered ? "true" : "false"} data-scene={scene} data-active-orb={activeOrb} data-thesis-active={thesisActive ? "true" : "false"} data-newspaper-active={newspaperSceneActive ? "true" : "false"} data-cat-x={x.toFixed(2)} data-cat-y={y.toFixed(2)} data-cat-frame={frameFloat.toFixed(2)} data-cat-mix={visualFrameMix.toFixed(3)} data-cat-direction={facingDirection}>
      <div className="cat-sticky" aria-hidden="true">
        <svg className="cat-route-svg" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="orb-halftone" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.15" fill="rgba(28,26,30,.18)" />
            </pattern>
            <filter id="paper-wobble" x="-15%" y="-15%" width="130%" height="130%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.8" />
            </filter>
          </defs>
          <path className="svg-dashed-route" d="M-70 460 C120 610 290 155 470 335 S760 610 1070 150" />
          {orbIds.map((id) => {
            const orb = orbState[id];
            return (
              <g key={id} className={`svg-orb svg-orb-${id}`} data-active={activeOrb === id ? "true" : "false"} transform={`translate(${orb.x} ${orb.y}) scale(${orb.sx} ${orb.sy})`}>
                <circle r={orb.r} fill={orb.color} opacity={Math.max(0, .62 * (1 - circleMerge))} filter="url(#paper-wobble)" />
                <circle r={orb.r} fill="url(#orb-halftone)" opacity={Math.max(0, .7 * (1 - circleMerge))} />
                <circle className="svg-orb-ring" r={orb.r + 8} />
              </g>
            );
          })}
        </svg>
        <svg className={`cat-character-svg cat-raster-stage is-${catMode} ${!reduced && poseHold ? "is-idle" : ""}`} viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice">
          {renderRiggedCat()}
        </svg>
        <div className={`thesis-moon-tableau ${!reduced && moonSettle > 0.88 ? "is-idle" : ""}`}>
          <span className="crescent-moon" />
          <img className="moon-girl moon-girl-base" src="/assets/thesis/moon-girl.png" alt="" />
          <img className="moon-girl moon-girl-skirt" src="/assets/thesis/moon-girl.png" alt="" />
        </div>
      </div>
      <div className="cat-content">{children}</div>
    </section>
  );
}

function FlipCard({ id, title, copy, open, onToggle, children }: { id: string; title: string; copy: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <article className={`flip-card ${open ? "is-flipped" : ""}`}>
      <div className="flip-card-inner">
        <button type="button" className="card-face card-front" onClick={onToggle} aria-expanded={open}>
          <small>[ {id} ]</small><h3>{title}</h3><p>{copy}</p><b>点击查看详情 ↗</b>
        </button>
        <div className="card-face card-back">
          <button type="button" className="card-back-close" onClick={onToggle}>返回正面 ×</button>
          <div className="card-back-scroll"><h3>{title}</h3>{children}</div>
          <p className="card-scroll-cue"><span>↓</span> 卡片内继续下滑 <span>↓</span></p>
        </div>
      </div>
    </article>
  );
}

function UmbrellaCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let start = performance.now();

    type Point3D = { x: number; y: number; z: number };
    const rotate = (point: Point3D, angle: number) => {
      const cosY = Math.cos(angle);
      const sinY = Math.sin(angle);
      const x = point.x * cosY + point.z * sinY;
      const z = -point.x * sinY + point.z * cosY;
      const tilt = -0.12;
      return {
        x,
        y: point.y * Math.cos(tilt) - z * Math.sin(tilt),
        z: point.y * Math.sin(tilt) + z * Math.cos(tilt),
      };
    };
    const project = (point: Point3D) => {
      const focal = 610;
      const scale = focal / (focal + point.z);
      return { x: width * 0.5 + point.x * scale, y: height * 0.42 + point.y * scale, scale };
    };
    const canopyY = (radius: number) => -88 + radius * 0.54;
    const surfacePoint = (radius: number, theta: number): Point3D => ({
      x: Math.cos(theta) * radius,
      y: canopyY(radius),
      z: Math.sin(theta) * radius,
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawLine = (points: Point3D[], angle: number, color: string, lineWidth: number) => {
      context.beginPath();
      points.forEach((point, index) => {
        const rendered = project(rotate(point, angle));
        if (index === 0) context.moveTo(rendered.x, rendered.y);
        else context.lineTo(rendered.x, rendered.y);
      });
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.lineCap = "round";
      context.stroke();
    };

    const draw = (time: number) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const angle = reduced ? 0.62 : ((time - start) / 10000) * Math.PI * 2;
      const panelCount = 16;
      const panels = Array.from({ length: panelCount }, (_, index) => {
        const thetaA = (index / panelCount) * Math.PI * 2;
        const thetaB = ((index + 1) / panelCount) * Math.PI * 2;
        const points = [
          surfacePoint(0, thetaA),
          surfacePoint(82, thetaA),
          surfacePoint(145, thetaA),
          surfacePoint(145, thetaB),
          surfacePoint(82, thetaB),
        ];
        const transformed = points.map((point) => rotate(point, angle));
        const depth = transformed.reduce((sum, point) => sum + point.z, 0) / transformed.length;
        return { index, transformed, depth };
      }).sort((a, b) => b.depth - a.depth);

      const shadow = context.createRadialGradient(width * 0.5, height * 0.76, 4, width * 0.5, height * 0.76, 145);
      shadow.addColorStop(0, "rgba(32,38,109,.17)");
      shadow.addColorStop(1, "rgba(32,38,109,0)");
      context.fillStyle = shadow;
      context.beginPath();
      context.ellipse(width * 0.5, height * 0.76, Math.min(150, width * 0.34), 26, 0, 0, Math.PI * 2);
      context.fill();

      panels.forEach(({ index, transformed }) => {
        context.beginPath();
        transformed.forEach((point, pointIndex) => {
          const rendered = project(point);
          if (pointIndex === 0) context.moveTo(rendered.x, rendered.y);
          else context.lineTo(rendered.x, rendered.y);
        });
        context.closePath();
        context.fillStyle = index % 2 === 0 ? "rgba(247,244,222,.91)" : "rgba(221,229,203,.88)";
        context.fill();
        context.strokeStyle = "rgba(118,105,66,.38)";
        context.lineWidth = 0.8;
        context.stroke();
      });

      for (let index = 0; index < panelCount; index += 1) {
        const theta = (index / panelCount) * Math.PI * 2;
        drawLine([surfacePoint(0, theta), surfacePoint(145, theta)], angle, "rgba(169,137,74,.76)", index % 2 ? 1.25 : 1.7);
      }
      drawLine(Array.from({ length: 33 }, (_, index) => surfacePoint(145, (index / 32) * Math.PI * 2)), angle, "rgba(92,124,94,.7)", 2.2);

      [0.28, 2.12, 3.72, 5.34].forEach((theta, branchIndex) => {
        const branch = [52, 71, 91, 112, 132].map((radius, index) => {
          const drift = Math.sin(index * 1.8 + branchIndex) * 0.045;
          return surfacePoint(radius, theta + drift);
        });
        drawLine(branch, angle, "rgba(74,113,77,.72)", 2.4);
        branch.slice(1).forEach((point, index) => {
          const leafTheta = theta + (index % 2 === 0 ? 0.12 : -0.12);
          drawLine([point, surfacePoint(72 + index * 15, leafTheta)], angle, "rgba(74,113,77,.56)", 1.7);
        });
      });

      drawLine([{ x: 0, y: -94, z: 0 }, { x: 0, y: 181, z: 0 }], angle, "rgba(91,65,31,.92)", 9);
      drawLine([{ x: 0, y: -94, z: 0 }, { x: 0, y: 181, z: 0 }], angle, "rgba(219,187,112,.92)", 4.5);
      for (let index = 0; index < panelCount; index += 2) {
        const theta = (index / panelCount) * Math.PI * 2;
        drawLine([{ x: 0, y: 10, z: 0 }, surfacePoint(122, theta)], angle, "rgba(165,137,82,.52)", 1.1);
      }
      const hub = project(rotate({ x: 0, y: -88, z: 0 }, angle));
      context.fillStyle = "#b89c60";
      context.beginPath();
      context.arc(hub.x, hub.y, 7 * hub.scale, 0, Math.PI * 2);
      context.fill();
      const bead = project(rotate({ x: 0, y: 192, z: 0 }, angle));
      context.fillStyle = "#738d77";
      context.beginPath();
      context.arc(bead.x, bead.y, 7 * bead.scale, 0, Math.PI * 2);
      context.fill();
      const tasselSway = reduced ? 0 : Math.sin((time - start) / 690) * 7;
      drawLine([{ x: 0, y: 198, z: 0 }, { x: tasselSway * .24, y: 214, z: 0 }, { x: tasselSway, y: 232, z: 0 }], angle, "rgba(74,98,76,.8)", 3.3);
      for (let strand = -3; strand <= 3; strand += 1) {
        drawLine([
          { x: tasselSway, y: 232, z: 0 },
          { x: tasselSway + strand * 2.3, y: 254 + Math.abs(strand) * 1.4, z: strand * .5 },
        ], angle, strand % 2 ? "rgba(80,111,85,.56)" : "rgba(54,91,69,.72)", 1.25);
      }

      const rippleOrigin = project(rotate({ x: 0, y: 274, z: 0 }, angle));
      if (!reduced) {
        for (let ripple = 0; ripple < 4; ripple += 1) {
          const ripplePhase = (((time - start) / 1450) + ripple * .25) % 1;
          context.beginPath();
          context.ellipse(rippleOrigin.x, rippleOrigin.y, 12 + ripplePhase * 58, 3 + ripplePhase * 12, 0, 0, Math.PI * 2);
          context.strokeStyle = `rgba(112,126,164,${(1 - ripplePhase) * .28})`;
          context.lineWidth = 1.2;
          context.stroke();
        }
      }
      frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
      start = 0;
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className="umbrella-canvas" role="img" aria-label="以伞柄为轴心匀速自转的立体水墨油纸伞" />;
}

function UmbrellaProject({ onOpen }: { onOpen: (item: LightboxItem) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const storyRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const toggle = (id: string) => setActive((current) => current === id ? null : id);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const story = storyRef.current;
      if (!story) return;
      if (reduced) {
        setStoryProgress(1);
        return;
      }
      const rect = story.getBoundingClientRect();
      const distance = Math.max(story.offsetHeight - innerHeight * 0.86, 1);
      setStoryProgress(clamp((innerHeight * 0.12 - rect.top) / distance));
    };
    const request = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    return () => { cancelAnimationFrame(raf); removeEventListener("scroll", request); removeEventListener("resize", request); };
  }, [reduced]);

  const smoothStep = (value: number) => {
    const amount = clamp(value);
    return amount * amount * (3 - 2 * amount);
  };
  /* Keep the early entrance, but give the flap, rising paper and card wheel a
     little more breathing room than the previous very short cut.  The archive
     still settles before the halfway point, leaving the larger half for use. */
  const envelopeEnter = smoothStep(storyProgress / 0.055);
  const envelopeOpen = smoothStep((storyProgress - 0.04) / 0.09);
  const paperRise = smoothStep((storyProgress - 0.095) / 0.115);
  const wheelProgress = smoothStep((storyProgress - 0.18) / 0.17);
  const settleProgress = smoothStep((storyProgress - 0.31) / 0.13);
  const umbrellaEntrance = smoothStep((storyProgress - 0.19) / 0.14);
  const wheelFocus = wheelProgress * 3;
  const storyStyle = {
    "--envelope-enter": envelopeEnter,
    "--envelope-open": envelopeOpen,
    "--paper-rise": paperRise,
    "--wheel-progress": wheelProgress,
    "--settle-progress": settleProgress,
    "--sheet-y": `${310 - paperRise * 395 + settleProgress * 85}px`,
    "--sheet-scale": 0.88 + paperRise * 0.08 + settleProgress * 0.04,
    "--envelope-fade": 1 - settleProgress,
    "--envelope-y": `${(1 - envelopeEnter) * 70}px`,
    "--envelope-scale": 0.96 + envelopeEnter * 0.04,
    "--sheet-width": `${82 + settleProgress * 18}%`,
    "--sheet-mobile-width": `${92 + settleProgress * 8}%`,
    "--sheet-height": `${76 + settleProgress * 20}%`,
    "--flap-angle": `${envelopeOpen * -178}deg`,
    "--heading-opacity": 0.42 + paperRise * 0.58,
    "--umbrella-entrance": umbrellaEntrance,
    "--umbrella-entrance-y": `${(1 - umbrellaEntrance) * 44}px`,
  } as CSSProperties;
  const cardMotionStyle = (index: number) => {
    const row = Math.floor(index / 2);
    const column = index % 2;
    const offset = index - wheelFocus;
    const proximity = 1 - clamp(Math.abs(offset), 0, 1);
    const initialX = column === 0 ? 52 : -52;
    const initialY = offset * 160 - row * 356;
    return {
      "--card-x": `${initialX * (1 - settleProgress)}%`,
      "--card-y": `${initialY * (1 - settleProgress)}px`,
      "--card-scale": 0.84 + proximity * 0.12 + settleProgress * (0.16 - proximity * 0.12),
      "--card-opacity": Math.min(1, 0.4 + proximity * 0.6 + settleProgress * 0.6),
      "--card-z": Math.round(proximity * 8 + settleProgress * 4),
    } as CSSProperties;
  };
  return (
    <section className="umbrella-project project-section" id="umbrella">
      <div className="umbrella-intro section-head">
        <div><p className="eyebrow">[ 01 / FIELD_RESEARCH ]</p><h2>桐香竹韵</h2><p>兰州大学赴四川省泸州市分水油纸伞调研</p></div>
        <p>从家乡的文化记忆出发，走进油纸伞厂、竹材产地与分水岭镇；以田野、问卷、影像和申报材料留下完整证据。</p>
      </div>
      <div className="umbrella-dashboard" style={storyStyle}>
        <aside className="umbrella-visual">
          <p>INK_UMBRELLA::ROTATING</p>
          <div className="umbrella-rotator"><UmbrellaCanvas /></div>
          <small>一把伞 / 四条工作线 / 全部可打开</small>
        </aside>
        <div className="umbrella-letter-story" ref={storyRef} style={storyStyle} data-interactive={storyProgress > 0.31 ? "true" : "false"} data-envelope-open={envelopeOpen > 0.55 ? "true" : "false"}>
          <div className="umbrella-letter-sticky">
            <div className="umbrella-letter-sheet">
              <div className="letter-heading" aria-hidden="true"><span>FIELD NOTES / 分水油纸伞</span><b>一封来自田野的工作档案</b></div>
              <div className="umbrella-cards">
          <div className="umbrella-card-slot" style={cardMotionStyle(0)}>
          <FlipCard id="A" title="田野调研" copy={<>走访油纸伞厂、竹材产地与分水岭镇；<br />参与传承人访谈和居民调研。</>} open={active === "field"} onToggle={() => toggle("field")}>
            <div className="field-photo-grid">
              {[
                ["/assets/umbrella/field/crafting.jpg", "参与油纸伞骨架制作"],
                ["/assets/umbrella/field/interview.jpg", "与传承人访谈"],
                ["/assets/umbrella/field/survey.jpg", "分水岭镇居民调研"],
              ].map(([src, title]) => <button type="button" key={src} onClick={() => onOpen({ src, title })}><img src={src} alt={title} /><span>{title}</span></button>)}
            </div>
          </FlipCard>
          </div>
          <div className="umbrella-card-slot" style={cardMotionStyle(1)}>
          <FlipCard id="B" title="问卷研究" copy={<>参与问卷设计、线下发放与收集、<br />数据清洗和调研报告撰写。</>} open={active === "survey"} onToggle={() => toggle("survey")}>
            <div className="document-links">
              {surveyDocuments.map((doc, index) => <div key={doc.pdf}><span>0{index + 1}</span><b>{doc.title}</b><a className="archive-action" href={doc.pdf} target="_blank" rel="noreferrer"><strong>阅读 PDF</strong><i>↗</i></a><a className="archive-action" href={doc.docx} download><strong>下载 DOCX</strong><i>↓</i></a></div>)}
            </div>
          </FlipCard>
          </div>
          <div className="umbrella-card-slot" style={cardMotionStyle(2)}>
          <FlipCard id="C" title="内容传播" copy={<>两篇中国青年网署名报道；<br />跟随拍摄《伞韵匠心》，参与文案撰写。</>} open={active === "media"} onToggle={() => toggle("media")}>
            <div className="media-archive">
              <button type="button" onClick={() => onOpen({ src: "/assets/umbrella/publicity-page1-2.jpg", title: "中国青年网署名报道（一）", caption: "原网页已清理，以署名截图存档。" })}><img src="/assets/umbrella/publicity-page1-2.jpg" alt="中国青年网署名报道一" /><span>署名报道 01</span></button>
              <button type="button" onClick={() => onOpen({ src: "/assets/umbrella/publicity-page2-2.jpg", title: "中国青年网署名报道（二）", caption: "原网页已清理，以署名截图存档。" })}><img src="/assets/umbrella/publicity-page2-2.jpg" alt="中国青年网署名报道二" /><span>署名报道 02</span></button>
              <a className="media-link" href="https://www.bilibili.com/video/BV1ya411P7j4/" target="_blank" rel="noreferrer"><b>《伞韵匠心》</b><span>B站视频 / 团队影像 / 跟随拍摄 / 参与文案撰写 ↗</span></a>
              <a className="media-link" href="/assets/umbrella-publicity.pdf" target="_blank" rel="noreferrer"><b>“绸缪迭梦”公众号</b><span>查看图文与宣传成果 PDF ↗</span></a>
            </div>
          </FlipCard>
          </div>
          <div className="umbrella-card-slot" style={cardMotionStyle(3)}>
          <FlipCard id="D" title="竞赛申报" copy={<>参与“挑战杯”申报书 B、C、F 部分撰写，<br />项目获全国三等奖。</>} open={active === "competition"} onToggle={() => toggle("competition")}>
            <div className="competition-archive">
              <a href="/assets/umbrella/documents/challenge-application-bcf.doc" download><b>申报书 B、C、F 部分</b><span>下载原始 DOC ↓</span></a>
              <button type="button" onClick={() => onOpen({ src: "/assets/umbrella/challenge-award-1.jpg", title: "挑战杯全国三等奖奖状" })}><img src="/assets/umbrella/challenge-award-1.jpg" alt="挑战杯全国三等奖奖状一" /><span>查看奖状 01 ↗</span></button>
              <button type="button" onClick={() => onOpen({ src: "/assets/umbrella/challenge-award-2.jpg", title: "挑战杯全国三等奖奖状" })}><img src="/assets/umbrella/challenge-award-2.jpg" alt="挑战杯全国三等奖奖状二" /><span>查看奖状 02 ↗</span></button>
            </div>
          </FlipCard>
          </div>
              </div>
            </div>
            <div className="envelope-back" aria-hidden="true" />
            <div className="envelope-flap" aria-hidden="true" />
            <div className="envelope-front" aria-hidden="true"><span>TO::PORTFOLIO_READER</span><i>FIELD_01</i></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NewspaperReveal() {
  const [open, setOpen] = useState(false);
  return (
    <div id="newspaper-scene" className={`newspaper-scene ${open ? "is-open" : ""}`}>
      <button type="button" className="crumpled-paper" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="点击展开或收起报纸">
        <span className="paper-texture"><img src="/assets/petroleum-page.webp" alt="《塔里木石油报》刊登《并肩前行夫妻档，一路追光不言苦》的完整版面" /><i /></span>
      </button>
      <div className="newspaper-open-caption" aria-hidden={!open}>
        <small>《塔里木石油报》综合版 · 第 3 版</small>
        <strong>并肩前行“夫妻档”<br />一路追“光”不言苦</strong>
        <span>文章位于完整报纸下半部中央，橙色框已标出</span>
      </div>
      <p className="pencil-prompt">{open ? "再点一次，收起报纸" : "点击纸团展开 ↗"}</p>
      <a className="newspaper-pdf archive-action" href="/assets/petroleum-report.pdf" target="_blank" rel="noreferrer"><strong>打开“夫妻档”见报 PDF</strong><i>↗</i></a>
    </div>
  );
}

function PetroleumProject() {
  return (
    <section className="petroleum-project project-section" id="petroleum">
      <div className="section-head petroleum-head">
        <div><p className="eyebrow">[ 02 / REPORTING ]</p><h2>一路追“光”</h2><p>中国石油报 · 塔里木油田实习采访</p></div>
        <blockquote>“以一线人物为切口，记录中国最大整装光伏项目中的共同坚守。”</blockquote>
      </div>
      <div className="petroleum-layout">
        <div className="petroleum-copy"><h3>并肩前行“夫妻档”，<br />一路追“光”不言苦</h3><p>在中国石油报实习期间参与现场采访与稿件撰写，以一线人物为切口记录上库高新区光伏项目中的共同坚守。</p><strong>MY_ROLE::现场采访 / 新闻采写 / 图片拍摄 / 实习记者署名</strong></div>
        <div className="petroleum-photos">
          <figure><img src="/assets/petroleum/field-workers.webp" alt="工作人员在光伏板前交流" /><figcaption>01 / 现场采访</figcaption></figure>
          <figure><img src="/assets/petroleum/field-lift.webp" alt="光伏现场高空作业" /><figcaption>02 / 建设现场</figcaption></figure>
          <figure><img src="/assets/petroleum/field-install.webp" alt="工人安装光伏支架" /><figcaption>03 / 图片拍摄</figcaption></figure>
        </div>
      </div>
      <NewspaperReveal />
    </section>
  );
}

function DecemberProject() {
  return (
    <section className="december-project project-section" id="december">
      <div className="section-head">
        <div><p className="eyebrow">[ 03 / MOVING_IMAGE ]</p><h2>一二九运动<br />主题视频</h2><p>《融合媒体新闻报道》课程作品</p></div>
        <p>围绕历史记忆的当代表达完成短视频策划，以文案、脚本和镜头协作组织一则轻快的融合媒体叙事。</p>
      </div>
      <div className="video-frame">
        <video controls preload="metadata" poster="/assets/december/vlog-129-poster.jpg"><source src={`/assets/december/vlog-129-web.mp4?v=${PORTFOLIO_VERSION}`} type="video/mp4" />你的浏览器暂不支持视频播放。</video>
        <a className="video-original-link" href="https://weixin.qq.com/sph/AsXg88pFJH" target="_blank" rel="noreferrer"><b>高清原频 ↗</b><span>前往微信视频号观看</span></a>
        <aside><b>MY_ROLE</b><span>文案 / 脚本 / 部分镜头拍摄</span><b>FORMAT</b><span>VLOG / 08:04 / 网页压缩预览</span></aside>
      </div>
    </section>
  );
}

function InteractiveBook() {
  type Phase = "closed" | "armed" | "opening" | "open" | "turn-forward" | "end" | "turn-back" | "closing";
  const [phase, setPhase] = useState<Phase>("closed");
  const [page, setPage] = useState<0 | 1>(0);
  const [previewing, setPreviewing] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const schedule = (callback: () => void, delay: number) => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = window.setTimeout(callback, delay); };
  const close = useCallback(() => {
    setPhase((current) => {
      if (current === "closed" || current === "closing") return current;
      if (current === "armed") { setPage(0); return "closed"; }
      schedule(() => { setPage(0); setPhase("closed"); }, 650);
      return "closing";
    });
  }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (phase !== "closed" && wrapRef.current && !wrapRef.current.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); };
  }, [close, phase]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const handleCover = () => {
    if (phase === "closed") { setPage(0); setPhase("armed"); return; }
    if (phase === "armed") { setPhase("opening"); schedule(() => setPhase("open"), 720); }
  };
  const forward = () => { if (phase === "open") { setPhase("turn-forward"); schedule(() => { setPage(1); setPhase("end"); }, 900); } };
  const back = () => { if (phase === "end") { setPage(0); setPhase("turn-back"); schedule(() => setPhase("open"), 900); } };
  const visible = phase !== "closed" && phase !== "armed";
  const prompted = phase !== "closed" && phase !== "closing";
  const showPagePrompt = prompted || previewing;
  const turning = phase === "turn-forward" || phase === "turn-back";
  return (
    <section className="book-project project-section" id="book">
      <div className="section-head"><div><p className="eyebrow">[ 04 / VISUAL_SELF_PORTRAIT ]</p><h2>你好，<br />李馨月。</h2></div><p>用Adobe Illustrator做的自我介绍，装订成一本画册。请打开它，阅读我</p></div>
      <div className="book-stage" ref={wrapRef} onMouseLeave={() => setPreviewing(false)}>
        {!visible ? <button className={`closed-book ${previewing ? "is-previewing" : ""} ${phase === "armed" ? "is-armed" : ""}`} type="button" onMouseEnter={() => setPreviewing(true)} onClick={handleCover} aria-label={phase === "armed" ? "点击翻开《你好，李馨月》画册" : "让《你好，李馨月》画册立起"}><span className="book-spine">HELLO_LI_XINYUE::2025</span><span className="book-cover"><img src="/assets/intro-p1-cover.webp" alt="《你好，李馨月》封面" /></span><span className="book-pages" /></button> :
          <div className={`open-book phase-${phase}`} aria-label="《你好，李馨月》翻页画册">
            <button className="book-page left-page" type="button" onClick={page === 0 ? forward : back} aria-label={page === 1 ? "返回上一跨页" : "翻到下一跨页"}><img src={page === 1 && !turning ? "/assets/intro-p4-goals.webp" : "/assets/intro-p2-about.webp"} alt={page === 1 && !turning ? "第四页：未来展望" : "第二页：关于我"} /></button>
            <button className="book-page right-page" type="button" onClick={page === 0 ? forward : close} aria-label={page === 0 ? "翻到下一跨页" : "点击合上画册"}>{page === 0 && !turning ? <img src="/assets/intro-p3-growth.webp" alt="第三页：成长回顾" /> : <span className="blank-page"><i>fin.</i><small>CLICK_TO_CLOSE</small></span>}</button>
            {turning && <div className={`turning-sheet ${phase === "turn-back" ? "is-reverse" : ""}`} aria-hidden="true"><span className="sheet-front"><img src="/assets/intro-p3-growth.webp" alt="" /></span><span className="sheet-back"><img src="/assets/intro-p4-goals.webp" alt="" /></span></div>}
            <span className="book-gutter" aria-hidden="true" />
          </div>}
        {phase === "closed" && <p className="book-state-note">HOVER::书本起身 / CLICK::进入阅读</p>}
        {showPagePrompt && <div className="book-page-prompt" aria-hidden="true"><svg viewBox="0 0 170 90"><path d="M164 73 C116 75 145 14 87 22 C43 28 73 75 26 62" /><path d="M27 62 L41 52 M27 62 L42 69" /></svg><span>{phase === "end" ? "点击合上" : "点击翻页"}</span></div>}
      </div>
    </section>
  );
}

const thesisContents = [
  { chapter: "第一章 绪论", items: ["1.1 选题缘起", "1.2 文献综述与研究创新点", "1.3 理论基础与名词解释"], nested: ["1.3.1 玩家社群互动", "1.3.2 性别主体意识", "1.3.3 氪金意愿、社交焦虑与浪漫信念的关系", "1.3.4 最终假设"] },
  { chapter: "第二章 研究方法", items: ["2.1 样本选取与数据收集", "2.2 测量工具与信效度检验"] },
  { chapter: "第三章 研究假设检验", items: ["3.1 结构方程模型的过程与结果", "3.2 半结构性采访"] },
  { chapter: "第四章 讨论与结论", items: ["4.1 爱欲与数字的张力", "4.2 离身与具身的共生"] },
  { chapter: "第五章 反思与建议", items: ["5.1 浪漫的信念与现实的践行", "5.2 性别混响中保持理性，多重叙事中坚守主体", "5.3 本研究的局限性"] },
] as const;

function ThesisProject({ onOpen }: { onOpen: (item: LightboxItem) => void }) {
  const [writeRun, setWriteRun] = useState(0);
  const [introProgress, setIntroProgress] = useState(0);
  const introRef = useRef<HTMLDivElement>(null);
  const replayWriting = () => setWriteRun((run) => run + 1);
  const chartOne = "/assets/thesis/research-significant-paths-original.png";
  const chartTwo = "/assets/thesis/research-rb-model-original.png";
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const intro = introRef.current;
      if (!intro) return;
      const rect = intro.getBoundingClientRect();
      const next = clamp((innerHeight * 0.96 - rect.top) / Math.max(innerHeight * 0.92, 1));
      setIntroProgress(next);
      const focus = rect.top < innerHeight * 0.98 && rect.bottom > innerHeight * 0.08;
      document.documentElement.classList.toggle("thesis-intro-focus", focus);
    };
    const request = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", request);
      removeEventListener("resize", request);
      document.documentElement.classList.remove("thesis-intro-focus");
    };
  }, [writeRun]);
  const ease = (value: number) => {
    const amount = clamp(value);
    return amount * amount * (3 - 2 * amount);
  };
  const penArrival = ease((introProgress - 0.02) / 0.52);
  const promptArrival = ease((introProgress - 0.28) / 0.42);
  const pinkWash = ease((introProgress - 0.52) / 0.38);
  const blueRecede = 1 - ease((introProgress - .04) / .58);
  const bottleRaw = clamp((introProgress - .2) / .42);
  const bottleSpring = bottleRaw <= 0 ? 0 : clamp(1 - Math.exp(-5.2 * bottleRaw) * Math.cos(9.2 * bottleRaw), 0, 1.12);
  const thesisStyle = {
    "--thesis-wash": pinkWash * 0.72,
    "--thesis-texture-opacity": pinkWash * 0.34,
    "--quill-arrival-y": `${(1 - penArrival) * 360}px`,
    "--quill-arrival-scale": 1.34 - penArrival * 0.34,
    "--prompt-arrival-y": `${(1 - promptArrival) * 105}px`,
    "--prompt-arrival-scale": 0.84 + promptArrival * 0.16,
    "--prompt-arrival-opacity": promptArrival,
    "--boundary-blue-opacity": blueRecede,
    "--boundary-blue-lift": `${(1 - blueRecede) * -9}vh`,
    "--bottle-arrival-y": `${(1 - bottleSpring) * 210}px`,
    "--bottle-arrival-scale": .58 + bottleSpring * .42,
    "--bottle-arrival-rotate": `${(1 - bottleSpring) * -11}deg`,
    "--bottle-arrival-opacity": clamp(bottleRaw * 2.8),
  } as CSSProperties;
  return (
    <section className={`thesis-project project-section ${writeRun ? "is-open" : "is-awaiting-ink"}`} id="thesis" style={thesisStyle}>
      <div className="thesis-boundary-wash" aria-hidden="true" />
      <div className="thesis-intro-scroll" ref={introRef}>
      <div className="thesis-title-composition">
        <div className="thesis-title-panel">
          <p className="eyebrow">[ 05 / UNDERGRADUATE_THESIS / SEM ]</p>
          <h2>毕业论文</h2>
          <h3>《存在之镜：乙女游戏中的主体性实践与消费异化——再结合浪漫信念、社交焦虑及社群互动的结构方程模型探析》</h3>
          <p className={`thesis-en ${writeRun ? "is-writing" : ""}`} key={writeRun}>
            <span>The Mirror of Existence: Subjectivity Practices and Consumption Alienation</span>
            <span>in Otome Games—An SEM-Based Exploration</span>
            <span>of Romantic Beliefs, Social Anxiety,</span>
            <span>and Community Interaction</span>
          </p>
          <div className="thesis-topic-tags" aria-label="论文研究标签">
            <span>乙女游戏研究</span><span>结构方程模型（SEM）</span><span>用户行为分析</span><span>女性数字文化</span>
          </div>
        </div>
        <aside className={`quill-station ${writeRun ? "is-writing" : ""}`} key={`quill-${writeRun}`}>
          <button type="button" className="quill-trigger" onClick={replayWriting} aria-label="点击羽毛笔书写英文论文标题">
            <img src="/assets/thesis/quill-black.png" alt="黑色羽毛笔" />
          </button>
          <span className="quill-prompt">点击羽毛笔 · 展开纸张并书写标题</span>
          <span className="ink-bottle" aria-hidden="true"><img src="/assets/thesis/ink-bottle-cutout-v2.png" alt="" /></span>
          <i className="ink-drop" aria-hidden="true" />
        </aside>
      </div>
      </div>

      <div className="thesis-tableau-space" aria-hidden="true"><span>PLAYER_AVATAR + BLACK_CAT / POSE_HOLD / IDLE_LOOP</span></div>

      <div className="thesis-research-board" id="thesis-research">
        <img className="research-thread-raster" src="/assets/thesis/research-thread-raster.png" alt="" />
        <div className="thesis-data-grid">
          <article className="research-chart-card">
            <button type="button" className="research-chart-visual" onClick={() => onOpen({ src: chartOne, title: "乙游玩家显著路径原图", caption: "论文原件中的无边框高清图" })} aria-label="放大查看乙游玩家显著路径原图">
              <span className="research-chart-frame frame-paths"><img className="research-satin-frame" src="/assets/thesis/satin-frame-paths.png" alt="" /><span className="research-chart-safe"><img src={chartOne} alt="乙游玩家的玩家社群互动、社交焦虑、浪漫信念、氪金意愿的显著路径" /></span></span>
            </button>
            <h3><small>DATA 01 / 显著路径</small>乙游玩家的玩家社群互动、社交焦虑、浪漫信念、氪金意愿的显著路径</h3>
          </article>
          <article className="research-chart-card">
            <button type="button" className="research-chart-visual" onClick={() => onOpen({ src: chartTwo, title: "以RB为关键的国乙玩家模型原图", caption: "论文原件中的无边框高清图" })} aria-label="放大查看以RB为关键的国乙玩家模型原图">
              <span className="research-chart-frame frame-rb"><img className="research-satin-frame" src="/assets/thesis/satin-frame-rb.png" alt="" /><span className="research-chart-safe"><img src={chartTwo} alt="研究成果：以RB为关键的国乙玩家模型" /></span></span>
            </button>
            <h3><small>DATA 02 / RB 模型</small>研究成果：以RB为关键的国乙玩家模型</h3>
          </article>
        </div>
        <div className="thesis-research-footer">
          <div className="thesis-file-actions">
            <a className="archive-action" href="/assets/thesis/li-xinyue-undergraduate-thesis.pdf" target="_blank" rel="noreferrer"><strong>网页阅读 PDF</strong><i>↗</i></a>
            <a className="archive-action" href="/assets/thesis/li-xinyue-undergraduate-thesis.docx" download><strong>下载论文 DOCX</strong><i>↓</i></a>
          </div>
          <div className="thesis-intro-paper-wrap">
            <img className="thesis-intro-rose" src="/assets/thesis/halftone-rose-cutout.png" alt="" />
            <article className="thesis-intro-paper">
              <h3>简介</h3>
              <p>让乙游玩家氪金的，可能不是孤独，而是对浪漫的相信。</p>
              <p>对<strong>253</strong>份有效问卷进行结构方程模型分析后，我发现：</p>
              <p>社交焦虑不会直接显著提升氪金意愿，却可能通过强化浪漫信念间接影响消费；玩家社群也未必让人变得更加焦虑，但它可能同时放大对角色的情感投入与消费意愿。</p>
              <p>更值得注意的是，性别主体意识更强，并不必然意味着更少相信浪漫、更不愿意氪金。</p>
              <p>玩家不是简单地“被恋爱脑支配”，也不是完全置身商业机制之外。她们一边借助虚拟亲密关系获得陪伴、表达主体，一边面对情感被编码、定价与出售的现实。</p>
              <p>当爱被写进代码，我们消费的究竟是角色、浪漫体验，还是理想中的自己？</p>
            </article>
          </div>
        </div>
      </div>

      <div className="thesis-archive-board">
        <img className="archive-flower flower-rose" src="/assets/thesis/vintage-rose-collage.png" alt="" />
        <img className="archive-flower flower-daisy" src="/assets/thesis/vintage-daisy-collage.png" alt="" />
        <div className="thesis-toc" aria-label="毕业论文目录">
          <span className="pink-paperclip" aria-hidden="true" />
          <p className="eyebrow">[ CONTENTS / 目录 ]</p>
          <h3>爱欲被写入代码，<br />谁在凝视镜中的主体？</h3>
          <div className="toc-columns">
            {thesisContents.map((group) => <section key={group.chapter}><h4>{group.chapter}</h4>{group.items.map((item) => <p key={item}>{item}</p>)}{"nested" in group && group.nested?.map((item) => <p className="toc-nested" key={item}>{item}</p>)}</section>)}
          </div>
        </div>
        <div className="thesis-quotes" aria-label="论文摘抄">
          <article className="quote-scrap quote-wide"><span className="paper-tape" /><p>在夷平一切不对等条件的对等“过滤泡”中，玩家不仅容易异化出钱情两讫的漠然，也会逐步走向自我对象化。</p></article>
          <article className="quote-scrap quote-short"><span className="paper-tape" /><p>爱欲在现代性中既被驯服，又潜藏解放的可能。</p></article>
          <article className="quote-scrap quote-radway"><span className="paper-tape" /><span className="thinker-portrait radway"><img src="/assets/thesis/portrait-reference.png" alt="拉德威头像插画" /></span><p>好的浪漫作品提供了一种乌托邦的愿景：女性的个体性和自我感知，与接受他人的呵护和照顾是可以共存的。</p><cite>——拉德威</cite></article>
          <article className="quote-scrap quote-lacan"><span className="paper-tape" /><span className="thinker-portrait lacan"><img src="/assets/thesis/portrait-reference.png" alt="拉康头像插画" /></span><p>“欲望是他者的欲望”，主体欲望的本质是成为他者欲望的对象，而承认的缺失导致主体的异化。</p><cite>——拉康</cite></article>
        </div>
      </div>
    </section>
  );
}

function BlenderArchive({ onOpen }: { onOpen: (item: LightboxItem) => void }) {
  return (
    <section className="blender-archive project-section" id="blender">
      <div className="section-head"><div><p className="eyebrow">[ 06 / SMALL_ARCHIVE ]</p><h2>Blender<br />学习档案</h2></div><p>课程作业，以blender构建了从物品色着、大学建筑、人物形态、动效跑步的期末作品</p></div>
      <div className="blender-grid">{blenderWorks.map((work, index) => <button type="button" key={work.src} onClick={() => onOpen({ src: work.src, title: work.title, caption: work.note })}><span>0{index + 1}</span><img src={work.src} alt={`${work.title} Blender作品截图`} /><div><h3>{work.title}</h3><p>{work.note}</p><b>OPEN_IMAGE ↗</b></div></button>)}</div>
    </section>
  );
}

function Lightbox({ item, onClose }: { item: LightboxItem | null; onClose: () => void }) {
  useEffect(() => { if (!item) return; const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; addEventListener("keydown", key); return () => removeEventListener("keydown", key); }, [item, onClose]);
  if (!item) return null;
  return <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.title} onClick={onClose}><button type="button" className="lightbox-close" onClick={onClose}>CLOSE ×</button><figure onClick={(event) => event.stopPropagation()}><img src={item.src} alt={item.title} /><figcaption><b>{item.title}</b>{item.caption && <p>{item.caption}</p>}</figcaption></figure></div>;
}

export default function PortfolioClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  useForegroundReveals();

  const metal = (strength = 0.18) => {
    if (!soundOn) return;
    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const audio = audioRef.current || new Context();
    audioRef.current = audio;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(680 + strength * 550, audio.currentTime);
    gain.gain.setValueAtTime(Math.min(0.11, strength * 0.22), audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.42);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.45);
  };

  useEffect(() => {
    if (!location.hash) return;
    const hash = location.hash;
    const timer = window.setTimeout(() => document.querySelector(hash)?.scrollIntoView(), 850);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="site-shell">
      <AsciiBackdrop />
      <aside className={`site-rail ${menuOpen ? "is-open" : ""}`}><a className="rail-mark" href="#home">LXY<span>PORTFOLIO_{PORTFOLIO_VERSION}</span></a><button className="mobile-menu" type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen}>MENU</button><nav aria-label="主导航">{navigation.map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav><p className="rail-note">CONTENT / FIELD / IMAGE<br />CHENGDU::2026</p></aside>
      <button type="button" className="sound-toggle" onClick={() => setSoundOn((value) => !value)}>SOUND_{soundOn ? "ON" : "OFF"} {soundOn ? "●" : "○"}</button>
      <main>
        <section className="hero" id="home">
          <div className="hero-copy"><p className="eyebrow">[ LI_XINYUE / PERSONAL_ARCHIVE / 2026 ]</p><h1><span>李馨月</span><strong>FROM FIELD<br />TO FORM<i>.</i></strong></h1><p className="hero-fields">内容策划 / 新闻采写 / 新媒体运营 / 影像制作 / 社会调研 / 视觉表达</p></div>
          <div className="hero-collage" aria-label="作品材料拼贴"><figure className="hero-photo hero-photo-a"><img src="/assets/umbrella/field/interview.jpg" alt="油纸伞传承人访谈" /><figcaption>FIELD_NOTE_01</figcaption></figure><figure className="hero-photo hero-photo-b"><img src="/assets/petroleum/field-workers.webp" alt="中国石油报现场采访" /><figcaption>REPORTING_02</figcaption></figure><figure className="hero-photo hero-photo-c"><img src="/assets/blender/zhigong-building.png" alt="至公楼建模作品" /><figcaption>VISUAL_03</figcaption></figure><span className="hero-ascii">{`{ collect : verify : write : make }`}</span></div>
          <div className="hero-bottom"><span>SCROLL_TO_ENTER ↓</span><span>ASCII_ARCHIVE + HANDMADE_MEMORY</span></div>
        </section>
        <MagneticCurtain soundOn={soundOn} onMetal={metal} />
        <ScrollCatWorld>
          <UmbrellaProject onOpen={setLightbox} />
          <PetroleumProject />
          <DecemberProject />
          <InteractiveBook />
          <ThesisProject onOpen={setLightbox} />
          <BlenderArchive onOpen={setLightbox} />
        </ScrollCatWorld>
        <section className="about" id="about">
          <div className="about-photo"><img src={`/assets/profile/lixinyue-headshot.jpg?v=${PORTFOLIO_VERSION}`} alt="李馨月求职证件照" /><span>LI_XINYUE<br />CHENGDU::2026</span></div>
          <div className="about-copy"><p className="eyebrow">[ JOB_FILE / 求职档案 ]</p><h2>李馨月</h2><p className="about-honor">第一名保研至四川大学</p><p className="about-lead">传播学硕士在读。希望在内容策划、新媒体运营、新闻采写与视觉表达的交叉地带继续工作。</p><div className="resume-rows"><div><small>EDUCATION_01</small><b>四川大学 · 传播学</b><span>2025—至今 / 硕士研究生</span></div><div><small>EDUCATION_02</small><b>兰州大学 · 英语＋网络与新媒体</b><span>2021—2025 / 双学位</span></div><div><small>CAPABILITY</small><b>采写 / 策划 / 运营 / 调研 / 影像</b><span>PS · Illustrator · Premiere · After Effects · Blender</span></div></div><div className="contact-links"><a href="mailto:1937952633@qq.com">1937952633@qq.com</a><a href="tel:18715875710">187 1587 5710</a></div></div>
          <footer><span>© 2026 LI_XINYUE::PORTFOLIO_{PORTFOLIO_VERSION}</span><span>END_OF_FILE_</span></footer>
        </section>
      </main>
      <Lightbox item={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
