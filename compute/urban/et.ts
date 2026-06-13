// ============================================================
// Evapotranspiration — Priestley-Taylor + open-water bulk formula
// ============================================================
// Reference: Priestley & Taylor (1972); Penman (1948) open-water.
// All temperatures in Kelvin, pressures in kPa, fluxes in W m⁻².

/** Latent heat of vaporisation of water (J kg⁻¹) */
const LAMBDA = 2.45e6;

/** Psychrometric constant γ (kPa K⁻¹) at standard pressure */
const GAMMA = 0.066;

/** Priestley-Taylor coefficient α (dimensionless) */
const ALPHA_PT = 1.26;

/**
 * Saturation vapour pressure (kPa) via Clausius-Clapeyron.
 * Consistent with e_A in greenhouse/properties.ts.
 */
function satVapourPressure(T_K: number): number {
  const T_c = T_K - 273.15;
  return 0.61078 * Math.exp((17.27 * T_c) / (T_c + 237.3));
}

/**
 * Slope of the saturation vapour pressure curve Δ (kPa K⁻¹).
 * Δ = de_s/dT = e_s · 17.27 · 237.3 / (T_c + 237.3)²
 */
function slopeVapourPressure(T_K: number): number {
  const T_c = T_K - 273.15;
  const e_s = satVapourPressure(T_K);
  return e_s * (17.27 * 237.3) / (T_c + 237.3) ** 2;
}

/**
 * Priestley-Taylor latent heat flux (W m⁻²) for vegetated surfaces.
 *
 * Only the vegetated fraction f_veg contributes; bare surfaces return 0.
 *
 * @param T_surface - Surface temperature (K)
 * @param S_net     - Net available energy (W m⁻²):
 *                    S_absorbed + R_atm_down − R_surface_up
 * @param f_veg     - Vegetated fraction [0–1]
 */
export function computeET(
  T_surface: number,
  S_net: number,
  f_veg: number,
): number {
  if (f_veg <= 0 || S_net <= 0) return 0;

  const delta = slopeVapourPressure(T_surface);
  const L_ET  = ALPHA_PT * (delta / (delta + GAMMA)) * S_net / LAMBDA;

  return f_veg * Math.max(0, L_ET) * LAMBDA;
}

/**
 * Open-water evaporation latent heat flux (W m⁻²) using the
 * bulk aerodynamic / Penman approach.
 *
 * Water cells are assumed to be continuously replenished from
 * groundwater at T_reservoir, so they never run dry and their
 * surface is always at saturation vapour pressure.
 *
 * Flux = ρ_a · c_p · (e_s(T_water) − RH · e_s(T_A)) / (γ · r_a) · LAMBDA/c_p
 *      = (e_s(T_water) − e_A) / (γ · r_a) · LAMBDA
 *
 * where r_a is an aerodynamic resistance (s m⁻¹).  We use a fixed
 * r_a = 100 s/m, representative of still-to-light-wind conditions
 * over a lake surface (Monteith & Unsworth, 2008).
 *
 * @param T_water     - Water surface temperature (K), typically T_reservoir
 * @param T_A         - Atmospheric temperature (K)
 * @param RH          - Atmospheric relative humidity [0–1]
 * @returns Latent heat flux (W m⁻²), ≥ 0 (condensation not modelled)
 */
export function computeWaterEvaporation(
  T_water: number,
  T_A: number,
  RH: number,
): number {
  /** Air density × specific heat (J m⁻³ K⁻¹) at ~20 °C */
  const RHO_CP = 1200;
  /** Aerodynamic resistance (s m⁻¹) — calm lake surface */
  const R_A    = 100;

  const e_s_water = satVapourPressure(T_water);   // kPa at water surface
  const e_a       = RH * satVapourPressure(T_A);  // kPa of ambient air
  const vpd       = e_s_water - e_a;              // vapour pressure deficit

  if (vpd <= 0) return 0; // air already saturated — no net evaporation

  // Latent flux via bulk formula: L = ρ_a·c_p·VPD / (γ·r_a)
  // Units: (J m⁻³ K⁻¹ · kPa) / (kPa K⁻¹ · s m⁻¹)
  //      = J m⁻³ K⁻¹ · kPa · m s / (kPa K⁻¹)
  //      = J m⁻² s⁻¹ = W m⁻²   ✓
  return Math.max(0, (RHO_CP * vpd) / (GAMMA * R_A));
}
