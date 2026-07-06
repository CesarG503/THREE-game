import { MapObjectItem, type MapObjectScale } from "./MapObjectItem";
import { DefaultMapObject } from "./DefaultMapObject";
import { StairsObject } from "./StairsObject";
import { RampObject } from "./RampObject";
import { SpawnPointObject } from "./SpawnPointObject";
import { MovementControllerObject } from "./MovementControllerObject";
import { InteractionButtonObject } from "./InteractionButtonObject";
import { InteractiveCollisionObject } from "./InteractiveCollisionObject";
import { TargetObject } from "./TargetObject";
import { ImpulsePadObject } from "./ImpulsePadObject";
import { FarmingZoneObject } from "./FarmingZoneObject";
import { LadderObject } from "./LadderObject";
import { GravitySphereObject } from "./GravitySphereObject";
import { GravityPadObject } from "./GravityPadObject";
import type { MapTextureSettings } from "../../utils/TextureMapping";

type MapObjectConstructor = new (
  id: string,
  name: string,
  type: string,
  iconPath: string,
  color: number,
  scale?: MapObjectScale,
  texturePath?: string | null,
  textureAssetId?: string | null,
  textureSettings?: MapTextureSettings | null
) => MapObjectItem;

export class MapObjectFactory {
  private registry = new Map<string, MapObjectConstructor>();

  constructor() {
    this.register("stairs", StairsObject);
    this.register("ramp", RampObject);
    this.register("spawn_point", SpawnPointObject);
    this.register("movement_controller", MovementControllerObject);
    this.register("interaction_button", InteractionButtonObject);
    this.register("interactive_collision", InteractiveCollisionObject);
    this.register("target", TargetObject);
    this.register("impulse_jump", ImpulsePadObject);
    this.register("impulse_lateral", ImpulsePadObject);
    this.register("farming_zone", FarmingZoneObject);
    this.register("ladder", LadderObject);
    this.register("gravity_sphere", GravitySphereObject);
    this.register("gravity_pad", GravityPadObject);
    // Standard default box shapes
    this.register("wall", DefaultMapObject);
    this.register("floor", DefaultMapObject);
    this.register("pillar", DefaultMapObject);
  }

  register(type: string, ctor: MapObjectConstructor) {
    this.registry.set(type, ctor);
  }

  create(
    id: string,
    name: string,
    type: string,
    iconPath: string,
    color: number,
    scale?: MapObjectScale,
    texturePath: string | null = null,
    textureAssetId: string | null = null,
    textureSettings: MapTextureSettings | null = null
  ): MapObjectItem {
    const Ctor = this.registry.get(type) || DefaultMapObject;
    return new Ctor(id, name, type, iconPath, color, scale, texturePath, textureAssetId, textureSettings);
  }
}

export const mapObjectFactory = new MapObjectFactory();
