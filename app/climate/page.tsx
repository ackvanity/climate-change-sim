"use client";

import React, { useEffect } from "react";
import computeClimateModel from "@/compute/greenhouse/model";
import { Slider } from "@/components/tailgrids/core/slider";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeading,
  PopoverDescription,
  PopoverClose
} from "@/components/tailgrids/core/popover";


interface ExperimentInterface {
  get_variable(name: string): any
  set_variable(name: string, value: any): void

  update_state(state: any): void
}

class VariableUpdateEvent {
  name: string = "";
  old_value: any = undefined;
  new_value: any = undefined;
}

function getInitialState(e: ExperimentInterface) {
  return computeClimateModel(e.get_variable("C"), e.get_variable("S_0"), e.get_variable("r_A"), e.get_variable("r_E"), e.get_variable("RH"));
}

function computeExperimentState(e: ExperimentInterface) {
  e.update_state(computeClimateModel(e.get_variable("C"), e.get_variable("S_0"), e.get_variable("r_A"), e.get_variable("r_E"), e.get_variable("RH")));
  console.log(computeClimateModel(e.get_variable("C"), e.get_variable("S_0"), e.get_variable("r_A"), e.get_variable("r_E"), e.get_variable("RH"))[0].T_E)
}

function recompute_on_update(e: ExperimentInterface, v: VariableUpdateEvent) {
  e.set_variable(v.name, v.new_value);
  computeExperimentState(e);
}

const ExperimentConfig = {parameters: [
  {
    "name": "C",
    "label": "Carbon Dioxide concentration",
    "unit": "ppm",
    "type": "slider",
    "value": 420,
    "min": 200,
    "max": 1000,
    "step": 1,
    "on_update": recompute_on_update
  }, {
    "name": "S_0",
    "label": "Incoming Solar Intensity (Solar Constant)",
    "unit": "W/m^2",
    "type": "slider",
    "value": 1350,
    "min": 500,
    "max": 2000,
    "step": 1,
    "on_update": recompute_on_update
  }, {
    "name": "r_A",
    "label": "Reflectivity of atmosphere",
    "unit": "ratio",
    "type": "slider",
    "value": 0.255,
    "min": 0.1,
    "max": 0.9,
    "step": 0.001,
    "on_update": recompute_on_update
  }, {
    "name": "r_E",
    "label": "Reflectivity of Earth",
    "unit": "ratio",
    "type": "slider",
    "value": 0.102,
    "min": 0.1,
    "max": 0.9,
    "step": 0.001,
    "on_update": recompute_on_update
  }, {
    "name": "RH",
    "label": "Relative Humidity of Earth",
    "unit": "ratio",
    "type": "slider",
    "value": 0.8,
    "min": 0.6,
    "max": 1.0,
    "step": 0.01,
    "on_update": recompute_on_update
  }
]}

const ExperimentContext = React.createContext(computeClimateModel(420, 1350, 0.255, 0.102, 0.80));

function Field({ param, value, onchange } : { param: any, value: any, onchange: any }) {
  if(param["type"] === "slider") {

    return (
      <React.Fragment>
        <label id={param["name"]}>
          {param["label"]} ({param["unit"]})<br />
          {param["name"]} = {value}
        </label>

        <Slider defaultValue={param["value"]} minValue={param["min"]} maxValue={param["max"]} step={param["step"]} aria-labelledby={param["name"]} onChange={onchange}/>
      </React.Fragment>
    )
  }
}

function Experiment({children, ...props } : {children?: React.ReactNode, className?: string}) {
  let [variables, setVariables] = React.useState(Object.fromEntries(ExperimentConfig.parameters.map(v => [v.name, v.value])));
  let experimentState, setExperimentState: (arg0: any) => void;

  const experiment: ExperimentInterface = {
    get_variable(name) {
      return variables[name];
    },
    set_variable(name, value) {
      setVariables((v) => { v[name] = value; return v; })
    },
    update_state(state) {
      setExperimentState(state);
    }
  };

  [experimentState, setExperimentState] = React.useState(getInitialState(experiment));

  return (
    <article className="flex flex-row gap-16 m-12 h-full" >
      <section className="border-22 border-gray-900 p-8 rounded-4xl">
        {...ExperimentConfig.parameters.map(param => <Field param={param} value={variables[param.name]} onchange={(value: any) => { param.on_update(experiment, { name: param.name, old_value: variables[param.name], new_value: value}); experiment.set_variable(param.name, value) }} />)}
      </section>

      <section {...props} className={`border-22 border-gray-900 p-8 rounded-4xl ${props["className"] || ""}`}>
        <ExperimentContext value={experimentState}>
          {children}
        </ExperimentContext>
      </section>  
    </article>
  )
}

function Simulation() {
  const state = React.useContext(ExperimentContext);
  
  return (
    <React.Fragment>
      <div className="w-full text-center flex flex-row justify-center items-center h-3/8">
        <Popover>
          <PopoverTrigger className="text-gray-300 hover:text-gray-200 ease-in-out duration-100 text-lg font-bold">Space</PopoverTrigger>

          <PopoverContent>
            <PopoverDescription>
              <h3>Solar Intensity</h3>
              <span>Incident (S_0): {state[0].S_0.toFixed(2)}</span><br />
              <span>Absorbed by Earth (S_SE): {state[0].S_SE.toFixed(2)}</span><br />
              <span>Reflected into space (S_SR): {state[0].S_SR.toFixed(2)}</span><br />
              <span>Albedo of Earth: {state[1].albedo.toFixed(2)}</span><br />

              <h3>Earth radiation</h3>
              <span>From Earth: {state[0].R_ES.toFixed(2)}</span><br />
              <span>From atmosphere: {state[0].R_AS.toFixed(2)}</span><br />
            </PopoverDescription>

            <PopoverClose className="mt-4 text-sm underline">Close</PopoverClose>
          </PopoverContent>
      </Popover>
      </div>
      <div className="w-full bg-sky-500 pb-auto h-1/2 text-center flex flex-row justify-center items-center">
        <Popover>
          <PopoverTrigger className="text-gray-300 hover:text-gray-200 ease-in-out duration-100 text-lg font-bold">Atmosphere ({state[0].T_A.toFixed(2)} K)</PopoverTrigger>

          <PopoverContent>
            <PopoverDescription>
              <h3>Thermal properties</h3>
              <span>Water partial pressure (e_A): {state[1].e_A.toFixed(2)}</span><br />
              <span>Emissivity from CO_2 (epsilon_CO_2): {state[1].epsilon_co2.toFixed(2)}</span><br />
              <span>Emissivity from H_2O (epsilon_H_2O): {state[1].epsilon_h2o.toFixed(2)}</span><br />
              <span>Emissivity overlap (epsilon_overlap): {state[1].epsilon_overlap.toFixed(2)}</span><br />
              <span>Emissivity after adjustment (epsilon): {state[1].epsilon.toFixed(2)}</span><br />

              <h3>Heat flow</h3>
              <span>Radiation emitted into space (R_AS): {state[0].R_AS.toFixed(2)}</span><br />
              <span>Radiation trasmitted from Earth into space (R_ES): {state[0].R_ES.toFixed(2)}</span><br />
              <span>Radiation absorbed by atmosphere from Earth (R_EA): {state[0].R_EA.toFixed(2)}</span><br />
              <span>Radiation back-flow from atmosphere to Earth (R_AE): {state[0].R_AE.toFixed(2)}</span><br />
              <span>Non-radiative heat flow from Earth (J_EA): {state[0].J_EA.toFixed(2)}</span><br />
            </PopoverDescription>

            <PopoverClose className="mt-4 text-sm underline">Close</PopoverClose>
          </PopoverContent>
        </Popover>
      </div>
      <div className="w-full bg-teal-800 pb-auto h-1/8 text-center flex flex-row justify-center items-center">
              <Popover>
          <PopoverTrigger className="text-gray-300 hover:text-gray-200 ease-in-out duration-100 text-lg font-bold">Eaerth ({state[0].T_E.toFixed(2)} K)</PopoverTrigger>

          <PopoverContent>
            <PopoverDescription>
              <h3>Heat flow</h3>
              <span>Radiation emitted into space (R_AS): {state[0].R_ES.toFixed(2)}</span><br />
              <span>Radiation absorbed by atmosphere (R_EA): {state[0].R_EA.toFixed(2)}</span><br />
              <span>Radiation back-flow from atmosphere (R_AE): {state[0].R_AE.toFixed(2)}</span><br />
              <span>Non-radiative heat flow to atmosphere (J_EA): {state[0].J_EA.toFixed(2)}</span><br />
            </PopoverDescription>

            <PopoverClose className="mt-4 text-sm underline">Close</PopoverClose>
          </PopoverContent>
        </Popover></div>
    </React.Fragment>
  )
}

export default function Home() {
  return (
    <React.Fragment>
      <main className="w-full h-full p-12">
        <h1 className="text-4xl text-gray-100 font-bold w-full text-center">The Greenhouse Effect</h1>
        <p className="w-full text-center pt-4">The greenhouse effect occurs because the Earth's atmosphere traps a certain amount of heat inside, causing the Earth to heat up.</p>
        <Experiment className="flex flex-col w-full">
          <Simulation />
        </Experiment>
      </main>
    </React.Fragment>
  );
}
