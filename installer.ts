import { xz } from '@napi-rs/lzma'
import { createReadStream, existsSync } from 'fs'
import { chmod, mkdir, readdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import * as tar from 'tar-stream'
import unzipper from 'unzipper'

const path = join(process.cwd(), 'binary')
await mkdir(path, { recursive: true })

async function decompress(fileName: string, dirPath: string, buffer: Uint8Array) {
  const fileType = fileName.split('.').pop()

  if (fileType === 'xz') {
    const decompressor = await xz.decompress(buffer)
    const output = join(dirPath, 'buffer.tar')

    await writeFile(output, new Uint8Array(decompressor), { encoding: 'binary' })

    const stream = createReadStream(output)
    const extract = tar.extract()
    stream.pipe(extract)
    
    extract.on('entry', (header, stream, next) => {
      const chunks: Uint8Array[] = []
      if (header.type === 'directory') {
        next()
        return
      }
        
      stream.on('data', (chunk) => chunks.push(new Uint8Array(chunk)))
      stream.on('end', async () => {
        const buffer = Buffer.concat(chunks) // Concatena todos os pedaços em um único buffer
        const outputPath = join(dirPath, header.name)

        if (!existsSync(dirname(outputPath))) await mkdir(dirname(outputPath), { recursive: true, mode: 0o777  })
        await writeFile(outputPath, new Uint8Array(buffer))
        await chmod(outputPath, 0o777)
          
        console.log(`Arquivo: ${outputPath}, Tamanho: ${buffer.length} bytes`)
        next()
      })
      
      stream.resume() // Garantir que o stream é consumido
    })
    await new Promise((resolve, reject) => {
      extract.on('finish', () =>  resolve(true))
      extract.on('error', (error) =>  reject(error))
    })

    await rm(output)
    return
  }
      
      
  switch (fileType) {
  case 'zip': {
    const content = await unzipper.Open.file(fileName)
    await content.extract({ path: dirPath })
    break
  }
  default:
    throw new Error(`Unsupported file type: ${fileType}`)
  }
  if (existsSync(fileName))  await rm(fileName)
}

async function findFolderByPrefix(dirPath: string, prefix: string): Promise<string | undefined> {
  const filesAndFolders = await readdir(dirPath, { withFileTypes: true })
  const matchingFolder = filesAndFolders.find((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
  return matchingFolder ? matchingFolder.name : undefined
}

const arch = process.arch === 'x64' ? '64' : process.arch
const platform = process.platform === 'win32' ? 'win' : process.platform
const fileType = process.platform === 'win32' ? 'zip' : 'tar.xz'
const fileName = `ffmpeg-master-latest-${platform}${arch}-gpl-shared.${fileType}`

const link = `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/${fileName}`
const filePath = join(path, fileName) 

//const data = await readFile(filePath)
const data = await (await fetch(link)).arrayBuffer()
await writeFile(filePath, new Uint8Array(data), { encoding: 'binary', mode: 0o777 })

await decompress(filePath, path, new Uint8Array(data))
const fileNameExtract = await findFolderByPrefix(path, 'ffmpeg-master')

if (fileNameExtract) {
  const source = join(path, fileNameExtract)
  const destination = join(path, 'ffmpeg')
  
  if (existsSync(destination)) await rm(destination, { recursive: true })

  await chmod(source, 0o755)
  await rename(source, destination)
}