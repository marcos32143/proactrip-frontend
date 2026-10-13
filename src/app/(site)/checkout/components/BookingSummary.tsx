// app/checkout/components/BookingSummary.tsx
'use client';

import Image from 'next/image';
import { CheckCircle, MapPin, Calendar, Users, Moon, Tag, Plane } from 'lucide-react';

// ==================== TIPO DE DATO UNIFICADO ====================
export interface CheckoutData {
  type: 'hotel' | 'vuelo' | 'plan' | 'experiencia';

  // Identificadores
  item_id: string;
  item_name: string;

  // Fechas y huéspedes (común a todos - ahora opcionales para flexibilidad)
  check_in?: string;          // Para hoteles: fecha entrada | Para vuelos: fecha salida
  check_out?: string;         // Para hoteles: fecha salida | Para vuelos: fecha regreso (opcional)
  adults: number;
  children?: number;
  infants?: number;
  nights?: number;            // Opcional: vuelos no tienen noches

  // Hotel específico (opcional)
  room_id?: string;
  room_name?: string;
  rooms?: number;
  hotel_address?: string;

  // Vuelo específico (nuevos campos opcionales)
  departure?: string;         // Código IATA origen (MAD)
  arrival?: string;           // Código IATA destino (LIM)
  outbound_date?: string;     // Fecha salida
  return_date?: string;       // Fecha regreso (si aplica)
  airline?: string;           // Nombre aerolínea

  // Precio (común)
  price_per_unit: number;
  total_price: number;
  currency: string;

  // Política (opcional para vuelos)
  cancellation_policy?: string;

  // Imagen (común)
  image?: string;
}

interface BookingSummaryProps {
  data: CheckoutData;
}

export default function BookingSummary({ data }: BookingSummaryProps) {
  const taxes = Math.round(data.total_price * 0.1);
  const grandTotal = data.total_price + taxes;

  // Etiqueta de unidad según tipo
  const unitLabel = () => {
    switch (data.type) {
      case 'hotel': return `${data.nights || 1} noche${(data.nights || 1) > 1 ? 's' : ''}`;
      case 'vuelo': return `${data.adults} pasajero${data.adults > 1 ? 's' : ''}`;
      case 'plan': return `${data.nights || 1} noche${(data.nights || 1) > 1 ? 's' : ''} · paquete completo`;
      case 'experiencia': return `${data.adults} persona${data.adults > 1 ? 's' : ''}`;
    }
  };

  // Badge de tipo
  const typeBadge = () => {
    const map = {
      hotel: { label: 'Hotel', color: 'bg-blue-100 text-blue-800' },
      vuelo: { label: 'Vuelo', color: 'bg-sky-100 text-sky-800' },
      plan: { label: 'Plan ProacTrip', color: 'bg-purple-100 text-purple-800' },
      experiencia: { label: 'Experiencia', color: 'bg-green-100 text-green-800' },
    };
    return map[data.type];
  };

  const badge = typeBadge();
  
  // Determinar fechas a mostrar según tipo
  const showCheckIn = data.check_in || data.outbound_date;
  const showCheckOut = data.check_out || data.return_date;

  return (
    <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">

      {/* Título */}
      <h3 className="text-lg font-bold text-gray-900 mb-4 pb-4 border-b border-gray-200">
        Resumen de reserva
      </h3>

      {/* Imagen + nombre */}
      <div className="mb-5">
        {data.image && (
          <div className="relative w-full h-36 rounded-lg overflow-hidden mb-3">
            <Image
              src={data.image}
              alt={data.item_name}
              fill
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="object-cover"
            />
          </div>
        )}

        {/* Badge de tipo */}
        <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold mb-2 ${badge.color}`}>
          {badge.label}
        </span>

        <p className="font-bold text-gray-900 text-base leading-tight">{data.item_name}</p>

        {/* Habitación (solo hoteles) */}
        {data.room_name && (
          <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-gray-400" />
            {data.room_name}
          </p>
        )}

        {/* Dirección (hoteles) o Ruta (vuelos) */}
        {data.type === 'hotel' && data.hotel_address && (
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {data.hotel_address}
          </p>
        )}
        
        {data.type === 'vuelo' && data.departure && data.arrival && (
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <Plane className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {data.departure} → {data.arrival}
            {data.airline && ` · ${data.airline}`}
          </p>
        )}
      </div>

      {/* Detalles de la reserva */}
      <div className="space-y-2.5 mb-5 pb-5 border-b border-gray-200">

        {/* Fechas - Check-in/Salida */}
        {showCheckIn && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-500">
              <Calendar className="w-4 h-4 text-gray-400" />
              {data.type === 'vuelo' ? 'Salida' : 'Check-in'}
            </span>
            <span className="font-medium text-gray-900">{showCheckIn}</span>
          </div>
        )}
        
        {/* Fechas - Check-out/Regreso */}
        {showCheckOut && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-500">
              <Calendar className="w-4 h-4 text-gray-400" />
              {data.type === 'vuelo' ? 'Regreso' : 'Check-out'}
            </span>
            <span className="font-medium text-gray-900">{showCheckOut}</span>
          </div>
        )}

        {/* Huéspedes/Pasajeros */}
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-gray-500">
            <Users className="w-4 h-4 text-gray-400" />
            {data.type === 'vuelo' ? 'Pasajeros' : 'Huéspedes'}
          </span>
          <span className="font-medium text-gray-900">
          {data.adults} adulto{data.adults > 1 ? 's' : ''}
          {data.children && data.children > 0 ? `, ${data.children} niño${data.children > 1 ? 's' : ''}` : ''}
          {data.infants && data.infants > 0 ? `, ${data.infants} bebé${data.infants > 1 ? 's' : ''}` : ''}
        </span>
        </div>

        {/* Noches (solo hoteles/planes) */}
        {data.nights && data.nights > 0 && data.type !== 'vuelo' && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-500">
              <Moon className="w-4 h-4 text-gray-400" />
              Duración
            </span>
            <span className="font-medium text-gray-900">{unitLabel()}</span>
          </div>
        )}

        {/* Habitaciones (solo hoteles con más de 1) */}
        {data.type === 'hotel' && data.rooms && data.rooms > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-500">
              <Tag className="w-4 h-4 text-gray-400" />
              Habitaciones
            </span>
            <span className="font-medium text-[--color-brand-500]">{data.rooms} habitaciones</span>
          </div>
        )}
      </div>

      {/* Desglose de precios */}
      <div className="space-y-2 mb-5 pb-5 border-b border-gray-200 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>
            {data.type === 'hotel' && data.nights
              ? `${data.currency} ${data.price_per_unit} × ${data.nights} noche${data.nights > 1 ? 's' : ''}`
              : `Precio base`}
          </span>
          <span>{data.currency} {data.total_price}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Tasas e impuestos (10%)</span>
          <span>{data.currency} {taxes}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
          <span>Total</span>
          <span className="text-[--color-brand-500]">{data.currency} {grandTotal}</span>
        </div>
      </div>

      {/* Política de cancelación */}
      {data.cancellation_policy && (
        <div className="flex items-start gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          <span className="text-green-700">{data.cancellation_policy}</span>
        </div>
      )}
    </div>
  );
}