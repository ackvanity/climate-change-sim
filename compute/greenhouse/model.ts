// Simulation features
// - Atmospheric reflection of solar radiation
// - Emissivity and Earth's reflection of solar radiation
// - Albedo calculation
// - High-accuracy calculation of atmospheric emissivity using water and CO2
//  - CO2 concentration
//  - Clausius-Clayperon for water
// - Non-radiative heat flow

import numeric from 'numeric';
import { ThermalModel, computeThermalModel } from "./thermal";
import { ThermalProperties, computeThermalProperties } from "./properties";

export default function computeClimateModel(C: number, S_0: number, r_A: number, r_E: number, RH: number): [ThermalModel, ThermalProperties] {
  S_0 = S_0 || 1350;
  r_A = r_A || 0.255;
  r_E = r_E || 0.102;
  RH = RH || 0.80;

  // Helpers
  let make_props = (T_A: number) => computeThermalProperties(T_A, C, S_0, r_E, r_A, RH);
  let make_model = ([T_E, T_A]: [number, number]) => computeThermalModel(make_props(T_A), T_A, T_E);

  // Solver
  const arr = numeric.uncmin(([T_E, T_A]: [number, number]) => make_model([T_E, T_A]).error, [288, 245]).solution;

  // Calculate final models
  let model = make_model(arr);
  let props = make_props(arr[1]);

  return [model, props];
}
