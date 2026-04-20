# Phase 3: DSL Evolution

## Goal
Deepen the DSL to support complex RPG mechanics, including genetic inheritance (Mail Order Monsters style), advanced stat mathematics, and a robust inventory system.

## Tasks

### 1. Genetic Systems
- [ ] Add `Genetic` component type to `CartridgeSchema`.
- [ ] Implement `Trait` definitions in the DSL (properties that can be inherited).
- [ ] Create a `GeneticsService` to handle "Crossover" and "Mutation" logic between two entities.

### 2. Advanced Stat Math & Expressions
- [ ] Integrate `expr-eval` more deeply into the `SystemExecutor`.
- [ ] Allow systems to reference other component values in expressions (e.g., `damage = "attacker.Strength * 2 + attacker.Weapon.power - defender.Armor.defense"`).
- [ ] Implement "Derived Stats" (stats calculated automatically from other components).

### 3. Inventory & Equipment
- [ ] Implement `Inventory` component type (list of Entity IDs).
- [ ] Add `Equippable` component for items with `slot` and `modifiers`.
- [ ] Update `SystemExecutor` to apply equipment modifiers to base stats during expression evaluation.

### 4. Status Effects (Buffs/Debuffs)
- [ ] Add `StatusEffects` component (list of active effects).
- [ ] Implement "Duration" and "Tick" logic in the game loop.
- [ ] Support conditional modifiers (e.g., "Attack +5 while Health < 20%").

### 5. Verification
- [ ] Create a "Monster Lab" benchmark cartridge demonstrating breeding and mutations.
- [ ] Create an "RPG Combat" benchmark cartridge with equipment and status effects.
- [ ] Verify that complex expressions evaluate correctly with real entity data.

## Success Criteria
- Two entities can "breed" to produce a new entity with mixed stats/traits.
- Equipment correctly modifies an entity's effective stats.
- Complex mathematical expressions in the DSL correctly resolve entity-to-entity interactions.
