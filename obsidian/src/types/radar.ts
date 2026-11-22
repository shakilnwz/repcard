export const RADAR_DOCUMENT_TYPE = 'genforge-radar' as const;

export type RadarMovement = 'new' | 'up' | 'down' | 'same';

export type RadarLabelMode = 'auto' | 'labels' | 'numbers';

export interface RadarStep {
  id: string;
  label: string;
  color: string;
  description?: string;
}

export interface RadarQuadrant {
  id: string;
  name: string;
  subtitle?: string;
}

export interface RadarItem {
  id: string;
  title: string;
  quadrant?: string;
  description?: string;
  link?: string;
  tags?: string[];
  movement?: RadarMovement;
}

export interface RadarDocument {
  type: typeof RADAR_DOCUMENT_TYPE;
  schemaVersion: 1;
  title: string;
  subtitle?: string;
  description?: string;
  quadrants: RadarQuadrant[];
  steps: RadarStep[];
  items: Record<string, RadarItem[]>;
}

export interface SavedCustomRadar {
  id: string;
  path?: string;
  source: 'builtin' | 'vault' | 'local' | 'uploaded';
  updatedAt: number;
  doc: RadarDocument;
}
