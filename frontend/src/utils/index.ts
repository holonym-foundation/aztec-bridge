export const truncateDecimals = (
  value: number | string,
  decimals = 6
): number => {
  const [integerPart, decimalPart] = value.toString().split('.')

  return parseFloat(
    `${integerPart}.${decimalPart?.slice(0, decimals) || '0000'}`
  )
}

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))