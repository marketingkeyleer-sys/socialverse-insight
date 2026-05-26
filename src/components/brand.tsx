import { Link } from "@tanstack/react-router";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 ${className}`}>
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
        <span className="absolute inset-0 rounded-lg ring-1 ring-white/20" />
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-background" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 18 L9 11 L13 15 L20 6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="20" cy="6" r="1.5" fill="currentColor" />
        </svg>
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">
        SocialVerse
      </span>
    </Link>
  );
}
