"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "@tailgrids/icons";
import {
  Card,
} from "@/components/tailgrids/core/card";
import Image from "next/image";

export default function Home() {
  return (
    <React.Fragment>
      <h1 className="text-4xl text-gray-100 font-bold w-full text-center">Climate Change simulations</h1>
      <p className="w-full text-center py-4">Explore simulations that explain the physics behind climate change, a pressing problem for us all to understand and solve.</p>
      <div className="flex flex-col gap-3 w-full max-w-92.5">
        <Card className="w-full flex flex-col overflow-hidden border-none shadow-none">
          <div className="relative w-full h-60">
            <Image
              src="/greenhouse.png"
              alt="The greenhouse effect simulation"
              fill
              className="object-cover"
            />
          </div>
          <div className="p-6">
            <h2 className="text-xl font-bold text-title-50 mb-2 leading-tight">
              Greenhouse Effect
            </h2>
            <p className="text-text-100 mb-6 text-sm leading-6">
              The atmosphere traps heat inside its atmosphere, increasing global temperatures. This causes runaway warming of the Earth.
            </p>
            <Link
              href="greenhouse"
              className="flex flex-row gap-1 hover:gap-4 w-full rounded-lg py-2.5 justify-left opacity-90 hover:opacity-100 duration-500 transition-ease-in-out"
            >
              Start Simulation
              <ChevronRight size={24} />
            </Link>
          </div>
        </Card>
      </div>
    </React.Fragment>
  );
}
