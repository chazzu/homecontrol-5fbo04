import { DOMParser } from 'xmldom'; // v0.1.31
import { optimize } from 'svgo'; // v3.0.0
import { validateFloorPlan } from './validation';
import { IFloorPlan } from '../interfaces/IFloorPlan';
import crypto from 'crypto';

/**
 * Configuration for secure SVG optimization
 */
const SVGO_CONFIG = {
    plugins: [
        {
            name: 'preset-default',
            params: {
                overrides: {
                    removeViewBox: false,
                    cleanupIDs: true,
                    removeEmptyAttrs: true,
                    removeHiddenElems: true,
                    removeEmptyText: true,
                    removeEmptyContainers: true,
                    removeUnusedNS: true,
                    removeXMLProcInst: true,
                    removeComments: true,
                    removeMetadata: true,
                    removeTitle: true,
                    removeDesc: true,
                    removeUselessDefs: true,
                    removeEditorsNSData: true,
                    removeEmptyAttrs: true,
                    removeHiddenElems: true,
                    removeEmptyText: true,
                    removeEmptyContainers: true,
                    minifyStyles: true,
                    convertStyleToAttrs: true,
                    convertColors: true,
                    convertPathData: true,
                    convertTransform: true,
                    removeUnknownsAndDefaults: true,
                    removeNonInheritableGroupAttrs: true,
                    removeUselessStrokeAndFill: true,
                    removeUnusedNS: true,
                    cleanupNumericValues: true,
                    moveElemsAttrsToGroup: true,
                    moveGroupAttrsToElems: true,
                    collapseGroups: true,
                    removeRasterImages: true,
                    mergePaths: true,
                    convertShapeToPath: true,
                    sortAttrs: true,
                    removeDimensions: false
                }
            }
        }
    ]
};

/**
 * Maximum allowed SVG file size in bytes (2MB)
 */
const MAX_SVG_SIZE = 2097152;

/**
 * Whitelist of allowed SVG elements for security
 */
const ALLOWED_SVG_ELEMENTS = [
    'svg',
    'path',
    'rect',
    'circle',
    'line',
    'polyline',
    'polygon',
    'g',
    'defs',
    'title'
];

/**
 * Processes and optimizes SVG floor plan content with enhanced security and validation
 * @param svgContent - Raw SVG content to process
 * @returns Promise with processed SVG data, dimensions, and content hash
 * @throws Error if SVG processing fails or content is invalid
 */
export async function processSvgFloorPlan(svgContent: string): Promise<{
    svgData: string;
    dimensions: { width: number; height: number };
    hash: string;
}> {
    // Validate SVG size
    if (svgContent.length > MAX_SVG_SIZE) {
        throw new Error(`SVG content exceeds maximum size of ${MAX_SVG_SIZE} bytes`);
    }

    // Create secure DOMParser instance
    const parser = new DOMParser({
        errorHandler: {
            warning: () => {},
            error: (msg) => { throw new Error(`SVG parsing error: ${msg}`); },
            fatalError: (msg) => { throw new Error(`Fatal SVG parsing error: ${msg}`); }
        }
    });

    // Parse SVG content
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    
    // Validate SVG structure
    const svgElement = doc.documentElement;
    if (!svgElement || svgElement.nodeName !== 'svg') {
        throw new Error('Invalid SVG: Root element must be <svg>');
    }

    // Extract and validate dimensions
    const dimensions = await extractSvgDimensions(svgContent);

    // Validate SVG content security
    await validateSvgContent(svgContent);

    // Optimize SVG
    const optimizedSvg = await optimizeSvg(svgContent);

    // Generate content hash for caching
    const hash = crypto
        .createHash('sha256')
        .update(optimizedSvg)
        .digest('hex');

    return {
        svgData: optimizedSvg,
        dimensions,
        hash
    };
}

/**
 * Validates SVG content structure and format with enhanced security checks
 * @param svgContent - SVG content to validate
 * @returns Promise<boolean> indicating validation result
 * @throws Error if validation fails
 */
export async function validateSvgContent(svgContent: string): Promise<boolean> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');

    // Check for valid SVG namespace
    const svgElement = doc.documentElement;
    if (svgElement.namespaceURI !== 'http://www.w3.org/2000/svg') {
        throw new Error('Invalid SVG namespace');
    }

    // Validate elements against whitelist
    const allElements = doc.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
        const element = allElements[i];
        if (!ALLOWED_SVG_ELEMENTS.includes(element.nodeName.toLowerCase())) {
            throw new Error(`Forbidden SVG element: ${element.nodeName}`);
        }
    }

    // Check for potentially malicious content
    const svgString = svgContent.toLowerCase();
    const forbiddenPatterns = [
        'javascript:',
        'data:',
        'vbscript:',
        '<script',
        'onclick',
        'onload',
        'onmouseover',
        'onerror',
        'eval(',
        'xlink:href'
    ];

    for (const pattern of forbiddenPatterns) {
        if (svgString.includes(pattern)) {
            throw new Error(`Forbidden content detected: ${pattern}`);
        }
    }

    return true;
}

/**
 * Optimizes SVG content for performance while maintaining security
 * @param svgContent - SVG content to optimize
 * @returns Promise<string> with optimized SVG content
 * @throws Error if optimization fails
 */
async function optimizeSvg(svgContent: string): Promise<string> {
    try {
        const result = optimize(svgContent, SVGO_CONFIG);
        
        if ('data' in result) {
            return result.data;
        }
        
        throw new Error('SVG optimization failed: No output data');
    } catch (error) {
        throw new Error(`SVG optimization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Securely extracts and validates SVG dimensions
 * @param svgContent - SVG content to process
 * @returns Promise with validated width and height
 * @throws Error if dimension extraction fails
 */
async function extractSvgDimensions(svgContent: string): Promise<{ width: number; height: number }> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElement = doc.documentElement;

    let width: number;
    let height: number;

    // Try to get dimensions from viewBox first
    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
        const [, , w, h] = viewBox.split(/[\s,]+/).map(Number);
        if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
            width = w;
            height = h;
        }
    }

    // Fallback to width/height attributes
    if (!width || !height) {
        width = parseFloat(svgElement.getAttribute('width') || '0');
        height = parseFloat(svgElement.getAttribute('height') || '0');
    }

    // Validate dimensions
    if (!width || !height || width <= 0 || height <= 0) {
        throw new Error('Invalid SVG dimensions: Both width and height must be positive numbers');
    }

    // Enforce maximum dimensions
    const MAX_DIMENSION = 10000;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        throw new Error(`SVG dimensions exceed maximum allowed size of ${MAX_DIMENSION}px`);
    }

    return { width, height };
}