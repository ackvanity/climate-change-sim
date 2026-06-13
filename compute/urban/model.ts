// ============================================================
// Urban Heat Island — model
// ============================================================
// Implements a 2-D explicit finite-difference surface energy balance.
//
// Physics per cell (mirrors greenhouse/thermal.ts, single-layer blackbody):
//
//   dT/dt = (1 / C) · (S_absorbed + R_atm_down − R_surface_up
//                       − J_sensible − L_ET + Q_lateral)
//
// Special case — open water cells (is_open_water = true):
//   Temperature is pinned to config.T_reservoir each step, modelling
//   continuous groundwater replenishment.  Diagnostics (fluxes) are still
//   computed at T_reservoir so the popover shows physically meaningful values.
//   Evaporation uses the bulk aerodynamic formula (computeWaterEvaporation)
//   rather than Priestley-Taylor.
//
// where (non-water cells):
//   S_absorbed   = S_0 · cos(θ) · (1 − albedo)         [solar, W m⁻²]
//   R_surface_up = σ · T⁴                               [blackbody emission]
//   R_atm_down   = ε · σ · T_A⁴                        [atmospheric back-rad]
//   J_sensible   = k_surface · (T − T_A)                [sensible heat]
//   L_ET         = Priestley-Taylor (vegetation)         [latent heat]
//   Q_lateral    = Σ k_avg · (T_neighbour − T) / dx     [lateral conduction]
//
// Boundary conditions: periodic in x and y.
// Time integration: explicit forward Euler.

import { UrbanGridConfig, CellState, SurfaceMaterial, UrbanHeatModel } from "./types";
import { computeET, computeWaterEvaporation } from "./et";

// ── Physical constants ────────────────────────────────────────
const SIGMA = 5.67e-8; // Stefan-Boltzmann (W m⁻² K⁻⁴)

// ── Internal helpers ──────────────────────────────────────────

function idx(x: number, y: number, nx: number): number {
  return y * nx + x;
}

function wrap(v: number, n: number): number {
  return ((v % n) + n) % n;
}

function harmonicMean(a: number, b: number): number {
  if (a + b === 0) return 0;
  return (2 * a * b) / (a + b);
}

function makeCellState(material: SurfaceMaterial, T_init: number): CellState {
  return {
    T: T_init,
    material,
    S_absorbed: 0,
    R_surface_up: 0,
    R_atm_down: 0,
    J_sensible: 0,
    L_ET: 0,
    Q_lateral: 0,
  };
}

// ── Model implementation ──────────────────────────────────────

class UrbanHeatModelImpl implements UrbanHeatModel {
  readonly config: UrbanGridConfig;
  cells: CellState[];
  t: number = 0;

  constructor(config: UrbanGridConfig, cells: CellState[]) {
    this.config = config;
    this.cells  = cells;
  }

  setAtmosphere(T_A: number, epsilon: number): void {
    this.config.T_A      = T_A;
    this.config.epsilon  = epsilon;
  }

  setCell(x: number, y: number, material: SurfaceMaterial): void {
    const { nx, ny, T_reservoir } = this.config;
    x = wrap(x, nx);
    y = wrap(y, ny);
    const old = this.cells[idx(x, y, nx)];
    // const T   = material.is_open_water ? T_reservoir : old.T;
    const T = old.T
    this.cells[idx(x, y, nx)] = makeCellState(material, T);
  }

  getT(x: number, y: number): number {
    return this.cells[idx(x, y, this.config.nx)].T;
  }

  /**
   * Advance by dt seconds.
   *
   * @param dt         - Time step (s). Must satisfy stability criterion.
   * @param hourOfDay  - Current hour [0–24) used to compute solar zenith.
   *                     Defaults to 12 (solar noon) if omitted.
   */
  step(dt: number, hourOfDay: number = 12): void {
    const { nx, ny, cell_size, S_0, T_A, epsilon, RH, T_reservoir } = this.config;
    const cells = this.cells;
    const n     = nx * ny;

    // Solar zenith factor: max(0, sin(π·(h−6)/12)) for h ∈ [6,18], else 0
    const cosTheta = Math.max(
      0,
      Math.sin(((hourOfDay - 6) / 12) * Math.PI),
    );

    const dT = new Float64Array(n);

    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const i    = idx(x, y, nx);
        const cell = cells[i];
        const { material } = cell;

        // For water cells, use T_reservoir for all flux diagnostics
        const T = cell.T

        // ── Shortwave ─────────────────────────────────────
        const S_absorbed = S_0 * cosTheta * (1 - material.albedo);

        // ── Longwave (blackbody) ──────────────────────────
        const R_surface_up = SIGMA * T ** 4;
        const R_atm_down   = epsilon * SIGMA * T_A ** 4;

        // ── Sensible heat ─────────────────────────────────
        const J_sensible = material.k_surface * (T - T_A);

        // ── Latent heat ───────────────────────────────────
        let L_ET: number;
        if (material.is_open_water) {
          // Bulk aerodynamic evaporation; water always at saturation
          L_ET = computeWaterEvaporation(T, T_A, RH);
        } else {
          const S_net = S_absorbed + R_atm_down - R_surface_up;
          L_ET = computeET(T, S_net, material.f_veg);
        }

        // ── Lateral conduction (4-connected, periodic BC) ─
        const neighbours = [
          idx(wrap(x + 1, nx), y,           nx),
          idx(wrap(x - 1, nx), y,           nx),
          idx(x,               wrap(y + 1, ny), nx),
          idx(x,               wrap(y - 1, ny), nx),
        ];

        let Q_lateral = 0;
        for (const ni of neighbours) {
          const T_n = cells[ni].T;
          const k_n   = cells[ni].material.k_lateral;
          const k_eff = harmonicMean(material.k_lateral, k_n);
          Q_lateral  += (k_eff * (T_n - T)) / cell_size;
        }

        // ── Store diagnostics ─────────────────────────────
        cell.S_absorbed    = S_absorbed;
        cell.R_surface_up  = R_surface_up;
        cell.R_atm_down    = R_atm_down;
        cell.J_sensible    = J_sensible;
        cell.L_ET          = L_ET;
        cell.Q_lateral     = Q_lateral;

        const Q_net = S_absorbed + R_atm_down - R_surface_up
                      - J_sensible - L_ET + Q_lateral;
        dT[i] = (Q_net / material.heat_capacity) * dt;
      }
    }

    // Commit
    for (let i = 0; i < n; i++) {
      cells[i].T += dT[i];
      if (cells[i].material.is_open_water) {
        // cells[i].T = T_reservoir; // enforce pin
      }
    }

    this.t += dt;
  }
}

// ── Factory ───────────────────────────────────────────────────

export interface UrbanHeatModelConfig {
  grid: UrbanGridConfig;
  layout?: SurfaceMaterial[];
  defaultMaterial?: SurfaceMaterial;
  T_init?: number;
}

/**
 * Create and initialise an UrbanHeatModel.
 *
 * @example
 * ```ts
 * import { createUrbanHeatModel, MATERIALS } from "@/compute/urban/model";
 * import computeClimateModel from "@/compute/greenhouse/model";
 *
 * const [ghModel, ghProps] = computeClimateModel(422, 1350, 0.255, 0.102, 0.80);
 *
 * const urban = createUrbanHeatModel({
 *   grid: {
 *     nx: 100, ny: 100, cell_size: 5,
 *     S_0: 1350,
 *     T_A: ghModel.T_A,
 *     epsilon: ghProps.epsilon,
 *     RH: 0.80,
 *     T_reservoir: 286,  // cool groundwater
 *   },
 *   defaultMaterial: MATERIALS.grass,
 *   T_init: ghModel.T_E,
 * });
 * ```
 */
export function createUrbanHeatModel(config: UrbanHeatModelConfig): UrbanHeatModel {
  const { grid, layout, T_init = 288 } = config;
  const { nx, ny, T_reservoir } = grid;
  const n = nx * ny;

  const { MATERIALS: M } = require("./types") as typeof import("./types");
  const fallback: SurfaceMaterial = config.defaultMaterial ?? M.grass;

  if (layout && layout.length !== n) {
    throw new Error(`layout length (${layout.length}) must equal nx * ny (${n})`);
  }

  const cells: CellState[] = Array.from({ length: n }, (_, i) => {
    const material = layout ? layout[i] : fallback;
    const T = material.is_open_water ? T_reservoir : T_init;
    return makeCellState(material, T);
  });

  return new UrbanHeatModelImpl({ ...grid }, cells);
}

// Re-export for single-import convenience
export type { UrbanGridConfig, CellState, SurfaceMaterial, UrbanHeatModel };
export { MATERIALS } from "./types";
