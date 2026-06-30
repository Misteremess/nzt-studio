"use client";

// components/ui/floating-dock.tsx
// Vertical magnifying dock (Aceternity FloatingDock, adapted).
// Icons scale up based on the cursor's vertical distance; the module label
// slides out to the right on hover. Used as the app's left rail.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export interface DockItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

export function FloatingDock({
  items,
  className,
}: {
  items: DockItem[];
  className?: string;
}) {
  const mouseY = useMotionValue(Infinity);

  return (
    <motion.nav
      onMouseMove={(e) => mouseY.set(e.pageY)}
      onMouseLeave={() => mouseY.set(Infinity)}
      className={cn("flex flex-col items-center gap-2 py-3", className)}
    >
      {items.map((item) => (
        <IconContainer key={item.href} mouseY={mouseY} {...item} />
      ))}
    </motion.nav>
  );
}

function IconContainer({
  mouseY,
  title,
  href,
  icon,
}: DockItem & { mouseY: MotionValue<number> }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  const distance = useTransform(mouseY, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { y: 0, height: 0 };
    return val - bounds.y - bounds.height / 2;
  });

  const sizeT = useTransform(distance, [-120, 0, 120], [44, 72, 44]);
  const iconSizeT = useTransform(distance, [-120, 0, 120], [22, 36, 22]);

  const spring = { mass: 0.1, stiffness: 150, damping: 12 };
  const size = useSpring(sizeT, spring);
  const iconSize = useSpring(iconSizeT, spring);

  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  function handleMouseEnter() {
    const bounds = ref.current?.getBoundingClientRect();
    if (bounds) setTooltipPos({ top: bounds.top + bounds.height / 2, left: bounds.right + 12 });
    setHovered(true);
  }

  return (
    <Link href={href}>
      <motion.div
        ref={ref}
        style={{ width: size, height: size }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "relative flex aspect-square items-center justify-center rounded-xl transition-colors",
          isActive
            ? "bg-primary/15 text-primary"
            : "bg-secondary/40 text-muted-foreground hover:text-foreground"
        )}
      >
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {hovered && tooltipPos && (
                <motion.div
                  initial={{ opacity: 0, x: -6, y: "-50%" }}
                  animate={{ opacity: 1, x: 0, y: "-50%" }}
                  exit={{ opacity: 0, x: -6, y: "-50%" }}
                  style={{ position: "fixed", top: tooltipPos.top, left: tooltipPos.left }}
                  className="pointer-events-none z-50 w-fit whitespace-pre rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-lg"
                >
                  {title}
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}

        <motion.div
          style={{ width: iconSize, height: iconSize }}
          className="flex items-center justify-center"
        >
          {icon}
        </motion.div>
      </motion.div>
    </Link>
  );
}
