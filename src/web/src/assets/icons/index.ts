import React, { memo, SVGProps } from 'react'; // ^18.0.0

// Global constants
const SVG_VIEWBOX = '0 0 24 24';

// Types and interfaces
interface IconOptions {
  label?: string;
  role?: string;
}

// Helper function to create standardized SVG components
const createSvgIcon = (
  path: string,
  viewBox: string = SVG_VIEWBOX,
  options: IconOptions = {}
): React.FC<SVGProps<SVGSVGElement>> => {
  return memo((props: SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="currentColor"
      role={options.role || 'img'}
      aria-label={options.label}
      {...props}
    >
      <path d={path} />
    </svg>
  ));
};

// Device-specific icons
export const DeviceIcons = {
  light: createSvgIcon(
    'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm0-12c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z',
    SVG_VIEWBOX,
    { label: 'Light device' }
  ),
  
  switch: createSvgIcon(
    'M17 7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h10c2.76 0 5-2.24 5-5s-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z',
    SVG_VIEWBOX,
    { label: 'Switch device' }
  ),
  
  climate: createSvgIcon(
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z',
    SVG_VIEWBOX,
    { label: 'Climate device' }
  ),
  
  media: createSvgIcon(
    'M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03c-.02 1.64-1.35 2.97-3 2.97-1.66 0-3-1.34-3-3z',
    SVG_VIEWBOX,
    { label: 'Media device' }
  ),
};

// UI control icons
export const UIIcons = {
  add: createSvgIcon(
    'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    SVG_VIEWBOX,
    { label: 'Add', role: 'button' }
  ),
  
  settings: createSvgIcon(
    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    SVG_VIEWBOX,
    { label: 'Settings', role: 'button' }
  ),
  
  menu: createSvgIcon(
    'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
    SVG_VIEWBOX,
    { label: 'Menu', role: 'button' }
  ),
  
  close: createSvgIcon(
    'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    SVG_VIEWBOX,
    { label: 'Close', role: 'button' }
  ),
};

// Status indicator icons
export const StatusIcons = {
  success: createSvgIcon(
    'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    SVG_VIEWBOX,
    { label: 'Success', role: 'status' }
  ),
  
  error: createSvgIcon(
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    SVG_VIEWBOX,
    { label: 'Error', role: 'alert' }
  ),
  
  warning: createSvgIcon(
    'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    SVG_VIEWBOX,
    { label: 'Warning', role: 'alert' }
  ),
  
  loading: createSvgIcon(
    'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
    SVG_VIEWBOX,
    { label: 'Loading', role: 'status' }
  ),
};