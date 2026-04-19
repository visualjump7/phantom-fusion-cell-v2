"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import * as THREE from "three";

// Varied dark-gray strokes so the country borders read as a subtle wireframe
// rather than one flat color. Picked deterministically from a small palette.
const GRAY_SHADES = ["#3f3f46", "#52525b", "#71717a", "#4b5563", "#6b7280"];
function pickGrayShade(feature: unknown): string {
  // Stable hash on whatever string we can derive from the feature so each
  // country keeps its color across re-renders.
  const key = JSON.stringify(
    (feature as { properties?: { ISO_A3?: string; NAME?: string } } | null)?.properties ?? feature
  );
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return GRAY_SHADES[Math.abs(h) % GRAY_SHADES.length];
}

/**
 * Decorative rotating wireframe globe used as a background texture
 * behind the command page. Country polygon outlines on a black sphere.
 * Rendered fixed beneath the orbital UI.
 */

type GlobeMethods = {
  controls: () => {
    autoRotate: boolean;
    autoRotateSpeed: number;
    enableZoom: boolean;
    enablePan: boolean;
    enableRotate: boolean;
  };
  pointOfView: (pov: { lat?: number; lng?: number; altitude?: number }) => void;
};

type GlobeProps = {
  ref?: React.Ref<GlobeMethods>;
  width?: number;
  height?: number;
  backgroundColor?: string;
  showAtmosphere?: boolean;
  atmosphereColor?: string;
  atmosphereAltitude?: number;
  showGlobe?: boolean;
  globeImageUrl?: string | null;
  globeMaterial?: unknown;
  polygonsData?: unknown[];
  polygonCapColor?: (d: unknown) => string;
  polygonSideColor?: (d: unknown) => string;
  polygonStrokeColor?: (d: unknown) => string;
  polygonAltitude?: number;
  animateIn?: boolean;
};

const COUNTRIES_URL =
  "https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson";

export function BackgroundGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<GlobeMethods | null>(null);
  const [Globe, setGlobe] = useState<ComponentType<GlobeProps> | null>(null);
  const [countries, setCountries] = useState<unknown[]>([]);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Solid black sphere so only the polygon stroke lines read against it.
  // Created on the client only.
  const globeMaterial = useMemo(
    () =>
      typeof window === "undefined"
        ? null
        : new THREE.MeshBasicMaterial({ color: 0x000000 }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    import("react-globe.gl").then((m) => {
      if (!cancelled) {
        setGlobe(() => m.default as unknown as ComponentType<GlobeProps>);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(COUNTRIES_URL)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const features = (data?.features ?? []) as unknown[];
        setCountries(features);
      })
      .catch(() => {
        /* leave empty — globe will render blank sphere */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function measure() {
      const el = containerRef.current;
      if (!el) return;
      setSize({ w: el.clientWidth, h: el.clientHeight });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    // Slower rotation since we're much closer to the surface — keeps the
    // ground-track motion gentle, not dizzying.
    controls.autoRotateSpeed = 0.15;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = false;
    // Low-orbit / satellite-style POV: camera hovers just above the surface
    // looking down. The horizon curves at the edges of the viewport.
    // Initial camera: centered on the continental United States (Western
     // Hemisphere) so the page loads with the US facing the viewer. The
     // auto-rotate controls spin the globe from there.
    globeRef.current.pointOfView({ lat: 38, lng: -98, altitude: 0.66 });
  }, [Globe, countries]);

  return (
    <>
      {/* Full-screen black backdrop so the rest of the page stays dark. */}
      <div
        className="pointer-events-none fixed inset-0 -z-20 bg-black"
        aria-hidden
      />
      {/* Globe fills the full viewport, centered. */}
      <div
        ref={containerRef}
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        {Globe && size.w > 0 && size.h > 0 && (
          <div style={{ opacity: 0.7 }}>
            <Globe
              ref={(node: GlobeMethods | null) => {
                globeRef.current = node;
              }}
              width={size.w}
              height={size.h}
              backgroundColor="rgba(0,0,0,0)"
              showAtmosphere={false}
              showGlobe
              globeImageUrl={null}
              globeMaterial={globeMaterial}
              polygonsData={countries}
              polygonCapColor={() => "rgba(0,0,0,0)"}
              polygonSideColor={() => "rgba(0,0,0,0)"}
              polygonStrokeColor={pickGrayShade}
              polygonAltitude={0.005}
              animateIn={false}
            />
          </div>
        )}
      </div>
    </>
  );
}
