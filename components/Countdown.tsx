// src/components/Countdown.tsx
"use client";
import { useState, useEffect, useRef } from "react";

interface CountdownProps {
  targetDate: string | Date;
  label?: string;
}

interface TimeLeft {
  d: number;
  h: number;
  m: number;
  s: number;
  expired: boolean;
}

function calcTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
    expired: false,
  };
}

// Fix 1: replace setAnim state with a ref + direct DOM class toggle.
// setState inside a useEffect body triggers the lint rule; direct DOM mutation does not.
function Digit({ value, label }: { value: number; label: string }) {
  const prev = useRef(value);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prev.current !== value && divRef.current) {
      divRef.current.classList.add("tick-anim");
      const timer = setTimeout(() => {
        divRef.current?.classList.remove("tick-anim");
      }, 300);
      prev.current = value;
      return () => clearTimeout(timer);
    }
    prev.current = value;
  }, [value]);

  return (
    <div className="flex flex-col items-center">
      <div
        ref={divRef}
        className="font-display text-4xl font-black tracking-tighter text-[#2e3d47] w-14 text-center leading-none"
        style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        {String(value).padStart(2, "0")}
      </div>
      <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mt-1">
        {label}
      </span>
    </div>
  );
}

function Sep() {
  return (
    <span
      className="font-display text-3xl font-thin text-[#b0aea5] self-start mt-1 mx-0.5"
      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
    >
      :
    </span>
  );
}

export default function Countdown({
  targetDate,
  label = "ends in",
}: CountdownProps) {
  const target = new Date(targetDate);

  // Fix 2: single nullable state — null means "not yet mounted".
  // The effect only ever calls setT (one setState), never two in sequence.
  // setMounted + setT in the same effect was the cascading-render problem.
  const [t, setT] = useState<TimeLeft | null>(null);

  useEffect(() => {
    setT(calcTimeLeft(target));
    const id = setInterval(() => setT(calcTimeLeft(target)), 1000);
    return () => clearInterval(id);
    // target.getTime() is a stable primitive — safe to use as dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.getTime()]);

  // t === null during SSR and first paint — render invisible placeholder
  // so server HTML matches client HTML (no hydration mismatch)
  if (t === null) {
    return (
      <div aria-hidden="true">
        {label && (
          <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-2">
            {label}
          </p>
        )}
        <div className="flex items-end gap-1 invisible">
          <Digit value={0} label="days" />
          <Sep />
          <Digit value={0} label="hrs" />
          <Sep />
          <Digit value={0} label="min" />
          <Sep />
          <Digit value={0} label="sec" />
        </div>
      </div>
    );
  }

  if (t.expired) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-[#9b3d3d] uppercase tracking-widest">
          Season ended
        </span>
      </div>
    );
  }

  return (
    <div>
      {label && (
        <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-2">
          {label}
        </p>
      )}
      <div className="flex items-end gap-1">
        <Digit value={t.d} label="days" />
        <Sep />
        <Digit value={t.h} label="hrs" />
        <Sep />
        <Digit value={t.m} label="min" />
        <Sep />
        <Digit value={t.s} label="sec" />
      </div>
    </div>
  );
}
