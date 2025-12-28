export interface Rect {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Guideline {
  type: 'horizontal' | 'vertical';
  pos: number;
}

export const SNAP_THRESHOLD = 5;

// Helper to find the best snap line
const snapValue = (value: number, lines: number[], threshold = SNAP_THRESHOLD): number | null => {
  let bestDist = threshold + 1;
  let bestLine = null;
  for (const line of lines) {
    const dist = Math.abs(value - line);
    if (dist < bestDist) {
      bestDist = dist;
      bestLine = line;
    }
  }
  return bestLine;
};

export const getSnapLines = (
  others: Rect[],
  canvasWidth: number,
  canvasHeight: number
) => {
  const verticalCandidates = new Set<number>();
  const horizontalCandidates = new Set<number>();

  // Add canvas edges and center
  verticalCandidates.add(0);
  verticalCandidates.add(canvasWidth / 2);
  verticalCandidates.add(canvasWidth);

  horizontalCandidates.add(0);
  horizontalCandidates.add(canvasHeight / 2);
  horizontalCandidates.add(canvasHeight);

  // Add other zones edges and centers
  others.forEach(rect => {
    verticalCandidates.add(rect.x);
    verticalCandidates.add(rect.x + rect.width / 2);
    verticalCandidates.add(rect.x + rect.width);

    horizontalCandidates.add(rect.y);
    horizontalCandidates.add(rect.y + rect.height / 2);
    horizontalCandidates.add(rect.y + rect.height);
  });

  return {
    vertical: Array.from(verticalCandidates),
    horizontal: Array.from(horizontalCandidates)
  };
};

export const calculateSnap = (
  current: Rect,
  others: Rect[],
  canvasWidth: number,
  canvasHeight: number
) => {
  const { vertical, horizontal } = getSnapLines(others, canvasWidth, canvasHeight);
  
  let newX = current.x;
  let newY = current.y;
  const activeGuides: Guideline[] = [];

  // Check vertical snaps (for X alignment)
  // Edges to check: Left (x), Center (x + w/2), Right (x + w)
  const vEdges = [
    { val: current.x, offset: 0 },
    { val: current.x + current.width / 2, offset: current.width / 2 },
    { val: current.x + current.width, offset: current.width }
  ];

  let bestVDiff = SNAP_THRESHOLD + 1;
  let bestVSnap: number | null = null;

  for (const edge of vEdges) {
    const snapped = snapValue(edge.val, vertical);
    if (snapped !== null) {
      const diff = Math.abs(edge.val - snapped);
      if (diff < bestVDiff) {
        bestVDiff = diff;
        bestVSnap = snapped - edge.offset;
      }
    }
  }

  if (bestVSnap !== null) {
    newX = bestVSnap;
    // Which line did we snap to? Re-calculate to find the exact line for visualization
    for (const edge of vEdges) {
       // Recalculate edge value with newX
       const currentEdgeVal = newX + edge.offset;
       for (const line of vertical) {
         if (Math.abs(currentEdgeVal - line) < 0.1) {
           activeGuides.push({ type: 'vertical', pos: line });
         }
       }
    }
  }

  // Check horizontal snaps (for Y alignment)
  // Edges to check: Top (y), Middle (y + h/2), Bottom (y + h)
  const hEdges = [
    { val: current.y, offset: 0 },
    { val: current.y + current.height / 2, offset: current.height / 2 },
    { val: current.y + current.height, offset: current.height }
  ];

  let bestHDiff = SNAP_THRESHOLD + 1;
  let bestHSnap: number | null = null;

  for (const edge of hEdges) {
    const snapped = snapValue(edge.val, horizontal);
    if (snapped !== null) {
      const diff = Math.abs(edge.val - snapped);
      if (diff < bestHDiff) {
        bestHDiff = diff;
        bestHSnap = snapped - edge.offset;
      }
    }
  }

  if (bestHSnap !== null) {
    newY = bestHSnap;
    for (const edge of hEdges) {
       const currentEdgeVal = newY + edge.offset;
       for (const line of horizontal) {
         if (Math.abs(currentEdgeVal - line) < 0.1) {
           activeGuides.push({ type: 'horizontal', pos: line });
         }
       }
    }
  }

  // Deduplicate guides
  const uniqueGuides = activeGuides.filter((g, index, self) =>
    index === self.findIndex((t) => (
      t.type === g.type && Math.abs(t.pos - g.pos) < 0.1
    ))
  );

  return { x: newX, y: newY, guides: uniqueGuides };
};

export const MIN_ZONE_SIZE = 10;

export const calculateResizeSnap = (
  current: Rect,
  direction: string,
  others: Rect[],
  canvasWidth: number,
  canvasHeight: number
) => {
  const { vertical, horizontal } = getSnapLines(others, canvasWidth, canvasHeight);
  const activeGuides: Guideline[] = [];
  
  let { x, y, width, height } = current;

  // Horizontal Snapping (Width / X)
  if (direction.toLowerCase().includes('left')) {
     // Moving left edge (x). Anchor is Right edge.
     const anchorRight = x + width;
     const snapped = snapValue(x, vertical);
     
     if (snapped !== null) {
       let newWidth = anchorRight - snapped;
       let newX = snapped;

       // Enforce min width
       if (newWidth < MIN_ZONE_SIZE) {
         newWidth = MIN_ZONE_SIZE;
         newX = anchorRight - MIN_ZONE_SIZE;
       }

       // Only show guide if we are actually at the snap line
       if (Math.abs(newX - snapped) < 0.1) {
         width = newWidth;
         x = newX;
         activeGuides.push({ type: 'vertical', pos: snapped });
       }
     }
  } else if (direction.toLowerCase().includes('right')) {
     // Moving right edge (x + width). Anchor is Left edge.
     const anchorLeft = x;
     const rightEdge = x + width;
     const snapped = snapValue(rightEdge, vertical);
     
     if (snapped !== null) {
       let newWidth = snapped - anchorLeft;
       
       if (newWidth < MIN_ZONE_SIZE) {
         newWidth = MIN_ZONE_SIZE;
       }

       // Check if we are still at snap (we only adjusted width, x is constant)
       // If min width triggered, we might not be at snap line anymore? 
       // Right edge = anchorLeft + newWidth. 
       // If newWidth was clamped, Right edge != snapped.
       if (Math.abs((anchorLeft + newWidth) - snapped) < 0.1) {
         width = newWidth;
         activeGuides.push({ type: 'vertical', pos: snapped });
       }
     }
  }

  // Vertical Snapping (Height / Y)
  if (direction.toLowerCase().includes('top')) {
     // Moving top edge (y). Anchor is Bottom edge.
     const anchorBottom = y + height;
     const snapped = snapValue(y, horizontal);
     
     if (snapped !== null) {
       let newHeight = anchorBottom - snapped;
       let newY = snapped;

       if (newHeight < MIN_ZONE_SIZE) {
         newHeight = MIN_ZONE_SIZE;
         newY = anchorBottom - MIN_ZONE_SIZE;
       }

       if (Math.abs(newY - snapped) < 0.1) {
         height = newHeight;
         y = newY;
         activeGuides.push({ type: 'horizontal', pos: snapped });
       }
     }
  } else if (direction.toLowerCase().includes('bottom')) {
     // Moving bottom edge (y + height). Anchor is Top edge.
     const anchorTop = y;
     const bottomEdge = y + height;
     const snapped = snapValue(bottomEdge, horizontal);
     
     if (snapped !== null) {
       let newHeight = snapped - anchorTop;

       if (newHeight < MIN_ZONE_SIZE) {
         newHeight = MIN_ZONE_SIZE;
       }

       if (Math.abs((anchorTop + newHeight) - snapped) < 0.1) {
         height = newHeight;
         activeGuides.push({ type: 'horizontal', pos: snapped });
       }
     }
  }

  return { x, y, width, height, guides: activeGuides };
};
