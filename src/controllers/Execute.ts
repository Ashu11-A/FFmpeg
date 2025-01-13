import { spawn } from 'child_process'

/**
 * Executa o binário ffmpeg com os parâmetros fornecidos
 * @param ffmpegPath Caminho para o executável do ffmpeg
 * @param args Argumentos para o ffmpeg
 * @returns Uma Promise que resolve com o output do terminal
 */
export async function executeFFmpeg(ffmpegPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, args)

    let output = ''
    let errorOutput = ''

    // Captura o stdout (saída padrão)
    process.stdout.on('data', (data) => {
      output += data.toString()
    })

    // Captura o stderr (saída de erro)
    process.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    // Lida com o término do processo
    process.on('close', (code) => {
      if (code === 0) {
        resolve(output)
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}. Error: ${errorOutput}`))
      }
    })

    // Lida com erros inesperados
    process.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg process. Error: ${err.message}`))
    })
  })
}
