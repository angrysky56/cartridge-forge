/**
 * Game Runtime — the turn-based game loop that connects all subsystems.
 * Handles: cartridge loading → world init → map gen → input → turn processing → render
 */

import { World } from "../ecs/world.js";
import { SystemExecutor, type GameEvent } from "../dsl/executor.js";
import type { IRenderer } from "../renderer/types.js";
import { RendererFactory } from "../renderer/factory.js";
import { generateMap, type GameMap, TileType } from "./mapgen.js";
import { PersistenceService, type SaveData } from "./persistence.js";
import { GeneticsService } from "./genetics.js";
import { InventoryService } from "./inventory.js";
import { sound } from "./audio.js";
import type { Cartridge } from "../cartridge/schema.js";
import type { Entity, EntityId } from "../ecs/types.js";

/** Game state phases */
export type GamePhase = "LOADING" | "PLAYER_TURN" | "ENEMY_TURN" | "GAME_OVER";

type InputAction = { dx?: number; dy?: number; rotate?: number };

/** Turn direction mappings */
const DIRECTIONS: Record<string, InputAction> = {
  // Arrow keys
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  // Standard WASD
  w: { dx: 0, dy: -1 },
  W: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  S: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  A: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
  D: { dx: 1, dy: 0 },
  // Rotation keys for 3D modes
  q: { rotate: -1 },
  Q: { rotate: -1 },
  e: { rotate: 1 },
  E: { rotate: 1 },
  // Wait / rest turn
  " ": { dx: 0, dy: 0 },
  ".": { dx: 0, dy: 0 },
  "5": { dx: 0, dy: 0 },
  // Numpad / vi keys for diagonal support
  y: { dx: -1, dy: -1 },
  u: { dx: 1, dy: -1 },
  b: { dx: -1, dy: 1 },
  n: { dx: 1, dy: 1 },
  h: { dx: -1, dy: 0 },
  l: { dx: 1, dy: 0 },
  k: { dx: 0, dy: -1 },
  j: { dx: 0, dy: 1 },
};

export class Game {
  private world: World;
  private executor: SystemExecutor;
  private renderer: IRenderer;
  private persistence: PersistenceService;
  private genetics: GeneticsService;
  private inventory: InventoryService;
  private map!: GameMap;
  private cartridge!: Cartridge;
  private phase: GamePhase = "LOADING";
  private playerId: EntityId | null = null;
  private turnCount = 0;
  private depth = 1;

  // Progression & Stats
  private level = 1;
  private xp = 0;
  private xpToNextLevel = 50;
  private monstersSlain = 0;
  private chestsOpened = 0;
  private secretsFound = 0;
  private dashCooldown = 0;
  private bashCooldown = 0;
  private fireballCooldown = 0;
  private lightningCooldown = 0;
  private frostCooldown = 0;
  private speedBuffTurns = 0;
  private enemyEnergy = new Map<EntityId, number>();
  private swarmCountdown: number | null = null;
  private activeBossId: EntityId | null = null;
  private shopCallback?: (merchant: Entity) => void;
  private lastDirection = { dx: 0, dy: -1 };

  /** UI callback for combat log messages */
  private logCallback: (msg: string) => void;
  /** UI callback for stats panel updates */
  private statsCallback: (entity: Entity | undefined) => void;

  private canvas: HTMLCanvasElement;

  constructor(
    canvas: HTMLCanvasElement,
    logCallback: (msg: string) => void,
    statsCallback: (entity: Entity | undefined) => void,
  ) {
    this.canvas = canvas;
    this.world = new World();
    this.persistence = new PersistenceService(this.world);
    this.genetics = new GeneticsService(this.world);
    this.inventory = new InventoryService(this.world);
    this.logCallback = logCallback;
    this.statsCallback = statsCallback;

    this.executor = new SystemExecutor(
      this.world,
      logCallback,
      this.genetics,
      this.inventory,
    );

    // Initial renderer (GRID_2D)
    this.renderer = RendererFactory.create("GRID_2D", {
      canvas,
      cellSize: 28,
      palette: {},
      fontFamily: "'JetBrains Mono', monospace",
    });
  }

  /** Load and initialize a validated cartridge */
  loadCartridge(cartridge: Cartridge): void {
    this.cartridge = cartridge;
    this.world.clear();
    this.turnCount = 0;
    this.depth = 1;
    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = 50;
    this.monstersSlain = 0;
    this.chestsOpened = 0;
    this.secretsFound = 0;
    this.dashCooldown = 0;
    this.bashCooldown = 0;
    this.fireballCooldown = 0;
    this.lightningCooldown = 0;
    this.frostCooldown = 0;
    this.speedBuffTurns = 0;
    this.enemyEnergy.clear();
    this.swarmCountdown = null;
    this.activeBossId = null;
    this.lastDirection = { dx: 0, dy: -1 };

    // Update renderer from cartridge config
    const activeCanvas =
      (typeof document !== "undefined"
        ? (document.getElementById("game-canvas") as HTMLCanvasElement)
        : null) || this.canvas;
    this.renderer = RendererFactory.create(cartridge.meta.renderer_mode, {
      canvas: activeCanvas,
      cellSize: 28,
      palette: cartridge.meta.palette ?? {},
      fontFamily: "'JetBrains Mono', monospace",
    });

    if (this.renderer && "resetExploration" in (this.renderer as any)) {
      (this.renderer as any).resetExploration();
    }

    // Register component definitions
    const compDefs: any = {};
    for (const [name, def] of Object.entries(cartridge.components)) {
      if ("fields" in def) {
        compDefs[name] = { name, ...def };
      } else {
        // Simple format -> convert to full
        compDefs[name] = { name, fields: def, persistent: true };
      }
    }
    this.world.registerComponentDefinitions(compDefs);

    // Register comprehensive roguelike blueprints
    const blueprints: Record<string, any> = {
      stairs: {
        Renderable: { glyph: "🪜", color: "#ffd700", layer: 1 },
        Glyph: { char: "🪜", color: "#ffd700" },
        Description: {
          name: "Dungeon Stairs",
          text: "Descend to deeper complex",
        },
      },
      chest: {
        Renderable: { glyph: "📦", color: "#ffd700", layer: 1 },
        Glyph: { char: "📦", color: "#ffd700" },
        Description: {
          name: "Treasure Chest",
          text: "Contains guaranteed equipment or potions.",
        },
      },
      cracked_wall: {
        Renderable: { glyph: "🧱", color: "#aa9977", layer: 1 },
        Glyph: { char: "🧱", color: "#aa9977" },
        Description: {
          name: "Cracked Secret Wall",
          text: "Brittle masonry hiding a secret.",
        },
      },
      shrine: {
        Renderable: { glyph: "✨", color: "#ff00ea", layer: 1 },
        Glyph: { char: "✨", color: "#ff00ea" },
        Description: {
          name: "Ancient Shrine",
          text: "Step to receive ancient blessings.",
        },
      },
      shrine_life: {
        Renderable: { glyph: "💖", color: "#00ff88", layer: 1 },
        Glyph: { char: "💖", color: "#00ff88" },
        Description: {
          name: "Sanctuary of Life",
          text: "Restores full health and grants +20 Max HP.",
        },
      },
      shrine_might: {
        Renderable: { glyph: "⚔️", color: "#ff3344", layer: 1 },
        Glyph: { char: "⚔️", color: "#ff3344" },
        Description: {
          name: "Altar of Might",
          text: "Permanently increases Strength by +4.",
        },
      },
      shrine_aegis: {
        Renderable: { glyph: "🛡️", color: "#00f0ff", layer: 1 },
        Glyph: { char: "🛡️", color: "#00f0ff" },
        Description: {
          name: "Altar of Aegis",
          text: "Permanently increases Armor by +3.",
        },
      },
      shrine_blood: {
        Renderable: { glyph: "🩸", color: "#ff0055", layer: 1 },
        Glyph: { char: "🩸", color: "#ff0055" },
        Description: {
          name: "Blood Altar",
          text: "Sacrifices 20 HP in exchange for a Rare Set Relic.",
        },
      },
      // Reach & Ranged Weapons
      iron_spear: {
        Renderable: { glyph: "🗡️", color: "#00e5ff", layer: 1 },
        Glyph: { char: "🗡️", color: "#00e5ff" },
        Equippable: {
          slot: "weapon",
          modifiers: { "CombatStats.strength": 8 },
        },
        WeaponType: { category: "reach", reach: 2 },
        Description: {
          name: "Iron Pike (Reach 2)",
          text: "Thrusting spear able to strike enemies 2 tiles away.",
        },
      },
      composite_bow: {
        Renderable: { glyph: "🏹", color: "#44ff88", layer: 1 },
        Glyph: { char: "🏹", color: "#44ff88" },
        Equippable: {
          slot: "weapon",
          modifiers: { "CombatStats.strength": 7 },
        },
        WeaponType: { category: "ranged", range: 6 },
        Description: {
          name: "Composite Bow (Ranged)",
          text: "Long bow striking enemies across corridors.",
        },
      },
      archmage_staff: {
        Renderable: { glyph: "🪄", color: "#bf55ec", layer: 1 },
        Glyph: { char: "🪄", color: "#bf55ec" },
        Equippable: {
          slot: "weapon",
          modifiers: { "CombatStats.strength": 12 },
        },
        WeaponType: { category: "magic" },
        SetItem: { setName: "archmage", pieceName: "Archmage Staff" },
        Description: {
          name: "Archmage Staff",
          text: "Arcane staff imbued with spellfire (+12 STR).",
        },
      },
      // Ironclad Bulwark Set
      ironclad_helm: {
        Renderable: { glyph: "🪖", color: "#00e5ff", layer: 1 },
        Glyph: { char: "🪖", color: "#00e5ff" },
        Equippable: { slot: "helm", modifiers: { "CombatStats.armor": 3 } },
        SetItem: { setName: "ironclad", pieceName: "Ironclad Helm" },
        Description: {
          name: "Ironclad Helm",
          text: "Heavy forged visor (+3 DEF).",
        },
      },
      ironclad_plate: {
        Renderable: { glyph: "🦺", color: "#00e5ff", layer: 1 },
        Glyph: { char: "🦺", color: "#00e5ff" },
        Equippable: { slot: "armor", modifiers: { "CombatStats.armor": 7 } },
        SetItem: { setName: "ironclad", pieceName: "Ironclad Plate" },
        Description: {
          name: "Ironclad Plate",
          text: "Solid steel chest armor (+7 DEF).",
        },
      },
      ironclad_shield: {
        Renderable: { glyph: "🛡️", color: "#00e5ff", layer: 1 },
        Glyph: { char: "🛡️", color: "#00e5ff" },
        Equippable: { slot: "offhand", modifiers: { "CombatStats.armor": 5 } },
        SetItem: { setName: "ironclad", pieceName: "Ironclad Shield" },
        Description: {
          name: "Ironclad Shield",
          text: "Tower shield (+5 DEF).",
        },
      },
      // Shadowstalker Set
      shadow_cowl: {
        Renderable: { glyph: "🥷", color: "#9933ff", layer: 1 },
        Glyph: { char: "🥷", color: "#9933ff" },
        Equippable: { slot: "helm", modifiers: { "CombatStats.armor": 2 } },
        SetItem: { setName: "shadow", pieceName: "Shadow Cowl" },
        Description: {
          name: "Shadow Cowl",
          text: "Silk cowl increasing evasion (+2 DEF).",
        },
      },
      shadow_cloak: {
        Renderable: { glyph: "🥋", color: "#9933ff", layer: 1 },
        Glyph: { char: "🥋", color: "#9933ff" },
        Equippable: { slot: "armor", modifiers: { "CombatStats.armor": 4 } },
        SetItem: { setName: "shadow", pieceName: "Shadow Cloak" },
        Description: {
          name: "Shadow Cloak",
          text: "Lightweight shroud (+4 DEF).",
        },
      },
      shadow_ring: {
        Renderable: { glyph: "💍", color: "#9933ff", layer: 1 },
        Glyph: { char: "💍", color: "#9933ff" },
        Equippable: { slot: "ring", modifiers: { "CombatStats.strength": 4 } },
        SetItem: { setName: "shadow", pieceName: "Shadow Band" },
        Description: {
          name: "Shadow Ring",
          text: "Pulsing ring of swiftness (+4 STR).",
        },
      },
      // Archmage Regalia Set
      archmage_hood: {
        Renderable: { glyph: "👑", color: "#bf55ec", layer: 1 },
        Glyph: { char: "👑", color: "#bf55ec" },
        Equippable: {
          slot: "helm",
          modifiers: { "CombatStats.armor": 2, "CombatStats.strength": 3 },
        },
        SetItem: { setName: "archmage", pieceName: "Archmage Hood" },
        Description: {
          name: "Archmage Hood",
          text: "Enchanted hood (+2 DEF, +3 STR).",
        },
      },
      archmage_robe: {
        Renderable: { glyph: "🥻", color: "#bf55ec", layer: 1 },
        Glyph: { char: "🥻", color: "#bf55ec" },
        Equippable: {
          slot: "armor",
          modifiers: { "CombatStats.armor": 4, "CombatStats.strength": 5 },
        },
        SetItem: { setName: "archmage", pieceName: "Archmage Robe" },
        Description: {
          name: "Archmage Robe",
          text: "Woven with magical runes (+4 DEF, +5 STR).",
        },
      },
      // Consumables
      speed_potion: {
        Renderable: { glyph: "⚡", color: "#ffea00", layer: 1 },
        Glyph: { char: "⚡", color: "#ffea00" },
        Consumable: { effect: "speed", value: 15 },
        Description: {
          name: "Elixir of Swiftness",
          text: "Surges movement speed by +50% for 15 turns.",
        },
      },
      teleport_scroll: {
        Renderable: { glyph: "📜", color: "#00ffff", layer: 1 },
        Glyph: { char: "📜", color: "#00ffff" },
        Consumable: { effect: "teleport", value: 1 },
        Description: {
          name: "Scroll of Blink",
          text: "Teleports instantly to a safe position.",
        },
      },
      health_potion: {
        Renderable: { glyph: "🧪", color: "#00f0ff", layer: 1 },
        Glyph: { char: "🧪", color: "#00f0ff" },
        Consumable: { effect: "heal", value: 45 },
        HealthPack: { healAmount: 45 },
        Description: {
          name: "Health Elixir",
          text: "Restores 45 vital health.",
        },
      },
      // Drops & NPCs
      gold_drop: {
        Renderable: { glyph: "💰", color: "#ffd700", layer: 1 },
        Glyph: { char: "💰", color: "#ffd700" },
        Gold: { amount: 15 },
        Description: {
          name: "Gold Coins",
          text: "Ancient coins accepted by dungeon merchants.",
        },
      },
      merchant: {
        Renderable: { glyph: "🧙‍♂️", color: "#00ff88", layer: 2 },
        Glyph: { char: "🧙‍♂️", color: "#00ff88" },
        Merchant: { isMerchant: true },
        Description: {
          name: "Grimm the Peddler",
          text: "Bump to trade gold for weapons, armor, and elixirs.",
        },
      },
      horn_scout: {
        Renderable: { glyph: "📯", color: "#ff0033", layer: 2 },
        Glyph: { char: "📯", color: "#ff0033" },
        Health: { current: 35, max: 35 },
        CombatStats: { strength: 10, armor: 1 },
        Faction: { id: "monster" },
        Description: {
          name: "Goblin Hornblower",
          text: "Carries a brass horn to sound dungeon alarms.",
        },
      },
      minotaur_boss: {
        Renderable: { glyph: "🐂", color: "#ff0055", layer: 2 },
        Glyph: { char: "🐂", color: "#ff0055" },
        Health: { current: 220, max: 220 },
        CombatStats: { strength: 22, armor: 6 },
        Faction: { id: "monster" },
        Description: {
          name: "Minotaur Crypt Lord",
          text: "The ancient guardian of the labyrinth.",
        },
      },
      lich_boss: {
        Renderable: { glyph: "☠️", color: "#bf55ec", layer: 2 },
        Glyph: { char: "☠️", color: "#bf55ec" },
        Health: { current: 320, max: 320 },
        CombatStats: { strength: 26, armor: 7 },
        Faction: { id: "monster" },
        Description: {
          name: "Lich King of the Forgotten",
          text: "Undead arch-sorcerer ruling the deep catacombs.",
        },
      },
      ...cartridge.blueprints,
    };
    this.world.registerBlueprints(blueprints);

    // Configure genetics
    if (cartridge.traits) {
      this.genetics.setTraits(cartridge.traits);
    }

    // Load systems
    this.executor.loadSystems(cartridge.systems);

    // Generate map for starting depth (1)
    this.map = generateMap(cartridge, 1);

    // Shuffle floor tiles for random placement
    const available = [...this.map.floorTiles];
    this.shuffleArray(available);

    // Find and spawn player blueprint (first blueprint with Faction.id === "player")
    let spawnIdx = 0;
    for (const [name, bp] of Object.entries(cartridge.blueprints)) {
      const faction = bp["Faction"] as { id: string } | undefined;
      if (faction?.id === "player") {
        const playerPos =
          this.map.isBossFloor && this.map.anteRoom
            ? this.map.anteRoom.playerSpawn
            : available[spawnIdx++] || { x: 1, y: 1 };
        const player = this.world.spawn(name, {
          Position: { x: playerPos.x, y: playerPos.y },
        });
        this.playerId = player.id;
        break;
      }
    }

    // Spawn stairs, chests, shrines, and enemies
    this.spawnDungeonFeatures(available, spawnIdx);

    this.phase = "PLAYER_TURN";
    this.logCallback(`=== ${cartridge.meta.title.toUpperCase()} ===`);
    this.logCallback(cartridge.meta.description ?? "A new session begins.");
    this.logCallback(
      "Move: [WASD] | Wait: [Space] | Dash: [1] | Shield Bash: [2]",
    );
    this.render();
    this.statsCallback(this.world.getEntity(this.playerId!));
  }

  /** Handle keyboard input */
  handleInput(key: string): void {
    if (this.phase !== "PLAYER_TURN") return;

    const player = this.playerId
      ? this.world.getEntity(this.playerId)
      : undefined;
    if (!player) return;

    const is3D =
      this.cartridge?.meta.renderer_mode === "CELL_PSEUDO_3D" ||
      this.cartridge?.meta.renderer_mode === "WIREFRAME_3D";
    const pos = player.components.get("Position") as {
      x: number;
      y: number;
      direction?: string;
    };

    // Tactical Abilities & Spells
    if (key === "1") {
      this.usePhaseDash();
      return;
    }
    if (key === "2") {
      this.useShieldBash();
      return;
    }
    if (key === "3") {
      this.useFireball();
      return;
    }
    if (key === "4") {
      this.useLightning();
      return;
    }
    if (key === "5") {
      this.useFrostNova();
      return;
    }
    if (key === "q" || key === "Q") {
      this.drinkHealthPotion();
      return;
    }
    if (key === "e" || key === "E") {
      if (is3D) {
        // Rotate in 3D mode
      } else {
        this.drinkSpeedPotion();
        return;
      }
    }

    // Wait / rest turn
    if (key === " " || key === "." || key === "5") {
      this.logCallback("You wait a turn...");
      sound.playMove();
      this.finishTurn(player);
      return;
    }

    let action = DIRECTIONS[key];
    // In 3D mode, 'a' and 'd' rotate instead of lateral move
    if (is3D && (key === "a" || key === "A")) action = { rotate: -1 };
    if (is3D && (key === "d" || key === "D")) action = { rotate: 1 };

    if (!action) return;

    // Handle rotation in 3D modes
    if (action.rotate !== undefined) {
      const dirs = ["N", "E", "S", "W"];
      const currentIdx = dirs.indexOf(pos.direction || "N");
      const newIdx = (currentIdx + action.rotate + 4) % 4;
      pos.direction = dirs[newIdx];
      sound.playMove();
      this.finishTurn(player);
      return;
    }

    // Handle perspective-aware movement in 3D mode
    let dx = action.dx || 0;
    let dy = action.dy || 0;

    if (
      is3D &&
      pos.direction &&
      (key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "w" ||
        key === "s" ||
        key === "W" ||
        key === "S")
    ) {
      const isForward = key === "ArrowUp" || key === "w" || key === "W";
      const moveScale = isForward ? 1 : -1;
      const perspectiveMap: Record<string, { dx: number; dy: number }> = {
        N: { dx: 0, dy: -1 },
        S: { dx: 0, dy: 1 },
        E: { dx: 1, dy: 0 },
        W: { dx: -1, dy: 0 },
      };
      const pDir = perspectiveMap[pos.direction];
      dx = pDir.dx * moveScale;
      dy = pDir.dy * moveScale;
    }

    this.executeAction({ dx, dy }, player);
  }

  /** Execute a directional action (move, attack, reach-thrust, wait) */
  executeAction(action: { dx: number; dy: number }, player: Entity): void {
    const { dx, dy } = action;
    const pos = player.components.get("Position") as {
      x: number;
      y: number;
      direction?: string;
    };
    if (dx !== 0 || dy !== 0) {
      this.lastDirection = { dx, dy };
    }

    if (dx === 0 && dy === 0) {
      this.logCallback("You wait a turn...");
      sound.playMove();
      this.finishTurn(player);
      return;
    }

    const targetX = pos.x + dx;
    const targetY = pos.y + dy;

    // Check for cracked secret wall collision
    const secretWall = this.getEntityAt(targetX, targetY);
    if (
      secretWall &&
      (secretWall.id.startsWith("cracked_wall_") ||
        (secretWall.components.get("Description") as any)?.name?.includes(
          "Cracked",
        ))
    ) {
      this.map.tiles[targetY][targetX] = TileType.Floor;
      this.world.queueDestroy(secretWall.id);
      this.world.flush();
      this.secretsFound++;
      sound.playHit();
      this.logCallback(
        "The cracked wall crumbles, revealing a hidden passage!",
      );
      if (this.renderer && "addFloatingText" in (this.renderer as any)) {
        (this.renderer as any).addFloatingText(
          targetX,
          targetY,
          "SECRET FOUND!",
          "#00ffcc",
        );
      }
      this.finishTurn(player);
      return;
    }

    // Check wall collision
    if (this.map.tiles[targetY]?.[targetX] === TileType.Wall) return;

    // Check for attackable hostile entity at target position (Distance 1)
    const targetEntity = this.getEntityAt(targetX, targetY, player.id);
    const isAttackable =
      targetEntity &&
      targetEntity.components.has("Health") &&
      ((targetEntity.components.has("Faction") &&
        (targetEntity.components.get("Faction") as any).id !== "player") ||
        targetEntity.components.has("CombatStats"));

    // Check Reach weapon strike at Distance 2 if distance 1 has no target
    const mods = this.inventory.getEquipmentModifiers(player);
    const equippedWeapon = this.inventory.getEquipped(player).weapon;
    const weaponType = equippedWeapon?.components.get("WeaponType") as
      { category: string; reach?: number } | undefined;
    const hasReach =
      weaponType?.category === "reach" ||
      (weaponType?.reach && weaponType.reach >= 2);

    const reachX = pos.x + dx * 2;
    const reachY = pos.y + dy * 2;
    const reachEntity = this.getEntityAt(reachX, reachY, player.id);
    const isReachAttackable =
      !isAttackable &&
      hasReach &&
      reachEntity &&
      reachEntity.components.has("Health") &&
      ((reachEntity.components.has("Faction") &&
        (reachEntity.components.get("Faction") as any).id !== "player") ||
        reachEntity.components.has("CombatStats"));

    if (isAttackable && targetEntity) {
      targetEntity.tags.add("alerted");
      const targetHealthBefore = (
        targetEntity.components.get("Health") as { current: number } | undefined
      )?.current;

      // Bump attack — emit ACTION_ATTACK event
      this.executor.emit({
        name: "ACTION_ATTACK",
        source: player,
        target: targetEntity,
      });
      this.world.flush();

      sound.playAttack();
      let targetHealthAfter = (
        targetEntity.components.get("Health") as { current: number } | undefined
      )?.current;

      // Fallback melee resolution if cartridge doesn't have an active DSL ACTION_ATTACK system
      if (
        targetHealthAfter === undefined ||
        targetHealthAfter === targetHealthBefore
      ) {
        const pStats = player.components.get("CombatStats") as
          Record<string, number> | undefined;
        const pStr =
          (pStats?.strength || 10) + (mods["CombatStats.strength"] || 0);
        const tHealth = targetEntity.components.get("Health") as
          { current: number; max: number } | undefined;
        if (tHealth) {
          const tStats = targetEntity.components.get("CombatStats") as
            Record<string, number> | undefined;
          const tArmor = tStats?.armor || 0;
          const dmg = Math.max(1, pStr - tArmor);
          tHealth.current -= dmg;
          targetHealthAfter = tHealth.current;
        }
      }

      const stillAlive = this.world.getEntity(targetEntity.id);
      const isDead =
        !stillAlive ||
        (targetHealthAfter !== undefined && targetHealthAfter <= 0);

      if (isDead) {
        if (stillAlive) {
          this.world.queueDestroy(targetEntity.id);
          this.world.flush();
        }
        this.handleMonsterDefeat(targetEntity, targetX, targetY, player);
      } else if (
        targetHealthBefore !== undefined &&
        targetHealthAfter !== undefined &&
        targetHealthBefore > targetHealthAfter
      ) {
        const dmg = targetHealthBefore - targetHealthAfter;
        this.addFloatingText(targetX, targetY, `-${dmg}`, "#ff3344");
        sound.playHit();
      }
    } else if (isReachAttackable && reachEntity) {
      // Thrust with reach weapon at 2 tiles away without contact retaliation
      reachEntity.tags.add("alerted");
      const pStats = player.components.get("CombatStats") as
        Record<string, number> | undefined;
      const mods = this.inventory.getEquipmentModifiers(player);
      const pStr =
        (pStats?.strength || 10) + (mods["CombatStats.strength"] || 0);
      const eHealth = reachEntity.components.get("Health") as {
        current: number;
        max: number;
      };

      const damage = Math.floor(pStr * 1.1) + 4;
      eHealth.current -= damage;
      sound.playAttack();
      this.addFloatingText(
        reachX,
        reachY,
        `POLEARM THRUST! -${damage}`,
        "#00e5ff",
      );
      const desc =
        (reachEntity.components.get("Description") as any)?.name || "Enemy";
      this.logCallback(
        `You thrust your spear across the corridor into ${desc} for ${damage} dmg!`,
      );

      if (eHealth.current <= 0) {
        this.world.queueDestroy(reachEntity.id);
        this.world.flush();
        this.handleMonsterDefeat(reachEntity, reachX, reachY, player);
      }
    } else {
      // Move onto tile
      pos.x = targetX;
      pos.y = targetY;
      this.executor.emit({
        name: "ACTION_MOVE",
        source: player,
      });
      this.world.flush();
      sound.playMove();

      // Check for item pickups and interactive entities on this tile
      const itemsOnTile = this.world.allEntities().filter((e) => {
        if (e.id === player.id) return false;
        const ePos = e.components.get("Position") as
          { x: number; y: number } | undefined;
        return ePos && ePos.x === targetX && ePos.y === targetY;
      });

      for (const item of itemsOnTile) {
        const desc = item.components.get("Description") as
          { name: string; text?: string } | undefined;
        const name = desc?.name || "";

        // 1. Dungeon Stairs / Level Transition
        if (
          name.includes("Stairs") ||
          name.includes("Hatch") ||
          item.id.startsWith("stairs_") ||
          item.components.has("Stairs")
        ) {
          this.logCallback(
            `You step onto ${name || "the stairs"} and descend deeper...`,
          );
          sound.playItem();
          this.descendFloor();
          return;
        }

        // 2. Gold Drop
        else if (
          item.components.has("Gold") ||
          item.id.startsWith("gold_drop_")
        ) {
          const goldAmount = (item.components.get("Gold") as any)?.amount || 15;
          this.inventory.addGold(player, goldAmount);
          this.world.queueDestroy(item.id);
          this.world.flush();
          sound.playGold();
          if (this.renderer && "addFloatingText" in (this.renderer as any)) {
            (this.renderer as any).addFloatingText(
              targetX,
              targetY,
              `+${goldAmount} GOLD`,
              "#ffd700",
            );
          }
          this.logCallback(
            `Collected ${goldAmount} Gold Coins! Wallet: ${this.inventory.getGold(player)} Gold`,
          );
          continue;
        }

        // 3. Dungeon Merchant NPC
        else if (
          item.components.has("Merchant") ||
          item.id.startsWith("merchant_") ||
          name.includes("Merchant") ||
          name.includes("Peddler")
        ) {
          this.logCallback(
            'Grimm the Peddler: "Care to browse my wares before facing the arena?"',
          );
          sound.playItem();
          if (this.shopCallback) {
            this.shopCallback(item);
          }
          continue;
        }

        // 4. Treasure Chest
        else if (name.includes("Chest") || item.id.startsWith("chest_")) {
          this.chestsOpened++;
          this.world.queueDestroy(item.id);
          this.world.flush();
          sound.playItem();
          if (this.renderer && "addFloatingText" in (this.renderer as any)) {
            (this.renderer as any).addFloatingText(
              targetX,
              targetY,
              "CHEST OPENED!",
              "#ffd700",
            );
          }
          const lootPool = [
            "iron_spear",
            "composite_bow",
            "ironclad_helm",
            "ironclad_plate",
            "shadow_ring",
            "speed_potion",
            "health_potion",
          ];
          const chosen = lootPool[Math.floor(Math.random() * lootPool.length)];
          this.world.spawn(chosen, { Position: { x: targetX, y: targetY } });
          this.logCallback(
            "You unlocked the Treasure Chest! Loot emerged onto the floor!",
          );
          continue;
        }

        // 5. Specific Shrines
        else if (
          name.includes("Shrine") ||
          name.includes("Altar") ||
          name.includes("Sanctuary") ||
          item.id.startsWith("shrine_")
        ) {
          const pStats = player.components.get("CombatStats") as
            Record<string, number> | undefined;
          const pHealth = player.components.get("Health") as
            { current: number; max: number } | undefined;

          if (item.id.startsWith("shrine_might") || name.includes("Might")) {
            if (pStats) pStats.strength = (pStats.strength || 10) + 4;
            this.addFloatingText(
              targetX,
              targetY,
              "+4 STRENGTH (ALTAR OF MIGHT)",
              "#ff3344",
            );
            this.logCallback(
              "Altar of Might blessed you! (+4 Permanent Strength)!",
            );
            sound.playLevelUp();
          } else if (
            item.id.startsWith("shrine_aegis") ||
            name.includes("Aegis")
          ) {
            if (pStats) pStats.armor = (pStats.armor || 0) + 3;
            this.addFloatingText(
              targetX,
              targetY,
              "+3 ARMOR (ALTAR OF AEGIS)",
              "#00f0ff",
            );
            this.logCallback(
              "Altar of Aegis blessed you! (+3 Permanent Armor)!",
            );
            sound.playLevelUp();
          } else if (
            item.id.startsWith("shrine_blood") ||
            name.includes("Blood")
          ) {
            if (pHealth) pHealth.current = Math.max(1, pHealth.current - 20);
            this.world.spawn("shadow_ring", {
              Position: { x: targetX, y: targetY },
            });
            this.addFloatingText(
              targetX,
              targetY,
              "-20 HP -> BLOOD RELIC SPAWNED!",
              "#ff0055",
            );
            this.logCallback(
              "Blood Altar accepted sacrifice (-20 HP)! A Shadow Ring emerged!",
            );
            sound.playHit();
          } else {
            // Sanctuary of Life / Default
            if (pHealth) {
              pHealth.max += 20;
              pHealth.current = pHealth.max;
            }
            this.addFloatingText(
              targetX,
              targetY,
              "FULL HEAL +20 MAX HP!",
              "#00ffaa",
            );
            this.logCallback(
              "Sanctuary of Life received! (Full Health Restored, +20 Max HP)!",
            );
            sound.playLevelUp();
          }

          this.world.queueDestroy(item.id);
          this.world.flush();
          this.statsCallback(player);
          continue;
        }

        // 6. Equippable Gear or Consumable -> Backpack
        else if (
          item.components.has("Equippable") ||
          item.components.has("Consumable") ||
          item.components.has("HealthPack")
        ) {
          const equippable = item.components.get("Equippable") as
            { slot: string; modifiers: Record<string, number> } | undefined;

          // Auto-equip if slot is empty, otherwise store in backpack
          let equippedDirectly = false;
          if (equippable) {
            const currentEquipped = this.inventory.getEquipped(player);
            const slotNorm = this.inventory.normalizeSlot(equippable.slot);
            if (!currentEquipped[slotNorm]) {
              this.inventory.equip(player, item, equippable.slot);
              equippedDirectly = true;
              sound.playItem();
              this.logCallback(`Equipped ${name || "Gear"} into ${slotNorm}!`);
              if (
                this.renderer &&
                "addFloatingText" in (this.renderer as any)
              ) {
                (this.renderer as any).addFloatingText(
                  targetX,
                  targetY,
                  `Equipped ${name}`,
                  "#00f0ff",
                );
              }
            }
          }

          if (!equippedDirectly) {
            const stowed = this.inventory.addToBackpack(player, item);
            if (stowed) {
              sound.playItem();
              this.logCallback(`Stowed ${name || "Item"} in Backpack [I]!`);
              if (
                this.renderer &&
                "addFloatingText" in (this.renderer as any)
              ) {
                (this.renderer as any).addFloatingText(
                  targetX,
                  targetY,
                  `+ ${name}`,
                  "#ffd700",
                );
              }
            }
          }

          this.statsCallback(player);
        }
      }
      this.world.flush();
    }

    this.finishTurn(player);
  }

  /** Handle mouse click on a map tile (click-to-move or click-to-attack) */
  handleTileClick(targetX: number, targetY: number): void {
    if (this.phase !== "PLAYER_TURN") return;
    const player = this.playerId
      ? this.world.getEntity(this.playerId)
      : undefined;
    if (!player) return;

    const pos = player.components.get("Position") as
      { x: number; y: number } | undefined;
    if (!pos) return;

    const dx = targetX - pos.x;
    const dy = targetY - pos.y;

    // If clicked adjacent tile, move or attack
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && !(dx === 0 && dy === 0)) {
      this.executeAction({ dx, dy }, player);
    } else if (dx === 0 && dy === 0) {
      // Clicked on self = wait
      this.executeAction({ dx: 0, dy: 0 }, player);
    }
  }

  /** Complete turn cycle: enemy actions, status effects, and render */
  private finishTurn(player: Entity): void {
    // Decrement ability and spell cooldowns
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.bashCooldown > 0) this.bashCooldown--;
    if (this.fireballCooldown > 0) this.fireballCooldown--;
    if (this.lightningCooldown > 0) this.lightningCooldown--;
    if (this.frostCooldown > 0) this.frostCooldown--;

    // Speed buff duration countdown
    if (this.speedBuffTurns > 0) {
      this.speedBuffTurns--;
      if (this.speedBuffTurns === 0) {
        this.logCallback("The Swiftness Potion effect has worn off.");
      }
    }

    // Swarm countdown from war horn
    if (this.swarmCountdown !== null) {
      this.swarmCountdown--;
      const pPos = player.components.get("Position") as {
        x: number;
        y: number;
      };
      if (this.swarmCountdown > 0) {
        this.logCallback(
          `[ALERT] Goblin swarm arrival in ${this.swarmCountdown} turns!`,
        );
        this.addFloatingText(
          pPos.x,
          pPos.y,
          `SWARM IN ${this.swarmCountdown}T!`,
          "#ffaa00",
        );
      } else if (this.swarmCountdown <= 0) {
        this.spawnSwarmReinforcements(player);
        this.swarmCountdown = null;
      }
    }

    // Check if player died before enemy turn
    if (!this.world.getEntity(this.playerId!)) {
      this.phase = "GAME_OVER";
      sound.playGameOver();
      this.logCallback("=== GAME OVER ===");
      this.render();
      return;
    }

    // Enemy turn with relative energy clock
    const playerHealthBefore = (
      player.components.get("Health") as { current: number } | undefined
    )?.current;
    this.processEnemyTurns(player);
    this.world.flush();

    const playerHealthAfter = (
      player.components.get("Health") as { current: number } | undefined
    )?.current;
    if (
      playerHealthBefore !== undefined &&
      playerHealthAfter !== undefined &&
      playerHealthBefore > playerHealthAfter
    ) {
      const dmg = playerHealthBefore - playerHealthAfter;
      const pPos = player.components.get("Position") as
        { x: number; y: number } | undefined;
      if (
        pPos &&
        this.renderer &&
        "addFloatingText" in (this.renderer as any)
      ) {
        (this.renderer as any).addFloatingText(
          pPos.x,
          pPos.y,
          `-${dmg}`,
          "#ff0033",
        );
      }
      sound.playHit();
    }

    // Check player again after enemy actions
    if (!this.world.getEntity(this.playerId!)) {
      this.phase = "GAME_OVER";
      sound.playGameOver();
      this.logCallback("=== GAME OVER ===");
      this.render();
      return;
    }

    // Emit TURN_END for status/turn effects
    this.turnCount++;
    this.executor.emit({ name: "TURN_END", source: player });
    this.world.flush();

    this.phase = "PLAYER_TURN";
    this.render();
    this.statsCallback(this.world.getEntity(this.playerId!));
  }

  /** Sensory Enemy AI with Relative Speed Energy System */
  private processEnemyTurns(player: Entity): void {
    const playerPos = player.components.get("Position") as {
      x: number;
      y: number;
    };
    const playerSpeed = this.getPlayerSpeed();

    const enemies = this.world.allEntities().filter((e) => {
      const faction = e.components.get("Faction") as { id: string } | undefined;
      return faction && faction.id !== "player" && e.components.has("Position");
    });

    for (const enemy of enemies) {
      if (!this.world.getEntity(enemy.id)) {
        this.enemyEnergy.delete(enemy.id);
        continue;
      }

      // Check Hornblower alert trigger for swarm countdown
      const desc = (enemy.components.get("Description") as any)?.name || "";
      if (
        (desc.includes("Horn") || enemy.id.startsWith("horn_scout")) &&
        enemy.tags.has("alerted") &&
        this.swarmCountdown === null
      ) {
        this.swarmCountdown = 3;
        sound.playHorn();
        const ePos = enemy.components.get("Position") as {
          x: number;
          y: number;
        };
        this.addFloatingText(
          ePos.x,
          ePos.y,
          "HORN SOUNDED! (3 TURNS)",
          "#ffaa00",
        );
        this.logCallback(
          "*** THE SCOUT BLOWS A WAR HORN! Swarm arrives in 3 turns! ***",
        );
      }

      // If stunned, consume stun effect and reset energy
      if (enemy.tags.has("stunned")) {
        enemy.tags.delete("stunned");
        this.enemyEnergy.set(enemy.id, 0);
        const ePos = enemy.components.get("Position") as {
          x: number;
          y: number;
        };
        if (this.renderer && "addFloatingText" in (this.renderer as any)) {
          (this.renderer as any).addFloatingText(
            ePos.x,
            ePos.y,
            "STUNNED",
            "#ffaa00",
          );
        }
        continue;
      }

      const ePos = enemy.components.get("Position") as { x: number; y: number };
      const adx = Math.abs(playerPos.x - ePos.x);
      const ady = Math.abs(playerPos.y - ePos.y);
      const chebyshevDist = Math.max(adx, ady);

      // Sensory AI: Only alert if within 7 tiles or already alerted
      if (chebyshevDist > 7 && !enemy.tags.has("alerted")) {
        continue;
      }
      enemy.tags.add("alerted");

      // Relative speed energy system
      const enemyStats = enemy.components.get("CombatStats") as
        Record<string, number> | undefined;
      const enemySpeed = enemyStats?.speed || 90;
      const energyGain = Math.max(
        20,
        Math.round(enemySpeed * (100 / playerSpeed)),
      );
      let currentEnergy = (this.enemyEnergy.get(enemy.id) || 0) + energyGain;

      while (currentEnergy >= 100) {
        currentEnergy -= 100;
        this.executor.emit({ name: "TURN_START", source: enemy });

        const currPos = enemy.components.get("Position") as {
          x: number;
          y: number;
        };
        const curAdx = Math.abs(playerPos.x - currPos.x);
        const curAdy = Math.abs(playerPos.y - currPos.y);

        const dx = Math.sign(playerPos.x - currPos.x);
        const dy = Math.sign(playerPos.y - currPos.y);

        const moves =
          curAdx >= curAdy
            ? [
                { dx, dy: 0 },
                { dx: 0, dy },
              ]
            : [
                { dx: 0, dy },
                { dx, dy: 0 },
              ];

        let acted = false;
        for (const m of moves) {
          if (m.dx === 0 && m.dy === 0) continue;
          const nx = currPos.x + m.dx;
          const ny = currPos.y + m.dy;

          if (this.map.tiles[ny]?.[nx] !== TileType.Floor) continue;

          // Check if player is there -> attack
          if (nx === playerPos.x && ny === playerPos.y) {
            this.executor.emit({
              name: "ACTION_ATTACK",
              source: enemy,
              target: player,
            });
            acted = true;
            break;
          }

          // Check if blocked by another entity
          if (this.getEntityAt(nx, ny)) continue;

          // Move
          currPos.x = nx;
          currPos.y = ny;
          acted = true;
          break;
        }

        if (!acted) break;
      }

      this.enemyEnergy.set(enemy.id, currentEnergy);
    }
  }

  /** Handle loot drops, experience, and boss victory upon enemy death */
  private handleMonsterDefeat(
    targetEntity: Entity,
    x: number,
    y: number,
    player: Entity,
  ): void {
    const desc =
      (targetEntity.components.get("Description") as any)?.name || "Enemy";
    const isBoss =
      targetEntity.id === this.activeBossId || targetEntity.tags.has("boss");

    sound.playDefeat();
    this.monstersSlain++;

    if (isBoss) {
      sound.playVictory();
      this.addFloatingText(x, y, "BOSS SLAIN!", "#ffd700");
      this.logCallback(
        `*** VICTORY! You defeated ${desc}! The chamber clears! ***`,
      );
      this.addXP(250);
      this.activeBossId = null;

      // Guaranteed legendary drop
      const bossDrops = [
        "ironclad_plate",
        "shadow_cloak",
        "archmage_robe",
        "composite_bow",
      ];
      const chosen = bossDrops[Math.floor(Math.random() * bossDrops.length)];
      this.world.spawn(chosen, { Position: { x, y } });

      // Massive gold chest
      this.world.spawn("gold_drop", {
        Position: { x: Math.max(1, x - 1), y },
        Gold: { amount: 150 + this.depth * 50 },
      });
    } else {
      this.addFloatingText(x, y, "DEFEATED!", "#ff3344");
      const baseXP = 25 + this.depth * 8;
      this.addXP(baseXP);
      this.logCallback(`Defeated ${desc}! (+${baseXP} XP)`);

      // All defeated enemies drop gold
      const goldAmt = 8 + Math.floor(Math.random() * (12 + this.depth * 4));
      this.world.spawn("gold_drop", {
        Position: { x, y },
        Gold: { amount: goldAmt },
      });

      // 40% chance of consumable or equipment drop
      if (Math.random() < 0.4) {
        const itemPool = [
          "health_potion",
          "speed_potion",
          "teleport_scroll",
          "iron_spear",
          "composite_bow",
          "ironclad_helm",
          "shadow_ring",
          "archmage_hood",
        ];
        const chosen = itemPool[Math.floor(Math.random() * itemPool.length)];
        this.world.spawn(chosen, { Position: { x, y } });
        this.logCallback(`${desc} dropped a ${chosen.replace(/_/g, " ")}!`);
      }
    }
  }

  /** Spawn goblin/orc reinforcements when a war horn countdown completes */
  private spawnSwarmReinforcements(player: Entity): void {
    const pPos = player.components.get("Position") as { x: number; y: number };
    sound.playHorn();
    this.addFloatingText(pPos.x, pPos.y, "SWARM ARRIVED!", "#ff0033");
    this.logCallback("!!! WAR HORNS RESOUND! A goblin horde ambushes you! !!!");

    const candidates = this.map.floorTiles.filter((t) => {
      const dist = Math.abs(t.x - pPos.x) + Math.abs(t.y - pPos.y);
      return dist >= 3 && dist <= 7 && !this.getEntityAt(t.x, t.y);
    });
    this.shuffleArray(candidates);

    const swarmCount = Math.min(
      3 + Math.floor(this.depth / 2),
      candidates.length,
    );
    for (let i = 0; i < swarmCount; i++) {
      const pos = candidates[i];
      const swarmEnemy = this.world.spawn(this.depth > 2 ? "orc" : "goblin", {
        Position: { x: pos.x, y: pos.y },
      });
      swarmEnemy.tags.add("alerted");
    }
  }

  /** Find an entity at a grid position (optionally excluding one) */
  getEntityAt(x: number, y: number, excludeId?: EntityId): Entity | undefined {
    return this.world.allEntities().find((e) => {
      if (excludeId && e.id === excludeId) return false;
      const pos = e.components.get("Position") as
        { x: number; y: number } | undefined;
      return pos && pos.x === x && pos.y === y;
    });
  }

  /** Render the current game state */
  render(): void {
    const player = this.playerId
      ? this.world.getEntity(this.playerId)
      : undefined;
    if (player) {
      const pos = player.components.get("Position") as { x: number; y: number };
      this.renderer.centerOn(pos.x, pos.y);
    }
    this.renderer.render(this.map, this.world.allEntities());
  }

  // --- Public Getters & Control Methods for UI ---

  getCartridge(): Cartridge | undefined {
    return this.cartridge;
  }
  getMap(): GameMap | undefined {
    return this.map;
  }
  getPlayer(): Entity | undefined {
    return this.playerId ? this.world.getEntity(this.playerId) : undefined;
  }
  getEntities(): Entity[] {
    return this.world.allEntities();
  }
  getTurnCount(): number {
    return this.turnCount;
  }
  getPhase(): GamePhase {
    return this.phase;
  }
  getRenderer(): IRenderer {
    return this.renderer;
  }

  setHoveredTile(x: number | null, y: number | null): void {
    if (this.renderer && "setHoveredTile" in (this.renderer as any)) {
      (this.renderer as any).setHoveredTile(
        x !== null && y !== null ? { x, y } : null,
      );
    }
  }

  addFloatingText(x: number, y: number, text: string, color?: string): void {
    if (this.renderer && "addFloatingText" in (this.renderer as any)) {
      (this.renderer as any).addFloatingText(x, y, text, color);
    }
  }

  /** Spawn stairs, chests, shrines, secrets, and monsters for current floor */
  private spawnDungeonFeatures(
    available: { x: number; y: number }[],
    spawnIdx: number,
  ): void {
    if (this.map.isBossFloor && this.map.anteRoom && this.map.bossArena) {
      // 1. Ante-Room Merchant
      this.world.spawn("merchant", {
        Position: {
          x: this.map.anteRoom.merchantSpawn.x,
          y: this.map.anteRoom.merchantSpawn.y,
        },
      });

      // 2. Ante-Room Life Sanctuary (guaranteed preparation before entering the arena)
      this.world.spawn("shrine_life", {
        Position: {
          x: this.map.anteRoom.merchantSpawn.x - 2,
          y: this.map.anteRoom.merchantSpawn.y,
        },
      });

      // 3. Grand Boss in Boss Arena
      const bossBlueprint = this.depth >= 6 ? "lich_boss" : "minotaur_boss";
      const boss = this.world.spawn(bossBlueprint, {
        Position: {
          x: this.map.bossArena.bossSpawn.x,
          y: this.map.bossArena.bossSpawn.y,
        },
      });
      this.activeBossId = boss.id;

      // 4. Dungeon Stairs behind boss
      if (this.map.stairsPosition) {
        this.world.spawn("stairs", {
          Position: {
            x: this.map.stairsPosition.x,
            y: this.map.stairsPosition.y,
          },
        });
      }

      this.logCallback("=== ANTE-ROOM TO THE BOSS ARENA ===");
      this.logCallback(
        "Browse Grimm the Peddler wares and seek the Sanctuary before challenging the Boss!",
      );
      return;
    }

    // Normal Procedural Floors:

    // 1. Spawn stairs for this floor
    if (this.map.stairsPosition) {
      this.world.spawn("stairs", {
        Position: {
          x: this.map.stairsPosition.x,
          y: this.map.stairsPosition.y,
        },
      });
    }

    // 2. Spawn 2 guaranteed Treasure Chests on floor tiles
    for (let i = 0; i < 2 && spawnIdx < available.length; i++) {
      const pos = available[spawnIdx++];
      this.world.spawn("chest", { Position: { x: pos.x, y: pos.y } });
    }

    // 3. Spawn Specific Shrine based on depth progression
    if (spawnIdx < available.length) {
      const pos = available[spawnIdx++];
      const shrineTypes = [
        "shrine_life",
        "shrine_might",
        "shrine_aegis",
        "shrine_blood",
      ];
      const chosenShrine = shrineTypes[(this.depth - 1) % shrineTypes.length];
      this.world.spawn(chosenShrine, { Position: { x: pos.x, y: pos.y } });
    }

    // 4. Spawn 1 Secret Wall (cracked_wall)
    let secretPlaced = false;
    for (const floorTile of available) {
      const neighbors = [
        { x: floorTile.x + 1, y: floorTile.y },
        { x: floorTile.x - 1, y: floorTile.y },
        { x: floorTile.x, y: floorTile.y + 1 },
        { x: floorTile.x, y: floorTile.y - 1 },
      ];
      for (const n of neighbors) {
        if (
          this.map.tiles[n.y]?.[n.x] === TileType.Wall &&
          !this.getEntityAt(n.x, n.y)
        ) {
          this.world.spawn("cracked_wall", { Position: { x: n.x, y: n.y } });
          secretPlaced = true;
          break;
        }
      }
      if (secretPlaced) break;
    }

    // 5. Spawn Goblin Horn Scout at depth >= 2
    if (this.depth >= 2 && spawnIdx < available.length) {
      const pos = available[spawnIdx++];
      this.world.spawn("horn_scout", { Position: { x: pos.x, y: pos.y } });
    }

    // 6. Spawn enemies from spawn_table (with depth scaling)
    if (this.cartridge?.world_gen.spawn_table) {
      for (const entry of this.cartridge.world_gen.spawn_table) {
        const count = entry.max_per_level ?? 5;
        for (let i = 0; i < count && spawnIdx < available.length; i++) {
          if (Math.random() < entry.weight) {
            const pos = available[spawnIdx++];
            const enemy = this.world.spawn(entry.blueprint, {
              Position: { x: pos.x, y: pos.y },
            });
            const eHealth = enemy.components.get("Health") as
              { current: number; max: number } | undefined;
            if (eHealth && this.depth > 1) {
              const bonus = (this.depth - 1) * 6;
              eHealth.max += bonus;
              eHealth.current += bonus;
            }
          }
        }
      }
    }
  }

  /** Tactical Ability 1: Phase Dash 2 tiles forward, skipping over intervening hazards/enemies */
  usePhaseDash(): boolean {
    if (this.phase !== "PLAYER_TURN") return false;
    const player = this.getPlayer();
    if (!player) return false;

    if (this.dashCooldown > 0) {
      this.logCallback(
        `Phase Dash recharging (${this.dashCooldown} turn${this.dashCooldown > 1 ? "s" : ""} left)!`,
      );
      sound.playHit();
      return false;
    }

    const pos = player.components.get("Position") as { x: number; y: number };
    const dx =
      this.lastDirection.dx !== 0 || this.lastDirection.dy !== 0
        ? this.lastDirection.dx
        : 0;
    const dy =
      this.lastDirection.dx !== 0 || this.lastDirection.dy !== 0
        ? this.lastDirection.dy
        : 1;

    let targetX = pos.x + dx * 2;
    let targetY = pos.y + dy * 2;

    if (
      this.map.tiles[targetY]?.[targetX] !== TileType.Floor ||
      this.getEntityAt(targetX, targetY)
    ) {
      targetX = pos.x + dx;
      targetY = pos.y + dy;
    }

    if (
      this.map.tiles[targetY]?.[targetX] !== TileType.Floor ||
      this.getEntityAt(targetX, targetY)
    ) {
      this.logCallback("Phase Dash blocked by obstacle or creature!");
      sound.playHit();
      return false;
    }

    pos.x = targetX;
    pos.y = targetY;
    this.dashCooldown = 6;
    sound.playAbility();
    this.addFloatingText(targetX, targetY, "PHASE DASH!", "#00f0ff");
    this.logCallback("You warp through space, escaping danger!");
    this.finishTurn(player);
    return true;
  }

  /** Tactical Ability 2: Shield Bash knockback & stun */
  useShieldBash(): boolean {
    if (this.phase !== "PLAYER_TURN") return false;
    const player = this.getPlayer();
    if (!player) return false;

    if (this.bashCooldown > 0) {
      this.logCallback(
        `Shield Bash recharging (${this.bashCooldown} turn${this.bashCooldown > 1 ? "s" : ""} left)!`,
      );
      sound.playHit();
      return false;
    }

    const pos = player.components.get("Position") as { x: number; y: number };
    const candidates = [
      { dx: this.lastDirection.dx, dy: this.lastDirection.dy },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    let targetEnemy: Entity | undefined;
    let bashDir = { dx: 0, dy: 1 };

    for (const c of candidates) {
      if (c.dx === 0 && c.dy === 0) continue;
      const ent = this.getEntityAt(pos.x + c.dx, pos.y + c.dy, player.id);
      if (
        ent &&
        ent.components.has("Health") &&
        ((ent.components.has("Faction") &&
          (ent.components.get("Faction") as any).id !== "player") ||
          ent.components.has("CombatStats"))
      ) {
        targetEnemy = ent;
        bashDir = c;
        break;
      }
    }

    if (!targetEnemy) {
      this.logCallback("No adjacent enemy to Shield Bash!");
      sound.playHit();
      return false;
    }

    const ePos = targetEnemy.components.get("Position") as {
      x: number;
      y: number;
    };
    const pStats = player.components.get("CombatStats") as
      Record<string, number> | undefined;
    const mods = this.inventory.getEquipmentModifiers(player);
    const pStr = (pStats?.strength || 10) + (mods["CombatStats.strength"] || 0);
    const eHealth = targetEnemy.components.get("Health") as {
      current: number;
      max: number;
    };

    // Knockback 1 tile if floor is walkable
    const knockX = ePos.x + bashDir.dx;
    const knockY = ePos.y + bashDir.dy;
    if (
      this.map.tiles[knockY]?.[knockX] === TileType.Floor &&
      !this.getEntityAt(knockX, knockY)
    ) {
      ePos.x = knockX;
      ePos.y = knockY;
    }

    const bashDamage = Math.floor(pStr * 0.8) + 4;
    eHealth.current -= bashDamage;
    targetEnemy.tags.add("stunned");
    targetEnemy.tags.add("alerted");

    this.bashCooldown = 4;
    sound.playAbility();

    const desc =
      (targetEnemy.components.get("Description") as any)?.name || "Enemy";
    if (eHealth.current <= 0) {
      this.world.queueDestroy(targetEnemy.id);
      this.world.flush();
      this.handleMonsterDefeat(targetEnemy, ePos.x, ePos.y, player);
    } else {
      this.addFloatingText(
        ePos.x,
        ePos.y,
        `BASH -${bashDamage} (STUNNED)`,
        "#ffaa00",
      );
      this.logCallback(
        `You slam your shield into ${desc} for ${bashDamage} dmg! It is stunned!`,
      );
    }

    this.finishTurn(player);
    return true;
  }

  /** Spell 1: Fireball (3x3 Area of Effect Explosion) */
  useFireball(targetX?: number, targetY?: number): boolean {
    if (this.phase !== "PLAYER_TURN") return false;
    const player = this.getPlayer();
    if (!player) return false;

    if (this.fireballCooldown > 0) {
      this.logCallback(
        `Fireball recharging (${this.fireballCooldown} turn${this.fireballCooldown > 1 ? "s" : ""} left)!`,
      );
      sound.playHit();
      return false;
    }

    const pos = player.components.get("Position") as { x: number; y: number };
    const cx =
      targetX !== undefined ? targetX : pos.x + this.lastDirection.dx * 2;
    const cy =
      targetY !== undefined ? targetY : pos.y + this.lastDirection.dy * 2;

    const pStats = player.components.get("CombatStats") as
      Record<string, number> | undefined;
    const mods = this.inventory.getEquipmentModifiers(player);
    const intellect =
      (pStats?.intellect || 10) + (mods["CombatStats.intellect"] || 0);
    const damage = 24 + Math.floor(intellect * 1.4);

    sound.playSpellFire();
    this.addFloatingText(cx, cy, "FIREBALL EXPLOSION!", "#ff4400");
    this.logCallback(
      `You cast Fireball! Scorching explosion erupts for ${damage} fire dmg!`,
    );

    let hitCount = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = cx + dx;
        const ty = cy + dy;
        const enemy = this.getEntityAt(tx, ty, player.id);
        if (
          enemy &&
          enemy.components.has("Health") &&
          ((enemy.components.has("Faction") &&
            (enemy.components.get("Faction") as any).id !== "player") ||
            enemy.components.has("CombatStats"))
        ) {
          enemy.tags.add("alerted");
          const eHealth = enemy.components.get("Health") as {
            current: number;
            max: number;
          };
          eHealth.current -= damage;
          hitCount++;
          this.addFloatingText(tx, ty, `-${damage}`, "#ff2200");

          if (eHealth.current <= 0) {
            this.world.queueDestroy(enemy.id);
            this.world.flush();
            this.handleMonsterDefeat(enemy, tx, ty, player);
          }
        }
      }
    }

    this.fireballCooldown = 5;
    this.finishTurn(player);
    return true;
  }

  /** Spell 2: Piercing Lightning Beam (strikes 5 tiles in facing direction) */
  useLightning(): boolean {
    if (this.phase !== "PLAYER_TURN") return false;
    const player = this.getPlayer();
    if (!player) return false;

    if (this.lightningCooldown > 0) {
      this.logCallback(
        `Lightning Beam recharging (${this.lightningCooldown} turn${this.lightningCooldown > 1 ? "s" : ""} left)!`,
      );
      sound.playHit();
      return false;
    }

    const pos = player.components.get("Position") as { x: number; y: number };
    const dx =
      this.lastDirection.dx !== 0 || this.lastDirection.dy !== 0
        ? this.lastDirection.dx
        : 0;
    const dy =
      this.lastDirection.dx !== 0 || this.lastDirection.dy !== 0
        ? this.lastDirection.dy
        : -1;

    const pStats = player.components.get("CombatStats") as
      Record<string, number> | undefined;
    const mods = this.inventory.getEquipmentModifiers(player);
    const intellect =
      (pStats?.intellect || 10) + (mods["CombatStats.intellect"] || 0);
    const damage = 32 + Math.floor(intellect * 1.8);

    sound.playSpellLightning();
    this.logCallback(
      `You unleash a Piercing Lightning Beam along your corridor!`,
    );

    for (let step = 1; step <= 5; step++) {
      const tx = pos.x + dx * step;
      const ty = pos.y + dy * step;

      if (this.map.tiles[ty]?.[tx] === TileType.Wall) {
        this.addFloatingText(tx, ty, "CRACK!", "#00ffff");
        break;
      }

      const enemy = this.getEntityAt(tx, ty, player.id);
      if (
        enemy &&
        enemy.components.has("Health") &&
        ((enemy.components.has("Faction") &&
          (enemy.components.get("Faction") as any).id !== "player") ||
          enemy.components.has("CombatStats"))
      ) {
        enemy.tags.add("alerted");
        const eHealth = enemy.components.get("Health") as {
          current: number;
          max: number;
        };
        eHealth.current -= damage;
        this.addFloatingText(tx, ty, `SHOCK! -${damage}`, "#00ffff");

        if (eHealth.current <= 0) {
          this.world.queueDestroy(enemy.id);
          this.world.flush();
          this.handleMonsterDefeat(enemy, tx, ty, player);
        }
      }
    }

    this.lightningCooldown = 6;
    this.finishTurn(player);
    return true;
  }

  /** Spell 3: Frost Nova (freezes and damages all enemies in radius 2) */
  useFrostNova(): boolean {
    if (this.phase !== "PLAYER_TURN") return false;
    const player = this.getPlayer();
    if (!player) return false;

    if (this.frostCooldown > 0) {
      this.logCallback(
        `Frost Nova recharging (${this.frostCooldown} turn${this.frostCooldown > 1 ? "s" : ""} left)!`,
      );
      sound.playHit();
      return false;
    }

    const pos = player.components.get("Position") as { x: number; y: number };
    const pStats = player.components.get("CombatStats") as
      Record<string, number> | undefined;
    const mods = this.inventory.getEquipmentModifiers(player);
    const intellect =
      (pStats?.intellect || 10) + (mods["CombatStats.intellect"] || 0);
    const damage = 16 + Math.floor(intellect * 1.1);

    sound.playSpellFrost();
    this.addFloatingText(pos.x, pos.y, "FROST NOVA!", "#88ddff");
    this.logCallback(
      `You unleash Frost Nova! Frost wave freezes nearby creatures!`,
    );

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const tx = pos.x + dx;
        const ty = pos.y + dy;
        const enemy = this.getEntityAt(tx, ty, player.id);
        if (
          enemy &&
          enemy.components.has("Health") &&
          ((enemy.components.has("Faction") &&
            (enemy.components.get("Faction") as any).id !== "player") ||
            enemy.components.has("CombatStats"))
        ) {
          enemy.tags.add("stunned");
          enemy.tags.add("alerted");
          const eHealth = enemy.components.get("Health") as {
            current: number;
            max: number;
          };
          eHealth.current -= damage;
          this.addFloatingText(tx, ty, `FROZEN -${damage}`, "#88ddff");

          if (eHealth.current <= 0) {
            this.world.queueDestroy(enemy.id);
            this.world.flush();
            this.handleMonsterDefeat(enemy, tx, ty, player);
          }
        }
      }
    }

    this.frostCooldown = 7;
    this.finishTurn(player);
    return true;
  }

  /** Drink Health Potion from backpack */
  drinkHealthPotion(): boolean {
    if (this.phase !== "PLAYER_TURN") return false;
    const player = this.getPlayer();
    if (!player) return false;

    const backpack = this.inventory.getBackpack(player);
    const pot = backpack.find((item) => {
      const desc = (item.components.get("Description") as any)?.name || "";
      return (
        item.id.startsWith("health_potion") ||
        desc.includes("Health Potion") ||
        item.components.has("HealthPack")
      );
    });

    if (!pot) {
      this.logCallback(
        "No Health Potion in your backpack! Press [I] to check inventory.",
      );
      sound.playHit();
      return false;
    }

    this.inventory.useConsumable(player, pot);
    sound.playItem();
    this.finishTurn(player);
    return true;
  }

  /** Drink Swiftness Potion from backpack */
  drinkSpeedPotion(): boolean {
    if (this.phase !== "PLAYER_TURN") return false;
    const player = this.getPlayer();
    if (!player) return false;

    const backpack = this.inventory.getBackpack(player);
    const pot = backpack.find((item) => {
      const desc = (item.components.get("Description") as any)?.name || "";
      return (
        item.id.startsWith("speed_potion") ||
        desc.includes("Swiftness") ||
        desc.includes("Speed")
      );
    });

    if (!pot) {
      this.logCallback(
        "No Swiftness Potion in your backpack! Press [I] to check inventory.",
      );
      sound.playHit();
      return false;
    }

    this.inventory.useConsumable(player, pot);
    this.speedBuffTurns = 15;
    sound.playItem();
    const pos = player.components.get("Position") as { x: number; y: number };
    this.addFloatingText(pos.x, pos.y, "SPEED +50% (15T)", "#00ffaa");
    this.logCallback(
      "You drank Swiftness Potion! Moving at 150% speed for 15 turns!",
    );
    this.finishTurn(player);
    return true;
  }

  /** Read Teleport Scroll from backpack */
  readTeleportScroll(): boolean {
    if (this.phase !== "PLAYER_TURN") return false;
    const player = this.getPlayer();
    if (!player) return false;

    const backpack = this.inventory.getBackpack(player);
    const scroll = backpack.find((item) => {
      const desc = (item.components.get("Description") as any)?.name || "";
      return (
        item.id.startsWith("teleport_scroll") ||
        desc.includes("Teleport") ||
        desc.includes("Blink")
      );
    });

    if (!scroll) {
      this.logCallback("No Scroll of Teleport in your backpack!");
      sound.playHit();
      return false;
    }

    this.inventory.useConsumable(player, scroll);
    sound.playAbility();
    this.finishTurn(player);
    return true;
  }

  /** Add experience and handle level-up progression */
  addXP(amount: number): void {
    const player = this.getPlayer();
    if (!player) return;

    this.xp += amount;
    this.logCallback(`+${amount} XP (${this.xp}/${this.xpToNextLevel})`);

    while (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level++;
      this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.6);

      const pHealth = player.components.get("Health") as
        { current: number; max: number } | undefined;
      const pStats = player.components.get("CombatStats") as
        Record<string, number> | undefined;

      if (pHealth) {
        pHealth.max += 12;
        pHealth.current = pHealth.max; // Full heal upon level up!
      }
      if (pStats) {
        pStats.strength = (pStats.strength || 10) + 2;
        pStats.armor = (pStats.armor || 0) + 1;
        pStats.intellect = (pStats.intellect || 10) + 2;
      }

      sound.playLevelUp();
      const pos = player.components.get("Position") as
        { x: number; y: number } | undefined;
      if (pos) {
        this.addFloatingText(
          pos.x,
          pos.y,
          `LEVEL UP! (LVL ${this.level})`,
          "#ffd700",
        );
      }
      this.logCallback(
        `=== LEVEL UP! Reached Level ${this.level}! (+12 Max HP, +2 STR, +2 INT, +1 DEF, Health Fully Restored!) ===`,
      );
    }

    this.statsCallback(player);
  }

  /** Descend to next dungeon depth */
  descendFloor(): void {
    this.depth++;
    const player = this.playerId
      ? this.world.getEntity(this.playerId)
      : undefined;
    if (!player) return;

    // Reset exploration fog for the new floor
    if (this.renderer && "resetExploration" in (this.renderer as any)) {
      (this.renderer as any).resetExploration();
    }

    // Keep player, equipped items, AND backpack items across floor transition
    const eq = player.components.get("Equipment") as
      { slots: Record<string, EntityId | null> } | undefined;
    const equippedItemIds = new Set(
      Object.values(eq?.slots ?? {}).filter(Boolean),
    );
    const bp = player.components.get("Inventory") as
      { items: EntityId[] } | undefined;
    const backpackItemIds = new Set(bp?.items ?? []);

    for (const ent of this.world.allEntities()) {
      if (
        ent.id !== player.id &&
        !equippedItemIds.has(ent.id) &&
        !backpackItemIds.has(ent.id)
      ) {
        this.world.queueDestroy(ent.id);
      }
    }
    this.world.flush();

    // Generate fresh map for new depth
    this.map = generateMap(this.cartridge, this.depth);
    const available = [...this.map.floorTiles];
    this.shuffleArray(available);

    let spawnIdx = 0;
    if (this.map.isBossFloor && this.map.anteRoom) {
      // Safe Ante-Room spawn
      player.components.set("Position", {
        x: this.map.anteRoom.playerSpawn.x,
        y: this.map.anteRoom.playerSpawn.y,
      });
    } else if (available[spawnIdx]) {
      const pPos = available[spawnIdx++];
      player.components.set("Position", { x: pPos.x, y: pPos.y });
    }

    // Spawn features for this floor
    this.spawnDungeonFeatures(available, spawnIdx);

    this.logCallback(`=== DESCENDED TO DEPTH ${this.depth} ===`);
    if (this.map.isBossFloor) {
      this.logCallback(`ANTEROOM REACHED! Prepare for the Chamber of Trials!`);
    } else {
      this.logCallback("Air grows colder. Deeper threats lurk in the shadows.");
    }
    sound.playItem();
    this.render();
    this.statsCallback(player);
  }

  getPlayerSpeed(): number {
    const player = this.getPlayer();
    if (!player) return 100;
    const baseStats = player.components.get("CombatStats") as
      Record<string, number> | undefined;
    const baseSpeed = baseStats?.speed || 100;
    const mods = this.inventory.getEquipmentModifiers(player);
    let speed = baseSpeed + (mods["CombatStats.speed"] || 0);
    if (this.speedBuffTurns > 0) {
      speed += 50;
    }
    return Math.max(30, speed);
  }

  getGold(): number {
    const player = this.getPlayer();
    return player ? this.inventory.getGold(player) : 0;
  }

  getBackpack(): Entity[] {
    const player = this.getPlayer();
    return player ? this.inventory.getBackpack(player) : [];
  }

  getActiveSetBonuses(): import("./inventory.js").SetBonus[] {
    const player = this.getPlayer();
    return player ? this.inventory.getActiveSetBonuses(player) : [];
  }

  getActiveBoss(): Entity | undefined {
    return this.activeBossId
      ? this.world.getEntity(this.activeBossId)
      : undefined;
  }

  setShopCallback(cb: (merchant: Entity) => void): void {
    this.shopCallback = cb;
  }

  buyShopItem(itemBlueprint: string, cost: number): boolean {
    const player = this.getPlayer();
    if (!player) return false;
    if (this.inventory.spendGold(player, cost)) {
      const item = this.world.spawn(itemBlueprint);
      this.inventory.addToBackpack(player, item);
      sound.playGold();
      this.logCallback(
        `Purchased ${itemBlueprint.replace(/_/g, " ")} for ${cost} Gold!`,
      );
      this.statsCallback(player);
      return true;
    } else {
      this.logCallback(`Not enough Gold! Costs ${cost} Gold.`);
      sound.playHit();
      return false;
    }
  }

  getSpellCooldowns(): {
    dash: number;
    bash: number;
    fireball: number;
    lightning: number;
    frost: number;
    speedBuff: number;
    swarmCountdown: number | null;
  } {
    return {
      dash: this.dashCooldown,
      bash: this.bashCooldown,
      fireball: this.fireballCooldown,
      lightning: this.lightningCooldown,
      frost: this.frostCooldown,
      speedBuff: this.speedBuffTurns,
      swarmCountdown: this.swarmCountdown,
    };
  }

  getDepth(): number {
    return this.depth;
  }
  getLevel(): number {
    return this.level;
  }
  getXP(): { current: number; next: number } {
    return { current: this.xp, next: this.xpToNextLevel };
  }
  getCooldowns(): { dash: number; bash: number } {
    return { dash: this.dashCooldown, bash: this.bashCooldown };
  }
  getStatsSummary(): {
    monstersSlain: number;
    chestsOpened: number;
    secretsFound: number;
    depth: number;
    level: number;
    turnCount: number;
  } {
    return {
      monstersSlain: this.monstersSlain,
      chestsOpened: this.chestsOpened,
      secretsFound: this.secretsFound,
      depth: this.depth,
      level: this.level,
      turnCount: this.turnCount,
    };
  }
  getInventoryService(): InventoryService {
    return this.inventory;
  }

  equipItem(slot: string, item: Entity): void {
    const player = this.getPlayer();
    if (!player) return;
    this.inventory.equip(player, item, slot);
    this.statsCallback(player);
  }

  unequipItem(slot: string): void {
    const player = this.getPlayer();
    if (!player) return;
    this.inventory.unequip(player, slot);
    this.statsCallback(player);
  }

  useBackpackItem(item: Entity): void {
    const player = this.getPlayer();
    if (!player) return;
    if (item.components.has("Equippable")) {
      const equippable = item.components.get("Equippable") as { slot: string };
      this.inventory.removeFromBackpack(player, item.id);
      this.inventory.equip(player, item, equippable.slot);
      sound.playItem();
      this.logCallback(
        `Equipped ${(item.components.get("Description") as any)?.name || "Gear"}!`,
      );
    } else if (
      item.components.has("Consumable") ||
      item.components.has("HealthPack")
    ) {
      this.inventory.useConsumable(player, item);
      sound.playItem();
    }
    this.statsCallback(player);
    this.render();
  }

  dropBackpackItem(item: Entity): void {
    const player = this.getPlayer();
    if (!player) return;
    const pos = player.components.get("Position") as { x: number; y: number };
    this.inventory.removeFromBackpack(player, item.id);
    item.components.set("Position", { x: pos.x, y: pos.y });
    sound.playItem();
    this.logCallback(
      `Dropped ${(item.components.get("Description") as any)?.name || "Item"} on the ground.`,
    );
    this.statsCallback(player);
    this.render();
  }

  getEquippedItems(): Record<string, Entity | undefined> {
    const player = this.getPlayer();
    if (!player) return {};
    const eq = player.components.get("Equipment") as
      { slots: Record<string, EntityId | null> } | undefined;
    if (!eq) return {};
    const result: Record<string, Entity | undefined> = {};
    for (const [slot, id] of Object.entries(eq.slots)) {
      result[slot] = id ? this.world.getEntity(id) : undefined;
    }
    return result;
  }

  restart(): void {
    if (this.cartridge) {
      this.loadCartridge(this.cartridge);
    }
  }

  /** Export current game state as JSON */
  saveGame(): string {
    const data = this.persistence.save(
      this.turnCount,
      this.playerId,
      this.map.tiles,
    );
    return JSON.stringify(data);
  }

  /** Restore game state from JSON */
  loadGame(json: string): void {
    const data = JSON.parse(json) as SaveData;
    const result = this.persistence.load(data);

    this.turnCount = result.turnCount;
    this.playerId = result.playerId;

    if (result.mapTiles) {
      this.map.tiles = result.mapTiles;
    }

    this.logCallback("--- GAME LOADED ---");
    this.render();
    this.statsCallback(this.world.getEntity(this.playerId!));
  }

  /** Fisher-Yates shuffle */
  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
