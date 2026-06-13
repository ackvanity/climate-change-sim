"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";

import computeClimateModel from "@/compute/greenhouse/model";
import {
  createUrbanHeatModel,
  MATERIALS,
  type UrbanHeatModel,
  type SurfaceMaterial,
} from "@/compute/urban/model";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeading,
  PopoverDescription,
  PopoverClose,
} from "@/components/tailgrids/core/popover";
import { Button } from "@/components/tailgrids/core/button";
import { Slider } from "@/components/tailgrids/core/slider";
import {
  ExperimentInterface,
  VariableUpdateEvent,
  ExperimentConfig,
  ExperimentContext,
  default as Experiment,
} from "@/components/experiment";

// ─────────────────────────────────────────────────────────────────────────────
// Speed modes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each mode controls how much simulated time elapses per animation frame.
 *
 * Slow  — 1 step × 60 s = 60 s / frame  → 1 simulated day ≈ 24 real minutes
 *          (24 h × 3600 s/h) / (60 s/frame × 60 frame/s) ≈ 24 min
 * Fast  — 30 steps × 300 s = 9000 s / frame → ≈ 1 simulated day per ~10 s
 *          86400 s / (9000 s/frame × 60 fps) ≈ 9.6 s / day
 */
type SpeedMode = "slow" | "fast";

const SPEED_CONFIG: Record<SpeedMode, { dt: number; stepsPerFrame: number; label: string; description: string }> = {
  slow: {
    dt:            24,
    stepsPerFrame:  1,
    label:         "🐢 Slow",
    description:   "1 day ≈ 1 min — watch the heat island build hour by hour",
  },
  fast: {
    dt:             72,
    stepsPerFrame:  10,
    label:         "⚡ Fast",
    description:   "1 day ≈ 2 sec — speedrun to steady state over several days",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GRID_N    = 100;   // cells per axis
const CELL_SIZE = 5;     // metres per cell

/** Seconds in one solar day */
const DAY_S = 86_400;

/** Cool groundwater / reservoir temperature (K) */
const T_RESERVOIR = 286;

/** Colour temperature range for the heatmap (K) */
const T_MIN = 270;
const T_MAX = 340;

/** Material palette */
const MATERIAL_PALETTE: Array<{
  key: keyof typeof MATERIALS;
  label: string;
  mapColor: string;
}> = [
  { key: "grass",    label: "Grass",    mapColor: "#4ade80" },
  { key: "forest",   label: "Forest",   mapColor: "#166534" },
  { key: "asphalt",  label: "Asphalt",  mapColor: "#44403c" },
  { key: "concrete", label: "Concrete", mapColor: "#a8a29e" },
  { key: "water",    label: "Water",    mapColor: "#38bdf8" },
];

const MATERIAL_RGB: Record<string, [number, number, number]> = {
  Grass:    [74,  222, 128],
  Forest:   [22,  101, 52 ],
  Asphalt:  [68,  64,  60 ],
  Concrete: [168, 162, 158],
  Water:    [56,  189, 248],
};

// ─────────────────────────────────────────────────────────────────────────────
// Experiment config  (left panel)
// ─────────────────────────────────────────────────────────────────────────────

function recompute(e: ExperimentInterface, v: VariableUpdateEvent) {
  e.set_variable(v.name, v.new_value);
  e.update_state(buildInitialState(e));
}

function buildInitialState(e: ExperimentInterface) {
  const C   = e.get_variable("C")   as number;
  const S_0 = e.get_variable("S_0") as number;
  const r_A = e.get_variable("r_A") as number;
  const r_E = e.get_variable("r_E") as number;
  const RH  = e.get_variable("RH")  as number;
  const [ghModel, ghProps] = computeClimateModel(C, S_0, r_A, r_E, RH);
  return { ghModel, ghProps, S_0, RH };
}

const experimentConfig: ExperimentConfig = {
  parameters: [
    {
      name: "C", label: "CO₂ concentration", unit: "ppm",
      type: "slider", value: 420, min: 200, max: 1000, step: 1,
      on_update: recompute,
    },
    {
      name: "S_0", label: "Solar constant", unit: "W/m²",
      type: "slider", value: 1350, min: 500, max: 2000, step: 1,
      on_update: recompute,
    },
    {
      name: "r_A", label: "Atmospheric reflectivity", unit: "ratio",
      type: "slider", value: 0.255, min: 0.05, max: 0.90, step: 0.001,
      on_update: recompute,
    },
    {
      name: "r_E", label: "Surface reflectivity (global)", unit: "ratio",
      type: "slider", value: 0.102, min: 0.05, max: 0.90, step: 0.001,
      on_update: recompute,
    },
    {
      name: "RH", label: "Relative humidity", unit: "ratio",
      type: "slider", value: 0.80, min: 0.05, max: 1.0, step: 0.01,
      on_update: recompute,
    },
  ],
  getInitialState: buildInitialState,
};

// ─────────────────────────────────────────────────────────────────────────────
// Canvas layer type
// ─────────────────────────────────────────────────────────────────────────────

type CanvasLayer = "simulation" | "landscape";

// ─────────────────────────────────────────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────────────────────────────────────────

function tempToRgb(T: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (T - T_MIN) / (T_MAX - T_MIN)));
  if (t < 0.5) {
    const s = t * 2;
    return [Math.round(s * 255), Math.round(s * 255), 255];
  }
  const s = (t - 0.5) * 2;
  return [255, Math.round((1 - s) * 255), Math.round((1 - s) * 255)];
}

function materialToRgb(name: string): [number, number, number] {
  return MATERIAL_RGB[name] ?? [128, 128, 128];
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulation clock  DD:HH:MM
// ─────────────────────────────────────────────────────────────────────────────

function formatSimTime(totalSeconds: number): string {
  const days    = Math.floor(totalSeconds / DAY_S);
  const hours   = Math.floor((totalSeconds % DAY_S) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return [days, hours, minutes].map(n => String(n).padStart(2, "0")).join(":");
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid Canvas
// ─────────────────────────────────────────────────────────────────────────────

interface GridCanvasProps {
  model: UrbanHeatModel;
  layer: CanvasLayer;
  selectedMaterial: SurfaceMaterial;
  brushSize: number;
  onCellHover: (x: number, y: number) => void;
  onCellClick: (x: number, y: number, material: SurfaceMaterial) => void;
  renderTick: number;
}

function GridCanvas({ model, layer, selectedMaterial, brushSize, onCellHover, onCellClick, renderTick }: GridCanvasProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const { nx, ny }   = model.config;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!imageDataRef.current || imageDataRef.current.width !== nx)
      imageDataRef.current = ctx.createImageData(nx, ny);
    const data = imageDataRef.current.data;
    for (let i = 0; i < nx * ny; i++) {
      const [r, g, b] = layer === "simulation"
        ? tempToRgb(model.cells[i].T)
        : materialToRgb(model.cells[i].material.name);
      const o = i * 4;
      data[o] = r; data[o+1] = g; data[o+2] = b; data[o+3] = 255;
    }
    ctx.putImageData(imageDataRef.current, 0, 0);
  }, [renderTick, model, layer, nx, ny]);

  const pointerToCell = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      cx: Math.floor(((e.clientX - rect.left) / rect.width)  * nx),
      cy: Math.floor(((e.clientY - rect.top)  / rect.height) * ny),
    };
  }, [nx, ny]);

  const paint = useCallback((cx: number, cy: number) => {
    for (let dy = -brushSize; dy <= brushSize; dy++)
      for (let dx = -brushSize; dx <= brushSize; dx++)
        if (dx*dx + dy*dy <= brushSize*brushSize)
          onCellClick(cx+dx, cy+dy, selectedMaterial);
  }, [brushSize, onCellClick, selectedMaterial]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { cx, cy } = pointerToCell(e);
    onCellHover(cx, cy);
    if (e.buttons === 1 && layer === "landscape") paint(cx, cy);
  }, [pointerToCell, onCellHover, layer, paint]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (layer !== "landscape") return;
    const { cx, cy } = pointerToCell(e);
    paint(cx, cy);
  }, [pointerToCell, layer, paint]);

  return (
    <canvas
      ref={canvasRef}
      width={nx} height={ny}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      className={`w-full h-full rounded-xl ${layer === "landscape" ? "cursor-crosshair" : "cursor-default"}`}
      style={{ imageRendering: "pixelated" }}
      aria-label={layer === "landscape" ? "Land-use map. Click or drag to paint." : "Temperature heatmap."}
      role="img"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic pill toggle
// ─────────────────────────────────────────────────────────────────────────────

function PillToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="inline-flex rounded-xl border border-popover-border bg-background-soft-200 p-0.5"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1 text-xs rounded-[10px] px-3 py-1.5 transition-colors
                      focus:outline-none focus:ring-2 focus:ring-primary-500
                      ${value === opt.value
                        ? "bg-primary-500 text-white font-semibold shadow-sm"
                        : "text-text-100 hover:text-title-50"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat pill
// ─────────────────────────────────────────────────────────────────────────────

function StatPill({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-background-soft-200 rounded-xl px-3 py-2 min-w-20">
      <span className="text-[10px] text-text-100 leading-tight">{label}</span>
      <span className="font-mono font-semibold text-sm text-title-50 leading-tight">{value}</span>
      <span className="text-[9px] text-text-100 leading-tight">{unit}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell Popover
// ─────────────────────────────────────────────────────────────────────────────

interface CellPopoverProps {
  x: number; y: number;
  model: UrbanHeatModel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMaterialSelect: (mat: SurfaceMaterial) => void;
}

function CellPopover({ x, y, model, open, onOpenChange, onMaterialSelect }: CellPopoverProps) {
  const { nx } = model.config;
  const cell   = x >= 0 && y >= 0 ? model.cells[y * nx + x] : null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild><span className="sr-only" aria-hidden /></PopoverTrigger>
      <PopoverContent className="w-64">
        <PopoverHeading>Cell ({x}, {y})</PopoverHeading>
        <PopoverDescription asChild>
          <div className="flex flex-col gap-3">
            {cell && (
              <div className="flex flex-col gap-1 text-xs">
                {(([
                  ["Temperature", `${cell.T.toFixed(2)} K / ${(cell.T - 273.15).toFixed(2)} °C`],
                  ["Material",    cell.material.name + (cell.material.is_open_water ? " (pinned to reservoir)" : "")],
                  ["S absorbed",  `${cell.S_absorbed.toFixed(1)} W/m²`],
                  ["R↑ surface",  `${cell.R_surface_up.toFixed(1)} W/m²`],
                  ["R↓ atm",      `${cell.R_atm_down.toFixed(1)} W/m²`],
                  ["J sensible",  `${cell.J_sensible.toFixed(1)} W/m²`],
                  ["L evap/ET",   `${cell.L_ET.toFixed(1)} W/m²`],
                  ["Q lateral",   `${cell.Q_lateral.toFixed(1)} W/m²`],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="shrink-0">{k}</span>
                    <span className="font-mono font-semibold text-right">{v}</span>
                  </div>
                )))}
                {cell.material.is_open_water && (
                  <p className="text-[10px] text-text-100 italic mt-1">
                    Water T is pinned to T_reservoir = {T_RESERVOIR} K.
                    Evaporation uses bulk aerodynamic formula (Penman).
                  </p>
                )}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-title-50 mb-1.5">Change material</p>
              <div className="flex flex-wrap gap-1.5">
                {MATERIAL_PALETTE.map(({ key, label, mapColor }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { onMaterialSelect(MATERIALS[key]); onOpenChange(false); }}
                    className="flex items-center gap-1.5 text-xs border border-popover-border rounded-lg
                               px-2 py-1 hover:bg-background-soft-200 transition-colors
                               focus:outline-none focus:ring-2 focus:ring-primary-500"
                    aria-label={`Set to ${label}`}
                  >
                    <span className="inline-block size-3 rounded-sm flex-shrink-0"
                          style={{ background: mapColor }} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PopoverDescription>
        <PopoverClose className="mt-4 text-xs underline">Close</PopoverClose>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Temperature legend
// ─────────────────────────────────────────────────────────────────────────────

function TempLegend() {
  const stops = Array.from({ length: 20 }, (_, i) => {
    const T = T_MIN + (i / 19) * (T_MAX - T_MIN);
    const [r, g, b] = tempToRgb(T);
    return `rgb(${r},${g},${b})`;
  });
  return (
    <div className="flex flex-col gap-1 w-full" aria-label="Temperature colour scale">
      <div className="h-3 w-full rounded-full"
           style={{ background: `linear-gradient(to right, ${stops.join(",")})` }} />
      <div className="flex justify-between text-[10px] text-text-100 font-mono">
        <span>{T_MIN} K</span>
        <span>{((T_MIN + T_MAX) / 2).toFixed(0)} K</span>
        <span>{T_MAX} K</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day/night indicator
// ─────────────────────────────────────────────────────────────────────────────

function DayNightIndicator({ simTimeSec }: { simTimeSec: number }) {
  const hourOfDay = (simTimeSec % DAY_S) / 3600;
  const isDay     = hourOfDay >= 6 && hourOfDay < 18;
  const cosTheta  = Math.max(0, Math.sin(((hourOfDay - 6) / 12) * Math.PI));
  return (
    <div className="flex items-center gap-2 text-xs text-text-100">
      <span className="text-lg leading-none" aria-hidden="true">{isDay ? "☀️" : "🌙"}</span>
      <div className="flex flex-col">
        <span>{isDay ? "Daytime" : "Night-time"}</span>
        <span className="font-mono text-[10px]">cos θ = {cosTheta.toFixed(3)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulation  (consumes ExperimentContext)
// ─────────────────────────────────────────────────────────────────────────────

function Simulation() {
  const state = React.useContext(ExperimentContext) as unknown as ReturnType<typeof buildInitialState>;
  const { ghModel, ghProps, S_0, RH } = state;

  const modelRef = useRef<UrbanHeatModel | null>(null);
  const rafRef   = useRef<number | null>(null);

  const [running,          setRunning]         = useState(false);
  const [renderTick,       setRenderTick]       = useState(0);
  const [simTime,          setSimTime]          = useState(0);
  const [speedMode,        setSpeedMode]        = useState<SpeedMode>("slow");
  const [layer,            setLayer]            = useState<CanvasLayer>("landscape");
  const [hoverCell,        setHoverCell]        = useState<{ x: number; y: number } | null>(null);
  const [popoverCell,      setPopoverCell]      = useState<{ x: number; y: number } | null>(null);
  const [popoverOpen,      setPopoverOpen]      = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<SurfaceMaterial>(MATERIALS.asphalt);
  const [brushSize,        setBrushSize]        = useState(1);
  const [stats, setStats] = useState({ T_mean: 288, T_max: 288, T_min: 288 });

  const popoverAnchorRef = useRef<HTMLDivElement | null>(null);

  // Keep speed config in a ref so the animation loop always reads the latest
  const speedRef = useRef(SPEED_CONFIG[speedMode]);
  useEffect(() => { speedRef.current = SPEED_CONFIG[speedMode]; }, [speedMode]);

  // ── Init model ────────────────────────────────────────────
  useEffect(() => {
    modelRef.current = createUrbanHeatModel({
      grid: {
        nx: GRID_N, ny: GRID_N, cell_size: CELL_SIZE,
        S_0, T_A: ghModel.T_A, epsilon: ghProps.epsilon,
        RH, T_reservoir: T_RESERVOIR,
      },
      defaultMaterial: MATERIALS.grass,
      T_init: ghModel.T_E,
    });

    // Default: 40×40 asphalt urban core
    const half = GRID_N / 2, r = 20;
    for (let y = half - r; y < half + r; y++)
      for (let x = half - r; x < half + r; x++)
        modelRef.current.setCell(x, y, MATERIALS.asphalt);

    setRenderTick(t => t + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync atmosphere ───────────────────────────────────────
  useEffect(() => {
    modelRef.current?.setAtmosphere(ghModel.T_A, ghProps.epsilon);
  }, [ghModel.T_A, ghProps.epsilon]);

  // ── Animation loop ────────────────────────────────────────
  useEffect(() => {
    if (!running) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }

    const tick = (frame_dt: number) => {
      console.log(frame_dt);
      const model = modelRef.current;
      if (!model) return;

      const { dt, stepsPerFrame } = speedRef.current;
      for (let i = 0; i < stepsPerFrame; i++) {
        const hourOfDay = (model.t % DAY_S) / 3600;
        model.step(dt, hourOfDay);
      }

      let sum = 0, tMin = Infinity, tMax = -Infinity;
      for (const cell of model.cells) {
        if(cell == undefined)console.log(model.cells);
        // Exclude pinned water cells from aggregate stats so we see land temps
        if (cell.material.is_open_water) continue;
        sum += cell.T;
        if (cell.T < tMin) tMin = cell.T;
        if (cell.T > tMax) tMax = cell.T;
      }
      const landCount = model.cells.filter(c => !c.material.is_open_water).length;
      setStats({
        T_mean: landCount > 0 ? sum / landCount : 288,
        T_min:  tMin === Infinity  ? 288 : tMin,
        T_max:  tMax === -Infinity ? 288 : tMax,
      });
      setSimTime(model.t);
      setRenderTick(t => t + 1);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running]);

  // ── Cell paint ────────────────────────────────────────────
  const handleCellClick = useCallback((x: number, y: number, mat: SurfaceMaterial) => {
    modelRef.current?.setCell(x, y, mat);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!hoverCell) return;
    setPopoverCell(hoverCell);
    setPopoverOpen(true);
  }, [hoverCell]);

  // ── Reset ─────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setRunning(false);
    const model = modelRef.current;
    if (!model) return;
    for (const cell of model.cells)
      cell.T = cell.material.is_open_water ? T_RESERVOIR : ghModel.T_E;
    (model as unknown as { t: number }).t = 0;
    setSimTime(0);
    setRenderTick(t => t + 1);
    setStats({ T_mean: ghModel.T_E, T_max: ghModel.T_E, T_min: ghModel.T_E });
  }, [ghModel.T_E]);

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* ── Atmosphere banner ──────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center justify-between
                      bg-background-soft-200 rounded-2xl px-5 py-3">
        <div className="flex flex-col">
          <span className="text-xs text-text-100">Atmosphere (from greenhouse model)</span>
          <span className="font-mono text-sm text-title-50">
            T_A = {ghModel.T_A.toFixed(2)} K &nbsp;·&nbsp; ε = {ghProps.epsilon.toFixed(4)}
            &nbsp;·&nbsp; T_reservoir = {T_RESERVOIR} K
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatPill label="T mean (land)" value={(stats.T_mean - 273.15).toFixed(1)} unit="°C" />
          <StatPill label="T max"         value={(stats.T_max  - 273.15).toFixed(1)} unit="°C" />
          <StatPill label="T min"         value={(stats.T_min  - 273.15).toFixed(1)} unit="°C" />
          <StatPill label="ΔT"            value={(stats.T_max - stats.T_min).toFixed(1)} unit="K" />
          <StatPill label="Sim clock"     value={formatSimTime(simTime)} unit="DD:HH:MM" />
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        {/* Left: playback + brush */}
        <div className="flex flex-wrap gap-3 items-center">
          <Button
            variant={running ? "danger" : "success"}
            appearance="fill" size="sm"
            onClick={() => setRunning(r => !r)}
            aria-pressed={running}
          >
            {running ? "⏸ Pause" : "▶ Run"}
          </Button>

          <Button variant="primary" appearance="outline" size="sm" onClick={handleReset}>
            ↺ Reset temps
          </Button>

          {/* Speed mode */}
          <PillToggle
            value={speedMode}
            onChange={v => setSpeedMode(v)}
            ariaLabel="Simulation speed"
            options={[
              { value: "slow", label: "🐢 Slow", title: SPEED_CONFIG.slow.description },
              { value: "fast", label: "⚡ Fast", title: SPEED_CONFIG.fast.description },
            ]}
          />

          {/* Brush */}
          <div className="flex items-center gap-2">
            <label htmlFor="brush-slider" className="text-xs text-text-100 whitespace-nowrap">
              Brush: {brushSize === 0 ? "1 cell" : `r = ${brushSize}`}
            </label>
            <Slider
              id="brush-slider"
              aria-label="Brush radius"
              defaultValue={1} minValue={0} maxValue={8} step={1}
              onChange={v => setBrushSize(v as number)}
              className="w-28"
            />
          </div>
        </div>

        {/* Right: day/night + layer switcher */}
        <div className="flex items-center gap-4">
          <DayNightIndicator simTimeSec={simTime} />
          <PillToggle
            value={layer}
            onChange={v => setLayer(v)}
            ariaLabel="Canvas overlay"
            options={[
              { value: "landscape",  label: "🗺 Landscape" },
              { value: "simulation", label: "🌡 Temperature" },
            ]}
          />
        </div>
      </div>

      {/* ── Speed mode description ──────────────────────────── */}
      <p className="text-[11px] text-text-100 italic -mt-3">
        {SPEED_CONFIG[speedMode].description}
      </p>

      {/* ── Material palette (landscape only) ──────────────── */}
      {layer === "landscape" && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Paint material">
          {MATERIAL_PALETTE.map(({ key, label, mapColor }) => {
            const isSelected = selectedMaterial === MATERIALS[key];
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedMaterial(MATERIALS[key])}
                className={`flex items-center gap-1.5 text-xs rounded-xl px-3 py-1.5 border transition-colors
                            focus:outline-none focus:ring-2 focus:ring-primary-500
                            ${isSelected
                              ? "border-primary-500 bg-primary-500/10 text-title-50 font-semibold"
                              : "border-popover-border bg-background-soft-200 text-text-100 hover:bg-background-soft-300"}`}
              >
                <span className="inline-block size-3 rounded-sm flex-shrink-0"
                      style={{ background: mapColor }} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Canvas ─────────────────────────────────────────── */}
      <div
        ref={popoverAnchorRef}
        className="relative w-full aspect-square rounded-xl overflow-hidden
                   border border-background-soft-400 bg-black"
        onContextMenu={handleContextMenu}
      >
        {modelRef.current && (
          <>
            <GridCanvas
              model={modelRef.current}
              layer={layer}
              selectedMaterial={selectedMaterial}
              brushSize={brushSize}
              onCellHover={(x, y) => setHoverCell({ x, y })}
              onCellClick={handleCellClick}
              renderTick={renderTick}
            />

            {/* Hover tooltip */}
            {hoverCell && modelRef.current && (() => {
              const cx   = Math.max(0, Math.min(hoverCell.x, GRID_N - 1));
              const cy   = Math.max(0, Math.min(hoverCell.y, GRID_N - 1));
              const cell = modelRef.current.cells[cy * GRID_N + cx];
              return (
                <div className="absolute bottom-2 left-2 pointer-events-none
                               bg-black/70 text-white text-[10px] font-mono px-2 py-1 rounded-lg">
                  ({hoverCell.x}, {hoverCell.y})
                  {layer === "simulation" && <> · {(cell.T - 273.15).toFixed(1)} °C</>}
                  {layer === "landscape"  && <> · {cell.material.name}</>}
                </div>
              );
            })()}

            {/* Right-click popover */}
            {popoverCell && (
              <CellPopover
                x={popoverCell.x} y={popoverCell.y}
                model={modelRef.current}
                open={popoverOpen}
                onOpenChange={setPopoverOpen}
                onMaterialSelect={mat => {
                  if (popoverCell) handleCellClick(popoverCell.x, popoverCell.y, mat);
                }}
              />
            )}
          </>
        )}
      </div>

      {/* ── Legend ─────────────────────────────────────────── */}
      {layer === "simulation" ? (
        <TempLegend />
      ) : (
        <div className="flex flex-wrap gap-3 text-[10px] text-text-100">
          {MATERIAL_PALETTE.map(({ label, mapColor }) => (
            <span key={label} className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm"
                    style={{ background: mapColor }} aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      )}

      {/* ── Hint ───────────────────────────────────────────── */}
      <p className="text-[10px] text-text-100 italic text-right">
        {layer === "landscape"
          ? "Left-click/drag to paint · Right-click for cell details & material toggle"
          : "Right-click any cell for full flux breakdown"}
      </p>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page root
// ─────────────────────────────────────────────────────────────────────────────

export default function UrbanHeatPage() {
  return (
    <React.Fragment>
      <h1 className="text-4xl text-gray-100 font-bold w-full text-center">
        Urban Heat Island
      </h1>
      <p className="w-full text-center pt-4">
        Explore how surface materials affect local temperatures. Atmospheric
        boundary conditions are derived from the greenhouse effect model. Paint
        materials, run the simulation in slow or fast mode, and watch heat
        redistribute through a realistic day–night cycle. Water bodies are
        continuously replenished from groundwater at {T_RESERVOIR} K and cool
        the city through evaporation.
      </p>
      <Experiment config={experimentConfig} className="flex flex-col w-full">
        <Simulation />
      </Experiment>
    </React.Fragment>
  );
}
