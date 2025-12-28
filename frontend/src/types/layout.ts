export interface LayoutZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rotation: number;
}

export interface Layout {
  id: string;
  name: string;
  description?: string;
  resolution: string;
  canvasWidth: number;
  canvasHeight: number;
  orientation: string;
  zones: LayoutZone[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLayoutData {
  name: string;
  description?: string;
}

export interface UpdateLayoutData {
  name?: string;
  description?: string;
  resolution?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  orientation?: string;
  zones?: LayoutZone[];
}
