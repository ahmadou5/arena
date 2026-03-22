// src/components/CopyButton.tsx
"use client";
import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="font-mono text-[10px] text-[#8a8880] hover:text-[#2e3d47] uppercase tracking-wider transition-colors border border-[#dddbd5] px-2 py-1 hover:border-[#2e3d47]"
      title="Copy full wallet address"
    >
      {copied ? "copied ✓" : "copy"}
    </button>
  );
}
