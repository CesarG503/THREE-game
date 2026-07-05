export type Rectangle2D = {
  gx: number; // Start grid X
  gz: number; // Start grid Z
  w: number;  // Width in grid units
  h: number;  // Height (depth) in grid units
};

export class MapPhysicsBuilder {
  /**
   * Performs 2D Greedy Meshing to combine floor/ceiling cell grid coordinates
   * into a minimal set of non-overlapping rectangles.
   */
  public static greedyMerge2D(gridKeys: string[]): Rectangle2D[] {
    if (gridKeys.length === 0) return [];

    const rectangles: Rectangle2D[] = [];
    const unvisited = new Set<string>(gridKeys);

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    gridKeys.forEach((key) => {
      const [gx, gz] = key.split(",").map(Number);
      if (gx < minX) minX = gx;
      if (gx > maxX) maxX = gx;
      if (gz < minZ) minZ = gz;
      if (gz > maxZ) maxZ = gz;
    });

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const key = `${x},${z}`;
        if (!unvisited.has(key)) {
          continue;
        }

        // Expand horizontal width
        let w = 1;
        while (unvisited.has(`${x + w},${z}`)) {
          w++;
        }

        // Expand vertical height
        let h = 1;
        let canExpand = true;
        while (canExpand) {
          for (let dx = 0; dx < w; dx++) {
            if (!unvisited.has(`${x + dx},${z + h}`)) {
              canExpand = false;
              break;
            }
          }
          if (canExpand) {
            h++;
          }
        }

        rectangles.push({ gx: x, gz: z, w, h });

        // Mark as visited
        for (let dz = 0; dz < h; dz++) {
          for (let dx = 0; dx < w; dx++) {
            unvisited.delete(`${x + dx},${z + dz}`);
          }
        }
      }
    }

    return rectangles;
  }

  /**
   * Merges contiguous wall segments along the horizontal (X) and vertical (Z) axes
   * to minimize the number of individual meshes and physics colliders.
   */
  public static mergeWallSegments(
    wallDefs: any[],
    cellSize: number,
    wallThickness: number,
    customGridWallGroups: { [key: string]: string }
  ): any[] {
    const mergedDefs: any[] = [];
    const horizByZAndGroup = new Map<string, any[]>();
    const vertByXAndGroup = new Map<string, any[]>();

    wallDefs.forEach((def) => {
      // If it has rotY, it's diagonal, do not merge
      if (def.rotY) {
        mergedDefs.push(def);
        return;
      }

      const groupId = (def.cellKey && customGridWallGroups[def.cellKey]) || "default";

      // Is it horizontal?
      if (Math.abs(def.depth - wallThickness) < 0.01) {
        const key = `${def.pos.z.toFixed(3)}_${groupId}`;
        if (!horizByZAndGroup.has(key)) {
          horizByZAndGroup.set(key, []);
        }
        horizByZAndGroup.get(key)!.push(def);
      }
      // Is it vertical?
      else if (Math.abs(def.width - wallThickness) < 0.01) {
        const key = `${def.pos.x.toFixed(3)}_${groupId}`;
        if (!vertByXAndGroup.has(key)) {
          vertByXAndGroup.set(key, []);
        }
        vertByXAndGroup.get(key)!.push(def);
      } else {
        mergedDefs.push(def);
      }
    });

    // Merge horizontal segments
    horizByZAndGroup.forEach((segments) => {
      if (segments.length === 0) return;
      segments.sort((a, b) => a.pos.x - b.pos.x);

      let current = { ...segments[0] };
      let currentXStart = current.pos.x - current.width / 2;
      let currentXEnd = current.pos.x + current.width / 2;

      for (let i = 1; i < segments.length; i++) {
        const next = segments[i];
        const nextXStart = next.pos.x - next.width / 2;
        const nextXEnd = next.pos.x + next.width / 2;

        if (Math.abs(nextXStart - currentXEnd) < 0.01) {
          currentXEnd = nextXEnd;
        } else {
          current.width = currentXEnd - currentXStart;
          current.pos.x = currentXStart + current.width / 2;
          mergedDefs.push(current);

          current = { ...next };
          currentXStart = nextXStart;
          currentXEnd = nextXEnd;
        }
      }
      current.width = currentXEnd - currentXStart;
      current.pos.x = currentXStart + current.width / 2;
      mergedDefs.push(current);
    });

    // Merge vertical segments
    vertByXAndGroup.forEach((segments) => {
      if (segments.length === 0) return;
      segments.sort((a, b) => a.pos.z - b.pos.z);

      let current = { ...segments[0] };
      let currentZStart = current.pos.z - current.depth / 2;
      let currentZEnd = current.pos.z + current.depth / 2;

      for (let i = 1; i < segments.length; i++) {
        const next = segments[i];
        const nextZStart = next.pos.z - next.depth / 2;
        const nextZEnd = next.pos.z + next.depth / 2;

        if (Math.abs(nextZStart - currentZEnd) < 0.01) {
          currentZEnd = nextZEnd;
        } else {
          current.depth = currentZEnd - currentZStart;
          current.pos.z = currentZStart + current.depth / 2;
          mergedDefs.push(current);

          current = { ...next };
          currentZStart = nextZStart;
          currentZEnd = nextZEnd;
        }
      }
      current.depth = currentZEnd - currentZStart;
      current.pos.z = currentZStart + current.depth / 2;
      mergedDefs.push(current);
    });

    return mergedDefs;
  }
}
