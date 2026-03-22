import Link from "next/link";

interface FooterProps {
  isTrader?: boolean;
  wallet?: string;
}

function shortWallet(w: string) {
  return `${w.slice(0, 6)}…${w.slice(-6)}`;
}

export const Footer = ({ isTrader, wallet }: FooterProps) => {
  return (
    <footer className="border-t border-[#dddbd5] px-6 py-6 mt-12">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="font-display font-black text-sm text-[#2e3d47] tracking-tight"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            ARENA PROTOCOL
          </span>
        </div>
        {isTrader ? (
          <span className="font-mono text-[10px] text-[#b0aea5]">
            {shortWallet(wallet || "")}
          </span>
        ) : (
          <div className="flex items-center gap-6">
            <a
              href="https://adrena.trade"
              className="font-mono text-[10px] text-[#8a8880] hover:text-[#2e3d47] uppercase tracking-widest transition-colors"
            >
              Adrena.trade
            </a>
            <a
              href="/api/config"
              className="font-mono text-[10px] text-[#8a8880] hover:text-[#2e3d47] uppercase tracking-widest transition-colors"
            >
              Scoring Config
            </a>
          </div>
        )}
      </div>
    </footer>
  );
};
