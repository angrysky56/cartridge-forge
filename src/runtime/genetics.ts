/**
 * Genetics Service — handles breeding, mutation, and trait inheritance.
 * Inspired by Mail Order Monsters.
 */

import type { World } from '../ecs/world.js';
import type { Entity, EntityId } from '../ecs/types.js';

export interface GeneticData {
  traits: string[];
  mutation_rate: number;
}

export class GeneticsService {
  private traitDefs: Record<string, any> = {};

  constructor(private world: World, traitDefs?: Record<string, any>) {
    if (traitDefs) this.traitDefs = traitDefs;
  }

  setTraits(traits: Record<string, any>): void {
    this.traitDefs = traits;
  }

  /** Breed two entities to create a new blueprint object */
  breed(parentA: Entity, parentB: Entity): Record<string, any> {
    const childBlueprint: Record<string, any> = {};

    // 1. Inherit/Average numerical stats
    const allComponents = new Set([
      ...parentA.components.keys(),
      ...parentB.components.keys()
    ]);

    for (const compName of allComponents) {
      if (compName === 'Position' || compName === 'Genetic') continue;

      const valA = parentA.components.get(compName);
      const valB = parentB.components.get(compName);

      if (valA && valB) {
        // Average numerical fields
        const averaged: Record<string, any> = {};
        for (const field of Object.keys(valA)) {
          if (typeof valA[field] === 'number' && typeof valB[field] === 'number') {
            averaged[field] = Math.round((valA[field] + valB[field]) / 2);
          } else {
            averaged[field] = valA[field]; // Default to Parent A for non-numeric
          }
        }
        childBlueprint[compName] = averaged;
      } else {
        // Inherit from the parent that has it (50/50 chance)
        if (Math.random() > 0.5) {
          if (valA) childBlueprint[compName] = { ...valA };
          else if (valB) childBlueprint[compName] = { ...valB };
        }
      }
    }

    // 2. Trait Crossover
    const genA = parentA.components.get('Genetic') as GeneticData | undefined;
    const genB = parentB.components.get('Genetic') as GeneticData | undefined;

    if (genA || genB) {
      const parentTraits = new Set([...(genA?.traits || []), ...(genB?.traits || [])]);
      const childTraits: string[] = [];
      const mutationRate = (genA?.mutation_rate || 0.05 + (genB?.mutation_rate || 0.05)) / 2;

      for (const trait of parentTraits) {
        // Each parent trait has a chance to be inherited
        if (Math.random() > 0.4) {
          childTraits.push(trait);
        }
      }

      // 3. Mutation
      if (Math.random() < mutationRate) {
        const allAvailableTraits = Object.keys(this.traitDefs);
        const randomTrait = allAvailableTraits[Math.floor(Math.random() * allAvailableTraits.length)];
        if (randomTrait && !childTraits.includes(randomTrait)) {
          childTraits.push(randomTrait);
        }
      }

      childBlueprint['Genetic'] = {
        traits: childTraits,
        mutation_rate: mutationRate
      };
    }

    return childBlueprint;
  }

  /** Apply trait modifiers to an entity's current components */
  applyTraits(entity: Entity): void {
    const gen = entity.components.get('Genetic') as GeneticData | undefined;
    if (!gen) return;

    for (const traitName of gen.traits) {
      const modifiers = this.traitDefs[traitName];
      if (!modifiers) continue;

      for (const [path, mod] of Object.entries(modifiers)) {
        const [compName, fieldName] = path.split('.');
        if (compName && fieldName) {
          const comp = entity.components.get(compName);
          if (comp && fieldName in comp) {
            (comp as any)[fieldName] += mod;
          }
        }
      }
    }
  }
}
