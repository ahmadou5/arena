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

function Digit({ value, label }: { value: number; label: string }) {
  const prev = useRef(value);
  const [anim, setAnim] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      setTimeout(() => {
        setAnim(true);
        setTimeout(() => setAnim(false), 300);
      }, 0);
    }
    prev.current = value;
  }, [value]);
  return (
    <div className="flex flex-col items-center">
      <div
        className={`font-display text-4xl font-black tracking-tighter text-[#2e3d47] w-14 text-center leading-none ${anim ? "tick-anim" : ""}`}
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
  const [t, setT] = useState<TimeLeft>(calcTimeLeft(target));

  useEffect(() => {
    const id = setInterval(() => setT(calcTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target.getTime()]);

  if (t.expired)
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-[#9b3d3d] uppercase tracking-widest">
          Season ended
        </span>
      </div>
    );

  return (
    <div>
      <p className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest mb-2">
        {label}
      </p>
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
