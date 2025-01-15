import { spawn } from 'child_process'
import { writeFile } from 'fs/promises'
import { EncoderCapabilities } from '../types/encoders'
import { TypedEventEmitter } from './EventEmitter'
import { ffmpegPath } from '../app'

type FFmpegArgs = {
  input?: string
  output?: string
  overwrite?: boolean
  codec?: {
    audio?: EncoderCapabilities['Audio']
    video?: EncoderCapabilities['Video']
  }
  resolution?: `${string}x${string}`
  bitrate?: `${number}M` | `${number}K`
  additional?: string[]
}

type ProgressType = {
  frame: number;
  fps: number;
  q: number;
  size: string;
  time: string;
  bitrate: string;
  speed: string;
}

type FinishType = {
  frameStats: ProgressType[]
  frameDetails: {
    frameI: number;
    avgQpI: number;
    frameP: number;
    avgQpP: number;
    frameB: number;
    avgQpB: number;
  }
  finalBitrate: number
  qavg: number
}

type FFmpegEvents = {
  progress: [ProgressType],
  finish: [FinishType]
}

export class FFmpeg extends TypedEventEmitter<FFmpegEvents>{
  private args: string[] = []
  private frameStats: ProgressType[] = []

  constructor(options: FFmpegArgs) {
    super()
    this.buildArgs(options)
  }

  run () {
    return new Promise<string>((resolve, reject) => {
      const process = spawn(ffmpegPath, this.args)
      let output = ''
      let outputErr = ''

      process.stdout.on('data', (buffer: Buffer) => {
        const text = buffer.toString()
        const stats = this.getFrameStats(text)
  
        if (stats) {
          this.emit('progress', stats)
          this.frameStats.push(stats)
        }

        output += text
      })
 
      process.stderr.on('data', (data: Buffer) => {
        const text = data.toString()


        if (text.includes('Overwrite?')) {
          process.kill()
          reject(new Error('FFmpeg didn\'t work because the output file already existed!'))
        }
        
        outputErr += text
      })
  
      // Lida com o término do processo
      process.on('close', async (code) => {
        if (code === 0) {
          const stats = this.getFrameStats(output)
          await writeFile('test.json', JSON.stringify(stats, null, 2))
          resolve(output)
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}. Error: ${outputErr}`))
        }
      })
  
      // Lida com erros inesperados
      process.on('error', (err) => {
        reject(new Error(`Failed to start FFmpeg process. Error: ${err.message}`))
      })
    })
  }

  private getFrameStats(input: string) {
    const regex = /frame=\s*(\d+)\s+fps=\s*(\d+)\s+q=\s*([\d.-]+)\s+size=\s*([\d.KiB]+)\s+time=\s*([\d:.]+)\s+bitrate=\s*([\d.]+kbits\/s)\s+speed=\s*([\d.x]+)/g
    const match = regex.exec(input)
    if (!match) return

    return {
      frame: parseInt(match[1], 10),
      fps: parseInt(match[2], 10),
      q: parseFloat(match[3]),
      size: match[4],
      time: match[5],
      bitrate: match[6],
      speed: match[7],
    }
  }

  private buildArgs(options: FFmpegArgs) {
    if (options.overwrite) {
      this.args.push('-y')
    }
    if (options.input) {
      this.args.push('-i', options.input) // Argumento para o arquivo de entrada
    }

    if (options.codec?.video) {
      this.args.push('-c:v', options.codec.video) // Codec de vídeo
    }

    if (options.codec?.audio) {
      this.args.push('-c:a', options.codec.audio) // Codec de áudio
    }

    if (options.resolution) {
      this.args.push('-s', options.resolution) // Resolução do vídeo
    }

    if (options.bitrate) {
      this.args.push('-b:v', options.bitrate) // Bitrate de vídeo
    }

    if (options.additional && options.additional.length > 0) {
      this.args.push(...options.additional) // Argumentos adicionais personalizados
    }

    if (options.output) {
      this.args.push(options.output)
    }
  }
}
