import { describe, it, expect, beforeEach, afterEach } from 'jest';
import {
    processSvgFloorPlan,
    validateSvgContent,
    optimizeSvg,
    extractSvgDimensions
} from '../../src/core/utils/svgProcessor';

// Test SVG content samples
const validSvgContent = `
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="50" height="50" fill="blue"/>
</svg>`;

const invalidSvgContent = '<invalid>xml content</invalid>';

const maliciousSvgContent = `
<svg xmlns="http://www.w3.org/2000/svg">
    <script>alert("xss")</script>
    <rect width="50" height="50"/>
</svg>`;

const complexSvgContent = `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 10 H 90 V 90 H 10 L 10 10 Z M 30 30 H 70 V 70 H 30 L 30 30"/>
</svg>`;

const oversizedSvgContent = `
<svg width="10000" height="10000" xmlns="http://www.w3.org/2000/svg">
    ${'<rect width="100" height="100"/>'.repeat(10000)}
</svg>`;

describe('SVG Processor Utility Tests', () => {
    describe('processSvgFloorPlan', () => {
        it('should successfully process valid SVG floor plan', async () => {
            const result = await processSvgFloorPlan(validSvgContent);
            expect(result).toHaveProperty('svgData');
            expect(result).toHaveProperty('dimensions');
            expect(result).toHaveProperty('hash');
            expect(result.dimensions).toEqual({ width: 100, height: 100 });
        });

        it('should reject oversized SVG files', async () => {
            await expect(processSvgFloorPlan(oversizedSvgContent))
                .rejects
                .toThrow(/exceeds maximum size/);
        });

        it('should reject SVG with malicious content', async () => {
            await expect(processSvgFloorPlan(maliciousSvgContent))
                .rejects
                .toThrow(/Forbidden content detected/);
        });

        it('should preserve essential attributes during processing', async () => {
            const result = await processSvgFloorPlan(validSvgContent);
            expect(result.svgData).toMatch(/width="100"/);
            expect(result.svgData).toMatch(/height="100"/);
            expect(result.svgData).toMatch(/viewBox="0 0 100 100"/);
        });

        it('should generate consistent hash for identical content', async () => {
            const result1 = await processSvgFloorPlan(validSvgContent);
            const result2 = await processSvgFloorPlan(validSvgContent);
            expect(result1.hash).toBe(result2.hash);
        });

        it('should process SVG with complex paths', async () => {
            const result = await processSvgFloorPlan(complexSvgContent);
            expect(result.svgData).toContain('path');
            expect(result.dimensions).toEqual({ width: 200, height: 200 });
        });

        it('should complete processing within performance threshold', async () => {
            const startTime = Date.now();
            await processSvgFloorPlan(validSvgContent);
            const processingTime = Date.now() - startTime;
            expect(processingTime).toBeLessThan(100); // 100ms threshold
        });
    });

    describe('validateSvgContent', () => {
        it('should validate well-formed SVG content', async () => {
            const result = await validateSvgContent(validSvgContent);
            expect(result).toBe(true);
        });

        it('should reject SVG with script tags', async () => {
            await expect(validateSvgContent(maliciousSvgContent))
                .rejects
                .toThrow(/Forbidden content detected: <script/);
        });

        it('should validate SVG namespace', async () => {
            const noNamespaceSvg = validSvgContent.replace('xmlns="http://www.w3.org/2000/svg"', '');
            await expect(validateSvgContent(noNamespaceSvg))
                .rejects
                .toThrow(/Invalid SVG namespace/);
        });

        it('should reject invalid XML structure', async () => {
            await expect(validateSvgContent(invalidSvgContent))
                .rejects
                .toThrow(/SVG parsing error/);
        });

        it('should validate allowed SVG elements', async () => {
            const invalidElementSvg = `
                <svg xmlns="http://www.w3.org/2000/svg">
                    <foreignObject><div>Invalid</div></foreignObject>
                </svg>`;
            await expect(validateSvgContent(invalidElementSvg))
                .rejects
                .toThrow(/Forbidden SVG element/);
        });

        it('should reject external references', async () => {
            const externalRefSvg = `
                <svg xmlns="http://www.w3.org/2000/svg">
                    <image href="http://example.com/image.png"/>
                </svg>`;
            await expect(validateSvgContent(externalRefSvg))
                .rejects
                .toThrow(/Forbidden content detected/);
        });

        it('should handle large SVG files efficiently', async () => {
            const largeSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">
                    ${`<rect x="0" y="0" width="10" height="10"/>`.repeat(1000)}
                </svg>`;
            const startTime = Date.now();
            await validateSvgContent(largeSvg);
            const validationTime = Date.now() - startTime;
            expect(validationTime).toBeLessThan(100); // 100ms threshold
        });
    });

    describe('optimizeSvg', () => {
        it('should achieve minimum optimization ratio', async () => {
            const result = await optimizeSvg(complexSvgContent);
            const originalSize = complexSvgContent.length;
            const optimizedSize = result.length;
            const reduction = (originalSize - optimizedSize) / originalSize;
            expect(reduction).toBeGreaterThan(0.2); // 20% minimum reduction
        });

        it('should preserve SVG functionality after optimization', async () => {
            const result = await optimizeSvg(validSvgContent);
            expect(result).toMatch(/width="100"/);
            expect(result).toMatch(/height="100"/);
            expect(result).toMatch(/rect/);
        });

        it('should handle complex path data', async () => {
            const result = await optimizeSvg(complexSvgContent);
            expect(result).toContain('path');
            expect(result).toContain('d=');
        });

        it('should remove unnecessary metadata', async () => {
            const svgWithMetadata = `
                <svg xmlns="http://www.w3.org/2000/svg">
                    <metadata>Test metadata</metadata>
                    <rect width="100" height="100"/>
                </svg>`;
            const result = await optimizeSvg(svgWithMetadata);
            expect(result).not.toContain('metadata');
        });

        it('should optimize decimal precision', async () => {
            const svgWithDecimals = `
                <svg xmlns="http://www.w3.org/2000/svg">
                    <rect x="10.123456789" y="20.987654321" width="100" height="100"/>
                </svg>`;
            const result = await optimizeSvg(svgWithDecimals);
            expect(result).not.toMatch(/\d{8,}/);
        });
    });

    describe('extractSvgDimensions', () => {
        it('should extract dimensions from explicit attributes', async () => {
            const dimensions = await extractSvgDimensions(validSvgContent);
            expect(dimensions).toEqual({ width: 100, height: 100 });
        });

        it('should extract dimensions from viewBox', async () => {
            const svgWithViewBox = `
                <svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100" height="100"/>
                </svg>`;
            const dimensions = await extractSvgDimensions(svgWithViewBox);
            expect(dimensions).toEqual({ width: 200, height: 150 });
        });

        it('should handle percentage dimensions', async () => {
            const svgWithPercentage = `
                <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <rect width="50" height="50"/>
                </svg>`;
            const dimensions = await extractSvgDimensions(svgWithPercentage);
            expect(dimensions).toEqual({ width: 100, height: 100 });
        });

        it('should reject invalid dimensions', async () => {
            const invalidDimensionsSvg = `
                <svg width="-100" height="0" xmlns="http://www.w3.org/2000/svg">
                    <rect width="50" height="50"/>
                </svg>`;
            await expect(extractSvgDimensions(invalidDimensionsSvg))
                .rejects
                .toThrow(/Invalid SVG dimensions/);
        });

        it('should handle missing dimensions with viewBox', async () => {
            const svgWithoutDimensions = `
                <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100" height="100"/>
                </svg>`;
            const dimensions = await extractSvgDimensions(svgWithoutDimensions);
            expect(dimensions).toEqual({ width: 300, height: 200 });
        });
    });
});