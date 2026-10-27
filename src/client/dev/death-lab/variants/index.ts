import type { DeathVariant } from "./BaseVariant";
import { V01_Tactical } from "./V01_Tactical";
import { V02_BattleRoyale } from "./V02_BattleRoyale";
import { V03_ArenaUltrakill } from "./V03_ArenaUltrakill";
import { V04_Cyberpunk } from "./V04_Cyberpunk";
import { V05_CinematicStory } from "./V05_CinematicStory";
import { V06_DarkFantasy } from "./V06_DarkFantasy";
import { V07_RetroArcade } from "./V07_RetroArcade";
import { V08_ComicBook } from "./V08_ComicBook";
import { V09_Horror } from "./V09_Horror";
import { V10_AnimeMecha } from "./V10_AnimeMecha";
import { V11_MemeAbsurd } from "./V11_MemeAbsurd";
import { V12_Western } from "./V12_Western";
import { V13_SciFiSpace } from "./V13_SciFiSpace";
import { V14_Esports } from "./V14_Esports";
import { V15_RealityCorruption } from "./V15_RealityCorruption";
import { V16_ViperSignature } from "./V16_ViperSignature";

export function createAllVariants(): DeathVariant[] {
  return [
    new V01_Tactical(),
    new V02_BattleRoyale(),
    new V03_ArenaUltrakill(),
    new V04_Cyberpunk(),
    new V05_CinematicStory(),
    new V06_DarkFantasy(),
    new V07_RetroArcade(),
    new V08_ComicBook(),
    new V09_Horror(),
    new V10_AnimeMecha(),
    new V11_MemeAbsurd(),
    new V12_Western(),
    new V13_SciFiSpace(),
    new V14_Esports(),
    new V15_RealityCorruption(),
    new V16_ViperSignature(),
  ];
}

export {
  type DeathVariant,
  V01_Tactical,
  V02_BattleRoyale,
  V03_ArenaUltrakill,
  V04_Cyberpunk,
  V05_CinematicStory,
  V06_DarkFantasy,
  V07_RetroArcade,
  V08_ComicBook,
  V09_Horror,
  V10_AnimeMecha,
  V11_MemeAbsurd,
  V12_Western,
  V13_SciFiSpace,
  V14_Esports,
  V15_RealityCorruption,
  V16_ViperSignature,
};
