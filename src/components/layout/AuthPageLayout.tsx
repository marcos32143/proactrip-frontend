"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export interface AuthPageLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  variant?: "split" | "card";
  sideTitle?: string;
  sideSubtitle?: string;
  sideImageSrc?: string;
  backgroundSrc?: string;
  backHref?: string;
}

/**
 * Ceepii-styled auth page layout.
 *
 * Clean, minimal, modern. No heavy background images — just a soft neutral
 * gradient with a centered glass card. Split variant shows a side panel with
 * a travel image; card variant is a single centered card.
 */
export default function AuthPageLayout({
  children,
  title,
  subtitle,
  variant = "card",
  sideTitle,
  sideSubtitle,
  sideImageSrc = "/assets/loginRegister/login-side.png",
  // Imagen de fondo de toda la pagina. Cambia esta ruta por la imagen que quieras (carpeta public/).
  backgroundSrc = "/images/destinations/francia.jpg",
  backHref,
}: AuthPageLayoutProps) {
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-neutral-900">
      {/* Fondo: imagen a pantalla completa + capa oscura para que la tarjeta destaque */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${backgroundSrc})` }}
      />
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />

      {/* CENTERED CARD */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className={`relative z-10 w-full bg-white rounded-3xl shadow-xl border border-neutral-200/60 overflow-hidden ${
          variant === "split"
            ? "max-w-5xl flex flex-col md:flex-row min-h-[580px]"
            : "max-w-md"
        }`}
      >
        {/* SPLIT — Left side image panel */}
        {variant === "split" && (
          <div className="relative w-full md:w-1/2 min-h-[220px] md:min-h-full overflow-hidden bg-neutral-100">
            <motion.div
              initial={{ scale: 1.08, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${sideImageSrc})` }}
            />
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

            {(sideTitle || sideSubtitle) && (
              <div className="absolute inset-x-0 bottom-0 p-8 md:p-10">
                <h2
                  suppressHydrationWarning
                  className="animate-slide-up text-white text-2xl md:text-3xl font-semibold leading-tight tracking-tight"
                  style={{ animationDelay: "0.35s" }}
                >
                  {sideTitle && (
                    <span className="font-display block">
                      {sideTitle}
                    </span>
                  )}
                  {sideSubtitle && (
                    <span className="text-white/70 text-base font-normal block mt-1">
                      {sideSubtitle}
                    </span>
                  )}
                </h2>
              </div>
            )}
          </div>
        )}

        {/* CONTENT SIDE */}
        <div
          className={
            variant === "split"
              ? "w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center"
              : "p-8 sm:p-10"
          }
        >
          {/* BACK LINK */}
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-600 transition-colors mb-6 group"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </Link>
          )}

          {/* TITLE */}
          <div
            className={`animate-title-in ${variant === "split" ? "mb-8" : "mb-6"}`}
          >
            <h1
              suppressHydrationWarning
              className="font-display text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight mb-2"
            >
              {title}
            </h1>
            <p className="text-neutral-500 text-sm sm:text-base leading-relaxed">
              {subtitle}
            </p>
          </div>

          {children}
        </div>
      </motion.div>
    </main>
  );
}
