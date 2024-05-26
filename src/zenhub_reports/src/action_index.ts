// const core = require('@actions/core');
// const github = require('@actions/github');
import { IMainConfig, Program } from './zenhub_call'
import { IIssue } from './models'

const config: IMainConfig = {
  workspaceId: '5e3018c2d1715f5725d0b8c7',
  outputJsonFilename: 'output/allEvs.json',
  outputImageFilename: `output/output_average.png`,
  minDate: '2024-04-18',
  maxDate: '2024-05-18',
  labels: ['regression'],
  skipRepos: [93615076],
  includeRepos: [232779486, 409231566],
  issuesToSkip: [],
  fromPipeline: 'Backlog',
  toPipeline: 'Awaiting TESS Review',
  maxCount: 5,
  release: ''
}

const program = new Program(config)
// skip ReBrowse
program
  .main(
    (issue: IIssue) => {
      const matchesLabel: boolean =
        config.labels !== undefined &&
        config.labels.some(l => {
          const low = l.toLowerCase()
          return (
            issue.labels !== undefined &&
            issue.labels.map(la => la.toLowerCase()).includes(low)
          )
        })
      const idShouldSkip: boolean = !!config.issuesToSkip?.includes(
        issue.number
      )

      const skip = !matchesLabel && idShouldSkip
      return Promise.resolve(skip)
    },
    (event: any) => {
      if (!config.minDate || !config.maxDate) {
        return Promise.resolve(false)
      }

      const minDate: Date | undefined = new Date(config.minDate)
      const maxDate: Date | undefined = new Date(config.maxDate)

      const eventDate: Date = new Date(event.createdAt)
      const skip: boolean =
        (minDate !== undefined && eventDate.getTime() < minDate.getTime()) ||
        (maxDate !== undefined && eventDate.getTime() > maxDate.getTime())

      return Promise.resolve(skip)
    }
  )
  .then((obj: any) => {
    // core.setOutput("markdownContent", obj.mark);
    console.log('Done')
  })
  .catch(err => {
    // core.setFailed(err.message);
    throw err
  })
