// react version: ^18.0.0
// styled-components version: ^6.0.0

import React, { useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { LoaderProps, LoaderSize, LoaderVariant } from './Loader.types';

// Size mapping following Material Design specifications
const SIZE_MAP = {
  [LoaderSize.SMALL]: '16px',
  [LoaderSize.MEDIUM]: '24px',
  [LoaderSize.LARGE]: '48px',
};

// Animation timing constants (in ms)
const ANIMATION_DURATION = {
  [LoaderVariant.SPINNER]: 1400,
  [LoaderVariant.DOTS]: 1000,
};

// Spinner animation with optimized transform
const spinnerAnimation = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

// Dots animation with Material Design easing
const dotsAnimation = keyframes`
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
`;

// Helper function to get theme-aware color with fallback
const getThemeAwareColor = (color?: string) => {
  return color || 'var(--loader-color, var(--primary-color, #007AFF))';
};

// Helper function to get size value from SIZE_MAP
const getSizeValue = (size: LoaderSize) => SIZE_MAP[size];

// Base container with accessibility and performance optimizations
const LoaderContainer = styled.div<{ size: LoaderSize; color?: string }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${props => getSizeValue(props.size)};
  height: ${props => getSizeValue(props.size)};
  color: ${props => getThemeAwareColor(props.color)};
  will-change: transform;
  
  @media (prefers-reduced-motion: reduce) {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
`;

// Spinner variant with optimized animation
const SpinnerLoader = styled.div<{ size: LoaderSize }>`
  position: absolute;
  width: 100%;
  height: 100%;
  border: calc(${props => getSizeValue(props.size)} / 8) solid;
  border-color: currentColor transparent transparent transparent;
  border-radius: 50%;
  animation: ${spinnerAnimation} ${ANIMATION_DURATION.SPINNER}ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
`;

// Dots variant container
const DotsContainer = styled.div`
  display: flex;
  gap: 4px;
`;

// Individual dot with optimized animation
const Dot = styled.div<{ delay: number; size: LoaderSize }>`
  width: calc(${props => getSizeValue(props.size)} / 3);
  height: calc(${props => getSizeValue(props.size)} / 3);
  background-color: currentColor;
  border-radius: 50%;
  animation: ${dotsAnimation} ${ANIMATION_DURATION.DOTS}ms ease-in-out ${props => props.delay}ms infinite;
`;

/**
 * A highly optimized, accessible loading indicator component that supports
 * multiple variants and sizes while adhering to Material Design principles
 * and WCAG 2.1 Level AA standards.
 *
 * @param {LoaderProps} props - Component props
 * @returns {JSX.Element} Rendered loader component
 */
const Loader: React.FC<LoaderProps> = React.memo(({
  size = LoaderSize.MEDIUM,
  variant = LoaderVariant.SPINNER,
  color,
  className,
  ariaLabel = 'Loading content'
}) => {
  // Memoized render functions for performance
  const renderSpinner = useCallback(() => (
    <SpinnerLoader size={size} />
  ), [size]);

  const renderDots = useCallback(() => (
    <DotsContainer>
      {[0, 160, 320].map((delay, index) => (
        <Dot
          key={index}
          delay={delay}
          size={size}
          aria-hidden="true"
        />
      ))}
    </DotsContainer>
  ), [size]);

  return (
    <LoaderContainer
      size={size}
      color={color}
      className={className}
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      data-testid="loader"
    >
      {variant === LoaderVariant.SPINNER ? renderSpinner() : renderDots()}
    </LoaderContainer>
  );
});

// Display name for debugging
Loader.displayName = 'Loader';

export default Loader;