import { calculateResizeSnap, Rect, Guideline } from './snapHelpers';

// Mock snap lines function if needed, but we can test calculateResizeSnap directly as it calls getSnapLines internally.
// We just need to trust getSnapLines works (which is simple).

describe('calculateResizeSnap', () => {
  const canvasWidth = 1000;
  const canvasHeight = 1000;
  const others: Rect[] = [
    { x: 200, y: 200, width: 100, height: 100 } // Zone at 200-300
  ];

  it('should snap right edge to canvas width', () => {
    const current: Rect = { x: 800, y: 0, width: 198, height: 100 }; // Right edge at 998
    // Dragging right edge
    const result = calculateResizeSnap(current, 'right', [], canvasWidth, canvasHeight);
    
    // Should snap to 1000
    expect(result.width).toBe(200); // 1000 - 800
    expect(result.x).toBe(800);
    expect(result.guides).toContainEqual({ type: 'vertical', pos: 1000 });
  });

  it('should snap left edge to other zone right edge', () => {
    // Other zone is 200-300.
    // We are resizing a zone starting at 302.
    const current: Rect = { x: 302, y: 0, width: 100, height: 100 };
    // Dragging left edge
    const result = calculateResizeSnap(current, 'left', others, canvasWidth, canvasHeight);
    
    // Should snap x to 300
    expect(result.x).toBe(300);
    // Width should increase by 2
    expect(result.width).toBe(102);
    expect(result.guides).toContainEqual({ type: 'vertical', pos: 300 });
  });

  it('should preserve anchor when resizing left', () => {
    // x=100, width=100. Right edge = 200.
    // Resize left to 90.
    const current: Rect = { x: 90, y: 0, width: 110, height: 100 }; // User dragged 10px left
    // No snap candidates nearby (except 0, but 90 is far from 0 if threshold is 5).
    // Let's put a snap target at 90 to trigger logic.
    const othersWith90: Rect[] = [{ x: 40, y: 0, width: 50, height: 50 }]; // Ends at 90
    
    const result = calculateResizeSnap(current, 'left', othersWith90, canvasWidth, canvasHeight);
    
    expect(result.x).toBe(90);
    expect(result.width).toBe(110);
    // Anchor check: Right edge was 200 (100+100) -> Now 90+110 = 200. Correct.
  });

  it('should enforce min size and adjust anchor if needed (left resize)', () => {
    // Current: x=195, width=5. (Too small!)
    // Anchor Right was 200.
    // Dragging Left.
    const current: Rect = { x: 195, y: 0, width: 5, height: 100 };
    
    const result = calculateResizeSnap(current, 'left', [], canvasWidth, canvasHeight);
    
    // Width should be clamped to 10.
    // If width is 10, and anchor is 200, x must be 190.
    expect(result.width).toBe(10);
    expect(result.x).toBe(190);
  });
  
  it('should enforce min size (right resize)', () => {
    // Current: x=100, width=5.
    // Anchor Left is 100.
    const current: Rect = { x: 100, y: 0, width: 5, height: 100 };
    
    const result = calculateResizeSnap(current, 'right', [], canvasWidth, canvasHeight);
    
    expect(result.width).toBe(10);
    expect(result.x).toBe(100);
  });

  it('should snap top to margin (0)', () => {
    const current: Rect = { x: 0, y: 3, width: 100, height: 100 };
    const result = calculateResizeSnap(current, 'top', [], canvasWidth, canvasHeight);
    
    expect(result.y).toBe(0);
    expect(result.height).toBe(103);
    expect(result.guides).toContainEqual({ type: 'horizontal', pos: 0 });
  });
});
