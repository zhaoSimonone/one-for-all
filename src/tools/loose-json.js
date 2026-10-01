const isIdentifierStart = (char) => /[A-Za-z_$]/.test(char)
const isIdentifierPart = (char) => /[A-Za-z0-9_$-]/.test(char)

const stripCodeFence = (text) => {
  const trimmed = String(text || '').trim().replace(/^\uFEFF/, '')
  const match = trimmed.match(/^```(?:json|javascript|js)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1].trim() : trimmed
}

// Quote object keys such as req: and resp: without changing text inside strings.
const quoteUnquotedKeys = (text) => {
  let output = ''
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      output += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }

    if (char === '"') {
      inString = true
      output += char
      continue
    }

    if (isIdentifierStart(char)) {
      let end = index + 1
      while (end < text.length && isIdentifierPart(text[end])) end += 1
      let lookahead = end
      while (/\s/.test(text[lookahead] || '')) lookahead += 1
      const token = text.slice(index, end)
      if (text[lookahead] === ':') {
        output += JSON.stringify(token)
        index = end - 1
        continue
      }
      output += token
      index = end - 1
      continue
    }

    output += char
  }
  return output
}

const removeTrailingCommas = (text) => {
  let output = ''
  let inString = false
  let escaped = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      output += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      output += char
      continue
    }
    if (char === ',') {
      let lookahead = index + 1
      while (/\s/.test(text[lookahead] || '')) lookahead += 1
      if (text[lookahead] === '}' || text[lookahead] === ']') continue
    }
    output += char
  }
  return output
}

export const parseJsonWithRecovery = (input) => {
  const raw = stripCodeFence(input)
  if (!raw) throw new Error('内容为空')

  try {
    return { value: JSON.parse(raw), recovered: false }
  } catch (strictError) {
    const normalized = removeTrailingCommas(quoteUnquotedKeys(raw))
    const candidates = normalized.startsWith('{') || normalized.startsWith('[')
      ? [normalized]
      : [`{${normalized}}`]

    for (const candidate of candidates) {
      try {
        return { value: JSON.parse(candidate), recovered: true }
      } catch {}
    }

    const error = new Error(strictError.message)
    error.strictError = strictError
    throw error
  }
}
