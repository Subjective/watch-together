import React, { useId } from "react";

export interface LogoProps {
  size?: number;
  className?: string;
}

// The bare mark: the top half follows the text color, the bottom half is the accent
export const Logo: React.FC<LogoProps> = ({ size = 32, className }) => {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <mask id={id}>
          <rect x="-2" y="-2" width="28" height="28" fill="#fff" />
          <path d="M0 12H24" stroke="#000" strokeWidth="1.7" />
        </mask>
      </defs>
      <g mask={`url(#${id})`}>
        <path
          d="M6 4.6L19.4 12H6Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M6 12H19.4L6 19.4Z"
          fill="#0A84FF"
          stroke="#0A84FF"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};
