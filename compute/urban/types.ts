// ============================================================
// Urban Heat Island — shared types
// ============================================================
// All temperatures in Kelvin, energy fluxes in W/m², time in seconds.

// ── Material library ─────────────────────────────────────────

/**
 * Physical properties of a surface material.
 *
 * @property albedo        - Shortwave reflectance [0–1]
 * @property k_surface     - Thermal conductance to overlying atmosphere
 *                           (W m⁻² K⁻¹), analogous to k in the greenhouse
 *                           model but allowed to vary per material
 * @property f_veg         - Vegetated fraction [0–1], drives Priestley-Taylor ET
 * @property is_open_water - True for water cells: temperature is pinned to
 *                           T_reservoir each step (groundwater replenishment),
 *                           and evaporation uses the bulk aerodynamic formula
 *                           rather than Priestley-Taylor.
 * @property heat_capacity - Effective volumetric heat capacity × depth
 *                           (J m⁻² K⁻¹). Ignored for water cells (T is pinned).
 * @property k_lateral     - In-plane thermal conductance between adjacent
 *                           cells (W m⁻¹ K⁻¹). Used for lateral diffusion.
 */
export interface SurfaceMaterial {
  readonly name: string;
  readonly albedo: number;
  readonly k_surface: number;
  readonly f_veg: number;
  readonly is_open_water: boolean;
  readonly heat_capacity: number;
  readonly k_lateral: number;
}

const NU = 15000;

/** Built-in material presets. */
export const MATERIALS = {
  asphalt: {
    name: "Asphalt",
    albedo: 0.04,
    k_surface: 0.50,
    f_veg: 0.00,
    is_open_water: false,
    heat_capacity: 1_200_000,
    k_lateral: 0.75 * NU,
  },
  concrete: {
    name: "Concrete",
    albedo: 0.30,
    k_surface: 0.45,
    f_veg: 0.00,
    is_open_water: false,
    heat_capacity: 10_000_000,
    k_lateral: 0.60 * NU,
  },
  grass: {
    name: "Grass",
    albedo: 0.25,
    k_surface: 0.35,
    f_veg: 0.80,
    is_open_water: false,
    heat_capacity: 800_000,
    k_lateral: 0.30 * NU,
  },
  forest: {
    name: "Forest",
    albedo: 0.15,
    k_surface: 0.30,
    f_veg: 1.00,
    is_open_water: false,
    heat_capacity: 900_000,
    k_lateral: 0.25 * NU,
  },
  water: {
    name: "Water",
    albedo: 0.06,
    k_surface: 0.60,
    f_veg: 0.00,
    is_open_water: true,
    heat_capacity: 4_000_000,  // unused — T is pinned to T_reservoir
    k_lateral: 0.60 * NU,
  },
} as const satisfies Record<string, SurfaceMaterial>;

export type MaterialKey = keyof typeof MATERIALS;

// ── Grid configuration ────────────────────────────────────────

/**
 * Configuration supplied once at model creation.
 * T_A and epsilon are mutable so setAtmosphere() can update them.
 *
 * @property nx          - Number of cells in x-direction
 * @property ny          - Number of cells in y-direction
 * @property cell_size   - Physical side length of each square cell (m)
 * @property S_0         - Solar constant (W m⁻²)
 * @property T_A         - Atmospheric temperature (K) from greenhouse model
 * @property epsilon     - Atmospheric emissivity from greenhouse model
 * @property RH          - Relative humidity [0–1]
 * @property T_reservoir - Groundwater / reservoir temperature (K).
 *                         Water cells are pinned to this value each step,
 *                         modelling continuous replenishment from below.
 *                         A reasonable default is 285–290 K (cool groundwater).
 */
export interface UrbanGridConfig {
  readonly nx: number;
  readonly ny: number;
  readonly cell_size: number;
  readonly S_0: number;
  T_A: number;
  epsilon: number;
  readonly RH: number;
  readonly T_reservoir: number;
}

// ── Per-cell state ────────────────────────────────────────────

/**
 * All quantities associated with a single grid cell.
 * Flat arrays inside UrbanHeatModel are indexed as [y * nx + x].
 */
export interface CellState {
  /** Surface temperature (K) */
  T: number;
  /** Material assigned to this cell */
  material: SurfaceMaterial;
  // ── Last time-step fluxes (W m⁻²) — populated after each step ──
  /** Absorbed shortwave solar radiation */
  S_absorbed: number;
  /** Longwave emission from surface upward */
  R_surface_up: number;
  /** Longwave back-radiation from atmosphere to surface */
  R_atm_down: number;
  /** Sensible (non-radiative) heat flux surface → atmosphere */
  J_sensible: number;
  /** Latent heat flux (ET for vegetation; bulk evaporation for water) */
  L_ET: number;
  /** Net lateral conductive flux received from neighbours */
  Q_lateral: number;
}

// ── Full model interface ──────────────────────────────────────

/**
 * The complete Urban Heat Island model.
 *
 * External rendering code reads:
 *   model.config          — grid geometry + atmosphere params
 *   model.cells[y*nx+x]   — per-cell state
 *   model.t               — elapsed simulation time (s)
 *
 * and calls:
 *   model.step(dt, hourOfDay)          — advance by dt seconds
 *   model.setAtmosphere(T_A, epsilon)  — update from greenhouse model
 *   model.setCell(x, y, material)      — repaint a tile interactively
 *   model.getT(x, y)                   — convenience temperature read
 */
export interface UrbanHeatModel {
  readonly config: UrbanGridConfig;
  cells: CellState[];
  t: number;
  step(dt: number, hourOfDay?: number): void;
  setAtmosphere(T_A: number, epsilon: number): void;
  setCell(x: number, y: number, material: SurfaceMaterial): void;
  getT(x: number, y: number): number;
}
