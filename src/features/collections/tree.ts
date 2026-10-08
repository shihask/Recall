import type { CollectionRow } from '@/types/database'

type Node = Pick<CollectionRow, 'id' | 'name' | 'parent_id'>

export type CollectionTreeNode<C extends Node> = C & { children: C[] }

const byName = (a: Node, b: Node) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

/**
 * Top-level collections, each with its sub-collections sorted by name. Keeps
 * the input order for the top level. A sub-collection whose parent is missing
 * (not loaded yet, or just deleted) is treated as top-level.
 */
export function buildCollectionTree<C extends Node>(collections: readonly C[]): CollectionTreeNode<C>[] {
  const ids = new Set(collections.map((c) => c.id))
  const children = new Map<string, C[]>()
  for (const c of collections) {
    if (c.parent_id && ids.has(c.parent_id)) children.set(c.parent_id, [...(children.get(c.parent_id) ?? []), c])
  }
  return collections
    .filter((c) => !c.parent_id || !ids.has(c.parent_id))
    .map((c) => ({ ...c, children: (children.get(c.id) ?? []).sort(byName) }))
}

export function childrenOf<C extends Node>(collections: readonly C[], id: string): C[] {
  return collections.filter((c) => c.parent_id === id).sort(byName)
}

/** Only one level of nesting: a collection with sub-collections can't go inside another. */
export function canHaveParent(collection: Pick<Node, 'id'>, collections: readonly Node[]): boolean {
  return !collections.some((c) => c.parent_id === collection.id)
}

/** Collections that `collection` (or a new one, if omitted) may be moved inside. */
export function parentOptions<C extends Node>(collections: readonly C[], collection?: Pick<Node, 'id'>): C[] {
  return collections.filter((c) => !c.parent_id && c.id !== collection?.id).sort(byName)
}
