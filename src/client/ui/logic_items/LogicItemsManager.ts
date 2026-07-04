// @ts-nocheck

import { TeamLogic } from "./TeamLogic"
import { CapacityLogic } from "./CapacityLogic"
import { OrderLogic } from "./OrderLogic"
import { HoldTimeLogic } from "./HoldTimeLogic"
import { InteractiveCollisionLogic } from "./InteractiveCollisionLogic"
import { TargetLogic } from "./TargetLogic"
import { EventSubscriptionLogic } from "./EventSubscriptionLogic"
import { DianaLogic } from "./DianaLogic"
import { LogicCameraLogic } from "./LogicCameraLogic"
import { CameraPanelLogic } from "./CameraPanelLogic"

export class LogicItemsManager {
    constructor(game = null, logicSystem = null) {
        this.game = game
        this.logicSystem = logicSystem

        // Register logic item handlers
        this.items = [
            new TeamLogic(),
            new CapacityLogic(),
            new OrderLogic(),
            new HoldTimeLogic(),
            new InteractiveCollisionLogic(game, logicSystem),
            new TargetLogic(game, logicSystem),
            new DianaLogic(),
            new LogicCameraLogic(),
            new CameraPanelLogic(game, logicSystem),
            new EventSubscriptionLogic()
        ]
    }

    renderAll(container, props, updateCallback) {
        container.innerHTML = ''
        this.items.forEach(item => {
            item.render(container, props, updateCallback)
        })
    }
}
