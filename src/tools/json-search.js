import { EditorState } from '@codemirror/state'
import { Decoration, ViewPlugin } from '@codemirror/view'
import { SearchQuery, getSearchQuery } from '@codemirror/search'

export function collectSearchMatches(documents, scope, text, options = {}, limit = 10000) {
  const query = new SearchQuery({ search: text, literal: true, ...options })
  if (!text) return { matches: [], error: '', truncated: false }
  if (!query.valid) return { matches: [], error: '正则表达式无效', truncated: false }
  const matches = []
  for (const [side, doc] of Object.entries(documents)) {
    if (scope !== 'both' && side !== scope) continue
    const cursor = query.getCursor(EditorState.create({ doc }))
    while (!cursor.next().done) {
      const { from, to } = cursor.value
      // Zero-width regex matches have no visible text to highlight.
      if (from === to) continue
      if (matches.length === limit) return { matches, error: '', truncated: true }
      matches.push({ side, from, to })
    }
  }
  return { matches, error: '', truncated: false }
}

export function nextSearchIndex(current, length, direction) {
  if (!length) return -1
  if (current < 0) return direction === 'previous' ? length - 1 : 0
  return (current + (direction === 'previous' ? -1 : 1) + length) % length
}

// CodeMirror's built-in highlighter is tied to its own panel. Our React toolbar
// uses the public query API and an independent, viewport-only decoration plugin.
export const jsonSearchHighlights = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this.highlight(view) }
  update(update) {
    if (update.docChanged || update.viewportChanged || update.selectionSet ||
      getSearchQuery(update.startState) !== getSearchQuery(update.state)) {
      this.decorations = this.highlight(update.view)
    }
  }
  highlight(view) {
    const query = getSearchQuery(view.state)
    if (!query.valid) return Decoration.none
    const marks = []
    for (const { from, to } of view.visibleRanges) {
      const cursor = query.getCursor(view.state, from, to)
      while (!cursor.next().done && marks.length < 10000) {
        const match = cursor.value
        if (match.from === match.to) continue
        const selection = view.state.selection.main
        const selected = match.from === selection.from && match.to === selection.to
        marks.push(Decoration.mark({ class: selected ? 'cm-searchMatch cm-searchMatch-selected' : 'cm-searchMatch' }).range(match.from, match.to))
      }
    }
    return Decoration.set(marks, true)
  }
}, { decorations: plugin => plugin.decorations })
