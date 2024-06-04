import {
  IAVGData,
  IAVGItem,
  IAVGItemMap,
  IOpenedPerPipeline,
  Program
} from '../src/zenhub_reports/src/zenhub_call'
import { IIssue, IStatResult, Utils } from '../src/zenhub_reports/src/models'
import { IMainConfig, mainConfig } from '../src/zenhub_reports/src/main_conf'

class ProgramMock extends Program {
  constructor(conf: IMainConfig) {
    super(conf)
    this._pipelines = ['New', 'Done']
  }

  getSumPerc(
    avg: IAVGItemMap,
    daysSum: number,
    pipelineIndex: number,
    toPipelineIndex: number
  ): number {
    return super.getSumPerc(avg, daysSum, pipelineIndex, toPipelineIndex)
  }

  getOpenedPerPipeline(
    avg: IAVGItemMap,
    openedPipelines: string[],
    remainingOpenedIssues: IIssue[],
    stats: IStatResult
  ): IOpenedPerPipeline[] {
    return super.getOpenedPerPipeline(
      avg,
      openedPipelines,
      remainingOpenedIssues,
      stats
    )
  }

  getTotalMsAverageFromPipelineToPipeline(
    avg: IAVGItemMap,
    fromPipelineIndex: number,
    toPipelineIndex: number
  ): number {
    return super.getTotalMsAverageFromPipelineToPipeline(
      avg,
      fromPipelineIndex,
      toPipelineIndex
    )
  }

  getTotalMsAverageFromPipelineToPipelineFromConf(avg: IAVGItemMap): number {
    const fromPipelineIndex = this._pipelines.indexOf(
      this._config.fromPipeline!
    )
    const toPipelineIndex = this._pipelines.indexOf(this._config.toPipeline!)
    return super.getTotalMsAverageFromPipelineToPipeline(
      avg,
      fromPipelineIndex,
      toPipelineIndex
    )
  }
}

describe('action', () => {
  let prog: ProgramMock

  beforeEach(() => {
    const mainConf = mainConfig
    mainConf.workspaceId = 'ae'
    mainConf.fromPipeline = 'New'
    mainConf.toPipeline = 'Done'

    prog = new ProgramMock(mainConf)
  })

  function testDays(
    avg: IAVGItemMap,
    fromIndex: number,
    toIndex: number
  ): void {
    const avgMs: number = avg[Object.keys(avg)[0]].data.durationAverage
    const daySym: number = prog.getTotalMsAverageFromPipelineToPipeline(
      avg,
      fromIndex,
      toIndex
    )
    expect(daySym).toEqual(avgMs * (toIndex - fromIndex))
  }

  it('can get days', async () => {
    const durationDays = 2
    const count = 2
    const duration = Utils.getDaysAsMs(durationDays)

    const avg: IAVGItemMap = {
      New: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Done: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem
    } as IAVGItemMap

    testDays(avg, 0, 1)
  })

  it('can get days 1', async () => {
    const durationDays = 2
    const count = 2
    const duration = Utils.getDaysAsMs(durationDays)

    const avg: IAVGItemMap = {
      New: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Doing: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Done: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem
    } as IAVGItemMap

    testDays(avg, 0, 1)
  })

  it('can get days 2', async () => {
    const durationDays = 2
    const count = 2
    const duration = Utils.getDaysAsMs(durationDays)

    const avg: IAVGItemMap = {
      New: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Doing: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Done: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem
    } as IAVGItemMap

    testDays(avg, 0, 2)
  })

  it('can get days from conf', async () => {
    const durationDays = 2
    const count = 2
    const duration = Utils.getDaysAsMs(durationDays)

    const avg: IAVGItemMap = {
      New: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Done: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem
    } as IAVGItemMap

    const daySym: number =
      prog.getTotalMsAverageFromPipelineToPipelineFromConf(avg)
    expect(daySym).toEqual(duration / 2)
  })

  it('can get sum perc 0', async () => {
    const durationDays = 2
    const count = 2
    const duration = Utils.getDaysAsMs(durationDays)

    const avg: IAVGItemMap = {
      Done: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem
    } as IAVGItemMap

    const perc: number = prog.getSumPerc(avg, 2, 0, 0)
    expect(perc).toEqual(0)
  })

  it('can get sum perc more than 0', async () => {
    const durationDays = 2
    const count = 2
    const duration = Utils.getDaysAsMs(durationDays)

    const avg: IAVGItemMap = {
      New: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Done: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem
    } as IAVGItemMap

    const sum: number = prog.getTotalMsAverageFromPipelineToPipeline(avg, 0, 1)
    const perc: number = prog.getSumPerc(avg, sum, 0, 1)

    expect(perc).toEqual(1)
  })

  it('can get sum perc more than 0 again', async () => {
    const durationDays = 2
    const count = 2
    const duration = Utils.getDaysAsMs(durationDays)

    const avg: IAVGItemMap = {
      New: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Doing: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Done: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem
    } as IAVGItemMap

    prog['_pipelines'] = ['New', 'Doing', 'Done']
    const sum: number = prog.getTotalMsAverageFromPipelineToPipeline(avg, 0, 1) // total sum
    const perc: number = prog.getSumPerc(avg, sum, 0, 1)

    expect(perc).toEqual(1)
  })

  it('can get sum perc more than 1', async () => {
    const durationDays = 2
    const count = 2
    const duration = Utils.getDaysAsMs(durationDays)

    const avg: IAVGItemMap = {
      New: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Doing: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Done: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem
    } as IAVGItemMap

    prog['_pipelines'] = ['New', 'Doing', 'Done']

    const sum: number = prog.getTotalMsAverageFromPipelineToPipeline(avg, 0, 2) // total sum
    const perc: number = prog.getSumPerc(avg, sum, 0, 2)

    expect(perc).toEqual(1)
  })

  it('can get sum perc more than les pipelines', async () => {
    const durationDays = 2
    const count = 2
    const duration = Utils.getDaysAsMs(durationDays)

    const avg: IAVGItemMap = {
      New: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Doing: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Done: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem
    } as IAVGItemMap

    prog['_pipelines'] = ['New', 'Doing', 'Done']

    const sum: number = prog.getTotalMsAverageFromPipelineToPipeline(avg, 0, 2) // total sum
    const perc: number = prog.getSumPerc(avg, sum, 1, 2)

    expect(perc).toEqual(0.5)
  })

  it('works with empty pipeline list', async () => {
    const durationDays = 2
    const count = 2
    const duration = Utils.getDaysAsMs(durationDays)

    const avg: IAVGItemMap = {
      Done: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem
    } as IAVGItemMap

    const sum: number = prog.getTotalMsAverageFromPipelineToPipeline(avg, 0, 1)
    const perc: number = prog.getSumPerc(avg, sum, 0, 1)
    expect(perc).toEqual(0)
  })

  it('works with pipeline list', async () => {
    const durationDays = 2
    const count = 2
    const duration = Utils.getDaysAsMs(durationDays)

    const avg: IAVGItemMap = {
      New: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Doing: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem,
      Done: {
        issueCount: 2,
        openedIssueCount: 0,
        data: {
          durationDays,
          duration,
          durationAverage: duration / count,
          durationAverageString: '',
          durationString: '',
          count: 2
        } as IAVGData
      } as IAVGItem
    } as IAVGItemMap

    let sum: number = prog.getTotalMsAverageFromPipelineToPipeline(avg, 0, 1)
    let perc: number = prog.getSumPerc(avg, sum, 0, 1)
    expect(perc).toEqual(1)

    sum = prog.getTotalMsAverageFromPipelineToPipeline(avg, 0, 2)
    perc = prog.getSumPerc(avg, sum, 0, 2)
    expect(perc).toEqual(1)

    sum = prog.getTotalMsAverageFromPipelineToPipeline(avg, 0, 2)
    perc = prog.getSumPerc(avg, sum, 1, 2)
    expect(perc).toEqual(0.5)
  })
})
