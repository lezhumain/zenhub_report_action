/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line import/named
import get from 'axios'
import { AxiosResponse } from 'axios'
import { IGithubPR } from './igithubpr'
import * as fs from 'node:fs'
import { ICheckPr } from './models'
import { Commit, fetchCommitsForPullRequest } from './getPrAndCommits'
import { IPrSummary } from './zenhub_call'
import { filterDateBetweenConfig } from './utils'

export function getWeekCount(dateFrom: Date, dateTo: Date): number {
  return Number(
    ((dateTo.getTime() - dateFrom.getTime()) / 1000 / 3600 / 24 / 7).toFixed(2)
  )
}

const callGithubAPIByURL = async (apiUrl: string): Promise<AxiosResponse> => {
  return get(apiUrl, {
    headers: {
      Authorization: `token ${process.env.GH_API_KEY}`
    }
  })
}

const callGithubAPIByEndpoint = async (
  endpoint: string,
  repoId: string
): Promise<AxiosResponse> => {
  // GitHub API endpoint for pull requests
  if (
    !endpoint.startsWith('/') &&
    endpoint.length > 0 &&
    !endpoint.startsWith('http')
  ) {
    endpoint = `/${endpoint}`
  }
  const owner = 'whitespace-software'
  const url = endpoint.startsWith('http')
    ? endpoint
    : `https://api.github.com/repos/${owner}/${repoId}${endpoint}` // pulls
  return callGithubAPIByURL(url)
}

async function getByURL<T>(url: string): Promise<T> {
  const resp: AxiosResponse = await callGithubAPIByURL(url)
  return Promise.resolve(resp.data)
}

export async function getRepoInfo(repoName: string): Promise<AxiosResponse> {
  return callGithubAPIByEndpoint('', repoName)
}

/**
 * See: https://docs.github.com/en/rest/metrics/statistics?apiVersion=2022-11-28#get-all-contributor-commit-activity
 * @returns {Promise<unknown>}
 */
async function getPContributorsData(repoId: string): Promise<AxiosResponse> {
  const savedName = getContribFilename(repoId)
  if (fs.existsSync(savedName)) {
    const content = fs.readFileSync(savedName, { encoding: 'utf8' })
    if (content) {
      return Promise.resolve({
        data: (JSON.parse(content) as never[]).map((e: any) => {
          e.incomplete = true
          return e
        })
      } as AxiosResponse)
    }
  }

  const e = await callGithubAPIByEndpoint('/stats/contributors', repoId)
  const res = Object.assign({}, e)

  if (!Array.isArray(res.data) && Object.keys(res.data).length > 0) {
    throw new Error(`Unknown data:\n${JSON.stringify(res.data)}`)
  }

  res.data = Array.isArray(res.data)
    ? res.data.map(ee => {
        ee.authorName = ee.author.login
        delete ee.author
        return ee
      })
    : []

  return res
}

function getContribFilename(repoId: string): string {
  return `output/contribs_${repoId}.json`
}

async function getPRs(
  repoName: string,
  minDate: string,
  maxDate: string,
  beforeDate?: string
): Promise<IGithubPR[]> {
  // const prsResponse = await callGithubAPIByEndpoint('pulls?state=all', repoName)

  let urlTmp = `https://api.github.com/search/issues?q=repo:whitespace-software/${repoName}+is:pr`
  if (!beforeDate) {
    // urlTmp += `+created:<${beforeDate}`
    beforeDate = maxDate
  }
  urlTmp += `+created:${encodeURIComponent('<')}${beforeDate}`

  const url = urlTmp
  const prsResponse = (await callGithubAPIByEndpoint(
    url,
    repoName
  )) as any as AxiosResponse<IGithubPR[]>
  // return Promise.resolve([])

  console.log('pr resp 1')

  const prs0: any = prsResponse.data
  const prs: IGithubPR[] = prs0.items

  const filtered = prs.filter((prr: IGithubPR) => {
    const isDateOk: boolean = filterDateBetweenConfig(
      prr.created_at,
      minDate,
      maxDate
    )
    return isDateOk
  })

  const min = new Date(minDate)
  if (prs.length === 30 && filtered.length > 0) {
    const before: string = prs[prs.length - 1].created_at
    // if (before !== beforeDate && (new Date(before)).getTime() > min.getTime()) {
    //   const newPrs = await getPRs(repoName, minDate, maxDate, before)
    //   filtered.push(...newPrs)
    // }
    if (before !== beforeDate && new Date(before).getTime() > min.getTime()) {
      console.log(`Getting before ${beforeDate}`)
      const rr: IGithubPR[] = await getPRs(repoName, minDate, maxDate, before)
      return Promise.resolve(filtered.concat(rr))
    }
  }

  return Promise.resolve(filtered)
}

async function main(
  repoName: string,
  config = {
    minDate: '2024-04-22',
    maxDate: '2024-05-22',
    includeRepos: [] as string[]
  }
): Promise<ICheckPr> {
  // console.log('pr resp 0')
  const prs: IGithubPR[] = await getPRs(
    repoName,
    config.minDate,
    config.maxDate
  )

  // const openedPrs = prs.filter(p => p.state === 'open' && !p.draft)
  // const openedPrs: IGithubPR[] = prs.filter((p: IPrResponse) => !p.draft)

  const res: { summary: any[]; users: any[]; yearCommits: any[] } = {
    summary: [],
    users: [],
    yearCommits: []
  }

  const minEpoch = new Date(config.minDate).getTime()
  const maxEpoch = new Date(config.maxDate).getTime()

  // console.log('prs')
  // console.log(JSON.stringify(prs, null, 2))

  const summary: IPrSummary[] = []

  // for (const pr of openedPrs) {
  for (const pr of prs) {
    try {
      const created = new Date(pr.created_at).getTime()
      if (created < minEpoch || created > maxEpoch) {
        // console.log('Not in epoch...')
        continue
      }
      // console.log('Within timespan')

      const author = pr.user.login

      const comments = pr.comments_url
        ? await getByURL<{ user: { login: string } }[]>(
            pr.comments_url.replace('/issues/', '/pulls/')
          )
        : []
      const review_comments = pr.review_comments_url
        ? await getByURL<{ user: { login: string } }[]>(pr.review_comments_url)
        : []

      const all_comments = comments.concat(review_comments)
      // console.log(`rr ${all_comments.length} comments for ${pr.url}`)

      const commentators: string[] = Array.from(
        new Set(
          all_comments.map(
            (comment: { user: { login: string } }) => comment.user.login
          )
        )
      )

      const allCommitData: Commit[] = await fetchCommitsForPullRequest(
        pr.number,
        repoName
      )
      const filteredCommit = allCommitData.filter((item: Commit) => {
        const commitDate = new Date(item.commit.committer.date)
        const created0 = commitDate.getTime()
        return created0 >= minEpoch && created0 <= maxEpoch
      })
      const obj: IPrSummary = {
        author,
        commentators,
        url: pr.html_url,
        commits: filteredCommit,
        commentCount: all_comments.length
      }

      // console.log('obj===')
      // console.log(obj)
      summary.push(obj)
    } catch {
      // console.log('check pr error')
    }
  }
  // console.log('pr resp 2')
  // console.log(summary)

  res.summary = summary

  const everyone: string[] = Array.from(
    new Set(
      summary.reduce((acc: string[], summaryItem: IPrSummary) => {
        acc.push(summaryItem.author)
        acc.push(...summaryItem.commentators)
        return acc
      }, [])
    )
  )

  const weekCount = getWeekCount(
    new Date(config.minDate),
    new Date(config.maxDate)
  )

  for (const user of everyone) {
    // TODO single loop
    const otherPrs = summary.filter(s => s.author !== user)
    const shouldReviewCount = otherPrs.length
    const didReviewCount = otherPrs.filter(op =>
      op.commentators.includes(user)
    ).length
    const reviewedPerc =
      shouldReviewCount === 0
        ? 0
        : Number((didReviewCount / shouldReviewCount).toFixed(2))

    const createdPrs = summary.filter(s => s.author === user)

    // const totalCommits: number = summary
    //   .map(c => c.commits.length)
    //   .reduce((res, item) => res + item, 0)

    const myCommits = createdPrs
      .map(c => c.commits.length)
      .reduce((res0: number, item: number) => res0 + item, 0)

    const averageCommitsPerWeek = weekCount > 0 ? myCommits / weekCount : 0

    const totalComments: number = createdPrs.reduce(
      (resC: number, item: IPrSummary) => {
        return resC + item.commentCount
      },
      0
    )

    res.users.push({
      user,
      shouldReviewCount,
      didReviewCount,
      reviewedPerc,
      created: createdPrs.length,
      createdPerc: summary.length > 0 ? createdPrs.length / summary.length : 0,
      totalCommits: myCommits,
      totalCommitsPerWeek: Number(averageCommitsPerWeek.toFixed(2)),
      totalCommentsInPr: totalComments,
      totalCommentsPerPr: totalComments / createdPrs.length
    })
  }

  return Promise.resolve(res)
}

export async function check_prs(
  repoName: string,
  config = { minDate: '2024-04-22', maxDate: '2024-05-22', includeRepos: [] }
): Promise<ICheckPr> {
  return main(repoName, config)
}

// if (module.parent !== null) {
//   module.exports = {
//     check_prs: main
//   }
// } else {
//   main(repo).then(res => {
//     // console.log(JSON.stringify(res, null, 2))
//   })
// }
