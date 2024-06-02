/* eslint-disable @typescript-eslint/ban-ts-comment,@typescript-eslint/no-require-imports,@typescript-eslint/no-explicit-any,github/no-then */
import md5 from 'md5'
import * as fs from 'fs'
import { ChartHelper, IChartItem, ISizeObj } from './chart_helper'
import {
  IControlChartItem,
  IIssue,
  IPipelinesConnection,
  Issue,
  IWorkspace,
  IGhEvent,
  ControlChartItem,
  Utils,
  IStatResult,
  StatHelper,
  IVelocity,
  IVelocityItem,
  ISarchIssuesByPipeline,
  ICheckPr,
  ISummary,
  IPrUser,
  IPrReviewStat
} from './models'
import * as path from 'node:path'
import { BubbleDataPoint } from 'chart.js'
import { IMainConfig } from './main_conf'

// eslint-disable-next-line import/extensions,@typescript-eslint/no-var-requires,import/no-commonjs
const reviewer_call = require('./check_pr_reviewers.js')

/*
	Takes issues that moved during a timespan
 */

const apiKey = process.env.API_KEY
// const repoId = '409231566'

interface ICSVItem {
  duration: number
  durationString: string
  durationPerEstimate?: number
  durationStringPerEstimate?: string
  pipeline: string
  event: string
  number: string
  htmlUrl: string
}

export interface IAVGItem {
  data: IAVGData
  issueCount: number
  openedIssueCount: number // FIXME should be the same as issueCount ?
}

export interface IAVGData {
  count: number
  duration: number
  durationDays: number
  durationAverage: number
  durationString: string
  durationAverageString: string
}

export interface IAVGItemMap {
  [pipeline: string]: IAVGItem
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class FileUtils {
  static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath)
  }
}

interface IHandleIssueResult {
  csvItems: ICSVItem[]
  events: IGhEvent[]
  completed?: {
    start: Date
    end: Date
  }
}

interface IReport {
  chartTime: IChartItem[]
  chartCount: IChartItem[]
  statsIssue: IStatResult
  statsEstimate: IStatResult
  controlChartList: IControlChartItem[]
  outstandingItems: ICSVItem[]
  // veloccityIssue: number;
  // velocityEstimate: number;
  // velocityList: IVelocityItem[];
  velocity: IVelocity
  avg: IAVGItemMap
  prList: IPrSummary[]
  userReviewStats: IPrReviewStat[]
  remainingOpenedIssues: IIssue[]
}

interface IPrSummary {
  author: string
  commentators: string[]
  url: string
}

export interface IProgramResult {
  mark: string
  allResult: IReport
}

interface ICSVResult {
  csvChart: string
  csvOutstanding: string
  velocityList: string
  mainList: string
  csvPrAndCommits: string
}

export interface IOpenedPerPipeline {
  pipeline: string
  opened: number
  estimatedCompletionDays: number
}

export class Program {
  private readonly _delim: string
  private readonly _configHash: string
  private readonly _baseFilename = 'workspace'
  private readonly _file: string

  protected _config: IMainConfig
  get config(): IMainConfig {
    return this._config
  }

  private _errorMessages: string[] = []
  /**
   * Started and completed with option date range
   * @private
   */
  private _completed: IIssue[] = []
  protected _pipelines: string[] = []
  private _startTimestamp = 0

  private _estimateRemainingMs = 0
  private _estimateRemainingPrveiousMs = 0
  private _eventsPerIssue: { [issueNumber: string]: IGhEvent[] } = {}
  private _preparedHTML: string[] = []

  private _issueQueryTemplate = `pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
          nodes {
            repository {
              ghId
            }
            htmlUrl
            estimate {
              value
            }
            labels {
              nodes {
                name
              }
            }
            releases {
              nodes {
                title
                id
              }
            }
            createdAt
            pullRequest
          }
        }`

  private readonly _bubbleBaseWith = 10
  private readonly _mainOutputFolder: string

  constructor(config: Partial<IMainConfig>) {
    this._delim = ','

    const defaultConfig: IMainConfig = {
      workspaceId: '5e3018c2d1715f5725d0b8c7',
      outputJsonFilename: 'output/allEvs.json',
      outputImageFilename: `output/output_average.png`,
      minDate: '2024-04-18T00:00:00Z',
      maxDate: '2024-05-18T23:59:59Z',
      labels: ['regression'],
      skipRepos: [93615076],
      includeRepos: [],
      issuesToSkip: [],
      fromPipeline: 'New Issues',
      toPipeline: 'Awaiting TESS Review',
      maxCount: 0,
      pullRequest: false,
      release: ''
    }
    this._config = Object.assign(defaultConfig, config)

    if (!Utils.isHex(this._config.workspaceId)) {
      throw new Error('Bad workspace ID')
    }

    const currentFolder = process.cwd()

    const outputJsonFilename = path.join(
      ...this._config.outputJsonFilename.split('/')
    )
    this._config.outputJsonFilename = path.join(
      currentFolder,
      outputJsonFilename
    )
    const outputImageFilename = path.join(
      ...this._config.outputImageFilename.split('/')
    )
    this._config.outputImageFilename = path.join(
      currentFolder,
      outputImageFilename
    )

    this._mainOutputFolder = path.join(currentFolder, 'output')

    for (const target of [
      this._config.outputJsonFilename,
      this._config.outputImageFilename
    ]) {
      const targetFolder = path.dirname(target)
      if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder)
      }
    }

    for (const key of Object.keys(this._config)) {
      // @ts-ignore
      if (!this._config[key]) {
        // @ts-ignore
        // this._config[key] = undefined;
        delete this._config[key]
      }
    }

    const str = JSON.stringify(this._config)
    this._configHash = md5(str)

    this._file = this._config.inputJsonFilename
      ? this._config.inputJsonFilename
      : path.join(
          this._mainOutputFolder,
          `${this._baseFilename}_${this._configHash}.json`
        )
    console.log(`Target file: ${this._file}`)
  }

  private async generateChartFromObj(
    title: string,
    evs: ICSVItem[],
    fileName: string,
    param3: ISizeObj
  ): Promise<IChartItem[]> {
    const csv = this.get_csv(evs)
    // await generateExcelPieChart(csv, 'output.xlsx', "Pie Chart Data", "D", "A");
    return this.generateChart(title, csv, fileName, param3)
  }

  private toCSV(
    myArr: any[],
    withDate: boolean,
    title?: string,
    lastLineFn?: (delim: string) => string
  ): string {
    if (myArr.length === 0) {
      return ''
    }

    const keys: string[] = (withDate ? ['Date'] : []).concat(
      Object.keys(myArr[0])
    )
    const csvHeaders = `${keys.join(this._delim)}\n`

    const datePart = withDate ? `${new Date().toUTCString()}${this._delim}` : ''

    let csvData = ''
    for (const arrItem of myArr) {
      csvData += datePart
      // for (const key of keys) {
      // 	csvData += arrItem[key] + this._delim;
      // }
      csvData += `${keys.map(k => arrItem[k]).join(this._delim)}\n`
    }
    if (lastLineFn) {
      csvData += lastLineFn(this._delim)
    }

    return `${title?.replace(/,/g, '_') || ''}\n${csvHeaders}${csvData}`
  }

  private generateAllCSV(title: string, report: IReport): ICSVResult {
    const date = new Date()

    const all: ICSVResult = this.getAllCSV(report, date)

    const mainCSV = `${all.csvChart}\n\n${all.csvOutstanding}\n\n${all.velocityList}\n\n${all.mainList}\n\n${all.csvPrAndCommits}`
    fs.writeFileSync(
      path.join(this._mainOutputFolder, 'main_report.csv'),
      mainCSV,
      { encoding: 'utf8' }
    )

    return all
  }

  private async generateChart(
    title: string,
    csvData: string,
    outputFile: string,
    sizeObj: ISizeObj
  ): Promise<IChartItem[]> {
    // Parse the CSV data
    const items: IChartItem[] = this.csvDataToChartItems(csvData)
    await ChartHelper.generateChartFromObj(title, items, outputFile, sizeObj)
    return Promise.resolve(items)
  }

  private async handleIssue(
    issueObj: IIssue,
    skipEventIfFn?: (issue: IGhEvent) => Promise<boolean>,
    doGen = false,
    fromPipeline = 'New Issues',
    toPipeline = 'Awaiting TESS Review'
  ): Promise<IHandleIssueResult> {
    const issueNumber: string = issueObj.number
    const events: IGhEvent[] =
      issueObj.events ||
      (await this.getEvents(
        issueObj.repositoryGhId,
        Utils.issueNumberAsNumber(issueNumber)
      ).catch(err => {
        this._errorMessages.push(err.message)
        return []
      }))
    events.sort(
      (a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    const move_events0: IGhEvent[] = events.filter(
      (e: any) => e.type === 'issue.change_pipeline'
    )

    const createdEventArr: IGhEvent[] = []

    if (move_events0.length > 0) {
      const created_event: IGhEvent = Object.assign({}, move_events0[0])
      created_event.createdAt = issueObj.createdAt.toISOString()
      delete created_event.data.github_user
      created_event.data.to_pipeline = created_event.data.from_pipeline
      // delete created_event.data.from_pipeline
      createdEventArr.push(created_event)
    }

    const move_events: IGhEvent[] = createdEventArr.concat(move_events0)
    // console.log(move_events);

    const filteredEvents: IGhEvent[] = []
    for (const event of move_events) {
      if (skipEventIfFn !== undefined && (await skipEventIfFn(event))) {
        continue
      }
      filteredEvents.push(event)
    }

    if (filteredEvents.length > 1) {
      const firstFrom = filteredEvents[0].data.from_pipeline.name
      const lastTo =
        filteredEvents[filteredEvents.length - 1].data.to_pipeline.name

      const reachedCompletionOrFurther =
        this.comparePipelines(lastTo, toPipeline) >= 0

      if (
        firstFrom !== lastTo &&
        this.comparePipelines(firstFrom, fromPipeline) <= 0 &&
        reachedCompletionOrFurther
      ) {
        this._completed.push(issueObj)
      }
    }

    // const completedEvent: IGhEvent | undefined = move_events.find(me => this.comparePipelines(me.data.to_pipeline.name, toPipeline) >= 0);
    const completedEvent: IGhEvent | undefined = move_events.find(
      me => this.comparePipelines(me.data.to_pipeline.name, toPipeline) >= 0
    )
    if (completedEvent !== undefined) {
      const startEvent: IGhEvent | undefined = move_events
        .slice()
        .reverse()
        .find(me => {
          return (
            this.comparePipelines(me.data.to_pipeline.name, fromPipeline) >=
              0 &&
            this.comparePipelines(me.data.from_pipeline.name, fromPipeline) < 0
          )
        })
      issueObj.completed = {
        start: new Date((startEvent || move_events[0]).createdAt),
        end: new Date(completedEvent.createdAt)
      }
    }

    // await print_timings(filteredEvents);
    const evs: ICSVItem[] = this.mapToUsefull(
      filteredEvents,
      issueObj?.estimateValue,
      issueObj
    )

    if (doGen) {
      try {
        await this.generateChartFromObj(
          '',
          evs,
          `output_issue_${issueNumber}.png`,
          { width: 1600, height: 1200 }
        )
      } catch (err: any) {
        console.error(err.message)
      }
    }

    return Promise.resolve({
      csvItems: evs,
      events: move_events
    })
  }

  private getAverages(allEvs: ICSVItem[]): IAVGItemMap {
    const avgObj: IAVGItemMap = {}
    for (const ev of allEvs) {
      if (!avgObj[ev.pipeline]) {
        avgObj[ev.pipeline] = {
          data: {
            count: 1,
            duration: ev.duration,
            durationDays: Utils.getMsAsDays(ev.duration),
            durationAverage: 0,
            durationString: '',
            durationAverageString: ''
          },
          issueCount: 0, // will be done at the end
          openedIssueCount: 0
        }
      } else {
        avgObj[ev.pipeline].data.count++
        avgObj[ev.pipeline].data.duration += ev.duration
      }
    }
    for (const pipelineKey of Object.keys(avgObj)) {
      avgObj[pipelineKey].data.durationString =
        Utils.millisecondsToHumanReadableTime(avgObj[pipelineKey].data.duration)

      avgObj[pipelineKey].data.durationAverage = Number(
        (
          avgObj[pipelineKey].data.duration / avgObj[pipelineKey].data.count
        ).toFixed(0)
      )

      avgObj[pipelineKey].data.durationAverageString =
        Utils.millisecondsToHumanReadableTime(
          avgObj[pipelineKey].data.durationAverage
        )

      avgObj[pipelineKey].data.durationDays = Utils.getMsAsDays(
        avgObj[pipelineKey].data.duration
      )
    }

    return avgObj
  }

  private mapToUsefull(
    move_events: any[],
    estimateValue: number | undefined,
    issueObj: IIssue
  ): ICSVItem[] {
    // return move_events.map((mo) => {
    // 	return {
    // 		duration:
    // 	}
    // });

    // const res = [];
    // for(let i = 1; i < move_events.length - 1; i++) {
    const res: ICSVItem[] = move_events.slice(1).map((ev, i) => {
      const prevEv = move_events[i]
      // const ev = move_events[i];
      const diff =
        new Date(ev.createdAt).getTime() - new Date(prevEv.createdAt).getTime()
      const diffPerEstimate =
        estimateValue !== undefined && estimateValue > 0
          ? Number((diff / estimateValue).toFixed(1))
          : undefined

      return {
        duration: diff,
        durationString: Utils.millisecondsToHumanReadableTime(diff),
        durationPerEstimate: diffPerEstimate,
        durationStringPerEstimate:
          diffPerEstimate !== undefined
            ? Utils.millisecondsToHumanReadableTime(diffPerEstimate)
            : undefined,
        pipeline: prevEv.data.to_pipeline.name,
        event: `${prevEv.data.to_pipeline.name} to ${ev.data.to_pipeline.name}`,
        number: issueObj?.number,
        htmlUrl: issueObj?.htmlUrl
      } as ICSVItem
    })
    // }

    return res
  }

  private get_csv(evs: ICSVItem[]): string {
    let str = `Pipeline${this._delim}Event${this._delim}Human readable duration${this._delim}Duration\n`
    for (const ev of evs) {
      str += `${ev.pipeline}${this._delim}${ev.event}${this._delim}${ev.durationString}${this._delim}${ev.duration}\n`
    }

    return str
  }

  private async callZenhub(query: string, variables: any): Promise<any> {
    // const endpoint = 'https://api.zenhub.io/graphql';
    const endpoint = 'https://api.zenhub.com/public/graphql'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ query, variables })
    })

    if (!response.ok) {
      throw new Error('Failed to fetch ZenHub API')
    }

    return response.json()
    // .then(data => {
    // 	console.log(data);
    // })
    // .catch(error => {
    // 	console.error(error);
    // })
  }

  private async getEvents(
    repositoryGhId: number,
    issueNumber: number,
    last = 50
  ): Promise<IGhEvent[]> {
    const query = `query getTimelineItems($repositoryGhId: Int!, $issueNumber: Int!) {
  issueByInfo(repositoryGhId: $repositoryGhId, issueNumber: $issueNumber) {
    id
    timelineItems(last: ${last}) {
      nodes {
        type: key
        data
        createdAt
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`

    const variables = { repositoryGhId, issueNumber }

    const res = await this.callZenhub(query, variables)
    const events: IGhEvent[] =
      (res.data?.issueByInfo.timelineItems.nodes as IGhEvent[]) || []

    return Promise.resolve(events)
  }

  private async getPipelines(workspaceId: string): Promise<string[]> {
    const query = `query getBoardInfoForWorkspace($workspaceId: ID!) {
  workspace(id: $workspaceId) {
    id
    pipelinesConnection(first: 25) {
      nodes {
        name
      }
    }
  }
}`
    const variables = { workspaceId }
    const res1 = await this.callZenhub(query, variables)
    const res: any[] = res1.data.workspace.pipelinesConnection.nodes.map(
      (res0: any) => res0.name
    )
    return Promise.resolve(res)
  }

  private async getPipelinesFromBoard(board: IWorkspace): Promise<string[]> {
    return Promise.resolve(
      board.pipelinesConnection.map((p: IPipelinesConnection) => {
        return p.name
      })
    )
  }

  private async getPipelineIssues(
    pipelineId: string,
    releaseIds: string[] = [],
    labels: string[] = [],
    issueCursor = '',
    last = 100
  ): Promise<ISarchIssuesByPipeline> {
    const query = `query getIssuesByPipeline($pipelineId: ID!, $filters: IssueSearchFiltersInput!, $issueCursor: String) {
  searchIssuesByPipeline(pipelineId: $pipelineId, filters: $filters, first: ${last}, after: $issueCursor) {
    ${this._issueQueryTemplate}
  }
}`

    // releaseIds = ["Z2lkOi8vcmFwdG9yL1JlbGVhc2UvOTc3MTk"];
    const variables = {
      pipelineId,
      filters: {},
      issueCursor
    }
    if (releaseIds.length > 0) {
      // @ts-ignore
      variables.filters.releases = { in: releaseIds }
    }
    if (labels.length > 0) {
      // @ts-ignore
      variables.filters.labels = { in: labels }
    }

    const res1 = await this.callZenhub(query, variables)
    // const issues: Issue[] = res1.data.searchIssuesByPipeline.nodes.reduce((res: IIssue[], ee: Issue) => {
    // 	return res.concat([{
    // 		number: Number(ee.number),
    // 		estimateValue: ee.estimate !== null ? Number(ee.estimate.value) : undefined,
    // 		repositoryGhId: Number(ee.repository.ghId),
    // 		labels: ee.labels?.nodes?.map((n: any) => n.name) || undefined
    // 	} as IIssue]);
    // }, []);

    const pipelines: ISarchIssuesByPipeline = this.addRepoProps(
      res1.data.searchIssuesByPipeline as ISarchIssuesByPipeline
    )
    return Promise.resolve(pipelines)
  }

  private async getIssuesFromBoard(board: IWorkspace): Promise<IIssue[]> {
    const issues: IIssue[] = board.pipelinesConnection.reduce(
      (res: IIssue[], item: IPipelinesConnection) => {
        const eventsTmp: Issue[] = item.issues
        const issues0: IIssue[] = eventsTmp.map((ee: Issue) => {
          const o: IIssue = {
            number: Utils.issueNumberAsString(ee.number),
            estimateValue:
              ee.estimate !== null && ee.estimate !== undefined
                ? Number(ee.estimate.value)
                : undefined,
            repositoryGhId: Number(ee.repository.ghId),
            pipelineName: item.name,
            labels: ee.labels?.nodes?.map((n: any) => n.name) || undefined,
            releases: ee.releases?.nodes?.map((n: any) => n.title) || undefined,
            events: ee.events,
            pullRequest: !!ee.pullRequest,
            htmlUrl: ee.htmlUrl,
            createdAt: new Date(ee.createdAt)
          } as IIssue
          return o
        })

        return res.concat(issues0)
      },
      []
    )

    return Promise.resolve(issues)
  }

  private async getBoardFull(
    workspaceId: string,
    last = 73
  ): Promise<IWorkspace> {
    console.log('Getting board data')
    const base: IWorkspace = await this.getBoard(workspaceId, last)
    this._config.releaseID = await this.getReleases(workspaceId)

    for (const pieline of base.pipelinesConnection) {
      const pipelineID = pieline.id
      let endCursor = pieline.issueEndCursor
      while (endCursor !== undefined) {
        const moreData: ISarchIssuesByPipeline = await this.getPipelineIssues(
          pipelineID,
          this._config.releaseID !== undefined ? [this._config.releaseID] : [],
          this._config.labels || [],
          endCursor
        )

        // console.log(moreData);

        pieline.issues.push(...moreData.nodes)

        endCursor = moreData.pageInfo.hasNextPage
          ? moreData.pageInfo.endCursor
          : undefined
        // pieline.issues.push(...this.ma)
      }
    }

    return Promise.resolve(base)
  }

  private async getReleases(workspaceId: string): Promise<string | undefined> {
    // TODO last
    const query = `query getCurrentWorkspace($workspaceId: ID!) {
  workspace: workspace(id: $workspaceId) {
    ...currentWorkspace
  }
}

fragment currentWorkspace on Workspace {
  pipelinesConnection(first:9) {
    nodes {
      issues(last: 100) {
        pageInfo {
          endCursor
          startCursor
          hasPreviousPage
        }
        nodes {
          releases {
            nodes {
            title
            id
            }
          }
        }
      }
    }
  }
}`

    const variables = { workspaceId }

    const res1 = await this.callZenhub(query, variables)

    const err = res1.errors?.map((e: any) => e.message) || []
    if (err.length > 0) {
      return Promise.reject(new Error(err.join('\n')))
    }

    const releases: string[] = Array.from(
      new Set(
        []
          .concat(
            ...[]
              .concat(
                ...res1.data.workspace.pipelinesConnection.nodes.map((n: any) =>
                  n.issues.nodes.map((nn: any) => nn.releases.nodes)
                )
              )
              .filter((l: any) => l.length > 0)
          )
          .map((y: any) => `${y.title}:${y.id}`)
      )
    )

    return releases
      .find((r: string) => r.startsWith(`${this._config.release}:`))
      ?.split(':')[1]
  }

  private async getBoard(workspaceId: string, last = 73): Promise<IWorkspace> {
    // TODO last
    const query = `query getCurrentWorkspace($workspaceId: ID!) {
  workspace: workspace(id: $workspaceId) {
    ...currentWorkspace
    __typename
  }
}

fragment currentWorkspace on Workspace {
  name
  id
  displayName
  pipelinesConnection(first:100) {
    nodes {
      id
      name
      issues(first:${last}) {
        ${this._issueQueryTemplate}
    }
  }
}`

    const variables = { workspaceId }

    const res1 = await this.callZenhub(query, variables)

    const err = res1.errors?.map((e: any) => e.message) || []
    if (err.length > 0) {
      return Promise.reject(new Error(err.join('\n')))
    }

    const finalRes: IWorkspace = Object.assign(
      { totalIssues: 0 },
      res1.data.workspace
    )
    finalRes.pipelinesConnection = this.mapPipelineConnec(finalRes)

    return Promise.resolve(finalRes)
  }

  private generateMainCSV(
    avg: IAVGItemMap,
    date: Date,
    stats: IStatResult,
    statsEstimate: IStatResult,
    veloccity: IVelocity
  ): string {
    const keys = Object.keys(avg)
    const csvHeaders =
      `Date${this._delim}${keys.join(this._delim)}` +
      `${this._delim}${keys.map(k => `${k} Issues`).join(this._delim)}` +
      `${this._delim}Completed,From Pipeline,To Pipeline,From Date,To Date,Working Days,Days/issue,Median,Days/estimate,Median estimate,Velocity (issue),Velocity(estimate)\n`

    let csv = `${date.toISOString()}`
    for (const key of keys) {
      csv += `${this._delim}${avg[key].data.durationDays.toFixed(2)}`
    }
    for (const key of keys) {
      csv += `${this._delim}${avg[key].issueCount}`
    }
    csv += `${this._delim}${this._completed.length}`
    csv += `${this._delim}${this._config.fromPipeline}${this._delim}${this._config.toPipeline}`
    csv += `${this._delim}${this._config.minDate}${this._delim}${this._config.maxDate}`
    csv += `${this._delim}${
      this._config.minDate && this._config.maxDate
        ? this.getWorkingDays(
            new Date(this._config.minDate),
            new Date(this._config.maxDate)
          )
        : ''
    }`
    csv +=
      `${this._delim}${stats.average}${this._delim}${stats.median}${this._delim}${statsEstimate.average}` +
      `${this._delim}${statsEstimate.median}${this._delim}${veloccity.velocityIssue}${this._delim}${veloccity.velocityEstimate}\n`

    const allCSV = csvHeaders + csv

    const outputPath = path.join(this._mainOutputFolder, 'main.csv')
    const writeCSV = fs.existsSync(outputPath) ? csv : csvHeaders + csv
    fs.writeFileSync(outputPath, writeCSV, { encoding: 'utf8', flag: 'a' })

    return allCSV
  }

  private generateHTML(outstanding: ICSVItem[]): void {
    const csv: string = fs.readFileSync(
      path.join(this._mainOutputFolder, 'main.csv'),
      { encoding: 'utf8' }
    )
    const html: string = fs
      .readFileSync(path.join(__dirname, 'index.html'), {
        encoding: 'utf8'
      })
      .replace('__DATA__', csv)
      .replace('__OUTS__', JSON.stringify(outstanding, null, 2))

    fs.writeFileSync(path.join(this._mainOutputFolder, 'index.html'), html, {
      encoding: 'utf8'
    })
  }

  private updateHTML(
    baseFile = path.join(this._mainOutputFolder, 'index.html'),
    outFile = path.join(this._mainOutputFolder, 'index.html'),
    tag = '__MORE__',
    html: string
  ): void {
    const htmlContent: string = fs
      .readFileSync(baseFile, { encoding: 'utf8' })
      .replace(tag, html)

    fs.writeFileSync(outFile, htmlContent, { encoding: 'utf8' })
  }

  private writeMoreHTML(): void {
    this.updateHTML(
      path.join(this._mainOutputFolder, 'index.html'),
      path.join(this._mainOutputFolder, 'index.html'),
      '__MORE__',
      this._preparedHTML.join('')
    )
  }

  private addControlChartListHTML(chartData: IControlChartItem[]): void {
    const htmlTableString = this.generateTable(chartData)
    this._preparedHTML.push(
      `<div class="control-chart-list"><h3>Control Chart list</h3>${htmlTableString}</div>`
    )
  }

  getWorkingDays(currentDate: Date, endDate: Date): number {
    let count = 0

    while (currentDate.getTime() <= endDate.getTime()) {
      const dayOfWeek = currentDate.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return count
  }

  private comparePipelines(firstFrom: any, fromPipeline: string): number {
    // return firstFrom === fromPipeline;
    return (
      this._pipelines.indexOf(firstFrom) - this._pipelines.indexOf(fromPipeline)
    )
  }

  private findOutstandingIssues(allEvs: ICSVItem[][]): ICSVItem[] {
    const flat: { data: ICSVItem[]; sum: number } = allEvs.reduce(
      (
        res: {
          data: ICSVItem[]
          sum: number
        },
        item: ICSVItem[]
      ) => {
        res.data.push(...item)
        res.sum += item.reduce((res0, item0) => res0 + item0.duration, 0)
        return res
      },
      { data: [], sum: 0 }
    )

    flat.data.sort((a: ICSVItem, b: ICSVItem) => {
      return a.duration - b.duration
    })

    const avg = flat.sum / flat.data.length

    return flat.data.filter((ff: ICSVItem) => ff.duration > avg)
  }

  async main(
    skipIssueIfFn?: (issue: IIssue) => Promise<boolean>,
    skipEventIfFn?: (issue: IGhEvent) => Promise<boolean>
  ): Promise<IProgramResult> {
    // const pipelines: string[] = await this.getPipelines(this._config.workspaceId);
    // this._pipelines = pipelines
    //
    // const issues = await this.getIssues(this._config.workspaceId)
    // 	.catch((err) => {
    // 		this._errorMessages.push(err.message);
    // 		return [];
    // 	});

    // const board: IWorkspace = await this.getBoardFull(this._config.workspaceId);
    const board: IWorkspace | null =
      this.getFromFile() ||
      (await this.getBoardFull(this._config.workspaceId, this._config.maxCount) // this.getBoard(this._config.workspaceId)
        .then((b: IWorkspace) => {
          b.configHash = this._configHash
          return b
        })
        .catch(err => {
          this._errorMessages.push(err.message)
          return null
        }))

    if (board === null) {
      const msg = process.env.API_KEY
        ? `Couldn't get board data for ${this._config.workspaceId}`
        : 'Need to export API_KEY'
      for (const err of this._errorMessages) {
        console.error(err)
      }
      throw new Error(msg)
    }

    const issues: IIssue[] = await this.getIssuesFromBoard(board)
    // const pipelines: string[] = await this.getPipelines(this._config.workspaceId);
    const pipelines: string[] = await this.getPipelinesFromBoard(board)
    this._pipelines = pipelines

    this._startTimestamp = Date.now()

    const allEvs: ICSVItem[][] = []
    let handledCount = 0
    for (let i = 0; i < issues.length; ++i) {
      console.clear()
      if (this._errorMessages.length > 0) {
        console.log(this._errorMessages.join('\n'))
      }
      const handledPerc = i / issues.length
      console.log(
        `${i} / ${issues.length} (${(handledPerc * 100).toFixed(1)}%)`
      )

      this.printRemaining(i, issues.length)

      const issue: IIssue = issues[i]

      if (
        !!issue.pullRequest !== !!this._config.pullRequest ||
        (this._config.labels &&
          this._config.labels.length > 0 &&
          !issue.labels?.some(la =>
            this._config.labels?.includes(la.toLowerCase())
          )) ||
        (this._config.skipRepos.length > 0 &&
          this._config.skipRepos.includes(issue.repositoryGhId)) ||
        (this._config.includeRepos.length > 0 &&
          !this._config.includeRepos.includes(issue.repositoryGhId)) ||
        (!!this._config.release &&
          !issue.releases?.includes(this._config.release)) ||
        (skipIssueIfFn !== undefined && (await skipIssueIfFn(issue)))
      ) {
        issue.filtered = true
        continue
      }

      // if (this._config.maxCount > 0 && handledCount === this._config.maxCount) {
      // 	break;
      // }

      const handleIssueResult: IHandleIssueResult = await this.handleIssue(
        issue,
        skipEventIfFn,
        false,
        this._config.fromPipeline,
        this._config.toPipeline
      )

      const evs: ICSVItem[] = handleIssueResult.csvItems
      if (evs.length > 0) {
        allEvs.push(evs)
        issue.handled = true
        handledCount++
      }

      this._eventsPerIssue[issue.number] = handleIssueResult.events
    }
    // fs.writeFileSync(this._config.outputJsonFilename, JSON.stringify(allEvs, null, 2), {encoding: 'utf8'}); // done at the end

    const remainingOpenedIssues: IIssue[] = issues.filter(
      iu => !iu.completed && !iu.filtered
    )

    // @ts-ignore
    const avg: IAVGItemMap = this.getAverages([].concat(...allEvs))
    for (const pipeline of Object.keys(avg)) {
      // TODO use all pipelines
      avg[pipeline].issueCount = issues.filter(
        is => is.pipelineName === pipeline && !is.filtered
      ).length
      // avg[pipeline].openedIssueCount = remainingOpenedIssues.filter(r => r.pipelineName === pipeline).length
    }

    const openedPipelines = Array.from(
      new Set(remainingOpenedIssues.map(r => r.pipelineName))
    )

    // const remainingPerPipeline = Object.keys(avg).map((pipeline: string) => {
    // 	return {
    // 		pipeline,
    // 		remsiningCount: avg[pipeline].openedIssueCount
    // 	}
    // });

    fs.writeFileSync(
      this._config.outputJsonFilename.replace('.json', '_averages.json'),
      JSON.stringify(avg, null, 2),
      { encoding: 'utf8' }
    )

    const evs: ICSVItem[] = Object.keys(avg).map((pipeline: string) => {
      const avgPipeline: IAVGItem = avg[pipeline]
      return {
        duration: avgPipeline.data.duration,
        durationString: avgPipeline.data.durationString,
        durationPerEstimate: undefined,
        durationStringPerEstimate: undefined,
        pipeline,
        event: '',
        number: ''
      } as ICSVItem
    })

    const date = new Date()

    const timeChartItems: IChartItem[] = await this.generateChartFromObj(
      `Time spent in pipelines on ${date.toISOString()} (${handledCount} issues)`,
      evs,
      this._config.outputImageFilename,
      {
        width: 1600,
        height: 1200
      }
    ).catch(e => {
      if (!e.message.includes("Cannot find module 'canvas'")) {
        throw e
      }
      console.warn(e.message)
      return []
    })
    console.log(JSON.stringify(avg, null, 2))

    const countChartItems: IChartItem[] = Object.keys(avg).map(
      (pipeline: string) => {
        return {
          label: pipeline,
          data: avg[pipeline].issueCount
        } as IChartItem
      }
    )
    console.log(`Handled ${handledCount} issues`)

    await ChartHelper.generateChartFromObj(
      `Total issues in pipelines on ${date.toISOString()} (${issues.length} issues)`,
      countChartItems,
      this._config.outputImageFilename.replace('.png', '_issues.png'),
      { width: 1600, height: 1200 }
    ).catch(e => {
      if (!e.message.includes("Cannot find module 'canvas'")) {
        throw e
      }
      console.warn(e.message)
    })

    let issueWithEventCount = 0
    board.pipelinesConnection.forEach(
      (pipelineConnect: IPipelinesConnection) => {
        pipelineConnect.issues.forEach((issue: Issue) => {
          // if(issue.number) {
          // 	issue.events = issue.number;
          // } else {
          // 	const issueNumberBits = issue.htmlUrl?.split("/") || [];
          // 	const issueNumber = issueNumberBits[issueNumberBits.length - 1];
          // 	issue.events = this._eventsPerIssue[issueNumber] || [];
          // }
          let issueNumber: number
          if (issue.number) {
            issueNumber = issue.number
          } else {
            const issueNumberBits = issue.htmlUrl?.split('/') || [undefined]
            issueNumber = Number(issueNumberBits[issueNumberBits.length - 1])
          }
          const issueEvents = issueNumber
            ? this._eventsPerIssue[Utils.issueNumberAsString(issueNumber)] || []
            : []
          issue.events = issueEvents

          if (issueEvents.length > 0) {
            issueWithEventCount++
          }
        })
      }
    )

    fs.writeFileSync(this._file, JSON.stringify(board, null, 2), {
      encoding: 'utf8'
    })
    console.log(`Wrote file ${this._file}`)

    const chartData: IControlChartItem[] = this.getControlChartData(issues)
    console.log(chartData)

    const completinList: number[] = chartData.map(c =>
      Number(c.completionTimeStr)
    )
    const stats: IStatResult = StatHelper.getStats(completinList)

    const openedPerPipeline = this.getOpenedPerPipeline(
      avg,
      openedPipelines,
      remainingOpenedIssues,
      stats
    )

    // const chartWithEstimate: IControlChartItem[] = chartData.filter((cd: IControlChartItem) => cd.estimate > 0);
    // const completinListEstimate: number[] = chartWithEstimate.map((c: IControlChartItem) => Number(c.completionTimeStr));
    // const completionTot: number = completinListEstimate.reduce((res: number, item: number) => res + item, 0);
    // const estimateTot: number = chartWithEstimate.reduce((res: number, item: IControlChartItem) => res + item.estimate, 0);
    // const averagePerEstimate: number = completionTot / estimateTot;

    const completinEstimateList: number[] = chartData
      .filter((cd: IControlChartItem) => cd.estimate > 0)
      .map(c => Number(c.completionTimeStr) / c.estimate)
    const statsEstimate: IStatResult = StatHelper.getStats(
      completinEstimateList
    )

    const veloccity: IVelocity = this.getVelocity(chartData)

    // this.generateMainCSV(avg, date, stats, statsEstimate, veloccity);

    const outs: ICSVItem[] = this.findOutstandingIssues(allEvs).slice(0, 5)
    // console.log(JSON.stringify(outs, null, 2));

    const allRepos: string[] = issues
      .filter((ii: IIssue) => ii.handled)
      .map((ii: IIssue) => ii.htmlUrl.split('/')[4])

    const repos: string[] = Array.from(
      new Set([].concat(...(allRepos as any[])))
    )

    // const allD: ICheckPr[] = await Promise.all(
    // 	repos.map(repo => {
    // 		return reviewer_call.check_prs(repo, this._config).catch((err: Error) => {
    // 			console.error(err.message);
    // 			return {
    // 				summary: [],
    // 				users:[]
    // 			};
    // 		}) as ICheckPr;
    // 	})
    // );

    const res: { allD: ICheckPr[]; newAllD: ICheckPr } =
      await this.getGithubData(repos)
    // const allD: ICheckPr[] = res.allD;
    const newAllD: ICheckPr = res.newAllD

    const allResult: IReport = {
      chartTime: timeChartItems,
      chartCount: countChartItems,
      statsIssue: stats,
      statsEstimate,
      controlChartList: chartData,
      outstandingItems: outs,
      velocity: veloccity,
      avg,
      prList: newAllD.summary as IPrSummary[],
      // userReviewStats: d.users as IPrUser[]
      userReviewStats: newAllD.users as IPrReviewStat[],
      remainingOpenedIssues
    } as IReport

    const ccsv = this.generateAllCSV('', allResult)
    fs.writeFileSync(
      this._config.outputJsonFilename,
      JSON.stringify(allResult, null, 2),
      { encoding: 'utf8' }
    ) // done at the end

    const remainingOpenedIssuesCleaned: IIssue[] = remainingOpenedIssues.map(
      (f: IIssue) => {
        const clone = Object.assign({}, f)
        delete clone.handled
        clone.estimateValue = clone.estimateValue || 0
        return clone
      }
    )

    this.generateHTML(outs)

    try {
      this.addStatsHTML(stats, statsEstimate, veloccity)
      this.addControlChartListHTML(chartData)
      this.writeMoreHTML()
    } catch (e: any) {
      if (!e.message.includes("Cannot find module 'canvas'")) {
        throw e
      }
      console.warn(e.message)
    }

    const baseTableFn = (
      issueNumberKey: string
    ): ((key: string, item: any) => string | null) => {
      return (key: string, item: any): string | null => {
        const itemStr = item[key] as string
        if (key === issueNumberKey && itemStr.startsWith('#')) {
          const url = (item as IControlChartItem).htmlUrl
          return `<a href="${url}">${itemStr}</a>`
        } else if (key === 'htmlUrl') {
          return ''
        }
        return null
      }
    }

    const fullHTML =
      `<h1>Zenhub report from ${this._config.minDate ? new Date(this._config.minDate).toLocaleDateString() : ''} to ${this._config.maxDate ? new Date(this._config.maxDate).toLocaleDateString() : ''}</h1>` +
      `<h2>Board: ${this._config.workspaceId} - Repos: ${this._config.includeRepos.join(',')}</h2>` +
      `<h2>From ${this._config.fromPipeline} to  ${this._config.toPipeline}</h2>` +
      `<h2>Releases: ${this._config.release || ''}</h2>` +
      `<h2>Labels: ${this._config.labels?.join(', ')}</h2><br>` +
      `<section>
          <h3>Cool stats</h3>
              ${this.getStatsHTML(stats, statsEstimate, veloccity)}
          </section>` +
      `<section>
            <h3>Control chart list</h3>
              ${this.generateTable(chartData, baseTableFn('number'))}
            <div>
                ${await this.getControlChartHTML(chartData).catch(e => {
                  if (!e.message.includes("Cannot find module 'canvas'")) {
                    throw e
                  }
                  console.warn(e.message)
                })}
            </div>
        </section>` +
      `<section>
          <h3>Outstanding issues</h3>
          ${this.generateTable(outs, baseTableFn('number'))}
        </section>` +
      `<section>
            <h3>Velocity list</h3>
            ${this.generateTableFromCSV(ccsv.velocityList)}
            <div>
                ${await this.getVeloctiyChart(veloccity).catch(e => {
                  if (!e.message.includes("Cannot find module 'canvas'")) {
                    throw e
                  }
                  console.warn(e.message)
                })}
            </div>
        </section>` +
      `<section>
            <h3>Main list</h3>
            <div style="overflow-x: scroll;">
                ${this.generateTableFromCSV(ccsv.mainList)}
            </div>
            <div>
                ${await this.getMainChartHTML(avg).catch(e => {
                  if (!e.message.includes("Cannot find module 'canvas'")) {
                    throw e
                  }
                  console.warn(e.message)
                })}
            </div>
        </section>` +
      `<section>
            <h3>Commits and PRs list</h3>
            ${this.generateTableFromCSV(ccsv.csvPrAndCommits)}
            <div>
                ${await this.getCommitsChartHTML(
                  allResult.userReviewStats
                ).catch(e => {
                  if (!e.message.includes("Cannot find module 'canvas'")) {
                    throw e
                  }
                  console.warn(e.message)
                })}
            </div>
        </section>` +
      `<section>
            <h3>Remaining opened issues</h3>
            ${this.generateTable(remainingOpenedIssuesCleaned, baseTableFn('number'))}
        </section>` +
      `<section>
            <h3>Remaining opened issues per pipeline</h3>
            ${this.generateTable(openedPerPipeline, undefined, '25%')}
            <div>
                ${await this.getOpenedChartHTML(openedPerPipeline, 100).catch(
                  e => {
                    if (!e.message.includes("Cannot find module 'canvas'")) {
                      throw e
                    }
                    console.warn(e.message)
                  }
                )}
            </div>
        </section>`

    this.updateHTML(
      path.join(__dirname, 'main_report.html'),
      path.join(this._mainOutputFolder, 'main_index.html'),
      '__CONTROL_CHART_TABLE__',
      fullHTML
    )

    const mark = `${Utils.htmlToMarkdown(fullHTML)}\n_This report was generated with the [Zenhub Issue Metrics Action](https://github.com/lezhumain/zenhub_report_action)_`
    fs.writeFileSync(
      path.join(this._mainOutputFolder, 'main_report.md'),
      mark,
      { encoding: 'utf8' }
    )

    console.log(
      `${allEvs.length} ${issues.filter(iu => !iu.filtered).length} ${issues.filter(iu => iu.handled).length} ${issueWithEventCount}`
    )
    return Promise.resolve({
      mark,
      allResult
    } as IProgramResult)
  }

  private printRemaining(i: number, length: number): void {
    const elapsedMs: number = Date.now() - this._startTimestamp
    const remainingCount = length - i
    const timePerIssueMs: number = elapsedMs / (i + 1)

    this._estimateRemainingPrveiousMs = this._estimateRemainingMs
    this._estimateRemainingMs = timePerIssueMs * remainingCount

    const strVal =
      this._estimateRemainingMs <= this._estimateRemainingPrveiousMs
        ? `${Utils.millisecondsToHumanReadableTime(this._estimateRemainingMs)}`
        : 'estimating...'

    console.log(`Remaining: ${strVal}`)
  }

  private getFromFile(): IWorkspace | null {
    console.log(`Getting from file ${this._file}`)
    if (!FileUtils.fileExists(this._file)) {
      console.log(`File doesn't exist`)
      return null
    }

    const content = fs.readFileSync(this._file, { encoding: 'utf8' })
    try {
      const obj: IWorkspace = JSON.parse(content) as IWorkspace
      console.log(`Got existing`)
      if (
        obj.configHash !== this._configHash &&
        !this._config.inputJsonFilename
      ) {
        console.log(`Using existing`)
        return null
      }
      return obj
    } catch (e) {
      return null
    }
  }

  private getControlChartData(issues: IIssue[]): IControlChartItem[] {
    const configMaxDate: string | undefined = this._config.maxDate
    const configMinDate: string | undefined = this._config.minDate

    const filteered: IIssue[] = issues.filter((i: IIssue) => {
      const endTime: number | undefined = i.completed?.end.getTime()
      return (
        endTime !== undefined &&
        (configMaxDate === undefined ||
          endTime <= new Date(configMaxDate).getTime()) &&
        (configMinDate === undefined ||
          endTime >= new Date(configMinDate).getTime())
      )
    })
    const tmp: (ControlChartItem | null)[] = filteered.map((i: IIssue) => {
      return i.completed?.start
        ? new ControlChartItem(
            i.completed?.start,
            i.completed?.end,
            i.estimateValue || 0,
            i.number,
            i.htmlUrl
          )
        : null
    })
    const res: IControlChartItem[] = tmp
      .filter((r: IControlChartItem | null) => r !== null)
      .map(r => r!.toObj())

    res.sort((a: IControlChartItem, b: IControlChartItem) => {
      return a.comppleted.getTime() - b.comppleted.getTime()
    })
    return res
  }

  private generateTable(
    arr: any[],
    specFn?: (key: string, item: any) => string | null,
    tableWidth?: string
  ): string {
    if (arr.length === 0) {
      return ''
    }

    const headers = this.getHeadersSorted(Object.keys(arr[0]))

    const html = `<table class="table table-striped-columns" ${tableWidth !== undefined ? `style="width: ${tableWidth}"` : ''}><thead>
                    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${arr
                      .slice()
                      .map((l: any) => {
                        return `<tr>${headers
                          .map(lkey => {
                            // const it = l[lkey]
                            // const isArr = Array.isArray(it)
                            // const val =
                            //   !isArr ||
                            //   it.every((r: any) => typeof r === 'string')
                            //     ? it?.toString() || ''
                            //     : this.generateTable(it)
                            // return `<td>${val}</td>`

                            const specRes: string | undefined | null =
                              specFn && specFn(lkey, l)
                            return `<td>${
                              specRes !== undefined && specRes !== null
                                ? specRes
                                : l[lkey]?.toString() || ''
                            }</td>`
                          })
                          .join('')}</tr>`
                      })
                      .join('')}
                </tbody>
			</table>`
    return html
  }

  private csvDataToChartItems(csvData: string): IChartItem[] {
    const rows: string[][] = csvData
      .split('\n')
      .map(row => row.split(','))
      .filter(rowArr => !rowArr.every(value => value === ''))
      .slice(1)

    return rows.map(r => {
      return {
        label: r[0],
        data: Number(r[3])
      } as IChartItem
    })
  }

  private addStatsHTML(
    stats: IStatResult,
    statsEstimate: IStatResult,
    veloccity: IVelocity
  ): void {
    this._preparedHTML.push(`<div class="stats">
			<h3>Stats</h3>
			<p><b>Average per issue:</b>${stats.average.toFixed(1)}</p>
			<p><b>Median:</b>${stats.median.toFixed(1)}</p>
			<p><b>Average per estimate:</b>${statsEstimate.average.toFixed(1)}</p>
			<p><b>Median per estimate:</b>${statsEstimate.median.toFixed(1)}</p>
			<p><b>Velocity (issue):</b>${veloccity.velocityIssue.toFixed(1)}</p>
			<p><b>Velocity (estimate):</b>${veloccity.velocityEstimate.toFixed(1)}</p>
		</div>`)
  }

  private getVelocity(issues: IControlChartItem[]): IVelocity {
    // const completed = 0
    const data: { [weekKey: string]: IVelocityItem } = {}
    for (const item of issues) {
      const weekOfMonth: string = this.getWeekOfMonth(item.comppleted)
      if (!data[weekOfMonth]) {
        data[weekOfMonth] = {
          estimate: item.estimate,
          count: 1
        }
      } else {
        data[weekOfMonth].estimate += item.estimate
        data[weekOfMonth].count++
      }
    }

    const totalCounts: [number, number, IVelocityItem[]] = Object.keys(
      data
    ).reduce(
      (res: [number, number, IVelocityItem[]], item: string) => {
        const it = data[item]
        res[0] += it.count
        res[1] += it.estimate

        // @ts-ignore
        it.key = item
        res[2].push(it)
        return res
      },
      [0, 0, []]
    )

    // new Date().getD
    return {
      velocityIssue: totalCounts[0] / Object.keys(data).length,
      velocityEstimate: totalCounts[1] / Object.keys(data).length,
      data: totalCounts[2]
    }
  }

  private getWeekOfMonth(date: Date): string {
    const firstDayOfMonth: Date = new Date(date.getTime())
    firstDayOfMonth.setDate(1)

    const firstDayOfMonthPosInWeek = firstDayOfMonth.getDay()

    const firstDayOfFirstWeek: Date = Utils.addDay(
      firstDayOfMonth,
      firstDayOfMonthPosInWeek * -1
    )

    let res = 1
    while (
      date.getDate() > Utils.addDay(firstDayOfFirstWeek, 7 * res).getDate()
    ) {
      ++res
    }

    return `${date.getMonth()}${res}`
  }

  private mapPipelineConnec(finalRes: any): IPipelinesConnection[] {
    return finalRes.pipelinesConnection.nodes.map(
      (pipelineConnectionItem: any) => {
        const tempRes = Object.assign({}, pipelineConnectionItem)
        tempRes.issues = this.addRepoPropsToIssues(
          pipelineConnectionItem.issues.nodes
        )
        tempRes.issueEndCursor = pipelineConnectionItem.issues.pageInfo
          ?.hasNextPage
          ? pipelineConnectionItem.issues.pageInfo.endCursor
          : undefined

        finalRes.totalIssues += tempRes.issues.length
        return tempRes as IPipelinesConnection
      }
    )
  }

  // private findReleaseID(base: IWorkspace): string | undefined {
  // 	for(const pip of base.pipelinesConnection) {
  // 		for(const pipIssue of pip.issues) {
  // 			for(const pipIssue0 of pipIssue.releases.nodes) {
  // 				if(pipIssue0.title === this._config.release) {
  // 					return pipIssue0.id;
  // 				}
  // 			}
  // 		}
  // 	}
  // }

  private getAllCSV(report: IReport, date: Date): ICSVResult {
    const reportVelocityList = report.velocity.data

    const csvChart = this.toCSV(
      report.controlChartList,
      false,
      'Control Chart Items',
      (delim: string) => {
        const newObj: IControlChartItem = Object.assign(
          {},
          report.controlChartList[0]
        )

        newObj.completionTime = Number(
          (
            report.controlChartList.reduce(
              (res: number, item: IControlChartItem) =>
                res + item.completionTime,
              0
            ) / report.controlChartList.length
          ).toFixed(0)
        )
        newObj.completionTimeStr = (
          report.controlChartList.reduce(
            (res: number, item: IControlChartItem) =>
              res + Number(item.completionTimeStr),
            0
          ) / report.controlChartList.length
        ).toFixed(2)
        newObj.estimate = Number(
          (
            report.controlChartList.reduce(
              (res: number, item: IControlChartItem) => res + item.estimate,
              0
            ) / report.controlChartList.length
          ).toFixed(2)
        )

        return `${delim}${delim}${delim}${newObj.completionTime}${delim}${newObj.completionTimeStr}${delim}${newObj.estimate}\n`
      }
    )
    const csvOutstanding = this.toCSV(
      report.outstandingItems,
      false,
      'Outstanding issues'
    )
    const velocityList = this.toCSV(
      report.velocity.data,
      false,
      'Velocity List',
      (delim: string) => {
        const newObj: IVelocityItem = Object.assign({}, reportVelocityList[0])
        delete newObj.key
        newObj.estimate = Number(
          (
            reportVelocityList.reduce(
              (res: number, item: IVelocityItem) => res + item.estimate,
              0
            ) / reportVelocityList.length
          ).toFixed(2)
        )
        newObj.count = Number(
          (
            reportVelocityList.reduce(
              (res: number, item: IVelocityItem) => res + item.count,
              0
            ) / reportVelocityList.length
          ).toFixed(2)
        )

        return `${newObj.estimate}${delim}${newObj.count}\n`
      }
    )

    const mainList = this.generateMainCSV(
      report.avg,
      date,
      report.statsIssue,
      report.statsEstimate,
      report.velocity
    )

    const userReviewStatsAnon = report.userReviewStats.map(
      (item: IPrReviewStat) => {
        const clone: Partial<IPrReviewStat> = Object.assign({}, item)
        // clone.user = "user" + index; // TODO uncomment me
        delete clone.shouldReviewCount
        return clone
      }
    )
    report.userReviewStats = userReviewStatsAnon as any
    const csvPrAndCommits = this.toCSV(
      userReviewStatsAnon,
      false,
      'PR and commit stats'
    )

    return {
      csvChart,
      csvOutstanding,
      velocityList,
      mainList,
      csvPrAndCommits
    } as ICSVResult
  }

  private generateTableFromCSV(csvChart: string): string {
    const lines = csvChart
      .trim()
      .split('\n')
      .map(i => i.split(','))
    const [headers] = lines.splice(0, 1)
    if (!headers || headers.length === 0) {
      return ''
    }
    const tableStr = `<table class="table table-striped-columns" style="width: 50%">
                <thead>
                    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${lines.map(l => `<tr>${l.map(h => `<td>${!isNaN(Number(h)) ? Number(h).toFixed(1) : h}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>`
    // return `<div> ${title ? `<h3>${title}</h3>` : ""}${tableStr} </div>`;
    return tableStr
  }

  private async getVeloctiyChart(data0: IVelocity): Promise<string> {
    // console.log(data);
    const data = data0.data.filter(r => r.key)

    const labels: string[] = data.map(d => d.key || '')

    const values: BubbleDataPoint[] = data.map(d => {
      return {
        x: (Number(d.key) || 0) * 7 * 24 * 3600000, // in ms
        y: d.count,
        r: d.estimate
      } as BubbleDataPoint
    })

    const file = path.join(this._mainOutputFolder, 'velocity_stuff.png')
    const title = 'Velocity graph'
    const b64img: string = await ChartHelper.generateScatterChart(
      title,
      values,
      labels,
      file,
      5
    )
    // return Promise.resolve(`<img title="${title}" src="${file.replace(/output./, "")}">`);
    return Promise.resolve(
      `<img title="${title}" src="data:image/png;base64,${b64img}">`
    )
  }

  private async getControlChartHTML(
    data0: IControlChartItem[]
  ): Promise<string> {
    // console.log(data);
    const data = data0.slice()
    // data.sort((a: IControlChartItem, b: IControlChartItem) => {
    // 	return a.comppleted.getTime() - b.comppleted.getTime();
    // })

    const labels: string[] = data.map(d => d.comppleted.toLocaleDateString())
    const values: BubbleDataPoint[] = data.map(d => {
      return {
        x: d.comppleted.getTime(),
        y: Number(d.completionTimeStr),
        r: d.estimate
      } as BubbleDataPoint
    })

    const file = path.join(this._mainOutputFolder, 'bubble_stuff.png')
    const title = 'My Title'
    const b64img: string = await ChartHelper.generateScatterChart(
      title,
      values,
      labels,
      file,
      this._bubbleBaseWith
    )
    // return Promise.resolve(`<img title="${title}" src="${file.replace(/output./, "")}">`);
    return Promise.resolve(
      `<img title="${title}" src="data:image/png;base64,${b64img}">`
    )

    // const imgFiles = [
    //
    // 		path: path.join(this._mainOutputFolder, "issueCount.png"),
    // 		title: "Total issues per pipeline",
    // 		key: "issueCount",
    // 		labelKey: "pipeline"
    // 	},
    // 	{
    // 		path: path.join(this._mainOutputFolder, "duration.png"),
    // 		title: "Days per pipeline",
    // 		key: "duration",
    // 		labelKey: "pipeline"
    // 	}
    // ];
    //
    // return this.generateChartFromArray(imgFiles, dataq, 50);
  }

  private async getMainChartHTML(
    csvPrAndCommits: IAVGItemMap
  ): Promise<string> {
    console.log(csvPrAndCommits)
    const pipelines = Object.keys(csvPrAndCommits)
    const dataq = pipelines.map((pipeline: string) => {
      const item: IAVGItem = csvPrAndCommits[pipeline]
      return {
        pipeline,
        issueCount: item.issueCount,
        duration: item.data.durationDays
      }
    })

    const imgFiles = [
      {
        path: path.join(this._mainOutputFolder, 'issueCount.png'),
        title: 'Total issues per pipeline',
        key: 'issueCount',
        labelKey: 'pipeline'
      },
      {
        path: path.join(this._mainOutputFolder, 'duration.png'),
        title: 'Days per pipeline',
        key: 'duration',
        labelKey: 'pipeline'
      }
    ]

    return this.generateChartFromArray(imgFiles, dataq, 50)
  }

  private async getOpenedChartHTML(
    csvPrAndCommits: { pipeline: string; opened: number }[],
    chartSizePerc = 50
  ): Promise<string> {
    const imgFiles = [
      {
        path: path.join(this._mainOutputFolder, 'remainingissueCount.png'),
        title: 'Remaining opened issues per pipeline',
        key: 'opened',
        labelKey: 'pipeline'
      }
    ]

    return this.generateChartFromArray(imgFiles, csvPrAndCommits, chartSizePerc)
  }

  private async getCommitsChartHTML(
    csvPrAndCommits: IPrReviewStat[]
  ): Promise<string> {
    const imgFiles = [
      {
        path: path.join(this._mainOutputFolder, 'prCommitCreated.png'),
        title: 'Repartition of PR creation',
        key: 'created',
        labelKey: 'user'
      },
      {
        path: path.join(this._mainOutputFolder, 'prCommitReviewed.png'),
        title: 'Repartition of PR reviews',
        key: 'didReviewCount',
        labelKey: 'user'
      },
      {
        path: path.join(this._mainOutputFolder, 'prCommitCommited.png'),
        title: 'Repartition of commits',
        key: 'totalCommits',
        labelKey: 'user'
      }
    ]
    return this.generateChartFromArray(imgFiles, csvPrAndCommits, 33)
  }

  private async getChartGeneric(
    title: string,
    outputFile: string,
    csvPrAndCommits: any[],
    key: string,
    labelKey?: string
  ): Promise<string> {
    // await this.generateChartFromObj("", evs, `output_issue_${issueNumber}.png`, {width: 1600, height: 1200});
    const items: IChartItem[] = csvPrAndCommits.map(c => {
      return {
        label: labelKey === undefined ? '' : c[labelKey],
        data: c[key]
      } as IChartItem
    })
    return ChartHelper.generateChartFromObj(title, items, outputFile, {
      width: 1600,
      height: 1200
    })
  }

  private async generateChartFromArray(
    imgFiles: any[],
    dataq: any[],
    sizePerc: number
  ): Promise<string> {
    if (sizePerc < 0) {
      sizePerc *= 100
    }
    const res: string[] = []
    for (const dat of imgFiles) {
      const b64img: string = await this.getChartGeneric(
        dat.title,
        dat.path,
        dataq,
        dat.key,
        dat.labelKey
      )
      res.push(
        `<!--<img style="width: ${sizePerc}%" title="${dat.title}" src="${dat.path.replace(/output./, '')}">-->`
      )
      // const b64img: string = fs.readFileSync(dat.path, { encoding: "base64" });
      res.push(
        `<img style="width: ${sizePerc}%" title="${dat.title}" src="data:image/png;base64,${b64img}">`
      )
    }
    return res.join('')
  }

  private averageOBjects<T>(objects: T[], includeKeys: string[]): T {
    const result: any = {}

    objects.forEach((obj: any) => {
      Object.keys(obj).forEach(key => {
        if (Array.isArray(obj[key])) {
          result[key] = this.averageOBjects(obj[key], includeKeys)
        } else if (result[key] === undefined) {
          result[key] = obj[key]
        } else {
          if (typeof obj[key] === 'number') {
            result[key] += obj[key]
          }
        }
      })
    })

    Object.keys(result).forEach(key => {
      if (typeof result[key] === 'number' && includeKeys.includes(key)) {
        result[key] /= objects.length
      }
    })

    return result as T
  }

  private getStatsHTML(
    stats: IStatResult,
    statsEstimate: IStatResult,
    veloccity: IVelocity
  ): string {
    return `<table class="table table-striped-columns" style="width: 25%">
			<thead></thead>
			<tbody>
				<tr>
					<td>Velocity: </td>
					<td>${veloccity.velocityIssue.toFixed(2)}</td>
				</tr>
				<tr>
					<td>Velocity estimate: </td>
					<td>${veloccity.velocityEstimate.toFixed(2)}</td>
				</tr>
				<tr>
					<td>Average day per issue: </td>
					<td>${stats.average.toFixed(2)}</td>
				</tr>
				<tr>
					<td>Median day per issue: </td>
					<td>${stats.median}</td>
				</tr>
				<tr>
					<td>Average day per estimate: </td>
					<td>${statsEstimate.average.toFixed(2)}</td>
				</tr>
				<tr>
					<td>Median day per estimate: </td>
					<td>${statsEstimate.median}</td>
				</tr>
			</tbody>
		</table>`
  }

  private averageUsers(users: IPrUser[]): IPrUser[] {
    const uu: IPrUser[] = users.reduce((res: IPrUser[], us: IPrUser) => {
      // const others = all.filter(a => a.user === us.user);
      // return  {
      // 	user:
      // } as IPrUser;
      const existing = res.find(a => a.user === us.user)
      if (!existing) {
        res.push(Object.assign({}, us))
      } else {
        existing.created += us.created
        existing.shouldReviewCount += us.shouldReviewCount
        existing.didReviewCount += us.didReviewCount
        existing.totalCommits += us.totalCommits
        existing.totalCommitsPerWeek += us.totalCommitsPerWeek
      }
      return res
    }, [])

    const totalCreated = uu.reduce(
      (res: number, it: IPrUser) => res + it.created,
      0
    )
    uu.forEach((u: IPrUser) => {
      const othersCreated = totalCreated - u.created

      u.createdPerc = Number((u.created / totalCreated).toFixed(2))
      u.reviewedPerc = Number((u.didReviewCount / othersCreated).toFixed(2))
    })
    return uu
  }

  private async getGithubData(repos: string[]): Promise<any> {
    const allD: ICheckPr[] = []
    for (const repo of repos) {
      const d = (await reviewer_call
        .check_prs(repo, this._config)
        .catch((err: Error) => {
          console.error(err.message)
          return {
            summary: [],
            users: []
          }
        })) as ICheckPr
      allD.push(d)
    }

    // @ts-ignore
    const prUsers: IPrUser[] = [].concat(
      // @ts-ignore
      ...allD.map((ad: ICheckPr) => ad.users)
    )

    // @ts-ignore
    const users: string[] = Array.from(
      new Set(
        [].concat(
          // @ts-ignore
          ...allD.map((f: ICheckPr) => f.users.map((au: IPrUser) => au.user))
        )
      )
    )
    const usersAvg = users.reduce(
      (res: any, us: string) => {
        // @ts-ignore
        const prUs: IPrUser[] = prUsers.filter((u: IPrUser) => u.user === us)

        const av: IPrUser = this.averageOBjects(prUs, [
          'reviewedPerc',
          'createdPerc'
        ])
        // const avz: IPrUser[] = this.averageUsers(prUs);
        // const av: IPrUser = avz[0];

        // console.log(av);
        res.users.push(av)

        const sbumaroes: ISummary[] = []
          // @ts-ignore
          .concat(...allD.map(a => a.summary))
          .filter((u: ISummary) => u.author === us)
        res.summary.push(...sbumaroes)

        return res
      },
      { users: [], summary: [] }
    )

    const newAllD: ICheckPr = Object.assign({}, allD[0])
    // newAllD.users = usersAvg.users;
    newAllD.users = this.averageUsers(usersAvg.users)
    newAllD.summary = usersAvg.summary

    // TODO year commit

    // const d: ICheckPr = newAllD;
    //
    // // const tb = this.averageOBjects(d.users, ["reviewedPerc", "createdPerc"]);
    // const dUsers: IPrUser[] = this.averageUsers(d.users);

    return Promise.resolve({ allD, newAllD })
  }

  private addRepoProps(item: ISarchIssuesByPipeline): ISarchIssuesByPipeline {
    const clone = Object.assign({}, item)
    clone.nodes = this.addRepoPropsToIssues(clone.nodes)
    return clone
  }

  private getRepoAndOwnerFromURL(
    htmlUrl: string
  ): [string, string, string] | null {
    if (!htmlUrl) {
      return null
    }
    const bits = htmlUrl.split('/')
    if (bits.length !== 7) {
      return null
    }
    return [bits[4], bits[3], bits[6]]
  }

  private addRepoPropsToIssues(nodes: Issue[]): Issue[] {
    return nodes.map((issue: Issue) => {
      const res: [string, string, string] | null = this.getRepoAndOwnerFromURL(
        issue.htmlUrl
      )
      issue.repository.name = res ? res[0] : ''
      issue.repository.ownerName = res ? res[1] : ''
      issue.number = res ? Number(res[2]) : 0

      return issue
    })
  }

  private getHeadersSorted(strings: string[]): string[] {
    const target = strings.find((str: string) => str === 'number')
    if (target === undefined) {
      return strings
    }

    return [target].concat(strings.filter(s => s !== target))
  }

  protected getSumPerc(
    avg: IAVGItemMap,
    daysSum: number,
    pipelineIndex: number,
    toPipelineIndex: number
  ): number {
    if(daysSum === 0) {
      return 0
    }
    let days = 0
    for (
      let pipelineI = pipelineIndex;
      pipelineI < toPipelineIndex;
      ++pipelineI
    ) {
      const currentPipeline = this._pipelines[pipelineI]
      const vals = avg[currentPipeline]
      if (vals) {
        console.log(`1 - Adding pipeline ${currentPipeline}`)
        days += vals.data.durationAverage
      } else {
        console.log(`2 - Adding pipeline ${currentPipeline}`)
      }
    }

    return days / daysSum
  }

  protected getOpenedPerPipeline(
    avg: IAVGItemMap,
    openedPipelines: string[],
    remainingOpenedIssues: IIssue[],
    stats: IStatResult
  ): IOpenedPerPipeline[] {
    const fromPipelineIndex = this._pipelines.indexOf(
      this._config.fromPipeline!
    )
    const toPipelineIndex = this._pipelines.indexOf(this._config.toPipeline!)

    const totalMsAverageFromPipelineToPipeline = this.getTotalMsAverageFromPipelineToPipeline(avg, fromPipelineIndex, toPipelineIndex)
    console.log('')

    let openedTotals = 0
    let estimatedDays = 0

    const openedPerPipeline = openedPipelines
      .map((pipeline: string) => {
        const currentFromPipelineIndex = this._pipelines.indexOf(pipeline)

        const estimatedMsAvg = this.getSumPerc(
          avg,
          totalMsAverageFromPipelineToPipeline,
          currentFromPipelineIndex,
          toPipelineIndex
        )
        const openedCount = remainingOpenedIssues.filter(
          r => r.pipelineName === pipeline
        ).length

        const estimatedCompletionDaysVal =
          openedCount * estimatedMsAvg * stats.average
        const estimatedCompletionDays = Number(
          estimatedCompletionDaysVal.toFixed(2)
        )

        openedTotals += openedCount
        estimatedDays += estimatedCompletionDaysVal

        return {
          pipeline,
          opened: openedCount,
          estimatedCompletionDays
        }
      })
      .concat([
        {
          pipeline: '',
          opened: openedTotals,
          estimatedCompletionDays: Number(estimatedDays.toFixed(2))
        }
      ])

    return openedPerPipeline
  }

  /**
   * Gets total ms needed to go from pipeline to pipeline
   * @param avg
   * @param fromPipelineIndex
   * @param toPipelineIndex
   * @protected
   */
  protected getTotalMsAverageFromPipelineToPipeline(
    avg: IAVGItemMap,
    fromPipelineIndex: number,
    toPipelineIndex: number
  ): number {
    return Object.keys(avg).reduce((res: number, ke: string) => {
      const currentIndex = this._pipelines.indexOf(ke)
      if (currentIndex >= fromPipelineIndex && currentIndex < toPipelineIndex) {
        console.log(`Adding pipeline ${ke}`)
        res += avg[ke].data.durationAverage
      }
      return res
    }, 0)
  }
}
