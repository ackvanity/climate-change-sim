# Climate Change Simulation

This project is a collection of climate-change-related simulations and resources. I strive to make the simulations as physically based as possible, but because this is a model some simplifications have been made.

## Simulations

### Greenhouse Effect (`/greenhouse`)

**Functionality**
- Simulates the effect of global warming due to icreasing CO2 levels using a relatively crude thermodynamic model based on the 2024 IPhO problem "Greenhouse Effect"
- Unlike the original system, which uses  a constant emissivity, this simulation also integrates the change in emissivity due to greenhouse gases, which vary according to temperature
- To handle the dynamics a numeric solver is used to minimize the energy imbalance for Earth and its atmosphere

**Limitations**
- The atmosphere is modelled as a simple layer of constant temperature, even though realistically the temperature varies as a function of height
- Currently only H2O and CO2 effects have been accounted for, and to adjust the temperature response it's multiplied by a numerical prefactor of `1.6`. In the future I may be able to reduce this by accounting for more gases

### Urban Heat Island (`/urban`)
- Simulates the effect of urban heat islands due to retention of heat by certain materials
- Uses a similar thermodynamic model as the greenhouse model but run at a higher resolution
- Adds simulation of heat retention and diffusion of heat across vast areas
- Diffusion constant is not physically accurate, although most other factors are physically based