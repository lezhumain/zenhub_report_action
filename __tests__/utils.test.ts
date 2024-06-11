/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Unit tests for the action's entrypoint, src/index.ts
 */

import { Utils } from '../src/zenhub_reports/src/models'

describe('index', () => {
  it('should display 1s in human readable time', async () => {
    const millis = 1000 // 1s
    const hum: string = Utils.millisecondsToHumanReadableTime(millis)
    expect(hum).toEqual('00:00:01')
  })

  it('should display 1mn in human readable time', async () => {
    const millis = 1000 * 60
    const hum: string = Utils.millisecondsToHumanReadableTime(millis)
    expect(hum).toEqual('00:01:00')
  })

  it('should display 1hr in human readable time', async () => {
    const millis = 1000 * 60 * 60
    const hum: string = Utils.millisecondsToHumanReadableTime(millis)
    expect(hum).toEqual('01:00:00')
  })

  it('should display milliseconds in human readable time', async () => {
    const millis = 60000
    const hum: string = Utils.millisecondsToHumanReadableTime(millis)

    const d: Date = new Date(millis)

    const strTarget = d
      .toISOString()
      .split('T')[1]
      .replace('Z', '')
      .split('.')[0]

    expect(hum).toEqual(strTarget)
  })

  it('should get ms as days', async () => {
    for (let day = 1; day < 1000; day += 0.1) {
      day = Number(day.toFixed(1))

      const millis = day * 24 * 60 * 60 * 1000

      const targetDay = Utils.getMsAsDays(millis)
      expect(targetDay).toEqual(day)
    }
  })

  it('should get days as ms', async () => {
    for (let day = 1; day < 10000; day++) {
      const millis = day * 24 * 60 * 60 * 1000

      const targetMs = Utils.getDaysAsMs(day)
      expect(targetMs).toEqual(millis)
    }
  })

  it('should add day', async () => {
    const d: Date = new Date('2024-01-01')

    const d1: Date = new Date(d)
    d1.setDate(d1.getDate() + 1)
    expect(d1.getTime()).toEqual(d.getTime() + Utils.getDaysAsMs(1))

    const target: Date = Utils.addDay(d, 1)

    expect(target.getTime()).toEqual(d.getTime() + Utils.getDaysAsMs(1))
    expect(target.toISOString()).toEqual(d1.toISOString())
  })

  it('should get issue number', async () => {
    const issueN = 3
    expect(Utils.issueNumberAsNumber(`#${issueN}`)).toEqual(issueN)
  })

  it('should get bad issue number', async () => {
    expect(isNaN(Utils.issueNumberAsNumber(`xdvfx`))).toEqual(true)
  })

  it('should get issue number string', async () => {
    const issueN = 3
    expect(Utils.issueNumberAsString(issueN)).toEqual(`#${issueN}`)
  })
})
