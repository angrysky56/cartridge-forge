import { World } from '../ecs/world.js';
import type { Entity, ComponentName, ComponentDefinition } from '../ecs/types.js';

export interface SerializedEntity {
  id: string;
  tags: string[];
  components: Record<string, any>;
}

export interface SaveData {
  entities: SerializedEntity[];
  turnCount: number;
  nextEntityId: number;
  playerId: string | null;
  mapTiles?: number[][]; // [y][x] TileType enum values
}

export class PersistenceService {
  constructor(private world: World) {}

  /** Serialize the current world and game state */
  save(turnCount: number, playerId: string | null, mapTiles?: number[][]): SaveData {
    const persistentEntities = this.world.allEntities().filter(e => e.persistent);
    const componentDefs = (this.world as any).componentDefs as Map<ComponentName, ComponentDefinition>;

    const serializedEntities: SerializedEntity[] = persistentEntities.map(entity => {
      const components: Record<string, any> = {};
      
      for (const [name, data] of entity.components) {
        const def = componentDefs.get(name);
        if (def?.persistent) {
          components[name] = structuredClone(data);
        }
      }

      return {
        id: entity.id,
        tags: Array.from(entity.tags),
        components
      };
    });

    return {
      entities: serializedEntities,
      turnCount,
      nextEntityId: (this.world as any).nextEntityId,
      playerId,
      mapTiles
    };
  }

  /** Restore the world and return game metadata */
  load(data: SaveData): { turnCount: number; playerId: string | null; mapTiles?: number[][] } {
    this.world.clear();
    
    // Restore internal counter
    (this.world as any).nextEntityId = data.nextEntityId;

    // Manually reconstruct entities
    // We don't use world.spawn because we want to preserve IDs and partial components
    const worldEntities = (this.world as any).entities as Map<string, Entity>;
    
    for (const sEntity of data.entities) {
      const entity: Entity = {
        id: sEntity.id,
        tags: new Set(sEntity.tags),
        components: new Map(Object.entries(sEntity.components)),
        destroyed: false,
        persistent: true // If it was saved, it's persistent
      };
      worldEntities.set(entity.id, entity);
    }

    return {
      turnCount: data.turnCount,
      playerId: data.playerId,
      mapTiles: data.mapTiles
    };
  }
}
