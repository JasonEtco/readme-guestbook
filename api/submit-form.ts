import { Octokit } from '@octokit/rest'
import { format } from 'date-fns'
import { NowRequest, NowResponse } from '@vercel/node'

const REPO_DETAILS = {
  owner: process.env.REPO_OWNER,
  repo: '.github'
}

const START_COMMENT = '<!--START_SECTION:guestbook-->'
const END_COMMENT = '<!--END_SECTION:guestbook-->'
const listReg = new RegExp(`${START_COMMENT}[\\s\\S]+${END_COMMENT}`)
const jsonReg = new RegExp(`<!--GUESTBOOK_LIST\\s(?<content>[\\s\\S]+)-->`)

interface Guest {
  name: string
  message: string
  date: string
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

async function updateReadme (octokit: Octokit, guests: Guest[], readme: string, sha: string) {
  const renderedList = renderList(guests)
  const listWithFences = `${START_COMMENT}\n${renderedList}\n${END_COMMENT}`
  const newContent = readme
    .replace(listReg, listWithFences)
    .replace(jsonReg, `<!--GUESTBOOK_LIST ${JSON.stringify(guests)}-->`)
  const content =  Buffer.from(newContent).toString('base64')

  return octokit.repos.createOrUpdateFile({
    ...REPO_DETAILS,
    content,
    path: 'README.md',
    message: `${guests[0].name} has signed the guestbook!`,
    sha
  })
}

function parseListFromReadme (match: RegExpMatchArray): Guest[] {
  const { content } = match.groups
  return JSON.parse(content)
}

function createNewList (newGuest: Guest, guests: Guest[]): Guest[] {
  // Only keep the latest 2
  const latest = guests.slice(0, 2)
  return [newGuest, ...latest]
}

function renderList (guests: Guest[]): string {
  return guests
    .map(guest => `**Name:** ${guest.name}\n\n<sub><strong>Date:</strong> ${guest.date}</sub>\n\n**Message:** ${guest.message}`)
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
    message: req.body.message,
    date: format(new Date(), 'MM/dd/yyyy')
  }

  const newList = createNewList(newGuest, guests)
  await updateReadme(octokit, newList, readme.content, readme.sha)

  res.send(200).end()
}
