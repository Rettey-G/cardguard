import Tesseract from 'tesseract.js'

type ScanResult = {
  text: string
  expiryYmd?: string
  title?: string
  issuer?: string
  cardType?: string
  personName?: string
  documentNumber?: string
  issueYmd?: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function clampDayMonth(day: number, month: number): { day: number; month: number } {
  const m = Math.min(Math.max(month, 1), 12)
  const maxDay = new Date(2024, m, 0).getDate()
  const d = Math.min(Math.max(day, 1), maxDay)
  return { day: d, month: m }
}

function normalizeYear(y: number): number {
  if (y < 100) return 2000 + y
  return y
}

function tryParseAnyDateYmd(text: string): string | undefined {
  const t = text.toUpperCase().replace(/\s+/g, ' ')

  // YYYY-MM-DD or YYYY/MM/DD
  let m = t.match(/\b(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})\b/)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    const cd = clampDayMonth(d, mo)
    return `${y}-${pad2(cd.month)}-${pad2(cd.day)}`
  }

  // DD-MM-YYYY or DD/MM/YYYY
  m = t.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/)
  if (m) {
    const d = Number(m[1])
    const mo = Number(m[2])
    const y = Number(m[3])
    const cd = clampDayMonth(d, mo)
    return `${y}-${pad2(cd.month)}-${pad2(cd.day)}`
  }

  return undefined
}

export function tryParseExpiryYmd(text: string): string | undefined {
  const t = text.toUpperCase().replace(/\s+/g, ' ')

  // Prefer lines near keywords
  const keyword = /(EXP|EXPIRES|EXPIRY|EXP\.|VALID THRU|VALID UNTIL|VALID TILL)/i
  const idx = t.search(keyword)
  const candidate = idx >= 0 ? t.slice(idx, Math.min(t.length, idx + 120)) : t

  // Patterns:
  // 1) YYYY-MM-DD or YYYY/MM/DD
  let m = candidate.match(/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    const cd = clampDayMonth(d, mo)
    return `${y}-${pad2(cd.month)}-${pad2(cd.day)}`
  }

  // 2) DD-MM-YYYY or DD/MM/YYYY
  m = candidate.match(/(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})/)
  if (m) {
    const d = Number(m[1])
    const mo = Number(m[2])
    const y = Number(m[3])
    const cd = clampDayMonth(d, mo)
    return `${y}-${pad2(cd.month)}-${pad2(cd.day)}`
  }

  // 3) MM/YY or MM-YY (common on bank cards). We assume day=01.
  m = candidate.match(/\b(0?[1-9]|1[0-2])[\/-]([0-9]{2})\b/)
  if (m) {
    const mo = Number(m[1])
    const yy = Number(m[2])
    const y = normalizeYear(yy)
    const cd = clampDayMonth(1, mo)
    return `${y}-${pad2(cd.month)}-${pad2(cd.day)}`
  }

  return undefined
}

export function tryParsePersonName(text: string): string | undefined {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/\b(NAME|COMMON NAME)\b\s*[:\-]?\s*(.+)?$/i)
    const isBareNameLabel = /^NAME\b\s*[:\-]?\s*$/i.test(line)
    const isPassportNameLabel = /^NAMEZAS\s*$/i.test(line) // Maldives Passport OCR artifact
    
    // Check for "Nar :" anywhere in the line
    const narMatch = line.match(/NAR\s*[:\-]?\s*(.+)?$/i)
    
    if (m) {
      const vInline = (m[2] ?? '').trim()
      const cleaned = vInline.replace(/[^\p{L}\p{N}\s\-'.]/gu, '').trim()
      if (cleaned.length >= 3 && !/^(F|M|NA)$/i.test(cleaned)) return cleaned
    }
    if (isBareNameLabel || isPassportNameLabel) {
      const candidate = lines[i + 1] || ''
      const cleaned = candidate.replace(/[^\p{L}\p{N}\s\-'.]/gu, '').trim()
      if (cleaned.length >= 3 && !/^(F|M|NA)$/i.test(cleaned)) return cleaned
    }
    if (narMatch) {
      const vInline = (narMatch[1] ?? '').trim()
      // More aggressive cleaning for passport OCR artifacts
      let cleaned = vInline.replace(/[^\p{L}\s]/gu, '').trim()
      cleaned = cleaned.replace(/\s+/g, ' ')
      // If the name is too garbled (like "oN i Te"), don't return it
      if (cleaned.length >= 3 && !/^(F|M|NA|oN i Te)$/i.test(cleaned)) {
        return cleaned
      }
    }
  }

  // Fallback: try to extract name from MRZ (machine-readable zone)
  // Format: P<MALDVNASHIDA<<MOHAMED<<<<<<<<<<<<<<<<<<<<<<<<<<
  const mrzMatch = text.match(/P<([A-Z]+)([A-Z]+)</)
  if (mrzMatch) {
    const surname = mrzMatch[2]
    const givenNames = mrzMatch[1]
    if (surname.length >= 3 || givenNames.length >= 3) {
      const fullName = `${givenNames} ${surname}`.trim()
      if (fullName.length >= 5) return fullName
    }
  }

  // Fallback: try to combine split names (e.g., "Fathmath Ha" and later "Hana")
  const nameCandidates = []
  for (const line of lines) {
    if (/^[A-Z][a-z]+ [A-Z][a-z]+$/i.test(line)) {
      nameCandidates.push(line)
    }
  }
  if (nameCandidates.length >= 2) {
    // Combine first name from first candidate and last name from second
    const first = nameCandidates[0].split(' ')[0]
    const last = nameCandidates[nameCandidates.length - 1].split(' ').slice(1).join(' ')
    if (first && last && last.length >= 2) {
      return `${first} ${last}`
    }
  }

  return undefined
}

export function tryParseDocumentNumber(text: string): string | undefined {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const patterns = [
    /\bPASSPORT\s*NO\b\s*[:\-]?\s*([A-Z0-9]{6,})/i,
    /\bNID\b\s*[:\-]?\s*([A-Z0-9]{5,})/i,
    /\bNATIONAL\s*ID\b\s*NO\b\s*[:\-]?\s*([A-Z0-9]{5,})/i,
    /\bNUMBER?\b\s*[:\-]?\s*([A-Z0-9]{4,})/i,
    /\bNUMBE\s*R?\b\s*[:\-]?\s*([A-Z0-9]{4,})/i,
    /\bumber\b\s*[:\-]?\s*([A-Z0-9]{4,})/i, // OCR typo: "umber" instead of "Number"
    /\bPASSPORT\s*NO\s*[:\-]?\s*([A-Z0-9]{8,})/i // For passports
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const p of patterns) {
      const m = line.match(p)
      if (m) return (m[1] ?? '').trim()
    }
    // Handle label on one line, value on next
    if (/^(NUMBER|NUMBE|umber|R?NID|PASSPORT\s*NO|NATIONAL\s*ID\s*NO)$/i.test(line)) {
      const next = lines[i + 1]
      if (next && /^[A-Z0-9\s]{4,}$/i.test(next)) {
        // Extract only the alphanumeric part (ignore trailing OCR junk like "Zass")
        const cleaned = next.replace(/[^A-Z0-9]/gi, '').trim()
        return cleaned
      }
    }
  }

  // Try to extract from machine-readable zone (MRZ) at the bottom of passports
  // Format: P<MALDVNASHIDA<<MOHAMED<<<<<<<<<<<<<<<<<<<<<<<<<<
  // Second line: document number + other info
  const mrzLines = text.split('\n').filter(l => /^[A-Z0-9<]{9,}$/.test(l))
  for (const line of mrzLines) {
    if (line.includes('MDV') && line.length > 20) {
      // Extract document number from MRZ (usually at start of second line)
      // Format: NC30696928MDV0902148F2112013A375356<<<<<<<76
      const docNum = line.replace(/</g, '').substring(2, 11).trim() // Skip "NC" prefix
      if (docNum.length >= 7 && /^[A-Z0-9]+$/.test(docNum)) {
        return docNum
      }
    }
  }

  return undefined
}

export function tryParseIssueYmd(text: string): string | undefined {
  const t = text.toUpperCase()
  const keyword = /(ISSUED|DATE OF ISSUE|ISSUE DATE)/i
  const idx = t.search(keyword)
  if (idx < 0) return undefined
  const candidate = t.slice(idx, Math.min(t.length, idx + 160))
  return tryParseAnyDateYmd(candidate)
}

export function tryParseCardTitle(text: string): string | undefined {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  // Look for common title patterns - usually the first prominent line
  // Skip lines that are clearly numbers, dates, or common keywords
  const skipPatterns = /^(EXP|EXPIRES|EXPIRY|VALID|THRU|UNTIL|TILL|CARD|DEBIT|CREDIT|20\d{2}|\d{2}\/\d{2}|\d{2}-\d{2})/i
  
  for (const line of lines) {
    if (line.length > 2 && line.length < 50 && !skipPatterns.test(line)) {
      // Clean up common OCR artifacts
      const cleaned = line.replace(/[^\w\s\-&.,']/g, '').trim()
      if (cleaned.length > 2) {
        return cleaned
      }
    }
  }
  
  return undefined
}

export function tryParseIssuer(text: string): string | undefined {
  const t = text.toUpperCase()
  
  // Common bank/issuer patterns
  const issuers = [
    /CHASE/i,
    /BANK OF AMERICA/i,
    /WELLS FARGO/i,
    /CITIBANK/i,
    /CAPITAL ONE/i,
    /AMERICAN EXPRESS/i,
    /DISCOVER/i,
    /BARCLAYS/i,
    /U\.?S\.? BANK/i,
    /PNC/i,
    /TD BANK/i,
    /HSBC/i,
    /GOVERNMENT/i,
    /DEPARTMENT OF/i,
    /REPUBLIC OF MALDIVES/i,
    /MINISTRY OF TRANSPORT/i,
    /CIVIL AVIATION/i,
    /PASSPORT/i,
    /DRIVER.?S? LICENSE/i,
    /IDENTIFICATION/i
  ]
  
  for (const pattern of issuers) {
    const match = t.match(pattern)
    if (match) {
      return match[0].trim()
    }
  }
  
  // Look for lines that might be issuer names (usually contain "Bank", "Card", etc.)
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  for (const line of lines) {
    if (line.includes('Bank') || line.includes('Card') || line.includes('Federal') || line.includes('Credit')) {
      const cleaned = line.replace(/[^\w\s\-&.,']/g, '').trim()
      if (cleaned.length > 3) {
        return cleaned
      }
    }
  }
  
  return undefined
}

export function tryParseCardType(text: string): string | undefined {
  const t = text.toUpperCase()
  
  // Card type detection patterns
  if (/DEBIT/i.test(t)) return 'Debit Card'
  if (/CREDIT/i.test(t)) return 'Credit Card'
  if (/PASSPORT/i.test(t)) return 'Passport'
  if (/DRIVER.?S? LICENSE|DRIVER.?S? LICENCE/i.test(t)) return "Driver's License"
  if (/IDENTIFICATION|ID CARD/i.test(t)) return 'ID Card'
  if (/SOCIAL SECURITY|SSN/i.test(t)) return 'Social Security Card'
  if (/MEDICARE|MEDICAID/i.test(t)) return 'Health Insurance Card'
  if (/INSURANCE/i.test(t)) return 'Insurance Card'
  if (/VETERAN|VA/i.test(t)) return 'Veteran ID Card'
  if (/MILITARY/i.test(t)) return 'Military ID'
  if (/STUDENT/i.test(t)) return 'Student ID'
  
  // Check for payment network indicators
  if (/VISA/i.test(t)) return 'Credit Card'
  if (/MASTERCARD/i.test(t)) return 'Credit Card'
  if (/AMEX|AMERICAN EXPRESS/i.test(t)) return 'Credit Card'
  if (/DISCOVER/i.test(t)) return 'Credit Card'
  
  return undefined
}

export async function scanCardImage(file: File): Promise<ScanResult> {
  try {
    // Note: first OCR run may download language data (free) depending on environment.
    const result = await Tesseract.recognize(file, 'eng', {
      logger: () => {}
    })

    const text = result.data.text ?? ''
    
    const expiryYmd = tryParseExpiryYmd(text)
    const title = tryParseCardTitle(text)
    const issuer = tryParseIssuer(text)
    const cardType = tryParseCardType(text)
    const personName = tryParsePersonName(text)
    const documentNumber = tryParseDocumentNumber(text)
    const issueYmd = tryParseIssueYmd(text)
    
    return { text, expiryYmd, title, issuer, cardType, personName, documentNumber, issueYmd }
  } catch (error) {
    console.error('OCR error:', error)
    throw error
  }
}

// Keep the old function for backward compatibility
export async function scanCardImageForExpiry(file: File): Promise<ScanResult> {
  return scanCardImage(file)
}
