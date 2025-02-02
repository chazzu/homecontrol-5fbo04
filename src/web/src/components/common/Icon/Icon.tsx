import React, { memo, useMemo } from 'react';
import styled, { css } from 'styled-components'; // v6.0.0
import { IconProps, IconType, IconSize } from './Icon.types';

// Size mapping for consistent icon dimensions
const ICON_SIZES = {
  [IconSize.SMALL]: '16px',
  [IconSize.MEDIUM]: '24px',
  [IconSize.LARGE]: '32px',
};

// Theme-aware color system
const ICON_THEMES = {
  light: 'var(--icon-color-light, #000000)',
  dark: 'var(--icon-color-dark, #FFFFFF)',
};

// Styled SVG wrapper with size and theme support
const StyledIcon = styled.svg<{
  $size: IconSize;
  $color?: string;
  $clickable: boolean;
}>`
  width: ${props => ICON_SIZES[props.$size]};
  height: ${props => ICON_SIZES[props.$size]};
  color: ${props => props.$color || 'currentColor'};
  transition: color 0.2s ease-in-out;
  
  ${props => props.$clickable && css`
    cursor: pointer;
    
    &:hover {
      opacity: 0.8;
    }
    
    &:focus {
      outline: 2px solid var(--focus-ring-color, #007AFF);
      outline-offset: 2px;
    }
  `}
`;

/**
 * Helper function to dynamically import icon components based on type and name
 * @param type - Category of icon (DEVICE, UI, STATUS)
 * @param name - Specific icon identifier
 * @returns Promise resolving to the icon component
 */
const getIconComponent = async (type: IconType, name: string) => {
  try {
    let iconModule;
    
    switch (type) {
      case IconType.DEVICE:
        iconModule = await import(`../../../assets/icons/devices/${name}.svg`);
        break;
      case IconType.UI:
        iconModule = await import(`../../../assets/icons/ui/${name}.svg`);
        break;
      case IconType.STATUS:
        iconModule = await import(`../../../assets/icons/status/${name}.svg`);
        break;
      default:
        console.error(`Invalid icon type: ${type}`);
        return null;
    }
    
    return iconModule.default;
  } catch (error) {
    console.error(`Failed to load icon: ${name}`, error);
    return null;
  }
};

/**
 * Icon component for rendering SVG icons with theme and accessibility support
 * Implements the visual hierarchy system with consistent sizing and categorization
 */
const Icon: React.FC<IconProps> = memo(({
  name,
  type,
  size = IconSize.MEDIUM,
  color,
  className,
  onClick,
  title,
  role = 'img',
  ariaLabel,
  themeVariant = 'light'
}) => {
  // Memoize the themed color value
  const themedColor = useMemo(() => {
    if (color) return color;
    return ICON_THEMES[themeVariant as keyof typeof ICON_THEMES];
  }, [color, themeVariant]);

  // Memoize the icon component loading
  const IconComponent = useMemo(async () => {
    return await getIconComponent(type, name);
  }, [type, name]);

  if (!IconComponent) {
    console.warn(`Icon not found: ${name}`);
    return null;
  }

  return (
    <StyledIcon
      as={IconComponent}
      $size={size}
      $color={themedColor}
      $clickable={!!onClick}
      className={className}
      onClick={onClick}
      role={role}
      aria-label={ariaLabel || title}
      focusable={!!onClick}
      data-testid={`icon-${type}-${name}`}
    >
      {title && <title>{title}</title>}
    </StyledIcon>
  );
});

Icon.displayName = 'Icon';

export default Icon;