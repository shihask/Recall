import { describe, expect, it } from 'vitest'
import { buildCollectionTree, canHaveParent, childrenOf, parentOptions } from './tree'

const c = (id: string, parent_id: string | null = null) => ({ id, name: id, parent_id })

// Travel ─ Munnar, Ooty, Wayanad · Kerala · Other ─ Food
const all = [c('Travel'), c('Wayanad', 'Travel'), c('Kerala'), c('Munnar', 'Travel'), c('Other'), c('Ooty', 'Travel'), c('Food', 'Other')]

describe('collection tree', () => {
  it('nests sub-collections under their parent, sorted by name, keeping top-level order', () => {
    const tree = buildCollectionTree(all)
    expect(tree.map((n) => n.id)).toEqual(['Travel', 'Kerala', 'Other'])
    expect(tree[0]?.children.map((n) => n.id)).toEqual(['Munnar', 'Ooty', 'Wayanad'])
    expect(tree[1]?.children).toEqual([])
    expect(tree[2]?.children.map((n) => n.id)).toEqual(['Food'])
  })

  it('treats a sub-collection with a missing parent as top-level', () => {
    const tree = buildCollectionTree([c('Munnar', 'gone'), c('Kerala')])
    expect(tree.map((n) => n.id)).toEqual(['Munnar', 'Kerala'])
  })

  it('lists children of one collection only', () => {
    expect(childrenOf(all, 'Travel').map((n) => n.id)).toEqual(['Munnar', 'Ooty', 'Wayanad'])
    expect(childrenOf(all, 'Munnar')).toEqual([])
  })

  it('does not let a parent become a sub-collection (Travel → Kerala)', () => {
    expect(canHaveParent({ id: 'Travel' }, all)).toBe(false)
    expect(canHaveParent({ id: 'Kerala' }, all)).toBe(true)
    expect(canHaveParent({ id: 'Munnar' }, all)).toBe(true)
  })

  it('offers only top-level collections other than itself as parents', () => {
    expect(parentOptions(all).map((n) => n.id)).toEqual(['Kerala', 'Other', 'Travel'])
    expect(parentOptions(all, { id: 'Kerala' }).map((n) => n.id)).toEqual(['Other', 'Travel'])
  })
})
