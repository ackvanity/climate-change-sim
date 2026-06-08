export class ThermalProperties {
  albedo: number = 0;
  e_A: number = 0;
  epsilon_co2: number = 0;
  epsilon_h2o: number = 0;
  epsilon_overlap: number = 0;
  epsilon: number = 0;
  k: number = 0.361;

  // parameters used to generate properties
  C: number = 422;
  S_0: number = 1350;
  r_A: number = 0.255;
  r_E: number = 0.102;
  RH: number = 0.75;
}

export function computeThermalProperties(T_A: number, C: number, S_0: number, r_A: number, r_E: number, RH: number): ThermalProperties {
  let prop = new ThermalProperties();
  prop.S_0 = S_0;
  prop.r_A = r_A;
  prop.r_E = r_E;
  prop.RH = RH;
  prop.C = C;
  prop.albedo = r_A + (1 - r_A)**2 * r_E / (1 - r_A * r_E);

  // Emissivity of CO2
  prop.epsilon_co2 = 0.22 * (1 - Math.exp(-0.107 * C**0.47));

  // Emissivity of water vapor
  const T_c = T_A - 273.15;
  prop.e_A = 0.61078 * Math.exp(17.27 * T_c / (T_c + 273.3)) * RH;
  prop.epsilon_h2o = 1.24 * (prop.e_A / T_A) ** (1/7);
  
  // Overlap emissivity between CO2 and water vapor, parts of their absorption band overlap
  prop.epsilon_overlap = 0.085 * Math.log1p(0.16 * prop.e_A * (C / 300) ** 0.5);

  // Total emissivity
  let epsilon_0 = (prop.epsilon_co2 + prop.epsilon_h2o - prop.epsilon_overlap);

  // Fitting coefficient (a value of ~0.85 for 422 ppm is expected for this model, per the reference solution)
  prop.epsilon = epsilon_0 * 1.5;

  return prop;
}