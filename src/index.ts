import { executeFFmpeg } from './controllers/Execute'
import { ParserDetails } from './parsers/Details'
import { writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname } from 'path'
import { mkdir } from 'fs/promises'

const HelperPaths = {
  /*
  encoders: {
    name: 'Encoders',
    types: 'EncoderTypes',
    categories: 'EncoderCategories',
    capabilities: 'EncoderCapabilities',
    ids: 'EncoderIDs'
  },
  */
  /*
  decoders: {
    name: 'Decoders',
    types: 'DecoderTypes',
    categories: 'DecoderCategories',
    capabilities: 'DecoderCapabilities',
    ids: 'DecoderIDs'
  },
  */
  codecs: {
    name: 'Codecs',
    types: 'CodecTypes',
    categories: 'CodecCategories',
    capabilities: 'CodecCapabilities',
    ids: 'CodecIDs'
  },
  /*
  formats: {
    name: 'Formats',
    types: 'FormatTypes',
    categories: 'FormatCategories',
    capabilities: 'FormatCapabilities',
    ids: 'FormatIDs'
  },
  */
  /*
  muxers: {
    name: 'Muxers',
    types: 'MuxerTypes',
    categories: 'MuxerCategories',
    capabilities: 'MuxerCapabilities',
    ids: 'MuxerIDs'
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
  layouts: {
    name: 'Layouts',
    types: 'LayoutTypes',
    categories: 'LayoutCategories',
    capabilities: 'LayoutCapabilities',
    ids: 'LayoutIDs'
  },
  sample_fmts: {
    name: 'SampleFmts',
    types: 'SampleFmtTypes',
    categories: 'SampleFmtCategories',
    capabilities: 'SampleFmtCapabilities',
    ids: 'SampleFmtIDs'
  },
  bsfs: {
    name: 'BSFs',
    types: 'BSFTypes',
    categories: 'BSFCategories',
    capabilities: 'BSFCapabilities',
    ids: 'BSFIDs'
  },
  protocols: {
    name: 'Protocols',
    types: 'ProtocolTypes',
    categories: 'ProtocolCategories',
    capabilities: 'ProtocolCapabilities',
    ids: 'ProtocolIDs'
  },
  dispositions: {
    name: 'Dispositions',
    types: 'DispositionTypes',
    categories: 'DispositionCategories',
    capabilities: 'DispositionCapabilities',
    ids: 'DispositionIDs'
  },
  colors: {
    name: 'Colors',
    types: 'ColorTypes',
    categories: 'ColorCategories',
    capabilities: 'ColorCapabilities',
    ids: 'ColorIDs'
  },
  hwaccels: {
    name: 'HwAccels',
    types: 'HwAccelTypes',
    categories: 'HwAccelCategories',
    capabilities: 'HwAccelCapabilities',
    ids: 'HwAccelIDs'
  }
  */
}

for (const [key, nomenclature] of Object.entries(HelperPaths)) {
  try {
    const ffmpegPath = 'binary\\ffmpeg\\bin\\ffmpeg.exe'
    const args = [`-${key}`]
  
    const output = await executeFFmpeg(ffmpegPath, args)
    const parser = new ParserDetails({ input: output, nomenclature })

    const outpath = `src/types/${key}.ts`

    if (!existsSync(dirname(outpath))) await mkdir(dirname(outpath), { recursive: true })
    await writeFile(outpath, parser.generated.code)
  } catch (error) {
    console.error('Erro ao executar FFmpeg:')
    console.error(error)
  }
}