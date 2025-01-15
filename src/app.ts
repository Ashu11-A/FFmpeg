import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { FFmpeg } from './controllers/Execute'
import { ParserDetails, ParserParams } from './parsers/Details'

import { join } from 'path'

export const ffmpegPath = join(process.cwd(), 'binary/ffmpeg/bin/ffmpeg')

const HelperPaths2: Record<string, ParserParams['nomenclature']> = {
  /* Special */
  filters: {
    name: 'Filters',
    types: 'FilterTypes',
    categories: 'FilterCategories',
    capabilities: 'FilterCapabilities',
    ids: 'FilterIDs'
  },
  pix_fmts: {
    name: 'PixFmts',
    types: 'PixFmtTypes',
    categories: 'PixFmtCategories',
    capabilities: 'PixFmtCapabilities',
    ids: 'PixFmtIDs'
  },
}

const HelperPaths: Record<string, ParserParams['nomenclature']> = {
  /*
  layouts: {
    types: 'LayoutTypes',
    tag: true
  },
  sample_fmts: {
    types: 'SampleFmtTypes',
    tag: true
  },
  */
  codecs: {
    name: 'Codecs',
    types: 'CodecTypes',
    categories: 'CodecCategories',
    capabilities: 'CodecCapabilities',
    ids: 'CodecIDs'
  },
  protocols: {
    name: 'Protocol',
    tagged: true
  },
  decoders: {
    name: 'Decoders',
    types: 'DecoderTypes',
    categories: 'DecoderCategories',
    capabilities: 'DecoderCapabilities',
    ids: 'DecoderIDs'
  },
  demuxers: {
    name: 'Demuxers',
    types: 'DemuxerTypes',
    categories: 'DemuxerCategories',
    capabilities: 'DemuxerCapabilities',
    ids: 'DemuxerIDs'
  },
  devices: {
    name: 'Devices',
    types: 'DeviceTypes',
    categories: 'DeviceCategories',
    capabilities: 'DeviceCapabilities',
    ids: 'DeviceIDs'
  },
  encoders: {
    name: 'Encoders',
    types: 'EncoderTypes',
    categories: 'EncoderCategories',
    capabilities: 'EncoderCapabilities',
    ids: 'EncoderIDs'
  },
  formats: {
    name: 'Formats',
    types: 'FormatTypes',
    categories: 'FormatCategories',
    capabilities: 'FormatCapabilities',
    ids: 'FormatIDs'
  },
  bsfs: {
    types: 'BSFTypes',
    tag: true
  },
  hwaccels: {
    types: 'HwAccelTypes',
    tag: true
  },
  dispositions: {
    types: 'DispositionTypes',
    tag: true
  },
  colors: {
    types: 'ColorTypes',
    tag: true
  },
  muxers: {
    name: 'Muxers',
    types: 'MuxerTypes',
    categories: 'MuxerCategories',
    capabilities: 'MuxerCapabilities',
    ids: 'MuxerIDs'
  },
}

for (const [key, nomenclature] of Object.entries(HelperPaths)) {
  try {
    const args = [`-${key}`, '-hide_banner']
    const output = await new FFmpeg({ additional: args }).run()
    const parser = new ParserDetails({ input: output, nomenclature })

    const outpath = `src/types/${key}.ts`

    if (!existsSync(dirname(outpath))) await mkdir(dirname(outpath), { recursive: true })
    await writeFile(outpath, parser.generated.code)
  } catch (error) {
    console.error('Erro ao executar FFmpeg:')
    console.error(error)
  }
}