export interface Screen {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'UNPAIRED';
  orientation: 'LANDSCAPE' | 'PORTRAIT';
  playerType: string;
  tags?: string[] | string;
  location?: {
    label?: string;
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    zip?: string;
  };
  lastSeenAt?: string;
  config?: any;
  createdAt: string;
  updatedAt: string;
}
