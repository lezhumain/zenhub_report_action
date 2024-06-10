/* eslint-disable no-tabs,indent */
const axios = require('axios')

// GitHub repository owner and name
const repo = 'BrowserPuppeteerTests'

const callGithubAPIByURL = async apiUrl => {
  return new Promise((resolve, reject) => {
    // Make a GET request to the GitHub API for pull requests with API key in headers
    axios
      .get(apiUrl, {
        headers: {
          Authorization: `token ${process.env.GH_API_KEY}`
        }
      })
      .then(response => {
        resolve(response)
      })
      .catch(error => {
        reject(error)
      })
  })
}

const callGithubAPIByEndpoint = async (endpoint, repoId) => {
  // GitHub API endpoint for pull requests
  if (!endpoint.startsWith('/')) {
    endpoint = `/${endpoint}`
  }
  const owner = 'whitespace-software'
  const url = `https://api.github.com/repos/${owner}/${repoId}${endpoint}` // pulls
  return callGithubAPIByURL(url)
}

async function getByURL(url) {
  const resp = await callGithubAPIByURL(url)
  return resp.data
}

/**
 * See: https://docs.github.com/en/rest/metrics/statistics?apiVersion=2022-11-28#get-the-hourly-commit-count-for-each-day
 * @returns {Promise<unknown>}
 */
async function getCommitDailySummary(repoId) {
  return callGithubAPIByEndpoint('/stats/punch_card', repoId).then(e => {
    return e
  })
}

/**
 * See: https://docs.github.com/en/rest/metrics/statistics?apiVersion=2022-11-28#get-the-last-year-of-commit-activity
 * @returns {Promise<unknown>}
 */
async function getLastYearSummary(repoId) {
  return callGithubAPIByEndpoint('/stats/commit_activity', repoId).then(e => {
    return e
  })
}

/**
 * See: https://docs.github.com/en/rest/metrics/statistics?apiVersion=2022-11-28#get-all-contributor-commit-activity
 * @returns {Promise<unknown>}
 */
async function getPContributorsData(repoId) {
  return callGithubAPIByEndpoint('/stats/contributors', repoId).then(e => {
    const res = Object.assign({}, e)

    if (!Array.isArray(res.data) && Object.keys(res.data).length > 0) {
      throw new Error(`Unknown data:\n${JSON.stringify(res.data)}`)
    }

    Array.isArray(res.data)
    res.data = Array.isArray(res.data)
      ? res.data.map(ee => {
          ee.authorName = ee.author.login
          delete ee.author

          return ee
        })
      : []

    return res
  })
}

async function main(
  repoId,
  config = { minDate: '2024-04-22', maxDate: '2024-05-22' }
) {
  let prsResponse
  try {
    prsResponse = await callGithubAPIByEndpoint('pulls?state=all', repoId)
  } catch (e) {
    throw e
  }
  const prs = prsResponse.data
  // const openedPrs = prs.filter(p => p.state === 'open' && !p.draft)
  const openedPrs = prs.filter(p => !p.draft)

  const res = { summary: [], users: [] }

  const minEpoch = new Date(config.minDate).getTime()
  const maxEpoch = new Date(config.maxDate).getTime()

  const summary = []
  // for (const pr of openedPrs) {
  for (const pr of prs) {
    try {
      const created = new Date(pr.created_at).getTime()
      if (created < minEpoch || created > maxEpoch) {
        continue
      }

      const author = pr.user.login

      const comments = pr.comments_url ? await getByURL(pr.comments_url) : []
      const review_comments = pr.review_comments_url
        ? await getByURL(pr.review_comments_url)
        : []

      const all_comments = comments.concat(review_comments)

      const commentators = Array.from(
        new Set(all_comments.map(comment => comment.user.login))
      )

      const obj = {
        author,
        commentators,
        url: pr.html_url
      }

      summary.push(obj)
    } catch (e) {
      debugger
    }
  }
  res.summary = summary

  const everyone = Array.from(
    new Set(
      summary.reduce((acc, summaryItem) => {
        acc.push(summaryItem.author)
        acc.push(...summaryItem.commentators)
        return acc
      }, [])
    )
  )

  const contribsResp = await getPContributorsData(repoId)
  const contribs = contribsResp.data.filter(r => r.total > 0)

  for (const user of everyone) {
    // TODO single loop
    const otherPrs = summary.filter(s => s.author !== user)
    const shouldReviewCount = otherPrs.length
    const didReviewCount = otherPrs.filter(op =>
      op.commentators.includes(user)
    ).length
    const reviewedPerc = Number((didReviewCount / shouldReviewCount).toFixed(2))

    const contrib = contribs.find(c => c.authorName === user)
    // copied
    const filteredWeeks =
      contrib?.weeks.filter(
        w =>
          (config.minDate === undefined ||
            w.w * 1000 >= new Date(config.minDate).getTime()) &&
          (config.maxDate === undefined ||
            w.w * 1000 <= new Date(config.maxDate).getTime())
      ) || []
    const totalCommits = filteredWeeks.reduce((res, cw) => res + cw.c, 0)
    const averageCommitsPerWeek = Number(
      (totalCommits / filteredWeeks.length).toFixed(2)
    )
    const created = summary.filter(s => s.author === user)
    res.users.push({
      user,
      shouldReviewCount,
      didReviewCount,
      reviewedPerc,
      created: created.length,
      createdPerc: created.length / summary.length,
      totalCommits,
      totalCommitsPerWeek: averageCommitsPerWeek
    })
  }

  const dailyCommitsResp = await getCommitDailySummary(repoId)
  const dailyCommits = dailyCommitsResp.data

  const yearCommitsResp = await getLastYearSummary(repoId)
  const yearCommits = yearCommitsResp.data

  try {
    if (!Array.isArray(yearCommits) && Object.keys(yearCommits).length > 0) {
      console.warn(
        `Need to handle yearCommits\n${JSON.stringify(yearCommits, null, 2)}`
      )
    }
    res.yearCommits =
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
  } catch (e) {
    console.error(e.message)
    throw e
  }

  return Promise.resolve(res)
}

if (module.parent !== null) {
  module.exports = {
    check_prs: main
  }
} else {
  main(repo).then(res => {
    console.log(JSON.stringify(res, null, 2))
  })
}
