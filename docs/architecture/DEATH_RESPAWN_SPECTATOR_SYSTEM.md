# Arquitectura del Sistema de Muerte, Reaparición y Modo Observador

Este documento define la arquitectura formal, los flujos de ejecución y las reglas de resolución de configuración para el sistema de muerte, reaparición, perfiles de rol y modo observador en viper.io (THREE-game).

---

## 1. Reglas de Configuración y Fuente Única de Verdad

### 1.1 Jerarquía y Almacenamiento
- **Persistencia en el Mapa**: Toda la configuración de modos de experiencia se almacena en el archivo JSON del mapa bajo `gameConfig.experienceModes` y `gameConfig.activeExperienceModeId`.
- **Prohibición de Configuración Externa**: Ninguna regla de experiencia o muerte se guarda en `.env` ni en la configuración global del perfil de jugador.
- **Compatibilidad Hacia Atrás**: Si un mapa carece de modos (`experienceModes` ausente o vacío), `normalizeExperienceModesConfig()` genera automáticamente los tres modos predeterminados (`mode_survival`, `mode_racing`, `mode_elimination`) manteniendo como activo `mode_survival`.

### 1.2 Distinción entre Modo Base de Experiencia y Perfiles de Muerte por Rol
1. **Modo Base Activo (`baseActiveMode`)**:
   - Es el modo principal de la partida (`activeExperienceModeId`).
   - Controla las **reglas globales de la partida y del observador**:
     - `spectator.enabled`: Si se permite o no observar al ser eliminado.
     - `spectator.allowFollow`: Si se permite seguir a otros jugadores o únicamente cámara libre.
     - `spectator.perspective`: Perspectiva permitida (`first_person`, `third_person`, `switchable`).
     - `spectator.allowedRoleIds`: Lista blanca de roles que pueden ser observados (vacío = todos).
     - `spectator.quality`: Nivel de optimización gráfica durante observación (`full`, `balanced`, `low`).
     - `roleModeAssignments`: Mapeo de roles a perfiles de muerte específicos (`Record<roleId, modeId>`).
2. **Perfil de Muerte del Jugador (`deathProfile`)**:
   - Resuelto individualmente para cada jugador según su rol (`character.activeRoleId`).
   - Si `baseActiveMode.roleModeAssignments[roleId]` existe y apunta a un modo válido, dicho jugador utiliza ese perfil de muerte.
   - Si no hay asignación, hereda y utiliza el `baseActiveMode`.
   - Controla exclusivamente las **reglas al morir**:
     - `enabledCauses`: Causas activas (daño, caída, lógica).
     - `respawns`: Cantidad de vidas (o herencia del perfil del jugador).
     - `respawnDelay`: Tiempo de espera para reaparecer (o herencia).
     - `explodeOnDeath`: Si explota en partes o no (o herencia).
     - `respawnPolicy`: Política elegida (`start`, `checkpoint`, `spectator`, `none`).
     - `deathScreen`: Personalización visual (título, mensaje, colores, botones, desenfoque).

---

## 2. Diagramas Mermaid de Arquitectura

### 2.1 Flujo de Causas de Muerte a Política de Reaparición

```mermaid
flowchart TD
    A["Evento de Muerte Detectado<br/>(Daño / Caída / Lógica-Trampa / Vehículo)"] --> B{"¿Muerte en proceso o personaje ya muerto?<br/>(isProcessingDeath || character.isDead)"}
    B -- "Sí" --> C["Descartar evento (Concurrency Guard)"]
    B -- "No" --> D["Obtener Perfil de Muerte del Jugador<br/>getDeathProfileForPlayer(roleId)"]

    D --> E{"¿Causa habilitada en el perfil?<br/>(enabledCauses[cause] && environmentConfig)"}
    E -- "No" --> F["Muerte ignorada / Cancelada"]
    E -- "Sí" --> G["Marcar isProcessingDeath = true<br/>character.isDead = true<br/>Desmontar vehículos si aplica"]

    G --> H{"¿Explosión corporal?<br/>explodeOnDeath (Modo vs Perfil)"}
    H --> I["Emitir 'died' y emitir señal 'player_death'"]

    I --> J{"Calcular vidas restantes<br/>(mode.respawns ?? character.respawns)"}
    J --> K{"¿Política de Reaparición?<br/>respawnPolicy"}

    K -- "none" --> L["Fin de Partida<br/>willRespawn = false"]
    K -- "spectator" --> M["willRespawn = false<br/>Transición a Modo Observador"]
    K -- "start o checkpoint" --> N{"¿Quedan vidas?<br/>(lives > 0 || lives == -1)"}

    N -- "No (vidas agotadas)" --> L
    N -- "Sí" --> O["willRespawn = true<br/>Decrementar vida si es finita"]

    L --> P["Mostrar Pantalla de Muerte<br/>(Acciones: reiniciar / lobby)"]
    M --> Q["Mostrar Pantalla de Muerte<br/>(Acción: observar / lobby)"]
    O --> R["Mostrar Pantalla de Muerte<br/>(Acción: reaparecer / lobby)"]

    R --> S{"¿Demora de reaparición?<br/>(delay <= 0)"}
    S -- "Inmediata (0s)" --> T["executeRespawn() Inmediato"]
    S -- "Con demora (>0s)" --> U["Temporizador setTimeout(executeRespawn, delay)"]
```

---

### 2.2 Resolución de Configuración: Modo Base vs Rol y Herencia

```mermaid
flowchart TD
    subgraph MapConfig ["JSON del Mapa: gameConfig"]
        ActiveModeId["activeExperienceModeId"]
        ModesList["experienceModes: [ModeProfile, ...]"]
    end

    ActiveModeId --> BaseMode["Modo Base Activo (baseActiveMode)"]
    ModesList --> BaseMode

    subgraph BaseModeRules ["Reglas Globales del Modo Base"]
        SpecRules["Opciones de Observador:<br/>- enabled<br/>- allowFollow<br/>- perspective (1ª, 3ª, alternable)<br/>- allowedRoleIds<br/>- quality"]
        RoleMap["roleModeAssignments: { roleId -> targetModeId }"]
    end
    BaseMode --> SpecRules
    BaseMode --> RoleMap

    subgraph PlayerRole ["Identificación del Rol del Jugador"]
        CharRole["character.activeRoleId<br/>(PlayerConfigManager.profiles)"]
    end

    CharRole --> RoleCheck{"¿Existe mapeo en<br/>roleModeAssignments?"}
    RoleMap --> RoleCheck

    RoleCheck -- "Sí" --> TargetMode["Perfil Asignado al Rol<br/>(targetMode)"]
    RoleCheck -- "No" --> FallbackMode["Heredar Modo Base<br/>(baseActiveMode)"]

    subgraph DeathResolution ["Resolución de Atributos de Muerte"]
        ResolvedMode["Perfil de Muerte Final"]
        TargetMode --> ResolvedMode
        FallbackMode --> ResolvedMode

        LivesCheck["Vidas:<br/>mode.respawns !== null ? mode.respawns : character.respawns"]
        DelayCheck["Demora:<br/>mode.respawnDelay !== null ? mode.respawnDelay : character.respawnDelay"]
        ExplodeCheck["Explosión:<br/>typeof mode.explodeOnDeath === 'boolean' ? mode.explodeOnDeath : character.explodeOnDeath"]
        ScreenCheck["Pantalla:<br/>mode.deathScreen (título, mensaje, colores, botones)"]
    end
    ResolvedMode --> LivesCheck
    ResolvedMode --> DelayCheck
    ResolvedMode --> ExplodeCheck
    ResolvedMode --> ScreenCheck
```

---

### 2.3 Flujo del Modo Observador

```mermaid
flowchart TD
    StartSpec["enterSpectator()"] --> HideLocal["Ocultar modelos del personaje local<br/>(glbModel, polygonModel, polygonModelSkin)"]
    HideLocal --> SaveCam["Guardar estado previo de cámara:<br/>previousCameraMode, previousIsFirstPerson, smoothing"]
    SaveCam --> InitPersp["Inicializar perspectiva según modo base:<br/>perspective: 'first_person' | 'third_person'"]

    InitPersp --> AllowFollowCheck{"¿allowFollow habilitado en modo base?"}
    AllowFollowCheck -- "false" --> FreeFlyMode["Cámara Libre (free-fly)<br/>WASD + Espacio / Shift<br/>HUD: 'Cámara libre'"]
    AllowFollowCheck -- "true" --> PickTarget["Buscar objetivo válido<br/>cycleSpectatorTarget(1)"]

    PickTarget --> TargetFilter{"Filtrar peers:<br/>- No muerto (isDead == false)<br/>- Rol permitido (allowedRoleIds)"}
    TargetFilter -- "Sin objetivos disponibles" --> NoTargetHUD["spectatorTargetId = null<br/>HUD: 'No hay jugadores disponibles'"]
    TargetFilter -- "Objetivo encontrado" --> SetTarget["spectatorTargetId = peer.playerId<br/>applySpectatorPerspective()"]

    SetTarget --> LoopUpdate["GameLoop (cada frame)"]

    subgraph SpectatorFrame ["Actualización en Frame"]
        LoopUpdate --> ValidateTarget{"¿Objetivo sigue vivo y permitido?"}
        ValidateTarget -- "No (Murió/Desconectó/Rol cambiado)" --> AutoCycle["Auto-seleccionar siguiente objetivo<br/>o notificar sin objetivos"]
        AutoCycle --> LoopUpdate

        ValidateTarget -- "Sí" --> ApplyCamView{"Perspectiva actual"}
        ApplyCamView -- "1ª Persona" --> CamFP["Colocar cámara en cabeza del objetivo<br/>Copiar rotación, cabeceo y gravedad del objetivo"]
        ApplyCamView -- "3ª Persona" --> CamTP["Cámara orbital con colisión sobre objetivo<br/>Permite orbitar con ratón"]

        CamFP --> NetPerf["Optimización NetworkManager:<br/>Objetivo observado: Calidad Completa<br/>Jugadores lejanos: Omitir animaciones detalladas"]
        CamTP --> NetPerf
    end

    subgraph SpectatorInputs ["Interacciones del Observador"]
        KeyQ["Tecla Q / Flecha Izq"] --> PrevTarget["cycleSpectatorTarget(-1)"]
        KeyE["Tecla E / Flecha Der"] --> NextTarget["cycleSpectatorTarget(1)"]
        KeyV["Tecla V (si perspective == 'switchable')"] --> ToggleView["toggleSpectatorPerspective()<br/>Alternar 1ª/3ª persona"]
    end

    PrevTarget --> LoopUpdate
    NextTarget --> LoopUpdate
    ToggleView --> LoopUpdate

    subgraph ExitSpectator ["Salida / Reaparición (cleanupSpectator)"]
        RespawnTrigger["executeRespawn() / reset() / destroy()"] --> RemoveHUD["Remover HUD del observador"]
        RemoveHUD --> RemoveKeys["Remover listeners de teclado"]
        RemoveKeys --> RestoreCam["Restaurar cameraController.mode original<br/>y restaurar smoothing"]
        RestoreCam --> RestoreModel["Restaurar visibilidad de modelos locales<br/>character.setModelType()"]
    end
```

---

## 3. Puntos de Incoherencia Identificados y Solución Unificada

Durante la auditoría del código previa a la consolidación, se detectaron los siguientes puntos:

1. **Confusión entre Modo Base y Perfil de Muerte en Observación**:
   - *Problema previo*: Si un jugador con rol asignado moría, `DeathManager.getActiveMode()` devolvía el modo del rol, y las funciones del observador leían `spectator` de dicho modo en vez del modo base de la partida.
   - *Regla unificada*: Se separa formalmente `getBaseActiveMode()` (que rige `spectator.*` y `roleModeAssignments`) de `getDeathProfileForPlayer()` (que rige vidas, demora, política y pantalla de muerte).

2. **Filtro de Controles en el HUD**:
   - *Problema previo*: Si había un solo jugador en la partida o el seguimiento estaba deshabilitado, el HUD podía seguir mostrando textos de atajos como `Q/E para cambiar`.
   - *Regla unificada*: El HUD únicamente anuncia controles interactivos que sean viables en el estado actual (ej. solo muestra `Q/E` si hay más de 1 objetivo disponible; solo muestra `V` si la perspectiva es `switchable`).

3. **Prevención de Pérdida de Objetivo Sin Ciclos**:
   - *Problema previo*: Al morir o desconectarse un jugador observado, la validación no debía entrar en recursión infinita si todos los jugadores habían muerto.
   - *Regla unificada*: Se realiza un escaneo de una sola pasada sobre los jugadores remotos disponibles. Si la lista filtrada queda vacía, se limpia `spectatorTargetId` inmediatamente y se informa al usuario.
