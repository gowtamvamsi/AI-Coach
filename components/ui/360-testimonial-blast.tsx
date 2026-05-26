"use client";

import * as React from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TestimonialItem {
  text: string;
  image: string;
  name: string;
  role: string;
}

interface TestimonialBlastProps {
  testimonials: TestimonialItem[];
  motivationalQuote?: string;
  className?: string;
}

export function TestimonialBlast({
  testimonials,
  motivationalQuote = "The future belongs to those who build it. Master Agentic AI and command the new frontier.",
  className
}: TestimonialBlastProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Hook scroll tracking over the parent's scroll-range [start start, end end]
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Limit testimonial count strictly to 15 items for the mathematically structured 360° blast
  const activeTestimonials = React.useMemo(() => {
    return testimonials.slice(0, 15);
  }, [testimonials]);

  // Background motivational quote animations (Layer 1)
  // Hidden completely (opacity: 0, scale: 0.8) until the blast clears (scrollYProgress >= 0.85)
  const bgOpacity = useTransform(scrollYProgress, [0.85, 1.0], [0, 1]);
  const bgScale = useTransform(scrollYProgress, [0.85, 1.0], [0.8, 1]);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full h-[400vh] bg-background", className)}
      style={{ position: "relative" }}
    >
      {/* Sticky Fullscreen viewport wrapper */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center bg-transparent">
        
        {/* LAYER 1: Background Motivational Quote */}
        <motion.div
          style={{
            opacity: bgOpacity,
            scale: bgScale,
            zIndex: 0,
            willChange: "transform, opacity",
            position: "absolute"
          }}
          className="flex flex-col items-center justify-center text-center max-w-4xl px-6"
        >
          <div className="absolute inset-0 bg-primary/5 blur-[120px] rounded-full -z-10" />
          <span className="text-primary/10 text-8xl font-serif leading-none italic select-none">“</span>
          <h2 className="font-serif italic text-4xl sm:text-5xl md:text-6xl text-foreground font-normal leading-tight tracking-tight mt-[-20px] mb-4">
            {motivationalQuote}
          </h2>
          <span className="text-primary/10 text-8xl font-serif leading-none italic select-none">”</span>
        </motion.div>

        {/* LAYER 2: The 360° Testimonial Build-Up & Blast */}
        <div className="relative w-full h-full flex items-center justify-center pointer-events-none z-10">
          {activeTestimonials.map((t, index) => {
            return (
              <TestimonialCard
                key={index}
                item={t}
                index={index}
                total={activeTestimonials.length}
                scrollYProgress={scrollYProgress}
              />
            );
          })}
        </div>

      </div>
    </div>
  );
}

interface TestimonialCardProps {
  item: TestimonialItem;
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
}

function TestimonialCard({ item, index, total, scrollYProgress }: TestimonialCardProps) {
  // Trigonometric 360° Positioning Calculations
  // Index 0: Lead Card (starts at top-right: 100vw, -100vh)
  // Index 1-14: Accumulation Cards (starts at offscreen 360° radial points)
  const mathData = React.useMemo(() => {
    let startXVal = 0;
    let startYVal = 0;
    let targetXVal = 0;
    let targetYVal = 0;
    let rotateOffset = 0;

    if (index === 0) {
      // The Lead Card starts at top-right
      startXVal = 100; // 100vw
      startYVal = -100; // -100vh
      targetXVal = 0;
      targetYVal = 0;
      rotateOffset = -5; // tilt center slightly
    } else {
      // Cards 2-15 start at radial angles
      const angle = (index / total) * Math.PI * 2;
      startXVal = Math.cos(angle) * 120; // 120vw
      startYVal = Math.sin(angle) * 120; // 120vh

      // Cluster offsets to prevent overlapping cards from completely blanketing each other
      targetXVal = ((index * 17) % 100) - 50; // -50px to 50px
      targetYVal = ((index * 31) % 80) - 40;  // -40px to 40px
      rotateOffset = ((index * 7) % 15) - 7.5; // -7.5deg to 7.5deg
    }

    const startX = `${startXVal}vw`;
    const startY = `${startYVal}vh`;
    const targetX = `${targetXVal}px`;
    const targetY = `${targetYVal}px`;
    const endX = `${startXVal * 2.5}vw`;
    const endY = `${startYVal * 2.5}vh`;

    return { startX, startY, targetX, targetY, endX, endY, rotateOffset };
  }, [index, total]);

  // Compute Scroll-Transform mappings across sequential timelines
  let x = useTransform(scrollYProgress, [0, 1], ["0px", "0px"]);
  let y = useTransform(scrollYProgress, [0, 1], ["0px", "0px"]);
  let scale = useTransform(scrollYProgress, [0, 1], [1, 1]);
  let rotate = useTransform(scrollYProgress, [0, 1], [0, 0]);
  let opacity = useTransform(scrollYProgress, [0, 1], [1, 1]);

  if (index === 0) {
    // THE LEAD CARD TIMELINE:
    // - [0.00, 0.15]: Fly-in from top-right to center
    // - [0.15, 0.75]: Hold perfectly still in the center
    // - [0.75, 0.85]: Violent blast to end coordinate (double offscreen distance)
    // - [0.85, 1.00]: Remain fully dispersed and invisible
    x = useTransform(
      scrollYProgress,
      [0.00, 0.15, 0.75, 0.85, 1.00],
      [mathData.startX, mathData.targetX, mathData.targetX, mathData.endX, mathData.endX]
    );
    y = useTransform(
      scrollYProgress,
      [0.00, 0.15, 0.75, 0.85, 1.00],
      [mathData.startY, mathData.targetY, mathData.targetY, mathData.endY, mathData.endY]
    );
    opacity = useTransform(
      scrollYProgress,
      [0.00, 0.15, 0.75, 0.85, 1.00],
      [1, 1, 1, 0, 0]
    );
    rotate = useTransform(
      scrollYProgress,
      [0.00, 0.15, 0.75, 0.85, 1.00],
      [15, mathData.rotateOffset, mathData.rotateOffset, mathData.rotateOffset * 2.5 - 20, mathData.rotateOffset * 2.5 - 20]
    );
    scale = useTransform(
      scrollYProgress,
      [0.00, 0.15, 0.75, 0.85, 1.00],
      [0.9, 1.05, 1.05, 0.5, 0.5]
    );
  } else {
    // ACCUMULATION CARDS TIMELINE:
    // - Fly in staggered based on their index between [0.15, 0.60]
    // - Hold centered pile between [0.60, 0.75]
    // - Violent blast disperse outward to double radial distance between [0.75, 0.85]
    // - Remain invisible [0.85, 1.00]
    const t1 = 0.15 + ((index - 1) / (total - 1)) * 0.28; // Staggered fly-in starts between 0.15 and 0.43
    const t2 = t1 + 0.12; // Card finishes sliding in after 0.12 progress (last card completes by 0.55)

    x = useTransform(
      scrollYProgress,
      [0.00, t1, t2, 0.75, 0.85, 1.00],
      [mathData.startX, mathData.startX, mathData.targetX, mathData.targetX, mathData.endX, mathData.endX]
    );
    y = useTransform(
      scrollYProgress,
      [0.00, t1, t2, 0.75, 0.85, 1.00],
      [mathData.startY, mathData.startY, mathData.targetY, mathData.targetY, mathData.endY, mathData.endY]
    );
    opacity = useTransform(
      scrollYProgress,
      [0.00, t1, t2, 0.75, 0.85, 1.00],
      [0, 0, 1, 1, 0, 0]
    );
    rotate = useTransform(
      scrollYProgress,
      [0.00, t1, t2, 0.75, 0.85, 1.00],
      [mathData.rotateOffset + 35, mathData.rotateOffset + 35, mathData.rotateOffset, mathData.rotateOffset, mathData.rotateOffset * 2.5 + 30, mathData.rotateOffset * 2.5 + 30]
    );
    scale = useTransform(
      scrollYProgress,
      [0.00, t1, t2, 0.75, 0.85, 1.00],
      [0.6, 0.6, 1.0, 1.0, 0.5, 0.5]
    );
  }

  return (
    <motion.div
      style={{
        x,
        y,
        scale,
        rotate,
        opacity,
        willChange: "transform, opacity",
        position: "absolute",
        zIndex: index + 10
      }}
      className={cn(
        "w-[290px] h-[170px] sm:w-[320px] sm:h-[185px] md:w-[350px] md:h-[200px] p-5 md:p-6 rounded-2xl flex flex-col justify-between select-none pointer-events-auto",
        "bg-white/10 dark:bg-black/45 backdrop-blur-xl border border-white/10 dark:border-white/5",
        "shadow-[0_20px_50px_rgba(0,0,0,0.25)] hover:shadow-[0_25px_60px_rgba(0,0,0,0.35)] hover:scale-[1.03] transition-shadow duration-300"
      )}
    >
      {/* Testimonial card content */}
      <div className="flex justify-between items-center border-b border-white/10 pb-2 w-full">
        <span className="text-[10px] font-semibold tracking-widest text-primary uppercase">
          0{index + 1} — Outcomes
        </span>
        <span className="text-[9px] font-mono text-white/40 uppercase">
          Verified
        </span>
      </div>

      <div className="flex-1 flex items-center my-3 overflow-hidden">
        <blockquote className="text-xs sm:text-sm md:text-base font-serif italic text-white/90 leading-snug line-clamp-3 text-left">
          “{item.text}”
        </blockquote>
      </div>

      <div className="flex justify-between items-end border-t border-white/10 pt-2 w-full gap-2">
        <div className="flex items-center gap-3">
          <img
            src={item.image}
            alt={item.name}
            className="w-8 h-8 rounded-full border border-white/20 object-cover"
          />
          <div className="text-left">
            <div className="text-[12px] font-bold text-white leading-tight">{item.name}</div>
            <div className="text-[10px] text-white/50 leading-tight mt-0.5">{item.role}</div>
          </div>
        </div>
        <div className="text-[9px] text-white/30 font-mono hidden sm:block">
          AE // 2026
        </div>
      </div>
    </motion.div>
  );
}
