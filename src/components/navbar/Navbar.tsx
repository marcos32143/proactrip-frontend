"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { Menu, X, Building2, Sparkles, Plane } from "lucide-react";
import NavActions from "./NavActions";
import HotelsSearch from "./tabs/HotelsSearch";
import AISearch from "./tabs/AISearch";
import FlightsSearch from "./tabs/FlightsSearch";
import MobileDrawer from "./MobileDrawer";
import { MobileHotelsSearch, MobileFlightsSearch, MobileAISearch } from "./MobileSearchContent";
import Backdrop from "./Backdrop";
import { useEnvironment } from "@/hooks/useEnvironment";
import { getUserPreferences } from "@/app/lib/utils/location";

const TABS = [
  { id: "hoteles" as const, icon: Building2, label: "Hoteles" },
  { id: "ia" as const, icon: Sparkles, label: "IA" },
  { id: "vuelos" as const, icon: Plane, label: "Vuelos" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { environment } = useEnvironment();
  const urlParams = useSearchParams();

  // ─── STATE ──────────────────────────────────────
  const [isScrolled, setIsScrolled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  // ─── HYDRATION-SAFE validation state ───────────
  const [isHydrated, setIsHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional hydration guard
  useEffect(() => { setIsHydrated(true); }, []);

  // Hotels
  const [hotelDest, setHotelDest] = useState("");
  const [hotelDateRange, setHotelDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });
  const [adults, setAdults] = useState(2);
  const [childCount, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  // Flights
  const [flightOrigin, setFlightOrigin] = useState("");
  const [flightDest, setFlightDest] = useState("");
  const [flightDateRange, setFlightDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });

  // AI
  const [aiMessage, setAiMessage] = useState("");

  // ─── SCROLL ─────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ─── KEYBOARD ──────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ─── BODY SCROLL LOCK (desktop panel only; MobileDrawer handles its own) ──
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    document.body.style.overflow = expanded && isDesktop ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [expanded, isDesktop]);

  // ─── PRE-FILL STATE/REGION FROM ENVIRONMENT ──────
  useEffect(() => {
    if (!environment?.location?.state) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time pre-fill from env data */
    setHotelDest((prev) => prev || environment.location.state);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [environment?.location?.state]);

  // ─── DERIVED ──
  const isLandingPage = pathname === "/";
  const isHotelesRoute = pathname === "/hoteles" || pathname.startsWith("/hoteles?");
  const isVuelosRoute = pathname === "/vuelos" || pathname.startsWith("/vuelos?");
  const isBusquedaAIRoute = pathname === "/busqueda-ai" || pathname.startsWith("/busqueda-ai?");
  const isHero = isLandingPage && !isScrolled && !expanded;

  // ─── Pre-select tab based on route ──
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route-driven tab sync
    if (isVuelosRoute) setTabIndex(2);
    else if (isBusquedaAIRoute) setTabIndex(1);
    else if (isHotelesRoute) setTabIndex(0);
  }, [isVuelosRoute, isHotelesRoute, isBusquedaAIRoute]);

  // ─── TAB HANDLER ───────────────────────────────
  const handleTabChange = useCallback((index: number) => {
    setTabIndex(index);
    setExpanded(true);
  }, []);

  const handleTabClick = useCallback(
    (idx: number) => {
      const tabId = TABS[idx]?.id;
      const isVuelosTab = tabId === "vuelos";
      const isHotelesTab = tabId === "hoteles";
      const isAITab = tabId === "ia";

      const matchesCurrentRoute =
        (isVuelosTab && isVuelosRoute) || (isHotelesTab && isHotelesRoute) || (isAITab && isBusquedaAIRoute);

      if (matchesCurrentRoute) {
        setExpanded((prev) => !prev);
      } else {
        setTabIndex(idx);
        setExpanded(true);
      }
    },
    [isVuelosRoute, isHotelesRoute, isBusquedaAIRoute],
  );

  // ─── SEARCH VALIDATION ───────────────────────
  const isSearchValid = isHydrated
    ? (hotelDest.trim() !== '' && hotelDateRange.start !== null && hotelDateRange.end !== null)
    : true;

  // ─── GUESTS HANDLER ────────────────────────────
  const handleGuestsChange = useCallback(
    (type: "adults" | "children" | "infants", value: number) => {
      if (type === "adults") setAdults(value);
      else if (type === "children") setChildren(value);
      else setInfants(value);
    },
    [],
  );

  // ─── DATE RANGE ────────────────────────────────
  const handleDateRangeChange = useCallback(
    (start: Date | null, end: Date | null) => setHotelDateRange({ start, end }),
    [],
  );

  const handleFlightDateRangeChange = useCallback(
    (start: Date | null, end: Date | null) => setFlightDateRange({ start, end }),
    [],
  );

  // ─── SYNC NAVBAR STATE FROM URL (hoteles) ──
  const urlString = urlParams.toString();
  /* eslint-disable react-hooks/set-state-in-effect -- intentional URL→state sync */
  useEffect(() => {
    if (!isHotelesRoute) return;
    const q = urlParams.get('query');
    const ci = urlParams.get('check_in_date');
    const co = urlParams.get('check_out_date');
    const ad = urlParams.get('adults');
    const ch = urlParams.get('children');

    if (q) setHotelDest(q);
    if (ci) {
      setHotelDateRange({
        start: new Date(ci + 'T00:00:00'),
        end: co ? new Date(co + 'T00:00:00') : null,
      });
    }
    if (ad) setAdults(parseInt(ad, 10));
    if (ch) setChildren(parseInt(ch, 10));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHotelesRoute, urlString]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── SYNC NAVBAR STATE FROM URL (vuelos) ──
  /* eslint-disable react-hooks/set-state-in-effect -- intentional URL→state sync */
  useEffect(() => {
    if (!isVuelosRoute) return;
    const orig = urlParams.get('origen');
    const dest = urlParams.get('destino');
    const fi = urlParams.get('fecha_ida');
    const fv = urlParams.get('fecha_vuelta');
    const ad = urlParams.get('adults');
    const ch = urlParams.get('children');

    if (orig) setFlightOrigin(orig);
    if (dest) setFlightDest(dest);
    if (ad) setAdults(parseInt(ad, 10));
    if (ch) setChildren(parseInt(ch, 10));
    if (fi) {
      setFlightDateRange({
        start: new Date(fi + 'T00:00:00'),
        end: fv ? new Date(fv + 'T00:00:00') : null,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVuelosRoute, urlString]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── SEARCH ACTIONS ────────────────────────────
  const handleHotelSearch = useCallback(() => {
    const dest = hotelDest.trim();

    if (!dest) {
      setValidationMessage('Ingresá un destino');
      return;
    }

    if (!hotelDateRange.start || !hotelDateRange.end) {
      setValidationMessage('Seleccioná las fechas de tu viaje');
      return;
    }

    setValidationMessage(null);

    const params = new URLSearchParams();
    params.set("query", dest);
    params.set("check_in_date", hotelDateRange.start.toISOString().split("T")[0]);
    params.set("check_out_date", hotelDateRange.end.toISOString().split("T")[0]);
    if (adults > 0) params.set("adults", String(adults));
    if (childCount > 0) params.set("children", String(childCount));
    const prefs = getUserPreferences();
    if (prefs.currency) params.set("currency", prefs.currency);
    if (prefs.hl) params.set("hl", prefs.hl);
    if (prefs.gl) params.set("gl", prefs.gl);
    setExpanded(false);
    setMobileMenuOpen(false);
    router.push(`/hoteles?${params.toString()}`);
  }, [hotelDest, hotelDateRange, adults, childCount, router]);

  const handleFlightSearch = useCallback(() => {
    setMobileMenuOpen(false);
    const params = new URLSearchParams();
    if (flightOrigin) params.set("origen", flightOrigin);
    if (flightDest) params.set("destino", flightDest);
    if (flightDateRange.start) params.set("fecha_ida", flightDateRange.start.toISOString().split("T")[0]);
    if (flightDateRange.end) params.set("fecha_vuelta", flightDateRange.end.toISOString().split("T")[0]);
    const prefs = getUserPreferences();
    if (prefs.currency) params.set("currency", prefs.currency);
    if (prefs.hl) params.set("hl", prefs.hl);
    if (prefs.gl) params.set("gl", prefs.gl);
    setExpanded(false);
    router.push(`/vuelos?${params.toString()}`);
  }, [flightOrigin, flightDest, flightDateRange, router]);

  const handleAiSend = useCallback(() => {
    if (!aiMessage.trim()) return;
    const query = aiMessage.trim();
    setAiMessage("");
    setExpanded(false);
    setMobileMenuOpen(false);
    router.push(`/busqueda-ai?q=${encodeURIComponent(query)}`);
  }, [aiMessage, router]);

  const handleMobileClear = useCallback(() => {
    const activeTab = TABS[tabIndex];
    switch (activeTab.id) {
      case "hoteles":
        setHotelDest("");
        setHotelDateRange({ start: null, end: null });
        break;
      case "vuelos":
        setFlightOrigin("");
        setFlightDest("");
        setFlightDateRange({ start: null, end: null });
        break;
      case "ia":
        setAiMessage("");
        break;
    }
    setAdults(2);
    setChildren(0);
    setInfants(0);
    setValidationMessage(null);
  }, [tabIndex]);

  const handleMobileSearch = useCallback(() => {
    const activeTab = TABS[tabIndex];
    switch (activeTab.id) {
      case "hoteles":
        handleHotelSearch();
        break;
      case "vuelos":
        handleFlightSearch();
        break;
      case "ia":
        handleAiSend();
        break;
    }
  }, [tabIndex, handleHotelSearch, handleFlightSearch, handleAiSend]);

  // ─── RENDER ─────────────────────────────────────
  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-[950]"
      >
        <TabGroup selectedIndex={tabIndex} onChange={handleTabChange}>
          {/* ── NAVBAR STRIP ── */}
          <div
            className={`relative z-20 h-[72px] flex items-center justify-between px-4 sm:px-6 lg:px-8 transition-colors duration-300 ${
              isHero ? "bg-transparent" : "bg-white shadow-sm border-b border-neutral-100"
            }`}
          >
            {/* LEFT — LOGO */}
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0"
            >
              <Image
                src="/logoMostrar.png"
                alt="ProacTrip"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                priority
              />
              <span
                className={`text-lg font-semibold tracking-tight transition-colors duration-300 ${
                  isHero ? "text-white" : "text-[#0A0A0A]"
                }`}
              >
                ProacTrip
              </span>
            </Link>

            {/* CENTER — TABS (desktop only) */}
            <TabList className="hidden lg:flex items-center gap-1.5">
              {TABS.map((tab, idx) => {
                const Icon = tab.icon;
                return (
                  <Tab
                    key={tab.id}
                    onClick={() => handleTabClick(idx)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 outline-none cursor-pointer ${
                      isHero
                        ? `text-white/80 data-[hover]:bg-white/15 data-[hover]:text-white data-[focus]:ring-2 data-[focus]:ring-white/30 ${expanded ? 'data-[selected]:bg-[#111] data-[selected]:text-white' : ''}`
                        : `text-[#888] data-[hover]:bg-[#f5f5f5] data-[hover]:text-[#111] data-[focus]:ring-2 data-[focus]:ring-[#e5e5e5] ${expanded ? 'data-[selected]:bg-[#111] data-[selected]:text-white' : ''}`
                    }`}
                  >
                    <Icon className="w-[17px] h-[17px]" />
                    {tab.label}
                  </Tab>
                );
              })}
            </TabList>

            {/* RIGHT — Actions (desktop) */}
            <div className="hidden lg:flex items-center gap-2">
              <NavActions isLanding={isHero} />
            </div>

            {/* RIGHT — Mobile: NavActions + Hamburger */}
            <div className="flex lg:hidden items-center gap-1.5">
              <NavActions isLanding={isHero} />
              <div className="w-px h-6 bg-current opacity-15 mx-1" />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                  isHero
                    ? "text-white hover:bg-white/10"
                    : "text-[#0A0A0A] hover:bg-[#F5F5F5]"
                }`}
                aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* ── DESKTOP SEARCH PANEL ── */}
          <div className="hidden lg:block">
            <div className={`search-panel ${expanded ? "is-open" : ""}`}>
              <div className="max-w-4xl mx-auto search-panel-content">
                {validationMessage && (
                  <div className="mb-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                    <span>{validationMessage}</span>
                    <button
                      onClick={() => setValidationMessage(null)}
                      className="ml-3 text-amber-600 hover:text-amber-800"
                      aria-label="Cerrar aviso"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <TabPanels>
                  <TabPanel>
                    <HotelsSearch
                      destination={hotelDest}
                      onDestinationChange={setHotelDest}
                      dateRange={hotelDateRange}
                      onDateRangeChange={handleDateRangeChange}
                      adults={adults}
                      childCount={childCount}
                      infants={infants}
                      onGuestsChange={handleGuestsChange}
                      onSearch={handleHotelSearch}
                      isValid={isSearchValid}
                    />
                  </TabPanel>
                  <TabPanel>
                    <AISearch
                      message={aiMessage}
                      onMessageChange={setAiMessage}
                      chat={[]}
                      onSend={handleAiSend}
                    />
                  </TabPanel>
                  <TabPanel>
                    <FlightsSearch
                      origin={flightOrigin}
                      onOriginChange={setFlightOrigin}
                      dest={flightDest}
                      onDestChange={setFlightDest}
                      adults={adults}
                      childCount={childCount}
                      infants={infants}
                      onGuestsChange={handleGuestsChange}
                      onSearch={handleFlightSearch}
                      dateRange={flightDateRange}
                      onDateRangeChange={handleFlightDateRangeChange}
                    />
                  </TabPanel>
                </TabPanels>
              </div>
            </div>
          </div>
        </TabGroup>
      </header>

      {/* ── DESKTOP BACKDROP ── */}
      <Backdrop
        isVisible={expanded}
        onClick={() => setExpanded(false)}
      />

      {/* ── MOBILE DRAWER (Stitch-style) ── */}
      <MobileDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        activeTab={tabIndex}
        onTabChange={(idx) => {
          setTabIndex(idx);
          setValidationMessage(null);
        }}
        onClear={handleMobileClear}
        onSearch={handleMobileSearch}
        searchLabel={TABS[tabIndex].id === "ia" ? "Preguntar" : "Buscar"}
      >
        {/* Tab-based search content — mobile-optimized vertical cards */}
        {tabIndex === 0 && (
          <>
            <MobileHotelsSearch
              destination={hotelDest}
              onDestinationChange={setHotelDest}
              dateRange={hotelDateRange}
              onDateRangeChange={handleDateRangeChange}
              adults={adults}
              childCount={childCount}
              infants={infants}
              onGuestsChange={handleGuestsChange}
            />
            {validationMessage && (
              <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
                {validationMessage}
              </div>
            )}
          </>
        )}

        {tabIndex === 1 && (
          <MobileAISearch
            message={aiMessage}
            onMessageChange={setAiMessage}
          />
        )}

        {tabIndex === 2 && (
          <MobileFlightsSearch
            origin={flightOrigin}
            onOriginChange={setFlightOrigin}
            dest={flightDest}
            onDestChange={setFlightDest}
            dateRange={flightDateRange}
            onDateRangeChange={handleFlightDateRangeChange}
            adults={adults}
            childCount={childCount}
            infants={infants}
            onGuestsChange={handleGuestsChange}
          />
        )}
      </MobileDrawer>
    </>
  );
}
