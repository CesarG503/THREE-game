// @ts-nocheck

import { LogicItem } from "./LogicItem"
import { InspectorUtils } from "./InspectorUtils"

export class OrderLogic extends LogicItem {
    render(container, props, updateCallback) {
        if (props.order !== undefined) {
            const ordInput = InspectorUtils.createNumberInput(
                "Orden de Spawn",
                (v) => updateCallback('order', v),
                0,
                1,
                "#FFFF00",
                props.order
            )
            container.appendChild(ordInput.container)
        }
    }
}
