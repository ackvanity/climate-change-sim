export class ThermalModel{
  S_0: number = 0; // solar constant
  S_SE: number = 0; // absorbed solar radiation
  S_SR: number = 0; // reflected solar radiation
  T_E: number = 0; // Earth temperature
  T_A: number = 0; // Atmospheric temperature
  R_EA: number = 0; // Radiation from Earth to atmosphere
  R_AE: number = 0; // Back-radiatin from atmosphere to Earth
  J_EA: number = 0; // Non-radiative conduction from Earth to atmosphere
  R_ES: number = 0; // Passed radiation from Earth to space
  R_AS: number = 0; // Atmospheric radiation to space

  error: number = 0; // Energy error for Earth and the atmosphere. Used as a minimized constraint
};

const sigma = 5.67E-8;

export function computeThermalModel({ S_0, albedo, epsilon, k} : { S_0: number, albedo: number, epsilon: number, k: number }, T_A: number, T_E: number ): ThermalModel {
  let model = new ThermalModel();

  // Solar energy
  model.S_0 = S_0;
  model.S_SR = S_0 * albedo / 4;
  model.S_SE = S_0 * (1-albedo) / 4;
  
  // Temperature
  model.T_E = T_E;
  model.T_A = T_A;

  // Solar irradiance
  model.R_EA = epsilon * sigma * model.T_E**4;
  model.R_ES = (1 - epsilon) * sigma * model.T_E**4;
  model.R_AE = sigma * epsilon * model.T_A**4;
  model.R_AS = sigma * epsilon * model.T_A**4;
  model.J_EA = k * (model.T_E - model.T_A);

  // Thermodynamic errors of:
  // 1: Earth
  const IN_E = model.S_SE + model.R_AE;
  const OUT_E = model.R_EA + model.R_ES + model.J_EA;

  const ERR_E = Math.abs(IN_E - OUT_E);

  // 2: Atmosphere
  const IN_A = model.R_EA + model.J_EA;
  const OUT_A = model.R_AE + model.R_AS;

  const ERR_A = Math.abs(IN_A - OUT_A);

  // 3: Whole System
  const IN_S = model.S_SE;
  const OUT_S = model.R_AS + model.R_ES;
  
  const ERR_S = Math.abs(IN_S - OUT_S);

  // console.log(model);
  model.error = ERR_E ** 2 + ERR_A ** 2 + ERR_S ** 2;

  return model;
}