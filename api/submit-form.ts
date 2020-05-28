import { Octokit } from '@octokit/rest'
import { format } from 'date-fns'
import { NowRequest, NowResponse } from '@vercel/node'
import sanitizeHTML from 'sanitize-html'

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
  const latest = guests.slice(0, 2)
  return [newGuest, ...latest]
}

function renderList (guests: Guest[]): string {
  return guests
    .map(guest => `**Name:** ${guest.name}\n\n<sub><strong>Date:</strong> ${guest.date}</sub>\n\n**Message:** ${guest.message}`)
    .join('\n\n---\n\n')
}

async function createBranch (octokit: Octokit, newGuest: Guest) {
  const baseRef = await octokit.git.getRef({
    ...REPO_DETAILS,
    ref: 'heads/master'
  })

  const ref = await octokit.git.createRef({
    ...REPO_DETAILS,
    ref: `refs/heads/${newGuest.name}`,
    sha: baseRef.data.object.sha
  })

  return ref.data.ref.replace(/^refs\/heads\//, '')
}

export default async (req: NowRequest, res: NowResponse) => {
  const octokit = new Octokit({ auth: `token ${process.env.GITHUB_TOKEN}` })
  const readme = await getReadme(octokit)

  const match = readme.content.match(jsonReg)
  if (!match) return res.send(200).end()

  const guests = parseListFromReadme(match)

  const newGuest: Guest = {
    name: req.body.name,
    message: sanitizeHTML(req.body.message),
    date: format(new Date(), 'MM/dd/yyyy')
  }

  const newList = createNewList(newGuest, guests)
  const branch = await createBranch(octokit, newGuest)
  const newContents = generateNewReadme(newList, readme.content)

  await octokit.repos.createOrUpdateFile({
    ...REPO_DETAILS,
    content: newContents,
    path: 'README.md',
    message: `${guests[0].name} has signed the guestbook!`,
    sha: readme.sha,
    branch
  })
  
  const pr = await octokit.pulls.create({
    ...REPO_DETAILS,
    head: branch,
    base: 'master',
    title: `${newGuest.name} has signed the guestbook!`,
    body: `**Name:** ${newGuest.name}\n\n<sub><strong>Date:</strong> ${newGuest.date}</sub>\n\n**Message:** ${newGuest.message}`
  })

  res.json({ pull_request: pr.data.html_url })
}
