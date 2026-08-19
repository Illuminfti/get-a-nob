import { useCallback, useEffect, useId, useRef, useState } from "react";

export type NobMood =
  | "watching"
  | "interviewing"
  | "verdict"
  | "wink"
  | "bored"
  | "doubting"
  | "pleased";

const PRESS_CYCLE: NobMood[] = [
  "interviewing",
  "verdict",
  "wink",
  "bored",
  "doubting",
  "pleased",
  "watching",
];

type Props = {
  busy?: boolean;
  className?: string;
};

export function NobFace({ busy = false, className = "" }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/:/g, "");
  const [mood, setMood] = useState<NobMood>("watching");
  const [look, setLook] = useState({ x: 0, y: 0 });
  const pressIndex = useRef(0);

  const shown: NobMood = busy ? "verdict" : mood;

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const onMove = (event: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const box = svg.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height * 0.42;
      const nx = (event.clientX - cx) / Math.max(box.width / 2, 1);
      const ny = (event.clientY - cy) / Math.max(box.height / 2, 1);
      const max = 6.2;
      setLook({
        x: Math.max(-max, Math.min(max, nx * max)),
        y: Math.max(-max * 0.7, Math.min(max * 0.7, ny * max * 0.7)),
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const onPress = useCallback(() => {
    if (busy) return;
    const next = PRESS_CYCLE[pressIndex.current % PRESS_CYCLE.length];
    pressIndex.current += 1;
    setMood(next);
  }, [busy]);

  return (
    <button
      type="button"
      onPointerDown={onPress}
      className={`nob-face ${className}`}
      aria-label="Nob, a bald orange doorman. Press to change his expression."
    >
      <svg
        ref={svgRef}
        viewBox="-9 4 212 192"
        className="nob-live block h-auto w-full select-none"
        aria-hidden="true"
        style={{
          ["--look-x" as string]: `${look.x}px`,
          ["--look-y" as string]: `${look.y}px`,
        }}
      >
        <defs>
          <pattern
            id={`${uid}-dots`}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="3.5" cy="3.5" r="1.35" fill="#8b3105" />
          </pattern>
          <clipPath id={`${uid}-head`}>
            <ellipse cx="94" cy="94" rx="78" ry="78" />
          </clipPath>
          <clipPath id={`${uid}-eyeL`}>
            <path d="M40 74 C52 73 68 74 82 74 C82 90 75 99 62 100 C49 100 42 92 40 74 Z" />
          </clipPath>
          <clipPath id={`${uid}-eyeR`}>
            <path d="M93 74 C107 74 124 74 139 74 C139 91 132 100 118 100 C104 100 95 92 93 74 Z" />
          </clipPath>
        </defs>

        <g className={`nob-master nob-knob knob-${shown}`}>
          <ellipse className="nob-master-shadow" cx="112" cy="112" rx="78" ry="78" />

          <path
            className="nob-ear nob-master-ear"
            d="M21 73 C -3 73 -4 105 20 107 C 15 97 15 83 21 73 Z"
          />
          <path
            className="nob-ear nob-master-ear"
            d="M168 71 C 199 67 207 111 172 117 C 181 103 181 85 168 71 Z"
          />
          <ellipse className="nob-head nob-master-head" cx="94" cy="94" rx="78" ry="78" />
          <g clipPath={`url(#${uid}-head)`}>
            <path
              d="M133 17 Q 177 55 171 111 Q 163 153 108 173 L180 177 L180 14 Z"
              fill={`url(#${uid}-dots)`}
              opacity="0.28"
            />
            <path
              d="M22 119 C35 159 70 173 110 169 C139 166 158 151 168 128 C142 151 118 158 89 158 C58 158 39 146 22 119 Z"
              fill={`url(#${uid}-dots)`}
              opacity="0.48"
            />
          </g>
          <path
            className="nob-master-ear-fold"
            d="M18 81 C7 78 4 90 10 97 C13 100 17 101 20 100"
          />
          <path
            className="nob-master-ear-fold"
            d="M176 82 C188 72 197 85 190 94 C186 99 179 99 177 104 C175 108 176 111 179 113"
          />

          <g className="nob-eye-group knob-eye-l">
            <path
              className="nob-eye-white"
              d="M40 74 C52 73 68 74 82 74 C82 90 75 99 62 100 C49 100 42 92 40 74 Z"
            />
            <g clipPath={`url(#${uid}-eyeL)`}>
              <circle className="nob-pupil" cx="48.6" cy="80.1" r="8.05" />
            </g>
            <g clipPath={`url(#${uid}-eyeL)`}>
              <g className="nob-anim knob-lid-l">
                <path className="nob-lid" d="M37 52 L85 52 L84 73 Q 62 75 39 74 Z" />
                <path className="knob-lid-arc" d="M40 74 Q 61 75 82 74" />
              </g>
            </g>
            <path
              className="nob-eye-outline"
              d="M40 74 C52 73 68 74 82 74 C82 90 75 99 62 100 C49 100 42 92 40 74 Z"
            />
            <g className="knob-eye-shut">
              <path className="knob-shut-line" d="M44 91 Q 62 78 80 91" />
              <path className="knob-shut-lash" d="M61 99 Q 51 98 44 102" />
            </g>
          </g>

          <g className="nob-eye-group knob-eye-r">
            <path
              className="nob-eye-white"
              d="M93 74 C107 74 124 74 139 74 C139 91 132 100 118 100 C104 100 95 92 93 74 Z"
            />
            <g clipPath={`url(#${uid}-eyeR)`}>
              <circle className="nob-pupil" cx="103.5" cy="80.3" r="8.05" />
            </g>
            <g clipPath={`url(#${uid}-eyeR)`}>
              <g className="nob-anim knob-lid-r">
                <path className="nob-lid" d="M90 52 L142 52 L141 73 Q 118 75 92 74 Z" />
                <path className="knob-lid-arc" d="M93 74 Q 117 75 139 74" />
              </g>
            </g>
            <path
              className="nob-eye-outline"
              d="M93 74 C107 74 124 74 139 74 C139 91 132 100 118 100 C104 100 95 92 93 74 Z"
            />
            <g className="knob-eye-shut">
              <path className="knob-shut-line" d="M104 90 Q 130 77 156 91" />
              <path className="knob-shut-lash" d="M139 98 Q 149 97 156 101" />
            </g>
          </g>

          <g className="nob-anim knob-brow-l">
            <path className="nob-brow" d="M42 59 C55 56 65 66 88 65" />
          </g>
          <g className="nob-anim knob-brow-r">
            <path className="nob-brow" d="M96 66 C110 70 124 67 138 64" />
          </g>

          <ellipse className="nob-nose" cx="85.8" cy="97.3" rx="8.5" ry="8" />

          <g className="nob-anim knob-mouth nob-mouth">
            <path className="knob-mouth-line" d="M63 120 Q 84 119 106 122" />
            <path className="knob-mouth-flat" d="M63 122 L106 122" />
            <path className="knob-mouth-smile" d="M63 116 Q 85 134 107 115" />
            <path className="knob-mouth-frown" d="M63 125 Q 84 114 106 122" />
            <path className="knob-mouth-o" d="M79 121 Q 87 114 95 121 Q 87 129 79 121 Z" />
          </g>
        </g>
      </svg>
    </button>
  );
}
