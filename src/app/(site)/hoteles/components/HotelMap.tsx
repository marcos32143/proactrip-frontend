'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FrontendHotel } from '@/app/lib/types/hotel';

interface HotelMapProps {
  hotels: FrontendHotel[];
  center: { lat: number; lng: number };
}

function createPriceIcon(price: number, currencySymbol: string, active = false): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div
        class="map-price-marker${active ? ' is-active' : ''}"
        style="
          display:flex;
          align-items:center;
          justify-content:center;

          width:44px;
          height:44px;

          padding:0 14px;

          background:${active ? '#0A0A0A' : '#fff'};
          color:${active ? '#fff' : '#0A0A0A'};

          border-radius:999px;

          font-family:'DM Sans',system-ui,sans-serif;
          font-size:13px;
          font-weight:700;
          line-height:1;

          box-shadow:0 2px 10px rgba(0,0,0,0.18);

          white-space:nowrap;
          cursor:pointer;

          border:2px solid ${active ? '#0A0A0A' : 'transparent'};

          transition:
            background 0.2s ease,
            color 0.2s ease,
            transform 0.2s ease;

          transform-origin:center bottom;
        "
      >
        ${currencySymbol}${price}
      </div>
    `,
    iconSize: [60, 36],
    iconAnchor: [30, 18],
  });
}

export default function HotelMap({ hotels, center }: HotelMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const initializedRef = useRef(false);

  const currencySymbol = hotels[0]?.price?.currency || '€';

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || initializedRef.current) return;
    initializedRef.current = true;

    const map = L.map(mapContainer.current, {
      center: [center.lat, center.lng],
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: 'abc',
      maxZoom: 19,
    }).addTo(map);

    // Custom zoom control style
    const zoomCtrl = map.zoomControl;
    if (zoomCtrl) {
      const container = zoomCtrl.getContainer();
      if (container) {
        container.style.border = 'none';
        container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.18)';
      }
    }

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
      initializedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    // Add new markers
    hotels.forEach((hotel) => {
      if (!hotel.location?.coordinates) return;
      const { lat, lng } = hotel.location.coordinates;
      const price = hotel.price?.amount || 0;

      const marker = L.marker([lat, lng], {
        icon: createPriceIcon(price, currencySymbol),
        title: hotel.name,
      }).addTo(map);

      marker.bindPopup(`
        <strong style="font-family:'DM Sans',sans-serif;font-size:13px;">${hotel.name}</strong><br>
        <span style="font-size:12px;color:#888;">${hotel.location.city || ''}</span><br>
        <strong style="font-size:13px;">${currencySymbol}${price}</strong>
      `, { closeButton: false, maxWidth: 200 });

      // Hover interactions
      marker.on('mouseover', () => {
        marker.setIcon(createPriceIcon(price, currencySymbol, true));
      });
      marker.on('mouseout', () => {
        marker.setIcon(createPriceIcon(price, currencySymbol, false));
      });

      markersRef.current.set(hotel.id, marker);
    });

    // Fit bounds if we have results
    if (hotels.length > 0) {
      const bounds = L.latLngBounds(
        hotels
          .filter((h) => h.location?.coordinates)
          .map((h) => [h.location.coordinates!.lat, h.location.coordinates!.lng] as [number, number])
      );
      if (bounds.isValid()) {
        map.invalidateSize();
        map.fitBounds(bounds.pad(0.1));
      }
    }
  }, [hotels]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
