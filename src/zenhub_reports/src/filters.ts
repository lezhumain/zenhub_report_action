import { IGhEvent, IIssue, Utils } from './models'
import { IMainConfig } from './zenhub_call'

export class IssueFilter {
  constructor(private readonly _config: IMainConfig) {}

  filterIssues = async (issue: IIssue): Promise<boolean> => {
    const matchesLabel: boolean =
      this._config.labels !== undefined &&
      this._config.labels.some((l: string) => {
        const low = l.toLowerCase()
        return (
          issue.labels !== undefined &&
          issue.labels.map((la: string) => la.toLowerCase()).includes(low)
        )
      })

    const idShouldSkip = !!this._config.issuesToSkip?.includes(
      Utils.issueNumberAsNumber(issue.number)
    )
    const skip = !matchesLabel && idShouldSkip
    return Promise.resolve(skip)
  }

  filterEvents = async (event: IGhEvent): Promise<boolean> => {
    if (!this._config.minDate || !this._config.maxDate) {
      return Promise.resolve(false)
    }

    const minDate: Date | undefined = new Date(this._config.minDate)
    const maxDate: Date | undefined = new Date(this._config.maxDate)

    const eventDate: Date = new Date(event.createdAt)
    const skip: boolean =
      (minDate !== undefined && eventDate.getTime() < minDate.getTime()) ||
      (maxDate !== undefined && eventDate.getTime() > maxDate.getTime())

    return Promise.resolve(skip)
  }
}
