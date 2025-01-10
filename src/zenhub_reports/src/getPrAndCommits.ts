/* eslint-disable no-tabs,@typescript-eslint/no-explicit-any */

// Define interfaces for Pull Request and Commit

interface PullRequest {
  title: string
  created_at: string
  number: number // Renamed from number to pr_number
  user?: { login: string }
  head?: { repo: { id: number } }
  id: number
}

export interface Commit {
  author: {
    login: string
  }
  commit: {
    message: string
    author: {
      name: string
      email: string
      date: string
    }
    committer: {
      name: string
      email: string
      date: string
    }
  }
}

interface PullRequestWithCommits {
  title: string
  createdAt: string
  author: string
  commits: Commit[]
}

const owner = process.env.GH_REPO_OWNER // Replace with the repository owner's username or organization name
// const repo = 'BrowserPuppeteerTests' // Replace with the repository name
const token = process.env.GH_API_KEY // Replace with your GitHub personal access token

function filterPulls(
  pulls: any[],
  includeRepos: number[],
  oneWeekAgo: Date,
  currentDate: Date
): PullRequest[] {
  if (pulls.length === 0) {
    return []
  }

  const repoURL = pulls[0].repository_url
  const repoBits = repoURL.split('/')
  const repoName = repoBits[repoBits.length - 1]
  if (includeRepos.length > 0 && !includeRepos.includes(repoName)) {
    return []
  }

  return pulls.filter((p: PullRequest) => {
    const depoch = new Date(p.created_at).getTime()
    const res = depoch > oneWeekAgo.getTime() && depoch < currentDate.getTime()
    return res
  })
}

async function fetchPullRequestsOnly(
  minDate: string,
  maxDate: string,
  repoName: string,
  includeRepos: number[] = [],
  page = 1,
  beforeDate?: string
): Promise<PullRequest[]> {
  let urlTmp = `https://api.github.com/search/issues?q=repo:${owner}/${repoName}+is:pr`
  if (beforeDate) {
    // urlTmp += `+created:<${beforeDate}`
    urlTmp += `+created:${encodeURIComponent('<')}${beforeDate}`
  }
  const url = urlTmp

  try {
    const response = await fetch(`${url}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // const sinceD = oneWeekAgo
    // const untilD = currentDate

    const oneWeekAgo = new Date(minDate)
    const currentDate = new Date(maxDate)

    const pullsAndObj: any = await response.json()
    const pullsAndMore: PullRequest[] = pullsAndObj.items
    pullsAndMore.sort((a: PullRequest, b: PullRequest) => {
      // return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return a.number - b.number
    })
    const pulls = pullsAndMore.filter((ppp: any) => !!ppp.pull_request)
    const pullsFiltered: PullRequest[] = filterPulls(
      pulls,
      includeRepos,
      oneWeekAgo,
      currentDate
    )

    // if (pulls.length > 0 && pulls.length === pullsFiltered.length) {
    if (pullsAndMore.length === 30 && pullsFiltered.length > 0) {
      // const befDate = new Date(pullsAndMore[0].created_at).toISOString().split('T')[0]
      const befDate = pullsAndMore[0].created_at
      if (befDate !== beforeDate) {
        const newFiltered = await fetchPullRequestsOnly(
          minDate,
          maxDate,
          repoName,
          includeRepos,
          page + 1,
          befDate
        )

        // pullsFiltered.push(...newFiltered)
        for (const rrr of newFiltered) {
          if (!pullsFiltered.some(pf => pf.number === rrr.number)) {
            pullsFiltered.push(rrr)
          }
        }
        console.log(`Total pulls: ${pullsFiltered.length}`)
      }
    }

    return pullsFiltered // Return the result as an object
  } catch (error: any) {
    // console.error('Error fetching pull requests only:', error)
    console.error(
      `Error fetching pull requests only: ${error.message} (${url}, page ${page})`
    )
    return [] // Return an empty array in case of error
  }
}

async function fetchPullRequests(
  minDate: string,
  maxDate: string,
  repoName: string,
  includeRepos: number[]
): Promise<PullRequestWithCommits[]> {
  try {
    const pulls: PullRequest[] = await fetchPullRequestsOnly(
      minDate,
      maxDate,
      repoName,
      includeRepos
    )
    const pullRequestsWithCommits: PullRequestWithCommits[] = await Promise.all(
      pulls.map(async pr => {
        const commits = await fetchCommitsForPullRequest(pr.number, repoName) // Updated to pr_number

        return {
          title: pr.title,
          createdAt: pr.created_at,
          commits: commits.filter(
            commit => commit.author?.login === pr.user?.login
          ),
          author: pr.user?.login ?? ''
        }
      })
    )

    return Promise.resolve(pullRequestsWithCommits) // Return the result as an object
  } catch (error) {
    console.error('Error fetching pull requests:', error)
    return [] // Return an empty array in case of error
  }
}

export async function fetchCommitsForPullRequest(
  prNumber: number,
  repoId: string
): Promise<Commit[]> {
  const url = `https://api.github.com/repos/${owner}/${repoId}/pulls/${prNumber}/commits`
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const commits: Commit[] = await response.json()
    return commits
  } catch (error: any) {
    console.error(
      `Error fetching commits for PR #${prNumber}: ${error.message} (${url})`
    )
    return []
  }
}

function makeStats(
  pullRequests: PullRequestWithCommits[]
): Record<string, { pr_count: number; commit_count: number }> {
  const allAuthors: string[] = Array.from(
    new Set(pullRequests.map(p => p.author))
  )
  const res: Record<string, { pr_count: number; commit_count: number }> = {}
  for (const auth of allAuthors) {
    const prs = pullRequests.filter(p => p.author === auth)
    const prCount = prs.length
    const commitCount = prs.reduce(
      (res1: number, pr: PullRequestWithCommits) => {
        return res1 + pr.commits.length
      },
      0
    )
    res[auth] = {
      pr_count: prCount,
      commit_count: commitCount
    }
  }
  return res
}

async function fetch_prs_for_repo(
  repoId: string,
  config = {
    minDate: '2024-04-22',
    maxDate: '2024-05-22',
    includeRepos: [] as number[]
  }
): Promise<
  Record<string, { pr_count: number; commit_count: number }> | undefined
> {
  // Execute the function to fetch pull requests and handle the result
  try {
    const pullRequests = await fetchPullRequests(
      config.minDate,
      config.maxDate,
      repoId,
      config.includeRepos
    )
    console.log(pullRequests) // Log the result
    const stats: Record<string, { pr_count: number; commit_count: number }> =
      makeStats(pullRequests)
    // console.log(JSON.stringify(stats, null, 2))
    console.log('Got stats')
    return Promise.resolve(stats)
  } catch (e) {
    console.error('Error fetching pull requests:', e)
  }
}

function generateSummary(
  all: Record<string, { pr_count: number; commit_count: number }>[]
): Record<
  string,
  {
    pr_count: number
    commit_count: number
    pr_perc: number
    commit_perc: number
  }
> {
  const obj: Record<
    string,
    {
      pr_count: number
      commit_count: number
      pr_perc: number
      commit_perc: number
    }
  > = {}
  // const users = Object.keys(all[0])
  // const entries = Object.entries(all[0])

  const entries = Array.from(all.map(f => Object.entries(f))).flat()
  const users: string[] = Array.from(new Set(entries.map(e => e[0])))

  const [prCount, commitCount] = entries.reduce(
    (
      res: [number, number],
      data: [key: string, { pr_count: number; commit_count: number }]
    ) => {
      const record: { pr_count: number; commit_count: number } = data[1]
      res[0] += record.pr_count
      res[1] += record.commit_count
      return res
    },
    [0, 0]
  )

  for (const user of users) {
    const targets: { pr_count: number; commit_count: number }[] = entries
      .filter(a => a[0] === user)
      .map(r => r[1])

    const sums: {
      pr_count: number
      commit_count: number
      pr_perc: number
      commit_perc: number
    } = targets.reduce(
      (
        res: {
          pr_count: number
          commit_count: number
          pr_perc: number
          commit_perc: number
        },
        item: { pr_count: number; commit_count: number }
      ) => {
        res.commit_count += item.commit_count
        res.pr_count += item.pr_count
        return res
      },
      { pr_count: 0, commit_count: 0, pr_perc: 0, commit_perc: 0 }
    )

    sums.commit_perc = sums.commit_count / commitCount
    sums.pr_perc = sums.pr_count / prCount
    obj[user] = sums
  }
  return obj
}

export async function getAllData(
  repos?: string[],
  config = {
    minDate: '2024-04-22',
    maxDate: '2024-05-22',
    includeRepos: [] as number[]
  }
): Promise<{
  all: Record<string, { pr_count: number; commit_count: number }>[]
  summary: Record<string, { pr_count: number; commit_count: number }>
}> {
  if (repos === undefined) {
    repos = ['BrowserPuppeteerTests', 'CucuVAPI']
  }
  const all: Record<string, { pr_count: number; commit_count: number }>[] = []
  for (const r of repos) {
    console.log(`Getting pr and commit data for ${r}`) // Log the result

    try {
      const rres:
        | Record<string, { pr_count: number; commit_count: number }>
        | undefined = await fetch_prs_for_repo(r, config)

      if (rres !== undefined && Object.keys(rres).length > 0) {
        all.push(rres)
      }
    } catch (err: any) {
      console.warn('err: ', err.message)
    }
  }

  const summary: Record<string, { pr_count: number; commit_count: number }> =
    generateSummary(all)

  // console.log(JSON.stringify(all, null, 2))
  // console.log(JSON.stringify(summary, null, 2))
  return Promise.resolve({ all, summary })
}

// eslint-disable-next-line github/no-then
// getAllData().then(res => {
//   console.log(JSON.stringify(res, null, 2))
// })
