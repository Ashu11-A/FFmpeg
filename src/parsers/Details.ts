type TypeMetadata = {
  readonly key: string
  readonly value: string
  readonly description: string
  readonly position: number
}

type FlagDetails = {
  readonly flag: string
  readonly position: number
  readonly description: string
}

type EncoderMetadata = {
  readonly category: string
  readonly name: string
  readonly flags: FlagDetails[]
  readonly description: string
}

type TypedBase = {
  key: string
  value: string | number
  JSDoc?: string
  disableFormat?: boolean
}

export type ParserParams = { 
  input: string
  nomenclature: TagParam | TypedParam | PreTaggedParam | PreTaggedParam
}

type TagParam = {
  types: string
  tag: boolean
}

type TypedParam = {
  name: string
  types: string
  categories: string
  capabilities: string
  ids: string
}

type PreTaggedParam = {
  name: string
  tagged: boolean
}

export class ParserDetails {
  generated
  input: ParserParams['input']
  nomenclature: ParserParams['nomenclature']

  constructor(params: ParserParams) {
    this.input = params.input
    this.nomenclature = params.nomenclature
    this.generated = this.parser()
  }

  private static isTagParam(nomenclature: TagParam | TypedParam | PreTaggedParam): nomenclature is TagParam {
    return (nomenclature as TagParam).tag !== undefined
  }

  private static isTypedParam(nomenclature: TagParam | TypedParam | PreTaggedParam): nomenclature is TypedParam {
    return (nomenclature as TypedParam).capabilities !== undefined
  }

  private static isPreTagged(nomenclature: TagParam | TypedParam | PreTaggedParam): nomenclature is PreTaggedParam {
    return (nomenclature as PreTaggedParam).tagged !== undefined
  }

  private parser() {
    if (ParserDetails.isTagParam(this.nomenclature)) {
      const tags = this.parserTags(this.input)
      const encoderTag = this.generateEnum(
        this.nomenclature.types,
        tags.map(({ key, value }) => ({
          key,
          value: value ?? key
        }))
      )

      return {
        code: ParserDetails.tokanizer(encoderTag),
        metadata: {
          tags
        }
      }
    }

    if (ParserDetails.isPreTagged(this.nomenclature)) {
      const tagged = this.parserPreTagged(this.input)
      const data = {
        code: '',
        metadata: {}
      }

      tagged.forEach((tag) => {
        const result = this.generateEnum(
          (this.nomenclature as { name: string }).name + tag.key,
          tag.values.map((value) => ({
            key: value,
            value: value
          }))
        )

        data.code += result + '\n\n'
        data.metadata[tag.key] = tag.values
      })
      
      return data
    }

    if (ParserDetails.isTypedParam(this.nomenclature)) {
      const encodersTypes = this.parserTypes(this.input)
      const encoderTypesEnum = this.generateEnum(
        this.nomenclature.types,
        encodersTypes.map(({ value, description }) => ({
          key: value,
          value: description,
          JSDoc: description
        }))
      )

      const encoderMetadata = this.parserMetadata(this.input, encodersTypes)
      const encoderEnum = this.generateEnum(
        this.nomenclature.name,
        encoderMetadata.map(({ name, description }) => ({
          key: name,
          value: name,
          JSDoc: description
        }))
      )

      const encoderCapabilities = this.generateType(
        this.nomenclature.capabilities,
        Object.entries(
          encoderMetadata.reduce<Record<string, string[]>>((acc, { flags, name }) => {
            flags.forEach(({ flag, position }) => {
              const encoderType = encodersTypes.find((item) => item.position === position && flag === item.key)
              if (!encoderType) return

              const key = `${(this.nomenclature as { types: string }).types}.${encoderType.value}`
              acc[key] = acc[key] || []
              acc[key].push(
                `${(this.nomenclature as { name: string }).name}.${ParserDetails.format(name)}`
              )
            })

            return acc
          }, {})
        )
          .sort(([flagA], [flagB]) => flagA.localeCompare(flagB))
          .map(([flag, encoders]) => ({
            key: `[${flag}]`,
            value: encoders.join(' | '),
            JSDoc: '',
            disableFormat: true
          }))
      )

      const encoderIDsType = this.generateType(
        this.nomenclature.ids,
        Object.entries(
          encodersTypes.reduce<Record<string, string[]>>((acc, { position, value }) => {
            acc[position] = acc[position] || []
            acc[position].push(`${(this.nomenclature as { types: string }).types}.${ParserDetails.format(value)}`)

            return acc
          }, {})
        ).map(([key, value]) => ({
          key,
          value: value.join(' | '),
          JSDoc: '',
          disableFormat: true
        }))
      )

      return {
        code: ParserDetails.tokanizer(encoderTypesEnum, encoderIDsType, encoderCapabilities, encoderEnum),
        metadata: {
          encoderTypesEnum,
          encoderEnum,
          encoderCapabilities,
          encoderIDsType
        }
      }
    }

    throw new Error('Invalid nomenclature type')
  }

  private generateEnum(name: string, values: TypedBase[]) {
    const generateJSDoc = (jsDoc?: string) => jsDoc ? `  /**\n  * ${jsDoc}\n  */\n` : ''

    const enumBody = values
      .map((item) => {
        const formattedKey = item.disableFormat ? item.key : ParserDetails.format(item.key)
        const jsDocComment = generateJSDoc(item.JSDoc)

        return `${jsDocComment} ${formattedKey} = '${item.value}'`
      }).join(',\n')

    return `export enum ${name} {\n${enumBody}\n}`
  }

  private generateType(name: string, values: TypedBase[]) {
    return `export type ${name} = {\n${values
      .map((item) => `  ${item.disableFormat ? item.key : ParserDetails.format(item.key)}: ${item.value}`)
      .join(',\n')}\n}`
  }

  parserTypes(input: string) {
    const typeRegex = /([A-Za-z.]+) = (.*)/gm
    const types: TypeMetadata[] = []
    let match: RegExpExecArray | null

    while ((match = typeRegex.exec(input)) !== null) {
      const [, key, description] = match
      const position = key.indexOf(key.replace(/\./g, ''))

      types.push({
        key: key.replaceAll(/\./g, ''),
        value: description.replaceAll(/\s|-/g, ''),
        description,
        position,
      })
    }

    return types
  }

  parserTags(input: string) {
    const tagRegex = /^(\w+)(?:\s+(#[\da-fA-F]{6}))?$/gm
    const matches = Array.from(input.matchAll(tagRegex))

    return matches.map((math) => ({ key: math[1], value: math[2] }))
  }

  parserPreTagged(input: string) {
    const taggerRegex = /(Input|Output):([\s\S]*?)(?=^\w|^$)/gm
    const matches = Array.from(input.matchAll(taggerRegex))

    return matches.map(match => ({
      key: match[1].trim(),
      values: match[2]
        .trim()
        .split(/\s*\n\s*/)
        .filter(value => value !== '')
    }))
  }

  parserMetadata(input: string, typesMap: TypeMetadata[]): EncoderMetadata[] {
    const encoders: EncoderMetadata[] = []
    const regexParams = /:(.*?)-/s
    const params = input.match(regexParams)?.[1]
    if (!params) return []

    const contents = ParserDetails.analyzePatterns([params])
    if (!contents) return []

    const regexContent = new RegExp(`-{${contents?.[0] ?? 1}}\\s*( .*)`, 's')
    const available = input.match(regexContent)?.[1]
    if (!available) return []

    for (const value of available.split('\n')) {
      const categories = value.slice(1, contents?.[0] + 2)
      
      const text = value.slice(contents?.[0] + 2)
      const parsed = /(.+?)\s+(.+)$/.exec(text.trim())
      if (!parsed) continue
      
      const [, name, description] = parsed
      const flagsDetails: FlagDetails[] = categories
        .split('')
        .map((char, index) => {
          if (char === '.') return null
          const type = typesMap.find((t) => t.key === char && t.position === index)
          return type
            ? {
              flag: char,
              position: index,
              description: type.description
            }
            : null
        })
        .filter((flag): flag is FlagDetails => flag !== null)

      encoders.push({
        category: categories,
        name,
        description: description.trim(),
        flags: flagsDetails
      })
    }

    return encoders
  }

  static analyzePatterns(inputs: string[]) {
    const regex = /^[.\s]*[.a-zA-Z0-9]+/ // Captura espaços, pontos e caracteres alfanuméricos no início.

    for (const input of inputs) {
      const lines = input
        .split('\n')
        .map((line) => line.trim()) // Remove espaços extras ao redor de cada linha.
        .filter((line) => line !== '') // Remove linhas vazias.

      // Captura os prefixos e seus comprimentos
      const prefixes = lines.map((line) => {
        const match = line.match(regex)
        return match ? match[0] : '' // Retorna o prefixo encontrado ou vazio.
      })

      const lengths = prefixes.map((prefix) => prefix.length) // Obtém o comprimento de cada prefixo.
      const uniqueLengths = new Set(lengths) // Determina os tamanhos únicos.

      return Array.from(uniqueLengths)
    }
  }

  static isFirstCharNumber(input: string): boolean {
    if (input.length === 0) return false
    return !isNaN(Number(input.charAt(0)))
  }

  static includesSpecialChar(input: string) {
    const specialCharRegex = /[^a-zA-Z0-9\s]/g
    const matches = input.match(specialCharRegex)

    return matches || []
  }

  static format = (input: string, comparator?: string) => {
    this.includesSpecialChar(input ?? comparator).forEach((char) => {
      input = input.replaceAll(char, '_')
    })
    const parsedNumbers = this.isFirstCharNumber(comparator ?? input) ? `_${input}` : `${input}`
    return parsedNumbers
  }

  static tokanizer = (...args: string[]) => args.join('\n\n')
}
