export interface HierarchyNodeInfo {
  name: string;
  code: string;
}

export interface MeterHierarchy {
  meterId: string;
  zone: HierarchyNodeInfo | null;
  circle: HierarchyNodeInfo | null;
  division: HierarchyNodeInfo | null;
  subdivision: HierarchyNodeInfo | null;
  substation: HierarchyNodeInfo | null;
  feeder: HierarchyNodeInfo | null;
  transformer: HierarchyNodeInfo | null;
}

export interface MeterHierarchyResponse {
  data: MeterHierarchy;
  meta: {
    hierarchyDepth: number;
    source: 'portal-network-export';
  };
}
