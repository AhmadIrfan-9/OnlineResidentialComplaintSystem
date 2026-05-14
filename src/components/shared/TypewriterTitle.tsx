"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface TypewriterSegment {
  text: string;
  style?: React.CSSProperties;
}

interface TypewriterTitleProps {
  segments: TypewriterSegment[];
  className?: string;
  delay?: number;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
}

export function TypewriterTitle({
  segments,
  className,
  delay = 0,
  typingSpeed = 80,
  deletingSpeed = 40,
  pauseDuration = 2500,
}: TypewriterTitleProps) {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    const startTimeout = setTimeout(() => setIsStarted(true), delay * 1000);
    return () => clearTimeout(startTimeout);
  }, [delay]);

  useEffect(() => {
    if (!isStarted || isPaused) return;

    if (isDeleting) {
      if (subIndex === 0 && index === 0) {
        setTimeout(() => setIsDeleting(false), 500);
        return;
      }

      const timeout = setTimeout(() => {
        if (subIndex > 0) {
          setSubIndex((prev) => prev - 1);
        } else if (index > 0) {
          setIndex((prev) => prev - 1);
          setSubIndex(segments[index - 1].text.length);
        }
      }, deletingSpeed);

      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        if (subIndex < segments[index].text.length) {
          setSubIndex((prev) => prev + 1);
        } else if (index < segments.length - 1) {
          setIndex((prev) => prev + 1);
          setSubIndex(0);
        } else {
          // Finished typing everything
          setIsPaused(true);
          setTimeout(() => {
            setIsPaused(false);
            setIsDeleting(true);
          }, pauseDuration);
        }
      }, typingSpeed + Math.random() * 40);

      return () => clearTimeout(timeout);
    }
  }, [subIndex, index, isDeleting, isPaused, isStarted, segments, typingSpeed, deletingSpeed, pauseDuration]);

  return (
    <div className={className}>
      {segments.map((segment, i) => {
        // Entirely typed segments
        if (i < index) {
          return (
            <span key={i} style={segment.style}>
              {segment.text}
              {i === 0 && <br />}
            </span>
          );
        }
        // Currently typing segment
        if (i === index) {
          return (
            <span key={i} style={segment.style}>
              {segment.text.substring(0, subIndex)}
              {/* Only show cursor on the currently active segment */}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                className="inline-block ml-1"
                style={{ 
                  borderLeft: "4px solid currentColor",
                  height: "0.9em",
                  verticalAlign: "middle",
                  WebkitTextStroke: "0",
                  filter: "drop-shadow(0 0 2px rgba(255,255,255,0.5))"
                }}
              />
            </span>
          );
        }
        // Not yet typed segments
        return null;
      })}
    </div>
  );
}
