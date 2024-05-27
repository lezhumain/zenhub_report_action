import * as fs from 'fs'
import { ChartJSNodeCanvas } from 'chartjs-node-canvas'
import { ChartJSNodeCanvasOptions } from 'chartjs-node-canvas/src'
import {
  ChartConfiguration,
  ChartData,
  BubbleDataPoint,
  ScatterDataPoint
} from 'chart.js'
import { IBubbleData, Utils } from './models'

export interface ISizeObj {
  width: number
  height: number
}

export interface IChartItem {
  label: string
  data: number
}

export class ChartHelper {
  private static _colorCache: { [key: string]: string } = {}
  private static _chartCallback = (ChartJS: any) => {
    const obj = { responsive: true, maintainAspectRatio: false }
    if (ChartJS.defaults.global === undefined) {
      ChartJS.defaults.global = obj
    } else {
      Object.assign(ChartJS.defaults.global, obj)
    }
  }
  private static _chartOptions: ChartJSNodeCanvasOptions = {
    width: 1600,
    height: 1200,
    chartCallback: ChartHelper._chartCallback
  }
  private static _chartConfig: ChartConfiguration = {
    type: '' as any,
    data: {
      labels: [],
      datasets: [
        {
          label: '',
          data: [],
          backgroundColor: ''
        }
      ]
    },
    plugins: [
      {
        id: 'background-colour',
        beforeDraw: (chart: any) => {
          const ctx = chart.ctx
          ctx.save()
          ctx.fillStyle = 'lightgrey'
          ctx.fillRect(
            0,
            0,
            ChartHelper._chartOptions.width,
            ChartHelper._chartOptions.height
          )
          ctx.restore()
        }
      }
    ],
    options: {
      plugins: {
        title: {
          display: true,
          text: ''
        }
      }
    }
  }

  private static getCanv(
    chartOptions?: ChartJSNodeCanvasOptions
  ): ChartJSNodeCanvas {
    return new ChartJSNodeCanvas(chartOptions || ChartHelper._chartOptions)
  }

  /**
   * Generate chart image file from list
   * @param title
   * @param chartItems
   * @param outputFile
   * @param sizeObj
   */
  static async generateChartFromObj(
    title: string,
    chartItems: IChartItem[],
    outputFile: string,
    sizeObj: ISizeObj
  ): Promise<string> {
    const data0: number[] = chartItems.map(e => e.data)
    const sum: number = data0.reduce(
      (res: number, item: number) => res + item,
      0
    )
    const labels: string[] = chartItems.map(
      e => `${e.label} (${((e.data * 100) / sum).toFixed(1)}%)`
    )

    return ChartHelper.generateChart(title, data0, labels, outputFile, sizeObj)
  }

  /**
   * Generate chart image file from data and label list
   * @param title
   * @param dataList
   * @param labelList
   * @param outputFile
   * @param sizeObj
   */
  static async generateChart(
    title: string,
    dataList: number[],
    labelList: string[],
    outputFile: string,
    sizeObj: ISizeObj
  ): Promise<string> {
    // Create a new instance of ChartJSNodeCanvas
    // const chartCallback = (ChartJS: any) => {
    // 	const obj = { responsive: true, maintainAspectRatio: false };
    // 	if (ChartJS.defaults.global === undefined) {
    // 		ChartJS.defaults.global = obj;
    // 	} else {
    // 		Object.assign(ChartJS.defaults.global, obj);
    // 	}
    // };

    // const chartOptions: ChartJSNodeCanvasOptions = { ...sizeObj, chartCallback };

    return this.doGenerate(
      title,
      ChartHelper._chartOptions,
      labelList,
      dataList,
      outputFile
    )
  }

  private static getColors(dataList: string[]): string[] {
    // @ts-ignore
    return dataList.map(pKey => {
      const d = pKey.replace(/ \(\d+(\.\d+)?%\)$/g, '')
      let cached = this._colorCache[d]
      if (!cached) {
        this._colorCache[d] = this.getRandomColor()
        cached = this._colorCache[d]
      }

      return cached
    })
  }

  private static getRandomColor() {
    const randomNumber = Math.floor(Math.random() * 16777215) // Generates a random number up to FFFFFF in hexadecimal
    const hexNumber = randomNumber.toString(16) // Convert the random number to hexadecimal
    return `#${hexNumber}`
  }

  static async generateScatterChart(
    myTitle: string,
    values: (null | number | BubbleDataPoint | ScatterDataPoint)[],
    labels: string[],
    outputFile: string,
    bubbleBaseWith = 3
  ): Promise<string> {
    // const chartCallback = (ChartJS: any) => {
    // 	const obj = { responsive: true, maintainAspectRatio: false };
    // 	if (ChartJS.defaults.global === undefined) {
    // 		ChartJS.defaults.global = obj;
    // 	} else {
    // 		Object.assign(ChartJS.defaults.global, obj);
    // 	}
    // };
    //
    // const chartOptions: ChartJSNodeCanvasOptions = { width: 1600, height: 1200, chartCallback };
    // const chartJSNodeCanvas = new ChartJSNodeCanvas(chartOptions);

    const bubbleValues = values as BubbleDataPoint[]

    const xData: number[] = Array.from(
      new Set(bubbleValues.map(b => Math.trunc(Utils.getMsAsDays(b.x))))
    )

    const lineData: BubbleDataPoint[] = xData.reduce(
      (res: any[], xValue: number) => {
        const allSameX: BubbleDataPoint[] = bubbleValues.filter(
          d => Math.trunc(Utils.getMsAsDays(d.x)) === xValue
        )
        res.push({
          x: Utils.getDaysAsMs(xValue),
          y: allSameX.reduce(
            (res: number, item: BubbleDataPoint) => res + item.y,
            0
          ),
          r: allSameX.reduce(
            (res: number, item: BubbleDataPoint) => res + item.r,
            0
          )
        } as BubbleDataPoint)
        return res
      },
      []
    ) as BubbleDataPoint[]

    const lineDataEstimate: ScatterDataPoint[] = lineData.map(e => {
      return {
        x: e.x,
        y: e.r
      } as ScatterDataPoint
    })

    bubbleValues.forEach((v: BubbleDataPoint) => {
      v.r = v.r * bubbleBaseWith
    })

    const data: ChartConfiguration = Object.assign({}, ChartHelper._chartConfig)
    data.type = 'bubble'
    data.data.labels = labels
    data.data.datasets = [
      {
        label: 'My First Dataset',
        data: bubbleValues,
        backgroundColor: this.getBubbleColors(values as any[]),
        // backgroundColor: this.getColors(bubbleValues.map(v => v.x.toString())),
        order: 3
      },
      {
        label: 'Completion time each day',
        data: lineData,
        type: 'line',
        order: 2,
        borderColor: 'blue'
      },
      {
        label: 'Completed estimates each day',
        data: lineDataEstimate,
        type: 'line',
        order: 1, // this dataset is drawn on top
        borderColor: 'orange'
      }
    ]
    data.options = {
      plugins: {
        title: {
          display: true,
          text: myTitle
        }
      }
    }

    const chartJSNodeCanvas: ChartJSNodeCanvas = ChartHelper.getCanv()

    // Define chart data
    // const data: ChartConfiguration = {
    // 	type: "bubble",
    // 	data: {
    // 		labels: labels,
    // 		datasets: [
    // 			{
    // 				label: 'My First Dataset',
    // 				data: bubbleValues,
    // 				// backgroundColor: this.getBubbleColors(values as any[]),
    // 				backgroundColor: this.getColors(bubbleValues.map(v => v.x.toString())),
    // 				order: 1 // this dataset is drawn on top
    // 			},
    // 			{
    // 				label: 'Completion time each day',
    // 				data: lineData,
    // 				type: 'line',
    // 				order: 2,
    // 				borderColor: "blue"
    // 			},
    // 			{
    // 				label: 'Completed estimates each day',
    // 				data: lineDataEstimate,
    // 				type: 'line',
    // 				order: 3,
    // 				borderColor: "orange"
    // 			}
    // 		]
    // 	},
    // 	plugins: [
    // 		{
    // 			id: 'background-colour',
    // 			beforeDraw: (chart: any) => {
    // 				const ctx = chart.ctx;
    // 				ctx.save();
    // 				ctx.fillStyle = 'lightgrey';
    // 				ctx.fillRect(0, 0, chartOptions.width, chartOptions.height);
    // 				ctx.restore();
    // 			}
    // 		}
    // 	],
    // 	options: {
    // 		plugins: {
    // 			title: {
    // 				display: true,
    // 				text: myTitle
    // 			}
    // 		}
    // 	}
    // };

    const buffer = await chartJSNodeCanvas.renderToBuffer(data)
    fs.writeFileSync(outputFile, buffer, 'base64')

    return Promise.resolve(buffer.toString('base64'))
  }

  private static async doGenerate(
    title: string,
    chartOptions: ChartJSNodeCanvasOptions,
    labelList: string[],
    dataList: any[],
    outputFile: string
  ): Promise<string> {
    const chartJSNodeCanvas: ChartJSNodeCanvas = ChartHelper.getCanv(
      ChartHelper._chartOptions
    )
    const conf: ChartConfiguration = Object.assign({}, ChartHelper._chartConfig)
    conf.type = 'polarArea'
    conf.data.labels = labelList
    conf.data.datasets[0].data = dataList
    conf.data.datasets[0].backgroundColor = ChartHelper.getColors(labelList)
    conf.options = {
      plugins: {
        title: {
          display: true,
          text: title
        }
      }
    }

    // Define chart data
    const buffer = await chartJSNodeCanvas.renderToBuffer(conf)
    fs.writeFileSync(outputFile, buffer, 'base64')

    return Promise.resolve(buffer.toString('base64'))
  }

  static interpolateColor(
    fromColor: [number, number, number],
    toColor: [number, number, number],
    weight: number
  ) {
    const r = Math.round(fromColor[0] * (1 - weight) + toColor[0] * weight)
    const g = Math.round(fromColor[1] * (1 - weight) + toColor[1] * weight)
    const b = Math.round(fromColor[2] * (1 - weight) + toColor[2] * weight)
    return `rgb(${r}, ${g}, ${b})`
  }

  private static getBubbleColors(values: BubbleDataPoint[]) {
    const max = Math.max(...values.map(v => v.r))
    // const max = 13;

    const green: [number, number, number] = [0, 255, 0]
    const red: [number, number, number] = [255, 0, 0]

    return values.map(v =>
      ChartHelper.interpolateColor(green, red, Math.trunc(v.r / max))
    )
  }
}
