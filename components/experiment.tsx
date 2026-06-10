"use client";

import React from "react";
import { Slider } from "@/components/tailgrids/core/slider";

export interface ExperimentInterface {
  get_variable(name: string): any
  set_variable(name: string, value: any): void

  update_state(state: any): void
}

export class VariableUpdateEvent {
  name: string = "";
  old_value: any = undefined;
  new_value: any = undefined;
}

type Slider = {
  type: "slider",
  value: number,
  min: number,
  max: number,
  step: number
}

export type ExperimentParameter = {
  name: string
  label: string
  unit: string
  on_update: (e: ExperimentInterface, v: VariableUpdateEvent) => void
} & (Slider);

export type ExperimentConfig = {
  getInitialState: (e: ExperimentInterface) => any
  parameters: Array<ExperimentParameter>
}

export const ExperimentContext = React.createContext(undefined);

function Field({ param, value, onchange } : { param: ExperimentParameter, value: any, onchange: any }) {
  if(param.type === "slider") {

    return (
      <React.Fragment>
        <label id={param.name}>
          {param.label} ({param.unit})<br />
          {param.name} = {value}
        </label>

        <Slider defaultValue={param.value} minValue={param.min} maxValue={param.max} step={param.step} aria-labelledby={param.name} onChange={onchange}/>
      </React.Fragment>
    )
  }
}

export default function Experiment({children, config , ...props } : {children?: React.ReactNode, config: ExperimentConfig, className?: string}) {
  let [variables, setVariables] = React.useState(Object.fromEntries(config.parameters.map(v => [v.name, v.value])));
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

  [experimentState, setExperimentState] = React.useState(config.getInitialState(experiment));

  return (
    <article className="flex flex-col lg:flex-row gap-16 m-12 h-full" >
      <section className="border-22 border-gray-900 p-8 rounded-4xl">
        {...config.parameters.map(param => <Field param={param} value={variables[param.name]} onchange={(value: any) => { param.on_update(experiment, { name: param.name, old_value: variables[param.name], new_value: value}); experiment.set_variable(param.name, value) }} />)}
      </section>

      <section {...props} className={`border-22 border-gray-900 p-8 rounded-4xl ${props["className"] || ""}`}>
        <ExperimentContext value={experimentState}>
          {children}
        </ExperimentContext>
      </section>  
    </article>
  )
}