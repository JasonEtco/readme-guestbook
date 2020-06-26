import { Octokit } from '@octokit/rest'
import { format } from 'date-fns'
import { NowRequest, NowResponse } from '@vercel/node'
import sanitizeHTML from 'sanitize-html'

const REPO_DETAILS = {
  owner: process.env.REPO_OWNER,
  repo: process.env.REPO_OWNER
}

const MAX_ENTRIES = 5
const MAX_LENGTH = 150

interface Guest {
  name: string
  message: string
  date: string
}

const START_COMMENT = '<!--START_SECTION:guestbook-->'
const END_COMMENT = '<!--END_SECTION:guestbook-->'
const listReg = new RegExp(`${START_COMMENT}[\\s\\S]+${END_COMMENT}`)
const jsonReg = new RegExp(`<!--GUESTBOOK_LIST\\s(?<content>[\\s\\S]+)-->`)
const entryTemplate = (guest: Guest) => {
  return `[@${guest.name}](https://github.com/${guest.name}) says:

> ${guest.message.trim().replace(/\n/g, '\n> ')}

<sup>${guest.date}</sup>
`
}

async function getReadme (octokit: Octokit) {
  const res = await octokit.repos.getReadme(REPO_DETAILS)
  const encoded = res.data.content
  const decoded = Buffer.from(encoded, 'base64').toString('utf8')
  return {
    content: decoded,
    sha: res.data.sha
  }
}

function generateNewReadme (guests: Guest[], readme: string) {
  const renderedList = renderList(guests)
  const listWithFences = `${START_COMMENT}\n${renderedList}\n${END_COMMENT}`
  const newContent = readme
    .replace(listReg, listWithFences)
    .replace(jsonReg, `<!--GUESTBOOK_LIST ${JSON.stringify(guests)}-->`)
  return Buffer.from(newContent).toString('base64')
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
  const octokit = new Octokit({ auth: `token ${process.env.GITHUB_TOKEN}` })
  const readme = await getReadme(octokit)

  const match = readme.content.match(jsonReg)
  if (!match) return res.send(200).end()

  const guests = parseListFromReadme(match)

  const newGuest: Guest = {
    name: req.body.name,
    message: sanitizeHTML(req.body.message.slice(0, MAX_LENGTH)),
    date: format(new Date(), 'MM/dd/yyyy')
  }

  const newList = createNewList(newGuest, guests)

  try {
    const newContents = generateNewReadme(newList, readme.content)
  
    await octokit.repos.createOrUpdateFile({
      ...REPO_DETAILS,
      content: newContents,
      path: 'README.md',
      message: `${newGuest.name} has signed the guestbook!`,
      sha: readme.sha,
      branch: 'master'
    })

    res.json({ redirect: 'https://github.com/JasonEtco' })
  } catch (err) {
    console.error(err)
    res.json({ error: 'Something weird happened and your entry wasn\'t added!' })
  }
}
