import { FFmpeg } from './controllers/Execute'
import { Encoders } from './types/encoders'

const ff = new FFmpeg({
  input: 'video.mp4',
  output: 'teste.mp4',
  overwrite: true,
  codec: {
    video: Encoders.libx264,
    audio: Encoders.aac
  },
  bitrate: '6M'
})

ff.on('progress', (data) => console.log(data))

await ff.run()