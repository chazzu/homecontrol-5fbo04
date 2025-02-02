import React, { useId, useMemo } from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import { InputProps, InputSize, InputVariant } from './Input.types';
import { useThemeContext } from '../../../contexts/ThemeContext';

// Styled container component with flex layout and theme-aware spacing
const StyledInputContainer = styled.div<{ $hasError?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  width: 100%;
`;

// Styled label with theme-aware typography and colors
const StyledLabel = styled.label<{ $size: InputSize; $disabled?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fontFamily};
  font-size: ${({ theme, $size }) => {
    switch ($size) {
      case InputSize.LARGE: return theme.typography.sizes.lg;
      case InputSize.SMALL: return theme.typography.sizes.sm;
      default: return theme.typography.sizes.md;
    }
  }};
  color: ${({ theme, $disabled }) => 
    $disabled ? theme.colors.text.disabled : theme.colors.text.primary};
  font-weight: 500;
  cursor: ${({ $disabled }) => $disabled ? 'not-allowed' : 'pointer'};
`;

// Styled input element with comprehensive theme integration
const StyledInput = styled.input<{
  $size: InputSize;
  $variant: InputVariant;
  $hasError?: boolean;
  $disabled?: boolean;
}>`
  width: 100%;
  padding: ${({ theme, $size }) => {
    switch ($size) {
      case InputSize.LARGE: return theme.spacing.md;
      case InputSize.SMALL: return theme.spacing.xs;
      default: return theme.spacing.sm;
    }
  }};
  font-size: ${({ theme, $size }) => {
    switch ($size) {
      case InputSize.LARGE: return theme.typography.sizes.lg;
      case InputSize.SMALL: return theme.typography.sizes.sm;
      default: return theme.typography.sizes.md;
    }
  }};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 2px solid ${({ theme, $hasError, $variant, $disabled }) => {
    if ($disabled) return theme.colors.border;
    if ($hasError) return theme.colors.error;
    return $variant === InputVariant.OUTLINED ? theme.colors.border : 'transparent';
  }};
  background-color: ${({ theme, $variant, $disabled }) => {
    if ($disabled) return theme.colors.background.disabled;
    return $variant === InputVariant.FILLED ? theme.colors.background.secondary : 'transparent';
  }};
  color: ${({ theme, $disabled }) => 
    $disabled ? theme.colors.text.disabled : theme.colors.text.primary};
  transition: all 0.2s ease-in-out;
  outline: none;

  &:focus {
    border-color: ${({ theme, $hasError }) => 
      $hasError ? theme.colors.error : theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme, $hasError }) => 
      $hasError ? `${theme.colors.error}33` : `${theme.colors.primary}33`};
  }

  &:hover:not(:disabled) {
    border-color: ${({ theme, $hasError }) => 
      $hasError ? theme.colors.error : theme.colors.primary};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.text.placeholder};
  }
`;

// Styled error message with theme-aware colors
const StyledError = styled.span`
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

/**
 * Input component with comprehensive accessibility support and theme integration
 * Implements WCAG 2.1 Level AA compliance
 */
export const Input = React.memo<InputProps>(({
  id,
  name,
  type = 'text',
  value,
  placeholder,
  label,
  error,
  disabled = false,
  required = false,
  size = InputSize.MEDIUM,
  variant = InputVariant.OUTLINED,
  onChange,
  onFocus,
  onBlur,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby,
  'aria-invalid': ariaInvalid,
}) => {
  // Generate unique IDs for accessibility
  const uniqueId = useId();
  const inputId = id || `input-${uniqueId}`;
  const errorId = `error-${inputId}`;

  // Access current theme
  const { theme } = useThemeContext();

  // Memoize ARIA attributes
  const ariaAttributes = useMemo(() => ({
    'aria-label': ariaLabel || label,
    'aria-invalid': ariaInvalid || !!error,
    'aria-required': required,
    'aria-describedby': error ? errorId : ariaDescribedby,
  }), [ariaLabel, label, ariaInvalid, error, required, errorId, ariaDescribedby]);

  return (
    <StyledInputContainer $hasError={!!error}>
      {label && (
        <StyledLabel
          htmlFor={inputId}
          $size={size}
          $disabled={disabled}
        >
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </StyledLabel>
      )}
      
      <StyledInput
        id={inputId}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        $size={size}
        $variant={variant}
        $hasError={!!error}
        $disabled={disabled}
        {...ariaAttributes}
      />

      {error && (
        <StyledError id={errorId} role="alert">
          {error}
        </StyledError>
      )}
    </StyledInputContainer>
  );
});

Input.displayName = 'Input';

export default Input;