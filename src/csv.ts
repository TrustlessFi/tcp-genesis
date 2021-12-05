import fs from "fs";
import readline from "readline";

async function* _readLines(file: fs.PathLike) {
  /* reads `file` and returns an async iterator of lines found */
  const lineReader = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of lineReader) {
    yield line;
  }
  lineReader.close();
  lineReader.removeAllListeners();
}

type CsvData<Values extends string[]> = {
  [key in Values[number]]: string;
};
export async function* readCsvFile<Header extends string>(
  headers: Header[],
  csvFile: fs.PathLike
): AsyncGenerator<CsvData<typeof headers>> {
  const iter = _readLines(csvFile);

  // parse headers
  const headerLine = (await iter.next()).value;
  if (!headerLine) throw new Error(`headers not found: ${csvFile}`);
  const headerMap = headerLine
    // split first line by comma
    .split(",")
    // map each header as a [header, index] tuple
    .map((header, index) => [headerLine.trim(), index] as [string, number])
    // create a map of headers to csv columns
    .reduce((previous, [header, index]) => {
      // ignore if header is not part of input headers
      if (headers.indexOf(header as any) < 0) return previous;

      // due to above check, can safely cast
      previous[index] = header as keyof Header;
      return previous;
    }, {} as { [key: number]: keyof Header });

  // parse lines
  for await (const line of iter) {
    const data = {} as { [key in typeof headers[number]]: string };
    line.split(",").map((value, index) => {
      // ignore values that aren't part of header input
      const header = headerMap[index];
      if (!header) return;

      // due to above check, can safely cast
      data[header as Header] = value;
    });
    yield data;
  }
}
