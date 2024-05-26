import xlsx from 'node-xlsx'
import * as fs from 'node:fs'
// import asposeCells from "aspose.cells";

export class ExcelHelper {
  static readExcel(file: string) {
    // const xlsx = require('node-xlsx');
    const obj = xlsx.parse(__dirname + file) // parses a file
    return obj
  }
}

// noinspection ES6ConvertRequireIntoImport
const ExcelJS = require('exceljs')

async function main() {
  const baseFile = 'main_report.xltx'

  const wb = new ExcelJS.Workbook()

  await wb.xlsx.readFile(baseFile)

  const ws = wb.getWorksheet(1)

  const data = [
    {
      id: 1,
      urlImagen: 'http://placeimg.com/640/480',
      name: 'test national',
      pdu: '53014',
      creationDate: 2020,
      appevel: 'ascending',
      ddlevel: 'descending',
      mapa: 1,
      Module: 'Lead',
      sector: 'Something'
    }
  ]

  // loop and write data
  for (const [rowNum, inputData] of data.entries()) {
    console.log('row: ', rowNum, ', data', inputData)

    // increment rowNum to change the row start position if needed
    // for example, start at 5th row:
    // const row = ws.getRow(rowNum+6);
    const row = ws.getRow(rowNum + 1)

    // insert values
    row.getCell(1).value = inputData.pdu
    row.getCell(2).value = inputData.name
    row.getCell(3).value = inputData.appevel

    row.commit()
  }

  const fileName = 'excel0.xlsx'
  wb.xlsx.writeFile(fileName)
}

main()
