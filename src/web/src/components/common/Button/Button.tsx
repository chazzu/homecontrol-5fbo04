/**
 * A reusable, accessible, and themeable button component
 * Implements WCAG 2.1 Level AA compliance with comprehensive theme support
 * @version 1.0.0
 */

import React from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import { ButtonProps, ButtonSize, ButtonVariant } from './Button.types';
import { Theme } from '../../types/theme.types';

// Size-based padding configurations for proper touch targets (WCAG 2.1)
const getSizePadding = (size: ButtonSize = ButtonSize.MEDIUM): string => {
  switch (size) {
    case ButtonSize.SMALL:
      return '8px 16px';
    case ButtonSize.LARGE:
      return '16px 32px';
    default:
      return '12px 24px';
  }
};

// Size-based font size configurations
const getSizeFontSize = (size: ButtonSize = ButtonSize.MEDIUM): string => {
  switch (size) {
    case ButtonSize.SMALL:
      return '0.875rem';
    case ButtonSize.LARGE:
      return '1.125rem';
    default:
      return '1rem';
  }
};

// Get text color based on variant and theme with proper contrast ratio (WCAG 2.1)
const getTextColor = (variant: ButtonVariant, theme: Theme): string => {
  switch (variant) {
    case ButtonVariant.PRIMARY:
    case ButtonVariant.ERROR:
    case ButtonVariant.SUCCESS:
      return theme.colors.background;
    case ButtonVariant.SECONDARY:
    case ButtonVariant.WARNING:
      return theme.colors.text;
    default:
      return theme.colors.text;
  }
};

// Get background color based on variant and theme
const getBackground = (variant: ButtonVariant, theme: Theme): string => {
  switch (variant) {
    case ButtonVariant.PRIMARY:
      return theme.colors.primary;
    case ButtonVariant.SECONDARY:
      return `${theme.colors.secondary}40`; // 25% opacity
    case ButtonVariant.SUCCESS:
      return theme.colors.success;
    case ButtonVariant.WARNING:
      return theme.colors.warning;
    case ButtonVariant.ERROR:
      return theme.colors.error;
    default:
      return theme.colors.primary;
  }
};

// Get hover background color with proper contrast
const getHoverBackground = (variant: ButtonVariant, theme: Theme): string => {
  const darkenFactor = '0.9'; // 10% darker on hover
  switch (variant) {
    case ButtonVariant.PRIMARY:
      return `${theme.colors.primary}${darkenFactor}`;
    case ButtonVariant.SECONDARY:
      return `${theme.colors.secondary}60`; // 37.5% opacity
    case ButtonVariant.SUCCESS:
      return `${theme.colors.success}${darkenFactor}`;
    case ButtonVariant.WARNING:
      return `${theme.colors.warning}${darkenFactor}`;
    case ButtonVariant.ERROR:
      return `${theme.colors.error}${darkenFactor}`;
    default:
      return `${theme.colors.primary}${darkenFactor}`;
  }
};

// Styled button component with comprehensive theme support
const StyledButton = styled.button<ButtonProps>`
  /* Base styles */
  display: ${props => props.fullWidth ? 'block' : 'inline-block'};
  width: ${props => props.fullWidth ? '100%' : 'auto'};
  padding: ${props => getSizePadding(props.size)};
  font-size: ${props => getSizeFontSize(props.size)};
  font-family: inherit;
  font-weight: 500;
  line-height: 1.5;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  
  /* Colors and theme */
  color: ${props => getTextColor(props.variant, props.theme)};
  background: ${props => getBackground(props.variant, props.theme)};
  border: none;
  border-radius: 4px;
  
  /* Interactive states */
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.6 : 1};
  transition: all 0.2s ease-in-out;
  
  /* Focus state for keyboard navigation (WCAG 2.1) */
  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
    box-shadow: 0 0 0 4px ${props => `${props.theme.colors.primary}40`};
  }
  
  /* Hover state */
  &:hover:not(:disabled) {
    background: ${props => getHoverBackground(props.variant, props.theme)};
  }
  
  /* Active state */
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
`;

/**
 * Button component with comprehensive accessibility support
 * Implements WCAG 2.1 Level AA compliance
 */
const Button: React.FC<ButtonProps> = ({
  children,
  variant = ButtonVariant.PRIMARY,
  size = ButtonSize.MEDIUM,
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button',
  ariaLabel,
  ariaExpanded,
  ariaControls,
  role,
  ...props
}) => {
  // Handle keyboard events for accessibility
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
    }
  };

  return (
    <StyledButton
      variant={variant}
      size={size}
      disabled={disabled}
      fullWidth={fullWidth}
      onClick={onClick}
      type={type}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      role={role}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </StyledButton>
  );
};

export default Button;