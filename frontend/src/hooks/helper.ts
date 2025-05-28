export const axiosErrorMessage = (error: any, errorMsg?: string) => {
  let errMsg = ''

  if (error?.response) {
    errMsg =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.response?.data ||
      error?.response?.statusText
  } else if (error instanceof Error) {
    errMsg = error?.message
  } else {
    errMsg = errorMsg || 'Unknown error'
  }

  return errMsg
}
