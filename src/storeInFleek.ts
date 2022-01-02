import * as fs from 'fs'
import fleekStorage from '@fleekhq/fleek-storage-js'


interface fleekApiKeys {
  apiKey: string
  apiSecret: string
}

interface storeInFleekOptions {
  fleekApiKeysFile: string
  file: string
}
export const storeInFleek = async (options: storeInFleekOptions) => {
  const { fleekApiKeysFile, file } = options

  // ensure file paths exist
  for (const path of [fleekApiKeysFile, file]) {
    if (!fs.existsSync(path)) {
      throw new Error(`file not found: ${path}`)
    }
  }

  const apiKeys = JSON.parse(fs.readFileSync(fleekApiKeysFile).toString()) as fleekApiKeys

  fs.readFile(file, async (error, fileData) => {
    if (error !== null) throw error

    const fileHash = await fleekStorage.upload({
      ...apiKeys,
      key: file,
      data: fileData,
    })

    console.info({fileHash})
  })
}
