import React, { useEffect, useCallback, useRef } from 'react'; // v18.0.0
import styled from 'styled-components'; // v6.0.0
import { DialogProps, DialogSize } from './Dialog.types';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';
import { IconType, IconSize } from '../Icon/Icon.types';
import { ButtonVariant } from '../Button/Button.types';

// Styled components with theme support
const StyledOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${({ theme }) => `${theme.colors.text}80`}; // 50% opacity
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  opacity: ${({ isOpen }) => (isOpen ? 1 : 0)};
  visibility: ${({ isOpen }) => (isOpen ? 'visible' : 'hidden')};
  transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out;
`;

const getDialogSize = (size: DialogSize): string => {
  switch (size) {
    case DialogSize.SMALL:
      return '400px';
    case DialogSize.MEDIUM:
      return '600px';
    case DialogSize.LARGE:
      return '800px';
    case DialogSize.FULL_SCREEN:
      return '95vw';
    default:
      return '600px';
  }
};

const StyledDialog = styled.div<{ size: DialogSize }>`
  background: ${({ theme }) => theme.colors.background};
  border-radius: 8px;
  box-shadow: 0 4px 20px ${({ theme }) => `${theme.colors.text}20`};
  width: ${({ size }) => getDialogSize(size)};
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  position: relative;
  transform: translateY(0);
  transition: transform 0.3s ease-in-out;

  &[aria-hidden="true"] {
    transform: translateY(20px);
  }
`;

const StyledHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const StyledTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  color: ${({ theme }) => theme.colors.text};
  font-weight: 600;
`;

const StyledContent = styled.div`
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  color: ${({ theme }) => theme.colors.text};
`;

const StyledFooter = styled.footer`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  gap: 12px;
`;

const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = DialogSize.MEDIUM,
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscapeKey = true,
  className,
  ariaLabel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element when dialog opens
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the dialog when it opens
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  // Restore focus when dialog closes
  useEffect(() => {
    return () => {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  // Handle escape key press
  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscapeKey && isOpen) {
        event.preventDefault();
        onClose();
      }
    },
    [closeOnEscapeKey, isOpen, onClose]
  );

  // Add keyboard event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isOpen, handleEscapeKey]);

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (
        closeOnOverlayClick &&
        event.target === event.currentTarget &&
        isOpen
      ) {
        onClose();
      }
    },
    [closeOnOverlayClick, isOpen, onClose]
  );

  // Focus trap implementation
  const handleTabKey = useCallback(
    (event: KeyboardEvent) => {
      if (!dialogRef.current || event.key !== 'Tab') return;

      const focusableElements = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[
        focusableElements.length - 1
      ] as HTMLElement;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    []
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleTabKey);
      return () => {
        document.removeEventListener('keydown', handleTabKey);
      };
    }
  }, [isOpen, handleTabKey]);

  if (!isOpen) return null;

  return (
    <StyledOverlay
      isOpen={isOpen}
      onClick={handleOverlayClick}
      role="presentation"
      data-testid="dialog-overlay"
    >
      <StyledDialog
        ref={dialogRef}
        size={size}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
        aria-hidden={!isOpen}
        className={className}
        tabIndex={-1}
        data-testid="dialog"
      >
        <StyledHeader>
          <StyledTitle>{title}</StyledTitle>
          {showCloseButton && (
            <Button
              variant={ButtonVariant.SECONDARY}
              onClick={onClose}
              ariaLabel="Close dialog"
            >
              <Icon
                name="close"
                type={IconType.UI}
                size={IconSize.SMALL}
                ariaLabel="Close"
              />
            </Button>
          )}
        </StyledHeader>
        <StyledContent>{children}</StyledContent>
        <StyledFooter>
          {/* Footer content rendered via children */}
        </StyledFooter>
      </StyledDialog>
    </StyledOverlay>
  );
};

export default Dialog;