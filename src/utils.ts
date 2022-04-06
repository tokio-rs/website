const chunkify = (inputArray: any[], chunkSize: number) => {
  var result = inputArray.reduce((resultArray: any[], item, index) => {
    const chunkIndex = Math.floor(index / chunkSize)

    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = [] // start a new chunk
    }
    resultArray[chunkIndex].push(item)
    return resultArray
  }, [])

  return result
}

export { chunkify }
