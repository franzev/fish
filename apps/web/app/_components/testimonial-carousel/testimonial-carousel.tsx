"use client";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import {
  IconChevronLeft,
  IconChevronRight,
  IconStarFilled,
} from "@tabler/icons-react";
import AutoplayPlugin from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";

export interface Testimonial {
  quote: string;
  name: string;
  /** Role, company, or both — rendered under the name. */
  role: string;
  /** 1–5. Omit to hide the rating row entirely. */
  rating?: number;
  /** Optional photo. Without one the card shows a quiet initial instead. */
  avatarUrl?: string;
}

export interface TestimonialCarouselProps {
  testimonials: Testimonial[];
  /** Accessible name for the carousel region. */
  label?: string;
  /** Auto-advance until the last slide or the first interaction, whichever
   * comes first. Off by default: moving content competes with reading, so
   * turn it on only for surfaces where nothing else asks for attention.
   * Reduced-motion preferences keep the carousel fully manual. */
  autoplay?: boolean;
  autoplayDelayMs?: number;
  className?: string;
}

/* Both the OS preference and the app's explicit setting (mirrored onto
   <html data-reduced-motion>) opt the carousel out of animated scrolling. */
function reducedMotion() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.reducedMotion === "true"
  );
}

function StarRating({ rating }: { rating: number }) {
  const filled = Math.min(5, Math.max(1, Math.round(rating)));
  return (
    <p className="flex items-center gap-3xs text-foreground">
      <span className="sr-only">Rated {filled} out of 5</span>
      {Array.from({ length: 5 }, (_, star) => (
        <IconStarFilled
          key={star}
          size={14}
          aria-hidden="true"
          className={cn(star >= filled && "text-border")}
        />
      ))}
    </p>
  );
}

/** One voice per card: rating, quote, then who said it. The whole card is a
 * flat surface-2 well — separation comes from fill and spacing, never from
 * borders or shadows. */
function TestimonialSlide({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="flex h-full flex-col rounded-card bg-surface-2 p-lg">
      {testimonial.rating !== undefined && (
        <StarRating rating={testimonial.rating} />
      )}
      <blockquote className="mt-md flex-1 text-copy text-body">
        “{testimonial.quote}”
      </blockquote>
      <figcaption className="mt-lg flex items-center gap-sm">
        {testimonial.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={testimonial.avatarUrl}
            alt=""
            width={44}
            height={44}
            className="size-target-touch shrink-0 rounded-pill bg-avatar object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-target-touch shrink-0 items-center justify-center rounded-pill bg-avatar font-serif text-heading-sm font-semibold text-foreground"
          >
            {testimonial.name.charAt(0)}
          </span>
        )}
        <span>
          <span className="block text-ui font-medium text-foreground">
            {testimonial.name}
          </span>
          <span className="block text-ui-sm text-muted">
            {testimonial.role}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/** Testimonial carousel for marketing surfaces. One slide per view on
 * phones, two on tablets, three on desktop; swipe, arrows, and dots all
 * reach every slide. Scrolling jumps instantly when the visitor prefers
 * reduced motion. */
export function TestimonialCarousel({
  testimonials,
  label = "What clients say",
  autoplay = false,
  autoplayDelayMs = 7000,
  className,
}: TestimonialCarouselProps) {
  /* The plugin array must keep its identity across renders or Embla
     re-initializes on every state change, so the plugin lives in state
     (autoplay is a configuration prop, not a live toggle). */
  const [autoplayPlugin] = useState(() =>
    autoplay
      ? AutoplayPlugin({
          delay: autoplayDelayMs,
          stopOnInteraction: true,
          stopOnMouseEnter: true,
          stopOnFocusIn: true,
          stopOnLastSnap: true,
        })
      : null
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { align: "start" },
    autoplayPlugin ? [autoplayPlugin] : undefined
  );

  const [selectedSnap, setSelectedSnap] = useState(0);
  const [snapCount, setSnapCount] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const sync = () => {
      setSelectedSnap(emblaApi.selectedScrollSnap());
      setSnapCount(emblaApi.scrollSnapList().length);
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };
    sync();
    emblaApi.on("select", sync).on("reInit", sync);
    return () => {
      emblaApi.off("select", sync).off("reInit", sync);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (emblaApi && autoplayPlugin && reducedMotion()) {
      autoplayPlugin.stop();
    }
  }, [emblaApi, autoplayPlugin]);

  const scrollPrev = useCallback(
    () => emblaApi?.scrollPrev(reducedMotion()),
    [emblaApi]
  );
  const scrollNext = useCallback(
    () => emblaApi?.scrollNext(reducedMotion()),
    [emblaApi]
  );
  const scrollTo = useCallback(
    (snap: number) => emblaApi?.scrollTo(snap, reducedMotion()),
    [emblaApi]
  );

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cn(
        "max-md:min-w-0 max-md:max-w-full max-md:overflow-hidden",
        className
      )}
    >
      <div ref={emblaRef} className="overflow-hidden">
        <div className="-ml-md flex">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${testimonials.length}`}
              className="w-full flex-none pl-md md:w-1/2 lg:w-1/3"
            >
              <TestimonialSlide testimonial={testimonial} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-lg flex items-center justify-between gap-md">
        <div className="flex">
          {Array.from({ length: snapCount }, (_, snap) => (
            <button
              key={snap}
              type="button"
              aria-label={`Go to slide ${snap + 1}`}
              aria-current={snap === selectedSnap ? "true" : undefined}
              onClick={() => scrollTo(snap)}
              className="flex size-target-touch items-center justify-center"
            >
              <span
                className={cn(
                  "size-xs rounded-pill transition-colors",
                  /* border, not a surface step: inactive dots sit on the
                     surface section and must keep 3:1 contrast in both
                     themes. */
                  snap === selectedSnap ? "bg-foreground" : "bg-border"
                )}
              />
            </button>
          ))}
        </div>
        <div className="flex gap-xs">
          <IconButton
            label="Previous testimonials"
            icon={<IconChevronLeft size={20} stroke={1.75} />}
            appearance="surface"
            onClick={scrollPrev}
            disabled={!canScrollPrev}
          />
          <IconButton
            label="Next testimonials"
            icon={<IconChevronRight size={20} stroke={1.75} />}
            appearance="surface"
            onClick={scrollNext}
            disabled={!canScrollNext}
          />
        </div>
      </div>
    </div>
  );
}
