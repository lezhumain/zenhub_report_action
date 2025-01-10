import { NodeHtmlMarkdown } from 'node-html-markdown'

interface GithubModels_Workspace {
  id: number // The ID of the workspace
  name: string // The name of the workspace
  mongo_id: string // The MongoDB ID of the workspace
}

interface GithubModels_Repository {
  id: number // The ID of the repository
  name: string // The name of the repository
  gh_id: number // The GitHub ID of the repository
}

interface GithubModels_Pipeline {
  id: number // The ID of the pipeline
  name: string // The name of the pipeline
}

interface GithubModels_Organization {
  id: number // The ID of the organization
  login: string // The login name of the organization
  avatar_url: string // The URL of the organization's avatar
}

export interface GithubModels_Data {
  workspace: GithubModels_Workspace // The workspace object
  repository: GithubModels_Repository // The repository object
  to_pipeline: GithubModels_Pipeline // The target pipeline object
  organization: GithubModels_Organization // The organization object
  from_pipeline: GithubModels_Pipeline // The source pipeline object
  github_user?: { login: string }
}

export interface IGhEvent {
  type: string
  data: GithubModels_Data
  createdAt: string
}

export interface IIssueEvent {
  number: string
  estimateValue: { value: number }
  repositoryGhId: number
  repositoryGhName: string
  createdAt: string
}

export interface IOpenedIssue extends IIssue {
  user: string
  previousPipeline: string
  isForward: boolean
  lastEventData: string
}

export interface IIssue {
  filtered?: boolean
  completed?: {
    start: Date
    end: Date
  }
  handled?: boolean
  // events?: IIssueEvent[];
  events?: IGhEvent[]
  number: string
  estimateValue?: number
  repositoryGhId: number
  repositoryGhName: string
  pipelineName: string
  labels?: string[]
  releases?: string[]
  pullRequest: boolean
  htmlUrl: string
  createdAt: Date
  author: string
}

export interface IWorkspace {
  configHash: string
  totalIssues: number
  name: string
  id: string
  displayName: string
  pipelinesConnection: IPipelinesConnection[]
  __typename: string
}

interface ICursor {
  hasNextPage: boolean
  startCursor: string
  endCursor: string
}

export interface IPipelinesConnection {
  issueEndCursor?: string
  id: string
  name: string
  issues: Issue[]
  cursor: ICursor
}

export interface ISarchIssuesByPipeline {
  pageInfo: ICursor
  nodes: Issue[]
}

export interface Issue {
  releases: { nodes: { title: string; id: string }[] }
  labels: { nodes: { name: string }[] }
  repository: { ghId: number; name: string; ownerName: string }
  estimate?: { value: string } | null
  number: number
  events?: IGhEvent[]
  htmlUrl: string
  pullRequest?: boolean
  createdAt: string
  user: { login: string }
}

export interface IControlChartItem {
  started: Date // unix
  comppleted: Date // unix
  completionTime: number // ms timespan
  completionTimeStr: string // ms timespan
  estimate: number
  number: string
  htmlUrl: string
}

class Utils {
  millisecondsToHumanReadableTime(milliseconds: number): string {
    const seconds = Math.floor((milliseconds / 1000) % 60)
    const minutes = Math.floor((milliseconds / (1000 * 60)) % 60)
    const hours = Math.floor((milliseconds / (1000 * 60 * 60)) % 24)
    const days = Math.floor((milliseconds / (1000 * 60 * 60 * 24)) % 30)
    const weeks = Math.floor((milliseconds / (1000 * 60 * 60 * 24 * 7)) % 4)
    const months = Math.floor(milliseconds / (1000 * 60 * 60 * 24 * 30))

    const monthsStr = months > 0 ? `${months}m ` : ''
    const weeksStr = weeks > 0 ? `${weeks}w ` : ''
    const daysStr = days > 0 ? `${days}d ` : ''
    const hoursStr = hours < 10 ? `0${hours}` : hours
    const minutesStr = minutes < 10 ? `0${minutes}` : minutes
    const secondsStr = seconds < 10 ? `0${seconds}` : seconds

    return `${monthsStr}${weeksStr}${daysStr}${hoursStr}:${minutesStr}:${secondsStr}`
  }

  addDay(firstDayOfMonth: Date, number: number): Date {
    const epoch = firstDayOfMonth.getTime()
    return new Date(epoch + this.getDaysAsMs(number))
  }

  getMsAsDays(ms: number): number {
    const trunced: number = Math.trunc(ms)
    const sigDigits: number = trunced.toString().length
    const res = ms / 1000 / 60 / 60 / 24

    return Number(res.toPrecision(sigDigits))
  }

  getDaysAsMs(days: number): number {
    return days * 1000 * 60 * 60 * 24
  }

  htmlToMarkdown(fullHTML: string): string {
    const mark = NodeHtmlMarkdown.translate(
      /* html */ fullHTML,
      /* options (optional) */ {},
      /* customTranslators (optional) */ undefined,
      /* customCodeBlockTranslators (optional) */ undefined
    )
    return mark
  }

  isHex(str: string): boolean {
    const hexRegex = /^[0-9A-Fa-f]+$/
    return hexRegex.test(str)
  }

  issueNumberAsNumber(issueNumber: string): number {
    return Number(issueNumber.replace('#', ''))
  }

  issueNumberAsString(issueNumber: number): string {
    return `#${issueNumber.toFixed(0)}`
  }

  async waitForTimeout(timeout: number): Promise<void> {
    return new Promise(function (resolve) {
      setTimeout(resolve, timeout)
    })
  }
}
export const utils = new Utils()

export class ControlChartItem implements IControlChartItem {
  private readonly _started: Date
  private readonly _comppleted: Date
  private readonly _estimate: number

  get started(): Date {
    return this._started
  }

  get comppleted(): Date {
    return this._comppleted
  }

  get estimate(): number {
    return this._estimate
  }

  get completionTime(): number {
    return this._comppleted.getTime() - this._started.getTime()
  }

  get completionTimeStr(): string {
    // return utils.millisecondsToHumanReadableTime(this.completionTime);
    return (this.completionTime / 1000 / 60 / 60 / 24).toFixed(0)
  }

  get number(): string {
    return this._number
  }

  get htmlUrl(): string {
    return this._htmlUrl
  }

  // constructor(started: number, comppleted: number, estimate: number) {
  // 	this._started = started;
  // 	this._comppleted = comppleted;
  // 	this._estimate = estimate;
  // }

  constructor(
    started: Date,
    comppleted: Date,
    estimate: number,
    private readonly _number: string,
    private readonly _htmlUrl: string
  ) {
    this._started = started
    this._comppleted = comppleted
    this._estimate = estimate
  }

  toObj(): IControlChartItem {
    return {
      number: this._number,
      started: this._started,
      comppleted: this._comppleted,
      completionTime: this.completionTime,
      completionTimeStr: this.completionTimeStr,
      estimate: this._estimate,
      htmlUrl: this.htmlUrl
    }
  }
}

export interface IStatResult {
  median: number
  average: number
}

class StatHelper {
  private getMedian(arr: number[]): number {
    const middle = (arr.length + 1) / 2
    const sorted = [...arr].sort((a, b) => a - b)
    const isEven = sorted.length % 2 === 0
    return isEven
      ? (sorted[middle - 1.5] + sorted[middle - 0.5]) / 2
      : sorted[middle - 1]
  }

  private getAverage(arr: number[]): number {
    return arr.reduce((res: number, val: number) => res + val, 0) / arr.length
  }

  getStats(arr: number[]): IStatResult {
    return {
      average: this.getAverage(arr),
      median: this.getMedian(arr)
    }
  }
}
export const statHelper = new StatHelper()

export interface IVelocityItem {
  estimate: number
  count: number
  key?: string
}

export interface IVelocity {
  data: IVelocityItem[]
  velocityIssue: number
  velocityEstimate: number
}

// github
export interface ICheckPr {
  summary: ISummary[]
  users: IPrUser[]
  yearCommits: IYearCommit[]
}

export interface ISummary {
  author: string
  commentators: object[]
  url: string
}

export interface IPrUser extends IPrReviewStat {
  totalCommits: number
  totalCommitsPerWeek: number
  totalCommentsInPr: number
  totalCommentsPerPr: number
  issueCreated: number
}

export interface IPrReviewStat {
  user: string
  shouldReviewCount: number
  didReviewCount: number
  reviewedPerc: number
  created: number
  createdPerc: number
}

export interface IYearCommit {
  total: number
  week: number
}

export interface IBubbleData {
  x: number
  y: number
  r: number
}
