import { NodeHtmlMarkdown, NodeHtmlMarkdownOptions } from 'node-html-markdown'

export interface IGhEvent {
  type: string
  data: any
  createdAt: string
}

export interface IIssueEvent {
  number: number
  estimateValue: { value: number }
  repositoryGhId: number
  createdAt: string
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
  number: number
  estimateValue?: number
  repositoryGhId: number
  pipelineName: string
  labels?: string[]
  releases?: string[]
  pullRequest: boolean
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
  repository: { ghId: number; name: string }
  estimate?: { value: string } | null
  number: string
  events?: IGhEvent[]
  htmlUrl: string
  pullRequest: boolean
}

export interface IControlChartItem {
  started: Date // unix
  comppleted: Date // unix
  completionTime: number // ms timespan
  completionTimeStr: string // ms timespan
  estimate: number
  number: number
}

export class Utils {
  static millisecondsToHumanReadableTime(milliseconds: number) {
    const seconds = Math.floor((milliseconds / 1000) % 60)
    const minutes = Math.floor((milliseconds / (1000 * 60)) % 60)
    const hours = Math.floor((milliseconds / (1000 * 60 * 60)) % 24)
    const days = Math.floor((milliseconds / (1000 * 60 * 60 * 24)) % 30)
    const weeks = Math.floor((milliseconds / (1000 * 60 * 60 * 24 * 7)) % 4)
    const months = Math.floor(milliseconds / (1000 * 60 * 60 * 24 * 30))

    const monthsStr = months > 0 ? months + 'm ' : ''
    const weeksStr = weeks > 0 ? weeks + 'w ' : ''
    const daysStr = days > 0 ? days + 'd ' : ''
    const hoursStr = hours < 10 ? '0' + hours : hours
    const minutesStr = minutes < 10 ? '0' + minutes : minutes
    const secondsStr = seconds < 10 ? '0' + seconds : seconds

    return `${monthsStr}${weeksStr}${daysStr}${hoursStr}:${minutesStr}:${secondsStr}`
  }

  static addDay(firstDayOfMonth: Date, number: number): Date {
    const epoch = firstDayOfMonth.getTime()
    return new Date(epoch + number * 24 * 60 * 60 * 1000)
  }

  static getMsAsDays(duration: number): number {
    return duration / 1000 / 60 / 60 / 24
  }

  static getDaysAsMs(duration: number): number {
    return duration * 1000 * 60 * 60 * 24
  }

  static htmlToMarkdown(fullHTML: string): string {
    const mark = NodeHtmlMarkdown.translate(
      /* html */ fullHTML,
      /* options (optional) */ {},
      /* customTranslators (optional) */ undefined,
      /* customCodeBlockTranslators (optional) */ undefined
    )
    return mark
  }
}

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
    // return Utils.millisecondsToHumanReadableTime(this.completionTime);
    return (this.completionTime / 1000 / 60 / 60 / 24).toFixed(0)
  }

  get number(): number {
    return this._number
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
    private readonly _number: number
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
      estimate: this._estimate
    }
  }
}

export interface IStatResult {
  median: number
  average: number
}

export class StatHelper {
  private static getMedian(arr: number[]): number {
    const middle = (arr.length + 1) / 2
    const sorted = [...arr].sort((a, b) => a - b)
    const isEven = sorted.length % 2 === 0
    return isEven
      ? (sorted[middle - 1.5] + sorted[middle - 0.5]) / 2
      : sorted[middle - 1]
  }

  private static getAverage(arr: number[]): number {
    return arr.reduce((res: number, val: number) => res + val, 0) / arr.length
  }

  static getStats(arr: number[]): IStatResult {
    return {
      average: StatHelper.getAverage(arr),
      median: StatHelper.getMedian(arr)
    }
  }
}

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
  commentators: any[]
  url: string
}

export interface IPrUser extends IPrReviewStat {
  // user: string
  // shouldReviewCount: number
  // didReviewCount: number
  // reviewedPerc: number
  // created: number
  // createdPerc: number
  totalCommits: number
  totalCommitsPerWeek: number
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
