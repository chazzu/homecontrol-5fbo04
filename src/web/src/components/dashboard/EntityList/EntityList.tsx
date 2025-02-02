import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components'; // v6.0.0
import { VirtualList } from 'react-virtual'; // v3.0.0
import { EntityListProps, EntityListItemProps, EntityAnimationState } from './EntityList.types';
import { useEntity } from '../../../hooks/useEntity';
import { Icon } from '../../common/Icon/Icon';
import { PERFORMANCE_THRESHOLDS, UI_CONSTANTS } from '../../../config/constants';

// Styled components for the entity list
const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--background-color);
  border-right: 1px solid var(--border-color);
`;

const SearchInput = styled.input`
  padding: 12px;
  margin: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
`;

const VirtualizedList = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const EntityItem = styled.div<{ $isDragging: boolean; $isSelected: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px;
  cursor: grab;
  background: ${props => props.$isSelected ? 'var(--selected-background)' : 'transparent'};
  opacity: ${props => props.$isDragging ? 0.5 : 1};
  transition: background-color 0.2s ease, transform 0.2s ease;
  
  &:hover {
    background: var(--hover-background);
  }
  
  &:active {
    cursor: grabbing;
  }
`;

const EntityInfo = styled.div`
  margin-left: 12px;
  flex: 1;
`;

const EntityName = styled.div`
  font-weight: 500;
  color: var(--text-primary);
`;

const EntityState = styled.div`
  font-size: 12px;
  color: var(--text-secondary);
`;

const EntityList: React.FC<EntityListProps> = ({
  entities,
  selectedType,
  searchQuery,
  onDragStart,
  onSelect,
  virtualized = true
}) => {
  // Local state for drag operations and selection
  const [draggingEntity, setDraggingEntity] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  // Filter entities based on type and search query
  const filteredEntities = useMemo(() => {
    const startTime = performance.now();
    
    let result = entities;
    
    if (selectedType) {
      result = result.filter(entity => entity.type === selectedType);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(entity => 
        entity.entity_id.toLowerCase().includes(query) ||
        entity.display_name?.toLowerCase().includes(query)
      );
    }
    
    const filterTime = performance.now() - startTime;
    if (filterTime > PERFORMANCE_THRESHOLDS.maxResponseTime) {
      console.warn(`Entity filtering exceeded performance threshold: ${filterTime}ms`);
    }
    
    return result;
  }, [entities, selectedType, searchQuery]);

  // Handle drag start with enhanced touch support
  const handleDragStart = useCallback((entity: EntityConfig, event: React.DragEvent | React.TouchEvent) => {
    const startTime = performance.now();
    
    if (event.type === 'dragstart') {
      const dragEvent = event as React.DragEvent;
      dragEvent.dataTransfer.setData('text/plain', entity.entity_id);
      dragEvent.dataTransfer.effectAllowed = 'move';
    }
    
    setDraggingEntity(entity.entity_id);
    onDragStart?.(entity, event);
    
    const dragTime = performance.now() - startTime;
    if (dragTime > PERFORMANCE_THRESHOLDS.maxResponseTime) {
      console.warn(`Drag start operation exceeded performance threshold: ${dragTime}ms`);
    }
  }, [onDragStart]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggingEntity(null);
  }, []);

  // Handle entity selection
  const handleSelect = useCallback((entity: EntityConfig) => {
    setSelectedEntity(entity.entity_id);
    onSelect?.(entity);
  }, [onSelect]);

  // Render individual entity item
  const renderEntityItem = useCallback(({ entity, style }: { entity: EntityConfig; style?: React.CSSProperties }) => {
    const { state: entityState } = useEntity(entity.entity_id);
    const isDragging = draggingEntity === entity.entity_id;
    const isSelected = selectedEntity === entity.entity_id;

    return (
      <EntityItem
        key={entity.entity_id}
        style={style}
        $isDragging={isDragging}
        $isSelected={isSelected}
        draggable
        onDragStart={(e) => handleDragStart(entity, e)}
        onDragEnd={handleDragEnd}
        onClick={() => handleSelect(entity)}
        role="listitem"
        aria-selected={isSelected}
        data-testid={`entity-item-${entity.entity_id}`}
      >
        <Icon
          name={entity.icon_override || entity.type}
          type="device"
          size="medium"
          aria-hidden="true"
        />
        <EntityInfo>
          <EntityName>{entity.display_name || entity.entity_id}</EntityName>
          <EntityState>{entityState?.state || 'unavailable'}</EntityState>
        </EntityInfo>
      </EntityItem>
    );
  }, [draggingEntity, selectedEntity, handleDragStart, handleDragEnd, handleSelect]);

  // Render list content with optional virtualization
  const renderListContent = () => {
    if (!virtualized) {
      return filteredEntities.map(entity => renderEntityItem({ entity }));
    }

    return (
      <VirtualList
        data={filteredEntities}
        height="100%"
        itemSize={72} // Height of each entity item
        overscan={5}
      >
        {({ index, style }) => renderEntityItem({
          entity: filteredEntities[index],
          style
        })}
      </VirtualList>
    );
  };

  return (
    <ListContainer role="list" aria-label="Entity List">
      <SearchInput
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange?.(e.target.value)}
        placeholder="Search entities..."
        aria-label="Search entities"
      />
      <VirtualizedList>
        {renderListContent()}
      </VirtualizedList>
    </ListContainer>
  );
};

export default React.memo(EntityList);