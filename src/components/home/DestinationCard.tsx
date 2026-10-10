"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Destination } from "@/app/lib/types/destination";

interface DestinationCardProps {
  destination: Destination;
  onSelect: (id: number) => void;
}

export default function DestinationCard({ destination, onSelect }: DestinationCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      onClick={() => onSelect(destination.id)}
      className="relative w-44 h-60 sm:w-52 sm:h-72 lg:w-44 lg:h-60 xl:w-60 xl:h-80 2xl:w-72 2xl:h-[28rem] rounded-3xl overflow-hidden shadow-lg cursor-pointer group shrink-0"
    >
      <Image
        src={destination.image}
        alt={destination.name}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-5 xl:p-6">
        <p className="text-white/70 text-xs sm:text-sm font-medium uppercase tracking-wider mb-1">
          {destination.name}
        </p>
        <p className="text-white font-semibold text-lg sm:text-xl xl:text-2xl tracking-tight">
          {destination.place}
        </p>
      </div>
    </motion.div>
  );
}
