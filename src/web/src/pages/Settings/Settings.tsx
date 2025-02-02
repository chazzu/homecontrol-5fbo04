import React, { useCallback, useMemo, Suspense, lazy } from 'react';
import styled from 'styled-components'; // ^6.0.0
import { SettingsProps, SettingsTabId } from './Settings.types';
import { useTheme } from '../../hooks/useTheme';
import { usePlugin } from '../../hooks/usePlugin';

// Lazy-loaded tab components for performance optimization
const AppearanceTab = lazy(() => import('./tabs/AppearanceTab'));
const PluginsTab = lazy(() => import('./tabs/PluginsTab'));
const AdvancedTab = lazy(() => import('./tabs/AdvancedTab'));

// Styled components with theme support
const SettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 2rem;
  background-color: var(--color-background);
  color: var(--color-text);
  min-height: 100vh;
  
  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const TabContainer = styled.div`
  display: flex;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 2rem;
`;

const TabButton = styled.button<{ active: boolean }>`
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  color: ${props => props.active ? 'var(--color-primary)' : 'var(--color-text)'};
  border-bottom: 2px solid ${props => props.active ? 'var(--color-primary)' : 'transparent'};
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1rem;
  
  &:hover {
    color: var(--color-primary);
  }
  
  &:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`;

const LoadingFallback = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--color-text);
`;

const ErrorBoundary = styled.div`
  padding: 1rem;
  border: 1px solid var(--color-error);
  border-radius: 4px;
  color: var(--color-error);
  margin: 1rem 0;
`;

/**
 * Settings component providing user interface for application configuration
 * Implements theme switching, plugin management, and advanced settings
 */
export const Settings: React.FC<SettingsProps> = React.memo(({ activeTab, onTabChange }) => {
  const { theme, setTheme, toggleTheme } = useTheme();
  const { 
    plugins, 
    loadPlugin, 
    unloadPlugin, 
    getPluginMetrics,
    validatePlugin 
  } = usePlugin();

  // Memoized tab configuration
  const tabs = useMemo(() => [
    { id: SettingsTabId.APPEARANCE, label: 'Appearance', icon: '🎨' },
    { id: SettingsTabId.PLUGINS, label: 'Plugins', icon: '🔌' },
    { id: SettingsTabId.ADVANCED, label: 'Advanced', icon: '⚙️' }
  ], []);

  // Performance-optimized theme change handler
  const handleThemeChange = useCallback((mode: 'light' | 'dark') => {
    const startTime = performance.now();
    
    setTheme(mode === 'light' ? 
      require('../../assets/styles/themes/light').default :
      require('../../assets/styles/themes/dark').default
    );
    
    const endTime = performance.now();
    console.debug(`Theme switch took ${endTime - startTime}ms`);
  }, [setTheme]);

  // Enhanced plugin management with security validation
  const handlePluginToggle = useCallback(async (pluginId: string, enabled: boolean) => {
    try {
      if (enabled) {
        const plugin = plugins.get(pluginId);
        if (plugin && validatePlugin(plugin)) {
          await loadPlugin(plugin, {
            timeout: 5000,
            retryAttempts: 3,
            validateManifest: true
          });
        }
      } else {
        await unloadPlugin(pluginId);
      }
    } catch (error) {
      console.error('Plugin operation failed:', error);
      throw error;
    }
  }, [plugins, loadPlugin, unloadPlugin, validatePlugin]);

  // Render active tab content with error boundary
  const renderTabContent = useCallback(() => {
    try {
      switch (activeTab) {
        case SettingsTabId.APPEARANCE:
          return (
            <AppearanceTab
              currentTheme={theme}
              onThemeChange={handleThemeChange}
              onThemeToggle={toggleTheme}
            />
          );
        case SettingsTabId.PLUGINS:
          return (
            <PluginsTab
              plugins={plugins}
              onPluginToggle={handlePluginToggle}
              getMetrics={getPluginMetrics}
            />
          );
        case SettingsTabId.ADVANCED:
          return <AdvancedTab />;
        default:
          return null;
      }
    } catch (error) {
      console.error('Tab render error:', error);
      return (
        <ErrorBoundary>
          An error occurred while loading this section.
          Please try refreshing the page.
        </ErrorBoundary>
      );
    }
  }, [activeTab, theme, handleThemeChange, toggleTheme, plugins, handlePluginToggle, getPluginMetrics]);

  return (
    <SettingsContainer role="main" aria-label="Settings">
      <TabContainer role="tablist">
        {tabs.map(tab => (
          <TabButton
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            active={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-controls={`${tab.id}-panel`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </TabButton>
        ))}
      </TabContainer>

      <Suspense fallback={<LoadingFallback>Loading settings...</LoadingFallback>}>
        <div
          role="tabpanel"
          id={`${activeTab}-panel`}
          aria-labelledby={`${activeTab}-tab`}
        >
          {renderTabContent()}
        </div>
      </Suspense>
    </SettingsContainer>
  );
});

Settings.displayName = 'Settings';

export default Settings;