import { format } from 'date-fns'
import { NowRequest, NowResponse } from '@vercel/node'
import sanitizeHTML from 'sanitize-html'
import { ReadmeBox } from 'readme-box'

const MAX_ENTRIES = 5
const MAX_LENGTH = 150

interface Guest {
  name: string
  message: string
  date: string
}

const jsonReg = new RegExp(`<!--GUESTBOOK_LIST\\s(?<content>[\\s\\S]+)-->`)
const entryTemplate = (guest: Guest) => {
  return `[@${guest.name}](https://github.com/@${guest.name}) says:

> ${guest.message}

<sup>${guest.date}</sup>
`
}

function parseListFromReadme (match: RegExpMatchArray): Guest[] {
  const { content } = match.groups
  return JSON.parse(content)
}

function createNewList (newGuest: Guest, guests: Guest[]): Guest[] {
  // Only keep the latest 2
  const latest = guests.slice(0, MAX_ENTRIES - 1)
  return [newGuest, ...latest]
}

function renderList (guests: Guest[]): string {
  return guests
    .map(entryTemplate)
    .join('\n\n---\n\n')
}

export default async (req: NowRequest, res: NowResponse) => {
  const box = new ReadmeBox({
    owner: process.env.REPO_OWNER,
    repo: process.env.REPO_OWNER,
    token: process.env.GITHUB_TOKEN
  })

  const readme = await box.getReadme()

  const match = readme.content.match(jsonReg)
  if (!match) return res.send(200).end()

  const guests = parseListFromReadme(match)

  const newGuest: Guest = {
    name: req.body.name,
    message: sanitizeHTML(req.body.message.slice(0, MAX_LENGTH)),
    date: format(new Date(), 'MM/dd/yyyy')
  }

  const newList = createNewList(newGuest, guests)
  const renderedList = renderList(newList)

  try {
    const newContents = box.replaceSection({
      newContents: renderedList,
      oldContents: readme.content,
      section: 'guestbook'
    })

    const withJSONStore = newContents
      .replace(jsonReg, `<!--GUESTBOOK_LIST ${JSON.stringify(guests)}-->`)

    await box.updateReadme({
      content: withJSONStore,
      sha: readme.sha,
      path: readme.path
    })

    res.json({ redirect: 'https://github.com/JasonEtco' })
  } catch (err) {
    console.error(err)
    res.json({ error: 'Something weird happened and your entry wasn\'t added!' })
  }
}
