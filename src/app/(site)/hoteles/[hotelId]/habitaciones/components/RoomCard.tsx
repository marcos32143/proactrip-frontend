'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Users, Maximize, BedDouble, CheckCircle, XCircle } from 'lucide-react';

interface RoomCardProps {
  room: {
    id: string;
    name: string;
    images: string[];
    beds: string;
    capacity: number;
    size: number; // m²
    amenities: string[];
    price: {
      amount: number;
      currency: string;
      total: number; // precio total (noches x precio)
      nights: number;
    };
    cancellation: {
      free: boolean;
      deadline?: string; // "hasta 24h antes"
    };
  };
  onSelect: (roomId: string) => void;
}

export default function RoomCard({ room, onSelect }: RoomCardProps) {
  const [currentImage, setCurrentImage] = useState(0);

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl hover:border-neutral-300 hover:shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition-all duration-[0.38s] ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden">
      <div className="grid grid-cols-12">

        {/* IMAGEN */}
        <div className="col-span-4 sm:col-span-3 relative">
          <div className="relative h-full min-h-[200px]">
            <Image
              src={room.images[currentImage]}
              alt={room.name}
              fill
              sizes="(max-width: 640px) 40vw, 25vw"
              unoptimized
              className="object-cover"
            />
            {room.images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentImage(p => (p - 1 + room.images.length) % room.images.length); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-sm cursor-pointer"
                  aria-label="Imagen anterior"
                >
                  <ChevronLeft className="w-4 h-4 text-neutral-700" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentImage(p => (p + 1) % room.images.length); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-sm cursor-pointer"
                  aria-label="Siguiente imagen"
                >
                  <ChevronRight className="w-4 h-4 text-neutral-700" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* INFO */}
        <div className="col-span-8 sm:col-span-6 p-4 sm:p-5">
          <h3 className="text-base sm:text-lg font-bold text-neutral-950 mb-3">{room.name}</h3>

          {/* Características */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-neutral-500 mb-4">
            <div className="flex items-center gap-1.5">
              <BedDouble className="w-4 h-4 text-neutral-400" />
              <span>{room.beds}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-neutral-400" />
              <span>Máx. {room.capacity} {room.capacity === 1 ? 'persona' : 'personas'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Maximize className="w-4 h-4 text-neutral-400" />
              <span>{room.size} m²</span>
            </div>
          </div>

          {/* Amenities */}
          <div className="flex flex-wrap gap-2 mb-4">
            {room.amenities.map((amenity) => (
              <span
                key={amenity}
                className="px-2.5 py-1 bg-neutral-100 text-neutral-600 text-xs rounded-full"
              >
                {amenity}
              </span>
            ))}
          </div>

          {/* Cancelación */}
          <div className="flex items-center gap-1.5 text-sm">
            {room.cancellation.free ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-green-700 font-medium">
                  Cancelación gratuita{room.cancellation.deadline ? ` hasta ${room.cancellation.deadline}` : ''}
                </span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-500 font-medium">No reembolsable</span>
              </>
            )}
          </div>
        </div>

        {/* PRECIO Y BOTÓN */}
        <div className="col-span-12 sm:col-span-3 p-4 sm:p-5 flex sm:flex-col flex-row items-center sm:items-end justify-between sm:justify-between border-t sm:border-t-0 sm:border-l border-neutral-100">
          <div className="sm:text-right">
            <p className="text-xs text-neutral-400 mb-0.5">{room.price.nights} noche{room.price.nights > 1 ? 's' : ''}</p>
            <p className="text-2xl sm:text-3xl font-bold text-neutral-950">
              {room.price.currency}{room.price.amount}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              Total: {room.price.currency}{room.price.total}
            </p>
          </div>

          <button
            onClick={() => onSelect(room.id)}
            className="bg-brand-500 text-white py-3 px-5 rounded-xl hover:bg-brand-600 active:scale-[0.97] transition-all duration-150 font-semibold text-sm cursor-pointer"
          >
            Seleccionar
          </button>
        </div>

      </div>
    </div>
  );
}