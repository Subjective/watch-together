import { useState, useEffect } from "react";

interface TypingAnimationProps {
  text: string;
  className?: string;
  speed?: number;
  backspeedMultiplier?: number;
  pauseTime?: number;
  isHovered?: boolean;
}

export const TypingAnimation: React.FC<TypingAnimationProps> = ({
  text,
  className = "",
  speed = 100,
  backspeedMultiplier = 3,
  pauseTime = 2000,
  isHovered = false,
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isTyping) {
      if (currentIndex < text.length) {
        timeout = setTimeout(() => {
          setDisplayedText(text.substring(0, currentIndex + 1));
          setCurrentIndex(currentIndex + 1);
        }, speed);
      } else {
        timeout = setTimeout(() => {
          setIsTyping(false);
        }, pauseTime);
      }
    } else {
      if (currentIndex > 0) {
        timeout = setTimeout(() => {
          setDisplayedText(text.substring(0, currentIndex - 1));
          setCurrentIndex(currentIndex - 1);
        }, speed / backspeedMultiplier);
      } else {
        timeout = setTimeout(() => {
          setIsTyping(true);
        }, 500);
      }
    }

    return () => clearTimeout(timeout);
  }, [currentIndex, isTyping, text, speed, backspeedMultiplier, pauseTime]);

  return (
    <div
      className={`transition-all duration-300 ${
        isHovered ? "opacity-50 blur-[0.5px]" : "opacity-100"
      } ${className}`}
    >
      {displayedText}
      <span className="animate-pulse">|</span>
    </div>
  );
};
