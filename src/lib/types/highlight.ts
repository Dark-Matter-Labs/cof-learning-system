export type HighlightState =
  | { readonly type: 'none' }
  | { readonly type: 'commitment'; readonly commitmentId: string; readonly connectedNodeIds: ReadonlySet<string> }
  | { readonly type: 'tension'; readonly alertId: string; readonly chainNodeIds: ReadonlySet<string>; readonly chainEdgeIds: ReadonlySet<string> }
  | { readonly type: 'assumption'; readonly assumptionId: string; readonly treeNodeIds: ReadonlySet<string> };
