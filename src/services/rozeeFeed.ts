import type { Job } from '../types/job'

const ROZEE_RSS_PROXY_URL =
  'https://api.allorigins.win/raw?url=https://www.rozee.pk/rss/jobs/it-software'
const FETCH_TIMEOUT_MS = 5000

const parseRozeeTitle = (rawTitle: string): { title: string; company: string } => {
  const cleaned = rawTitle.trim()
  const atMatch = cleaned.match(/\s+at\s+/i)
  if (atMatch) {
    const [titlePart, companyPart] = cleaned.split(/\s+at\s+/i)
    return {
      title: titlePart.trim() || cleaned,
      company: companyPart.trim() || 'Rozee.pk',
    }
  }

  const dashIndex = cleaned.lastIndexOf(' - ')
  if (dashIndex > 0) {
    return {
      title: cleaned.slice(0, dashIndex).trim() || cleaned,
      company: cleaned.slice(dashIndex + 3).trim() || 'Rozee.pk',
    }
  }

  return {
    title: cleaned,
    company: 'Rozee.pk',
  }
}

const parseLocationFromDescription = (description: string): string => {
  const locationMatch = description.match(/Location:\s*([^<\n\r]+)/i)
  if (locationMatch) {
    return locationMatch[1].trim()
  }
  const cityMatch = description.match(/(Karachi|Lahore|Islamabad|Rawalpindi|Peshawar|Multan)/i)
  if (cityMatch) {
    return `${cityMatch[1].trim()}, Pakistan`
  }
  return 'Pakistan'
}

const normalizePublicationDate = (rawDate?: string): string | undefined => {
  if (!rawDate) return undefined
  const parsed = new Date(rawDate)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

export async function fetchRozeeJobs(): Promise<Job[]> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(ROZEE_RSS_PROXY_URL, {
      signal: controller.signal,
    })

    if (!response.ok) {
      return []
    }

    const text = await response.text()
    const parser = new DOMParser()
    const xml = parser.parseFromString(text, 'text/xml')

    if (xml.querySelector('parsererror')) {
      return []
    }

    const items = Array.from(xml.querySelectorAll('item'))
    const jobs: Job[] = items.map((item) => {
      const rawTitle = item.querySelector('title')?.textContent?.trim() ?? ''
      const link = item.querySelector('link')?.textContent?.trim() ?? ''
      const description = item.querySelector('description')?.textContent?.trim() ?? ''
      const rawPubDate = item.querySelector('pubDate')?.textContent?.trim()
      const location =
        item.querySelector('location')?.textContent?.trim() || parseLocationFromDescription(description)

      const { title, company } = parseRozeeTitle(rawTitle)
      const publication_date = normalizePublicationDate(rawPubDate)
      const id = link || `${title.toLowerCase()}|${company.toLowerCase()}|${publication_date ?? Date.now()}`

      return {
        id,
        title,
        company_name: company,
        candidate_required_location: location,
        url: link,
        description,
        publication_date,
        category: 'Software Development',
        job_type: 'Full Time',
      }
    })

    return jobs
  } catch {
    return []
  } finally {
    window.clearTimeout(timeoutId)
  }
}
