/**
 * Floor Plan Upload Component
 * Provides a modal dialog interface for uploading and configuring floor plan SVG files
 * with comprehensive security, validation, and accessibility features.
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components'; // v6.0.0
import { z } from 'zod'; // v3.0.0
import { FloorPlanUploadProps } from './FloorPlanUpload.types';
import Dialog from '../../common/Dialog/Dialog';
import Input from '../../common/Input/Input';
import { processSVG } from '../../../utils/floorPlan';
import { useTheme } from '../../../hooks/useTheme';
import { DialogSize } from '../../common/Dialog/Dialog.types';
import { InputSize, InputVariant } from '../../common/Input/Input.types';

// Form validation schema using zod
const uploadFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  scale: z.number().positive('Scale must be positive').max(1000, 'Scale is too large'),
  order: z.number().int('Order must be an integer').min(0, 'Order must be non-negative')
});

// Styled components with theme support
const StyledForm = styled.form<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing?.medium || '16px'};
  width: 100%;
`;

const StyledFileInput = styled.div<{ theme: Theme; isDragging?: boolean }>`
  border: 2px dashed ${({ theme, isDragging }) => 
    isDragging ? theme.colors.primary : theme.colors.border};
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  background: ${({ theme, isDragging }) => 
    isDragging ? `${theme.colors.primary}10` : 'transparent'};

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => `${theme.colors.primary}10`};
  }

  input[type="file"] {
    display: none;
  }
`;

const StyledInputGroup = styled.div`
  display: flex;
  gap: 16px;
  width: 100%;
`;

const StyledError = styled.div<{ theme: Theme }>`
  color: ${({ theme }) => theme.colors.error};
  font-size: 14px;
  margin-top: 8px;
`;

const StyledProgress = styled.div<{ progress: number; theme: Theme }>`
  width: 100%;
  height: 4px;
  background: ${({ theme }) => `${theme.colors.primary}20`};
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;

  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${({ progress }) => `${progress}%`};
    background: ${({ theme }) => theme.colors.primary};
    transition: width 0.3s ease-in-out;
  }
`;

const FloorPlanUpload: React.FC<FloorPlanUploadProps> = ({
  isOpen,
  onUpload,
  onCancel,
  loading,
  error,
  onProgress
}) => {
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    scale: 100,
    order: 0
  });
  const [svgData, setSvgData] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Handle file selection and validation
  const handleFileChange = useCallback(async (file: File) => {
    try {
      // Validate file type
      if (!file.type.includes('svg')) {
        throw new Error('Only SVG files are supported');
      }

      // Read file
      const reader = new FileReader();
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          setUploadProgress(progress);
          onProgress?.(progress, 'VALIDATION');
        }
      };

      reader.onload = async () => {
        try {
          // Process SVG with security measures
          const result = await processSVG(reader.result as string, {
            sanitize: true,
            optimizePaths: true
          });

          setSvgData(result.svgData);
          setUploadProgress(100);
          onProgress?.(100, 'PROCESSING');
          setValidationError(null);
        } catch (error) {
          setValidationError(error.message);
          setSvgData(null);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      setValidationError(error.message);
      setSvgData(null);
    }
  }, [onProgress]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      // Validate form data
      const validatedData = uploadFormSchema.parse(formData);

      if (!svgData) {
        throw new Error('Please select a floor plan SVG file');
      }

      // Submit data
      await onUpload({
        name: validatedData.name,
        svgData,
        scale: validatedData.scale,
        order: validatedData.order
      });

      // Reset form
      setFormData({ name: '', scale: 100, order: 0 });
      setSvgData(null);
      setUploadProgress(0);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setValidationError(error.errors[0].message);
      } else {
        setValidationError(error.message);
      }
    }
  };

  // Handle drag and drop events
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileChange(file);
    }
  }, [handleFileChange]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      title="Upload Floor Plan"
      size={DialogSize.MEDIUM}
      ariaLabel="Floor plan upload dialog"
    >
      <StyledForm onSubmit={handleSubmit} noValidate>
        <Input
          id="floor-plan-name"
          name="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          label="Floor Plan Name"
          placeholder="Enter floor plan name"
          required
          size={InputSize.MEDIUM}
          variant={InputVariant.OUTLINED}
          error={validationError}
          aria-label="Floor plan name"
        />

        <StyledFileInput
          theme={theme}
          isDragging={isDragging}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          aria-label="Upload SVG file"
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg"
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            aria-hidden="true"
          />
          <p>Drop SVG file here or click to upload</p>
          {uploadProgress > 0 && uploadProgress < 100 && (
            <StyledProgress progress={uploadProgress} theme={theme} />
          )}
        </StyledFileInput>

        <StyledInputGroup>
          <Input
            id="floor-plan-scale"
            name="scale"
            type="number"
            value={formData.scale.toString()}
            onChange={(e) => setFormData(prev => ({ ...prev, scale: Number(e.target.value) }))}
            label="Scale (pixels/meter)"
            required
            size={InputSize.MEDIUM}
            variant={InputVariant.OUTLINED}
            aria-label="Floor plan scale"
          />

          <Input
            id="floor-plan-order"
            name="order"
            type="number"
            value={formData.order.toString()}
            onChange={(e) => setFormData(prev => ({ ...prev, order: Number(e.target.value) }))}
            label="Display Order"
            required
            size={InputSize.MEDIUM}
            variant={InputVariant.OUTLINED}
            aria-label="Floor plan display order"
          />
        </StyledInputGroup>

        {error && <StyledError theme={theme} role="alert">{error}</StyledError>}

        <button
          type="submit"
          disabled={loading || !svgData}
          aria-busy={loading}
        >
          {loading ? 'Uploading...' : 'Upload Floor Plan'}
        </button>
      </StyledForm>
    </Dialog>
  );
};

export default FloorPlanUpload;