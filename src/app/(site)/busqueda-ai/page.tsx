import type { Metadata } from 'next';
import BusquedaAIClientWrapper from './BusquedaAIClientWrapper';

export const metadata: Metadata = {
  title: 'Buscar con IA — Proactrip',
  description:
    'Buscá vuelos y hoteles usando lenguaje natural. Nuestra IA conversacional entiende lo que necesitás y te da los mejores resultados en tiempo real.',
  openGraph: {
    title: 'Buscar con IA — Proactrip',
    description:
      'Buscá vuelos y hoteles usando lenguaje natural. Nuestra IA conversacional entiende lo que necesitás y te da los mejores resultados en tiempo real.',
    type: 'website',
  },
  alternates: {
    canonical: '/busqueda-ai',
  },
};

export default function BusquedaAIPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Proactrip AI Search',
            url: 'https://proactrip.com/busqueda-ai',
            description:
              'Buscá vuelos y hoteles usando lenguaje natural. Nuestra IA entiende lo que necesitás.',
            applicationCategory: 'TravelApplication',
            operatingSystem: 'All',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'EUR',
            },
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate:
                  'https://proactrip.com/busqueda-ai?q={search_term_string}',
              },
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
            {process.env.NEXT_PUBLIC_AI_ENABLED === 'false' ? (
        <main className="flex min-h-[60vh] items-center justify-center px-6">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold">
              Búsqueda con IA no disponible en esta demo
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Esta función usa una API de pago que ahora mismo no está activa.
              El resto de ProacTrip (hoteles, vuelos, mapa y clima) funciona con normalidad.
            </p>
          </div>
        </main>
      ) : (
        <BusquedaAIClientWrapper />
      )}
    </>
  );
}
