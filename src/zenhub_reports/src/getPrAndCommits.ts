/* eslint-disable no-tabs */

// Define interfaces for Pull Request and Commit
interface PullRequest {
  title: string
  created_at: string
  number: number // Renamed from number to pr_number
  user?: { login: string }
}

interface Commit {
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

// const currentDate = new Date()
// const oneWeekAgo = new Date(currentDate)
// // const currentDateEpoch = currentDate.getTime()
// // const oneWeekAgoEpoch = oneWeekAgo.getTime()
// oneWeekAgo.setDate(currentDate.getDate() - 7)
// // const since = oneWeekAgo.toISOString() // Replace with your start date in ISO 8601 format
// // const until = currentDate.toISOString() // Replace with your end date in ISO 8601 format

// const specificAuthor = 'author_username' // Replace with the specific author's username

async function fetchPullRequestsOnly(
  minDate: string,
  maxDate: string,
  repoId: string,
  page = 1
): Promise<PullRequest[]> {
  // const sinceP = minDate
  // const untilP = maxDate

  const url = `https://api.github.com/repos/${owner}/${repoId}/pulls`
  const params = new URLSearchParams({
    state: 'all',
    sort: 'created',
    direction: 'desc'
    // sinceP,
    // untilP
  })

  try {
    const response = await fetch(`${url}?${params}`, {
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

    const pulls: PullRequest[] = await response.json()
    const pullsFiltered: PullRequest[] = pulls.filter((p: PullRequest) => {
      const depoch = new Date(p.created_at).getTime()
      const res =
        depoch > oneWeekAgo.getTime() && depoch < currentDate.getTime()
      return res
    })

    if (pulls.length > 0 && pulls.length === pullsFiltered.length) {
      const newFiltered = await fetchPullRequestsOnly(
        minDate,
        maxDate,
        repoId,
        page + 1
      )
      pullsFiltered.push(...newFiltered)
    }

    return pullsFiltered // Return the result as an object
  } catch (error) {
    console.error('Error fetching pull requests only:', error)
    return [] // Return an empty array in case of error
  }
}

async function fetchPullRequests(
  minDate: string,
  maxDate: string,
  repoId: string
): Promise<PullRequestWithCommits[]> {
  try {
    const pulls: PullRequest[] = await fetchPullRequestsOnly(
      minDate,
      maxDate,
      repoId
    )
    const pullRequestsWithCommits: PullRequestWithCommits[] = await Promise.all(
      pulls.map(async pr => {
        const commits = await fetchCommitsForPullRequest(pr.number, repoId) // Updated to pr_number
        // const allAuthors = Array.from(new Set(commits.map(c => c.author?.login)))
        // const mainAuthor = commits.reduce((res: { done: string[], author: string }, item: Commit, all: Commit[]) => {
        // 	const auth = item.author?.login
        // 	if(!res.done.includes(auth)) {
        // 		res.done.push(auth);
        // 		const count = all.filter()
        // 	}
        // 	return res;
        // }, { done: [], author: "" })
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

    return pullRequestsWithCommits // Return the result as an object
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
  } catch (error) {
    console.error(`Error fetching commits for PR #${prNumber}:`, error)
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
  config = { minDate: '2024-04-22', maxDate: '2024-05-22' }
): Promise<
  Record<string, { pr_count: number; commit_count: number }> | undefined
> {
  // Execute the function to fetch pull requests and handle the result
  try {
    const pullRequests = await fetchPullRequests(
      config.minDate,
      config.maxDate,
      repoId
    )
    console.log(pullRequests) // Log the result
    const stats: Record<string, { pr_count: number; commit_count: number }> =
      makeStats(pullRequests)
    // console.log(JSON.stringify(stats, null, 2))
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
  config = { minDate: '2024-04-22', maxDate: '2024-05-22' }
): Promise<{
  all: Record<string, { pr_count: number; commit_count: number }>[]
  summary: Record<string, { pr_count: number; commit_count: number }>
}> {
  if (repos === undefined) {
    repos = ['BrowserPuppeteerTests', 'CucuVAPI']
  }
  const all: Record<string, { pr_count: number; commit_count: number }>[] = []
  for (const r of repos) {
    const rres:
      | Record<string, { pr_count: number; commit_count: number }>
      | undefined = await fetch_prs_for_repo(r, config).catch((err: any) => {
      console.warn('err: ' + err.message)
      return undefined
    })
    if (rres !== undefined) {
      all.push(rres)
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
