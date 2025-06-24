export function filterDateBetweenConfig(
  date0: string,
  minDate?: string,
  maxDate?: string
): boolean {
  const date1 = new Date(date0)
  const epoch = date1.getTime()
  const minOk = minDate === undefined || epoch >= new Date(minDate).getTime()
  const maxOk = maxDate === undefined || epoch <= new Date(maxDate).getTime()
  return minOk && maxOk
}
