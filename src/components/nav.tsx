"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const links = [
  { href: "/", label: "대시보드" },
  { href: "/regions", label: "지역 관리" },
  { href: "/listings", label: "매물 목록" },
  { href: "/starred", label: "관심 매물" },
  { href: "/alerts", label: "알림 설정" },
];

export default function Nav() {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState<"none" | "right" | "left" | "both">("none");

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasLeft = el.scrollLeft > 0;
    const hasRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    if (hasLeft && hasRight) setFade("both");
    else if (hasLeft) setFade("left");
    else if (hasRight) setFade("right");
    else setFade("none");
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const maskImage =
    fade === "both"
      ? "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)"
      : fade === "left"
        ? "linear-gradient(to right, transparent, black 24px)"
        : fade === "right"
          ? "linear-gradient(to right, black calc(100% - 24px), transparent)"
          : undefined;

  const maskStyle: React.CSSProperties | undefined = maskImage
    ? { maskImage, WebkitMaskImage: maskImage }
    : undefined;

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-6">
        {/* 모바일: 2단, sm+: 1단 */}
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-zinc-900"
          >
            <span className="text-blue-600">Zip</span>Cock
          </Link>
          {/* sm+ 탭: 데스크톱에서만 표시 */}
          <div className="hidden items-center gap-1 sm:flex">
            {links.map(({ href, label }) => {
              const isActive =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
        {/* 모바일 탭: sm 미만에서만 표시 */}
        <div
          ref={scrollRef}
          className="-mx-6 flex gap-1 overflow-x-auto px-6 pb-2 scrollbar-hide sm:hidden"
          style={maskStyle}
        >
          {links.map(({ href, label }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
