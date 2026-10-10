"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { DESTINATIONS } from "@/app/lib/constants/destinations";
import DestinationCard from "@/components/home/DestinationCard";
import Navbar from "@/components/layout/Navbar";

export default function LandingPage() {
  const [currentId, setCurrentId] = useState(1);
  const [hasNavigated, setHasNavigated] = useState(false);
  const router = useRouter();

  const backgroundDestination = DESTINATIONS.find((d) => d.id === currentId)!;

  const visibleCards = DESTINATIONS.filter((d) => d.id !== currentId).sort(
    (a, b) => {
      const aIsGreater = a.id > currentId;
      const bIsGreater = b.id > currentId;
      if (aIsGreater === bIsGreater) return a.id - b.id;
      return aIsGreater ? -1 : 1;
    }
  );

  const handleCardSelect = useCallback((id: number) => {
    setHasNavigated(true);
    setCurrentId(id);
  }, []);

  const handleNext = useCallback(() => {
    setHasNavigated(true);
    setCurrentId((prev) => (prev === 7 ? 1 : prev + 1));
  }, []);

  const handlePrev = useCallback(() => {
    setHasNavigated(true);
    setCurrentId((prev) => (prev === 1 ? 7 : prev - 1));
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-neutral-950">
      <Navbar />

      {/* FULLSCREEN BACKGROUND */}
      <AnimatePresence mode="sync">
        <motion.div
          key={currentId}
          initial={hasNavigated ? { scale: 1.1, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          exit={hasNavigated ? { scale: 1.05, opacity: 0 } : undefined}
          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0"
        >
          <Image
            src={backgroundDestination.image}
            alt={backgroundDestination.name}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/70" />
        </motion.div>
      </AnimatePresence>

      {/* CONTENT LAYER */}
      <div className="relative z-10 h-full flex flex-col lg:flex-row">
        {/* LEFT — DESTINATION INFO (enlarged) */}
        <div className="flex-1 flex items-end lg:items-center px-6 pb-10 lg:pb-0 lg:pl-20 xl:pl-32 lg:pr-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentId}
              initial={hasNavigated ? { opacity: 0, y: 30 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={hasNavigated ? { opacity: 0, y: -30 } : undefined}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="w-full max-w-xl"
            >
              <span className="inline-block text-sm font-medium tracking-widest uppercase text-white/60 mb-4">
                {backgroundDestination.name}
              </span>

              <h1 suppressHydrationWarning className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-white leading-[0.9] tracking-tight mb-4">
                {backgroundDestination.place}
              </h1>

              <p className="text-white/75 text-base sm:text-lg leading-relaxed mb-10 max-w-lg line-clamp-3 sm:line-clamp-none">
                {backgroundDestination.description}
              </p>

              <button
                onClick={() => {
                  const prompt = `Vuelos y hoteles a ${backgroundDestination.place} en ${backgroundDestination.name}`;
                  router.push(
                    `/busqueda-ai?prompt=${encodeURIComponent(prompt)}`
                  );
                }}
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-white text-neutral-900 rounded-full text-base font-medium hover:bg-white/95 transition-all duration-200 cursor-pointer"
              >
                Descubrir destino
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT — IMAGE CARDS + CONTROLS (enlarged area) */}
        <div className="lg:w-[640px] xl:w-[860px] 2xl:w-[1000px] flex flex-col justify-end px-6 pb-8 lg:pb-14 lg:pr-12 xl:pr-16 gap-5">
          {/* DESTINATION CARDS ROW */}
          <div className="w-full overflow-x-auto hide-scrollbar lg:overflow-hidden">
            <div className="flex gap-4 lg:gap-5 lg:justify-end">
              <AnimatePresence mode="sync">
                {visibleCards.slice(0, 3).map((destination) => (
                  <DestinationCard
                    key={destination.id}
                    destination={destination}
                    onSelect={handleCardSelect}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* NAVIGATION CONTROLS */}
          <div className="flex items-center gap-5 lg:justify-end">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                className="w-12 h-12 lg:w-14 lg:h-14 2xl:w-16 2xl:h-16 flex items-center justify-center rounded-full bg-white/25 hover:bg-white/40 backdrop-blur-sm border border-white/40 transition-colors"
              >
                <ChevronLeft className="w-6 h-6 2xl:w-7 2xl:h-7 text-white" />
              </button>
              <button
                onClick={handleNext}
                className="w-12 h-12 lg:w-14 lg:h-14 2xl:w-16 2xl:h-16 flex items-center justify-center rounded-full bg-white/25 hover:bg-white/40 backdrop-blur-sm border border-white/40 transition-colors"
              >
                <ChevronRight className="w-6 h-6 2xl:w-7 2xl:h-7 text-white" />
              </button>
            </div>

            {/* PROGRESS BAR */}
            <div className="flex items-center gap-3 flex-1 lg:flex-none lg:w-48">
              <div className="relative flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="absolute top-0 left-0 h-full bg-white rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${(currentId / 7) * 100}%` }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
              <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-semibold tabular-nums">
                  {currentId}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
