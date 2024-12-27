// eslint-disable-next-line import/named
import get from 'axios'
import { AxiosResponse } from 'axios'
import { IGithubPR } from './igithubpr'
import * as fs from 'node:fs'
import { ICheckPr, Utils } from './models'
import { fetchCommitsForPullRequest } from './getPrAndCommits'
import { IPrSummary } from './zenhub_call'

export function getWeekCount(dateFrom: Date, dateTo: Date): number {
  return Number(((dateTo.getTime() - dateFrom.getTime()) / 1000 / 3600 / 24 / 7).toFixed((2)))
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
  if (!endpoint.startsWith('/')) {
    endpoint = `/${endpoint}`
  }
  const owner = 'whitespace-software'
  const url = `https://api.github.com/repos/${owner}/${repoId}${endpoint}` // pulls
  return callGithubAPIByURL(url)
}

async function getByURL<T>(url: string): Promise<T> {
  const resp: AxiosResponse = await callGithubAPIByURL(url)
  return Promise.resolve(resp.data)
}

// /**
//  * See: https://docs.github.com/en/rest/metrics/statistics?apiVersion=2022-11-28#get-the-hourly-commit-count-for-each-day
//  * @returns {Promise<unknown>}
//  */
// async function getCommitDailySummary(repoId: string): Promise<AxiosResponse> {
//   return callGithubAPIByEndpoint('/stats/punch_card', repoId)
// }

/**
 * See: https://docs.github.com/en/rest/metrics/statistics?apiVersion=2022-11-28#get-the-last-year-of-commit-activity
 * @returns {Promise<unknown>}
 */
async function getLastYearSummary(repoId: string): Promise<AxiosResponse> {
  return callGithubAPIByEndpoint('/stats/commit_activity', repoId)
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// interface IPrResponse {
//   user: object
//   draft: boolean
//   created_at: string
// }

function getContribFilename(repoId: string): string {
  return `output/contribs_${repoId}.json`
}

async function handleYearCommits(
  repoId: string,
  config: { minDate: string; maxDate: string },
  tryCount = 0
): Promise<unknown[]> {
  const yearCommitsResp = await getLastYearSummary(repoId)
  const yearCommits = yearCommitsResp.data

  if (!Array.isArray(yearCommits) && Object.keys(yearCommits).length > 0) {
    console.warn(
      `Need to handle yearCommits\n${JSON.stringify(yearCommits, null, 2)}`
    )
  }
  const resYearCommits =
    (Array.isArray(yearCommits) ? yearCommits : [])
      .map(yc => {
        const clone = Object.assign({}, yc)
        delete clone.days
        return clone
      })
      .filter(
        w =>
          (config?.minDate === undefined ||
            w.week * 1000 >= new Date(config.minDate).getTime()) &&
          (config?.maxDate === undefined ||
            w.week * 1000 <= new Date(config.maxDate).getTime())
      ) || []

  if (resYearCommits.length === 0 && tryCount > 0) {
    await Utils.waitForTimeout(1000)
    return handleYearCommits(repoId, config, tryCount - 1)
  }

  return Promise.resolve(resYearCommits)
}

async function main(
  repoId: string,
  config = { minDate: '2024-04-22', maxDate: '2024-05-22' }
): Promise<ICheckPr> {
  // console.log('pr resp 0')
  const prsResponse = await callGithubAPIByEndpoint('pulls?state=all', repoId)
  // console.log('pr resp 1')

  const prs: IGithubPR[] = prsResponse.data

  // const openedPrs = prs.filter(p => p.state === 'open' && !p.draft)
  // const openedPrs: IGithubPR[] = prs.filter((p: IPrResponse) => !p.draft)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: { summary: any[]; users: any[]; yearCommits: any[] } = {
    summary: [],
    users: [],
    yearCommits: []
  }

  const minEpoch = new Date(config.minDate).getTime()
  const maxEpoch = new Date(config.maxDate).getTime()

  // console.log('prs')
  // console.log(JSON.stringify(prs, null, 2))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      const comments: object[] = pr.comments_url
        ? await getByURL<object[]>(pr.comments_url)
        : []
      const review_comments = pr.review_comments_url
        ? await getByURL<object[]>(pr.review_comments_url)
        : []

      const all_comments: object[] = comments.concat(review_comments)
      // console.log(`rr ${all_comments.length} comments for ${pr.url}`)

      const commentators: any[] = Array.from(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new Set(all_comments.map((comment: any) => comment.user.login))
      )

      const allCommitData = await fetchCommitsForPullRequest(pr.number, prs[0].head.repo.name)
      const filteredCommit = allCommitData.filter((item: any) => {
        const commitDate = new Date(item.commit.committer.date)
        const created = commitDate.getTime()
        return created >= minEpoch && created <= maxEpoch
      })
      const obj: IPrSummary = {
        author,
        commentators,
        url: pr.html_url,
        commits: filteredCommit
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

  // console.log('pr resp 3')

  const contribsResp: AxiosResponse = await getPContributorsData(repoId)
  const contribs: {
    authorName: string
    weeks: { w: number }[]
    incomplete?: boolean
  }[] =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contribsResp.data.filter((r: any) => r.total > 0)

  if (contribs.length > 0) {
    fs.writeFileSync(
      getContribFilename(repoId),
      JSON.stringify(contribs, null, 2),
      { encoding: 'utf8' }
    )
  }

  // console.log('pr resp 4')
  // console.log(`Everyone: ${everyone.join(',')}`)

  const weekCount = getWeekCount(new Date(config.minDate), new Date(config.maxDate))

  for (const user of everyone) {
    // TODO single loop
    const otherPrs = summary.filter(s => s.author !== user)
    const shouldReviewCount = otherPrs.length
    const didReviewCount = otherPrs.filter(op =>
      op.commentators.includes(user)
    ).length
    const reviewedPerc = shouldReviewCount === 0 ? 0 : Number((didReviewCount / shouldReviewCount).toFixed(2))

    const created = summary.filter(s => s.author === user)

    const totalCommits: number = summary.map(c => c.commits.length).reduce((res, item) => res + item, 0)
    const averageCommitsPerWeek = weekCount > 0 ? (totalCommits / weekCount) : 0

    res.users.push({
      user,
      shouldReviewCount,
      didReviewCount,
      reviewedPerc,
      created: created.length,
      createdPerc: summary.length > 0 ? created.length / summary.length : 0,
      totalCommits,
      totalCommitsPerWeek: Number(averageCommitsPerWeek.toFixed(2))
    })
  }

  return Promise.resolve(res)
}

export async function check_prs(
  repoId: string,
  config = { minDate: '2024-04-22', maxDate: '2024-05-22' }
): Promise<ICheckPr> {
  return main(repoId, config)
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
