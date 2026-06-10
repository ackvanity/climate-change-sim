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
import { ExperimentInterface, VariableUpdateEvent, ExperimentConfig, ExperimentContext, default as Experiment } from "@/components/experiment";

function computeExperimentState(e: ExperimentInterface) {
  e.update_state(computeClimateModel(e.get_variable("C"), e.get_variable("S_0"), e.get_variable("r_A"), e.get_variable("r_E"), e.get_variable("RH")));
}

function recompute_on_update(e: ExperimentInterface, v: VariableUpdateEvent) {
  e.set_variable(v.name, v.new_value);
  computeExperimentState(e);
}

const config: ExperimentConfig = {
  parameters: [
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
      "min": 0.05,
      "max": 1.0,
      "step": 0.01,
      "on_update": recompute_on_update
    }
  ],
  getInitialState(e: ExperimentInterface) {
    return computeClimateModel(e.get_variable("C"), e.get_variable("S_0"), e.get_variable("r_A"), e.get_variable("r_E"), e.get_variable("RH"));
  }
}

// ── Arrow label pill ────────────────────────────────────────────────────────
// Renders a single labeled flow arrow.
// direction: "down" | "up"   — arrowhead orientation
interface FlowArrowProps {
  variable: string;
  value: number;
  direction: "down" | "up";
  colorClass: string;    // tailwind text color class for label
  strokeColor: string;   // raw CSS color for SVG stroke
}

function FlowArrow({ variable, value, direction, colorClass, strokeColor }: FlowArrowProps) {
  const shaft = direction === "down"
    ? { x1: 12, y1: 4, x2: 12, y2: 28 }
    : { x1: 12, y1: 28, x2: 12, y2: 4 };
  const head = direction === "down"
    ? "M6,22 L12,30 L18,22"
    : "M6,10 L12,2 L18,10";

  return (
    <div className="flex flex-col items-center gap-0.5 mx-1 sm:mx-2">
      <svg width="24" height="32" viewBox="0 0 24 32" fill="none"
           xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <line {...shaft} stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        <path d={head} stroke={strokeColor} strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className={`font-mono font-semibold text-[10px] sm:text-xs leading-tight ${colorClass}`}>
        {variable}
      </span>
      <span className="text-gray-400 text-[9px] sm:text-[11px] leading-tight whitespace-nowrap">
        {value.toFixed(1)} W/m²
      </span>
    </div>
  );
}

// ── Arrow band ───────────────────────────────────────────────────────────────
function ArrowBand({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex flex-row flex-wrap justify-center items-start gap-x-1 sm:gap-x-3 gap-y-2 py-3 px-2
                    bg-background-soft-200 border-y border-background-soft-400">
      {children}
    </div>
  );
}

// ── Zone label ───────────────────────────────────────────────────────────────
function ZoneLabel({ name, tempK, className, popoverContent }: {
  name: string;
  tempK?: number;
  className?: string;
  popoverContent: React.ReactNode;
}) {
  const tempC = tempK != null ? (tempK - 273.15).toFixed(1) : null;
  return (
    <Popover>
      <PopoverTrigger className={`flex flex-col items-center gap-1 group ${className ?? ""}`}>
        <span className="text-sm sm:text-base font-bold text-white-90
                         group-hover:text-white-100 transition-colors duration-100
                         underline decoration-dotted underline-offset-4">
          {name}
        </span>
        {tempK != null && (
          <span className="text-[10px] sm:text-xs font-mono bg-black/30 rounded-full px-2 py-0.5 text-gray-300">
            {tempK.toFixed(1)} K &nbsp;/&nbsp; {tempC} °C
          </span>
        )}
      </PopoverTrigger>
      {popoverContent}
    </Popover>
  );
}

// ── Simulation ───────────────────────────────────────────────────────────────
function Simulation() {
  const state = React.useContext(ExperimentContext);
  // @ts-expect-error: ts(2488)
  const [m, p] = state; // ThermalModel, ThermalProperties

  // Emissivity drives atmosphere visual opacity: clamp to [0.15, 0.85]
  const atmoOpacity = Math.min(0.85, Math.max(0.15, p.epsilon));

  return (
    <div className="w-full flex flex-col rounded-2xl overflow-hidden
                    border border-background-soft-400 text-white select-none">

      {/* ── SPACE zone ──────────────────────────────────────────────────── */}
      <div className="relative w-full min-h-20 sm:min-h-28 flex items-center justify-center px-4 py-4
                      bg-gradient-to-b from-[#020814] to-[#0a1628]">
        {/* subtle static star field */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {([
            [15,18],[28,8],[42,30],[55,12],[68,25],[80,6],[92,20],
            [8,45],[35,50],[60,40],[75,55],[90,38],[20,60],[50,65],
          ] as [number,number][]).map(([cx, cy], i) => (
            <div key={i}
                 className="absolute rounded-full bg-white"
                 style={{ left: `${cx}%`, top: `${cy}%`, width: 1.5, height: 1.5,
                          opacity: 0.5 + (i % 3) * 0.15 }} />
          ))}
        </div>

        <ZoneLabel
          name="Space"
          popoverContent={
            <PopoverContent>
              <PopoverHeading>Space</PopoverHeading>
              <PopoverDescription>
                <div className="flex flex-col gap-1 text-xs sm:text-sm">
                  <p className="text-text-100 font-semibold mt-1">Incoming solar</p>
                  <span>Solar constant (S₀): <b>{m.S_0.toFixed(2)} W/m²</b></span>
                  <span>Absorbed by Earth (S_SE): <b>{m.S_SE.toFixed(2)} W/m²</b></span>
                  <span>Reflected to space (S_SR): <b>{m.S_SR.toFixed(2)} W/m²</b></span>
                  <span>System albedo: <b>{p.albedo.toFixed(3)}</b></span>
                  <p className="text-text-100 font-semibold mt-2">Outgoing radiation</p>
                  <span>Earth → space (R_ES): <b>{m.R_ES.toFixed(2)} W/m²</b></span>
                  <span>Atmosphere → space (R_AS): <b>{m.R_AS.toFixed(2)} W/m²</b></span>
                </div>
              </PopoverDescription>
              <PopoverClose className="mt-4 text-xs underline">Close</PopoverClose>
            </PopoverContent>
          }
        />
      </div>

      {/* ── Space ↔ Atmosphere arrows ────────────────────────────────────── */}
      <ArrowBand>
        <FlowArrow variable="S_SE" value={m.S_SE} direction="down"
                   colorClass="text-yellow-300" strokeColor="#fde047" />
        <FlowArrow variable="S_SR" value={m.S_SR} direction="up"
                   colorClass="text-yellow-500" strokeColor="#eab308" />
        <FlowArrow variable="R_ES" value={m.R_ES} direction="up"
                   colorClass="text-orange-400" strokeColor="#fb923c" />
        <FlowArrow variable="R_AS" value={m.R_AS} direction="up"
                   colorClass="text-red-400" strokeColor="#f87171" />
      </ArrowBand>

      {/* ── ATMOSPHERE zone ──────────────────────────────────────────────── */}
      <div className="relative w-full min-h-28 sm:min-h-36 flex items-center justify-center px-4 py-4"
           style={{ background: `rgba(56, 130, 220, ${atmoOpacity})` }}>
        <span className="absolute top-2 right-3 text-[9px] sm:text-[10px] font-mono
                         text-sky-100/70 pointer-events-none">
          ε = {p.epsilon.toFixed(3)}
        </span>

        <ZoneLabel
          name="Atmosphere"
          tempK={m.T_A}
          popoverContent={
            <PopoverContent>
              <PopoverHeading>Atmosphere</PopoverHeading>
              <PopoverDescription>
                <div className="flex flex-col gap-1 text-xs sm:text-sm">
                  <p className="text-text-100 font-semibold mt-1">Emissivity</p>
                  <span>Water vapour pressure (e_A): <b>{p.e_A.toFixed(3)} kPa</b></span>
                  <span>CO₂ contribution (ε_CO₂): <b>{p.epsilon_co2.toFixed(4)}</b></span>
                  <span>H₂O contribution (ε_H₂O): <b>{p.epsilon_h2o.toFixed(4)}</b></span>
                  <span>Overlap correction (ε_overlap): <b>{p.epsilon_overlap.toFixed(4)}</b></span>
                  <span>Effective emissivity (ε): <b>{p.epsilon.toFixed(4)}</b></span>
                  <p className="text-text-100 font-semibold mt-2">Radiative fluxes</p>
                  <span>Absorbed from Earth (R_EA): <b>{m.R_EA.toFixed(2)} W/m²</b></span>
                  <span>Back-radiated to Earth (R_AE): <b>{m.R_AE.toFixed(2)} W/m²</b></span>
                  <span>Emitted to space (R_AS): <b>{m.R_AS.toFixed(2)} W/m²</b></span>
                  <span>Convective input (J_EA): <b>{m.J_EA.toFixed(2)} W/m²</b></span>
                </div>
              </PopoverDescription>
              <PopoverClose className="mt-4 text-xs underline">Close</PopoverClose>
            </PopoverContent>
          }
        />
      </div>

      {/* ── Atmosphere ↔ Earth arrows ─────────────────────────────────────── */}
      <ArrowBand>
        <FlowArrow variable="R_EA" value={m.R_EA} direction="up"
                   colorClass="text-orange-300" strokeColor="#fdba74" />
        <FlowArrow variable="R_AE" value={m.R_AE} direction="down"
                   colorClass="text-cyan-400" strokeColor="#22d3ee" />
        <FlowArrow variable="J_EA" value={m.J_EA} direction="up"
                   colorClass="text-green-400" strokeColor="#4ade80" />
      </ArrowBand>

      {/* ── EARTH zone ───────────────────────────────────────────────────── */}
      <div className="w-full min-h-20 sm:min-h-28 flex items-center justify-center px-4 py-4
                      bg-gradient-to-b from-teal-900 to-teal-950">
        <ZoneLabel
          name="Earth"
          tempK={m.T_E}
          popoverContent={
            <PopoverContent>
              <PopoverHeading>Earth's Surface</PopoverHeading>
              <PopoverDescription>
                <div className="flex flex-col gap-1 text-xs sm:text-sm">
                  <p className="text-text-100 font-semibold mt-1">Surface properties</p>
                  <span>Surface reflectivity (r_E): <b>{p.r_E.toFixed(3)}</b></span>
                  <span>Atmosphere reflectivity (r_A): <b>{p.r_A.toFixed(3)}</b></span>
                  <span>Conduction coeff. (k): <b>{p.k.toFixed(3)} W/m²/K</b></span>
                  <p className="text-text-100 font-semibold mt-2">Energy balance</p>
                  <span>Absorbed solar (S_SE): <b>{m.S_SE.toFixed(2)} W/m²</b></span>
                  <span>Absorbed back-radiation (R_AE): <b>{m.R_AE.toFixed(2)} W/m²</b></span>
                  <span>Emitted to atmosphere (R_EA): <b>{m.R_EA.toFixed(2)} W/m²</b></span>
                  <span>Emitted to space (R_ES): <b>{m.R_ES.toFixed(2)} W/m²</b></span>
                  <span>Convective loss (J_EA): <b>{m.J_EA.toFixed(2)} W/m²</b></span>
                </div>
              </PopoverDescription>
              <PopoverClose className="mt-4 text-xs underline">Close</PopoverClose>
            </PopoverContent>
          }
        />
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="w-full flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 py-3
                      bg-background-soft-300 text-[9px] sm:text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-300"/> Incoming solar
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"/> Reflected solar
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-400"/> Outgoing IR (Earth)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-red-400"/> Outgoing IR (atmo)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400"/> Back-radiation
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400"/> Convection
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <React.Fragment>
        <h1 className="text-4xl text-gray-100 font-bold w-full text-center">The Greenhouse Effect</h1>
        <p className="w-full text-center pt-4">The greenhouse effect occurs because the Earth's atmosphere traps a certain amount of heat inside, causing the Earth to heat up.</p>
        <Experiment config={config} className="flex flex-col w-full">
          <Simulation />
        </Experiment>
    </React.Fragment>
  );
}