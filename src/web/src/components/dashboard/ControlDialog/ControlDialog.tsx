import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components'; // v6.0.0
import Dialog from '../../common/Dialog/Dialog';
import { DialogSize } from '../../common/Dialog/Dialog.types';
import Button from '../../common/Button/Button';
import { ButtonVariant } from '../../common/Button/Button.types';
import Icon from '../../common/Icon/Icon';
import { IconType, IconSize } from '../../common/Icon/Icon.types';
import useEntity from '../../../hooks/useEntity';
import { EntityType, EntityConfig } from '../../../types/entity.types';
import { PERFORMANCE_THRESHOLDS } from '../../../config/constants';

// Styled components for the control dialog
const StyledForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  max-height: 80vh;
  overflow-y: auto;
  scrollbar-gutter: stable;
`;

const StyledControlGroup = styled.div<{ $loading?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  opacity: ${({ $loading }) => ($loading ? 0.7 : 1)};
  pointer-events: ${({ $loading }) => ($loading ? 'none' : 'auto')};
  transition: opacity 0.2s ease-in-out;
`;

const StyledControl = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
`;

const StyledLabel = styled.label`
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
`;

const StyledSlider = styled.input`
  width: 100%;
  margin: 0;
  -webkit-appearance: none;
  background: ${({ theme }) => theme.colors.border};
  height: 4px;
  border-radius: 2px;
  outline: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
    transition: all 0.2s ease-in-out;
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
    transition: all 0.2s ease-in-out;
  }
`;

const StyledError = styled.div`
  color: ${({ theme }) => theme.colors.error};
  font-size: 0.875rem;
  padding: 0.5rem;
  border-radius: 4px;
  background: ${({ theme }) => `${theme.colors.error}10`};
`;

interface ControlDialogProps {
  entityId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ControlDialog: React.FC<ControlDialogProps> = ({
  entityId,
  isOpen,
  onClose
}) => {
  const { state, config, sendCommand, supportsFeature } = useEntity(entityId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controls, setControls] = useState<Record<string, any>>({});

  // Initialize controls based on entity state
  useEffect(() => {
    if (state && config) {
      const initialControls: Record<string, any> = {};
      
      switch (config.type) {
        case EntityType.LIGHT:
          initialControls.brightness = state.attributes.brightness || 0;
          if (supportsFeature('color')) {
            initialControls.color = state.attributes.rgb_color || [255, 255, 255];
          }
          break;
        case EntityType.CLIMATE:
          initialControls.temperature = state.attributes.temperature || 20;
          initialControls.mode = state.attributes.hvac_mode || 'off';
          break;
        case EntityType.MEDIA_PLAYER:
          initialControls.volume = state.attributes.volume_level || 0;
          break;
        case EntityType.COVER:
          initialControls.position = state.attributes.current_position || 0;
          break;
        case EntityType.FAN:
          initialControls.speed = state.attributes.percentage || 0;
          break;
      }
      
      setControls(initialControls);
    }
  }, [state, config, supportsFeature]);

  // Handle control value changes with debouncing
  const handleControlChange = useCallback(async (
    controlId: string,
    value: any
  ) => {
    setControls(prev => ({ ...prev, [controlId]: value }));
    setError(null);

    try {
      setLoading(true);
      const startTime = Date.now();

      const data: Record<string, any> = {};
      switch (controlId) {
        case 'brightness':
          data.brightness = Math.round(value);
          break;
        case 'color':
          data.rgb_color = value;
          break;
        case 'temperature':
          data.temperature = value;
          break;
        case 'mode':
          data.hvac_mode = value;
          break;
        case 'volume':
          data.volume_level = value;
          break;
        case 'position':
          data.position = value;
          break;
        case 'speed':
          data.percentage = value;
          break;
      }

      await sendCommand('set', data);

      const responseTime = Date.now() - startTime;
      if (responseTime > PERFORMANCE_THRESHOLDS.maxResponseTime) {
        console.warn(`Control response time exceeded threshold: ${responseTime}ms`);
      }
    } catch (err) {
      setError('Failed to update control. Please try again.');
      console.error('Control update error:', err);
    } finally {
      setLoading(false);
    }
  }, [sendCommand]);

  // Handle form submission
  const handleSubmit = useCallback(async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    try {
      setLoading(true);
      await sendCommand('apply', controls);
      onClose();
    } catch (err) {
      setError('Failed to apply changes. Please try again.');
      console.error('Form submission error:', err);
    } finally {
      setLoading(false);
    }
  }, [controls, sendCommand, onClose]);

  if (!state || !config) {
    return null;
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={config.display_name || entityId}
      size={DialogSize.MEDIUM}
      ariaLabel={`Control ${config.display_name || entityId}`}
    >
      <StyledForm onSubmit={handleSubmit}>
        <StyledControlGroup $loading={loading}>
          {config.type === EntityType.LIGHT && (
            <>
              <StyledControl>
                <StyledLabel htmlFor="brightness">Brightness</StyledLabel>
                <StyledSlider
                  type="range"
                  id="brightness"
                  min="0"
                  max="255"
                  value={controls.brightness}
                  onChange={e => handleControlChange('brightness', Number(e.target.value))}
                />
              </StyledControl>
              {supportsFeature('color') && (
                <StyledControl>
                  <StyledLabel htmlFor="color">Color</StyledLabel>
                  <input
                    type="color"
                    id="color"
                    value={`#${controls.color?.map((c: number) => c.toString(16).padStart(2, '0')).join('') || '000000'}`}
                    onChange={e => {
                      const hex = e.target.value.substring(1);
                      const rgb = [
                        parseInt(hex.substring(0, 2), 16),
                        parseInt(hex.substring(2, 4), 16),
                        parseInt(hex.substring(4, 6), 16)
                      ];
                      handleControlChange('color', rgb);
                    }}
                  />
                </StyledControl>
              )}
            </>
          )}

          {config.type === EntityType.CLIMATE && (
            <>
              <StyledControl>
                <StyledLabel htmlFor="temperature">Temperature</StyledLabel>
                <StyledSlider
                  type="range"
                  id="temperature"
                  min="16"
                  max="30"
                  step="0.5"
                  value={controls.temperature}
                  onChange={e => handleControlChange('temperature', Number(e.target.value))}
                />
              </StyledControl>
              <StyledControl>
                <StyledLabel htmlFor="mode">Mode</StyledLabel>
                <select
                  id="mode"
                  value={controls.mode}
                  onChange={e => handleControlChange('mode', e.target.value)}
                >
                  <option value="off">Off</option>
                  <option value="heat">Heat</option>
                  <option value="cool">Cool</option>
                  <option value="auto">Auto</option>
                </select>
              </StyledControl>
            </>
          )}

          {error && <StyledError>{error}</StyledError>}
        </StyledControlGroup>

        <Button
          variant={ButtonVariant.PRIMARY}
          type="submit"
          disabled={loading}
          fullWidth
        >
          Apply Changes
        </Button>
      </StyledForm>
    </Dialog>
  );
};

export default ControlDialog;