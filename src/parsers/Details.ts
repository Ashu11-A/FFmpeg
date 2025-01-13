type TypeMetadata = {
  readonly key: string;
  readonly value: string;
  readonly description: string;
  readonly position: number;
}

type FlagDetails = {
  readonly flag: string;
  readonly position: number;
  readonly description: string;
}

type EncoderMetadata = {
  readonly category: string;
  readonly name: string;
  readonly flags: FlagDetails[];
  readonly description: string;
}

type TypedBase = {
  key: string,
  value: string | number
  JSDoc: string
  disableFormat?: boolean
}

type ParserParams = {
  input: string
  nomenclature: {
    name: string,
    types: string,
    categories: string,
    capabilities: string,
    ids: string
  }
}

export class ParserDetails {
  generated
  input
  nomenclature

  constructor (params: ParserParams) {
    this.input = params.input
    this.nomenclature = params.nomenclature
    this.generated = this.parser()
  }

  private parser () {
    const encodersTypes = this.parserTypes(this.input)
    const encoderTypesEnum = this.generateEnum(
      this.nomenclature.types,
      encodersTypes.map(({ value, description }) => ({ key: value, value: description, JSDoc: description }))
    )
    
    const encoderMetadata = this.parserMetadata(this.input, encodersTypes)
    const encoderEnum = this.generateEnum(
      this.nomenclature.name,
      encoderMetadata.map(({ name, description }) => ({ key: name, value: name, JSDoc: description }))
    )
    
    const encoderCategoryType = this.generateType(
      this.nomenclature.categories,
      Object.entries(
        encoderMetadata.reduce<Record<string, string[]>>((acc, { category, name }) => {
          const encoderType = encodersTypes.find((item) => item.key === category && item.position === 0)
          if (!encoderType) return acc
          
          acc[`${this.nomenclature.types}.${encoderType.value}`] = acc[`${this.nomenclature.types}.${encoderType.value}`] || []
          acc[`${this.nomenclature.types}.${encoderType.value}`].push(`${this.nomenclature.name}${ParserDetails.formatDerived(name)}`)
    
          return acc
        }, {})
      ).map(([category, encoders]) => ({ key: `[${category}]`, value: encoders.join(' | '), JSDoc: '' }))
    )
    
    const encoderCapabilities = this.generateType(
      'EncoderCapabilities',
      Object.entries(
        encoderMetadata.reduce<Record<string, string[]>>((acc, { flags, name }) => {
          flags.forEach(({ flag, position }) => {
            const encoderType = encodersTypes.find((item) => item.position === position && flag === item.key)
            if (!encoderType) return
            
            acc[`${this.nomenclature.types}.${encoderType.value}`] = acc[`${this.nomenclature.types}.${encoderType.value}`] || []
            acc[`${this.nomenclature.types}.${encoderType.value}`].push(`${this.nomenclature.name}${ParserDetails.formatDerived(name)}`)
          })
    
          return acc
        }, {})
      ).map(([flag, encoders]) => ({ key: `[${flag}]`, value: encoders.join(' | '), JSDoc: '' }))
    )
    
    const encoderIDsType = this.generateType(
      this.nomenclature.ids,
      Object.entries(
        encodersTypes.reduce<Record<string, string[]>>((acc, { position, value }) => {
          acc[position] = acc[position] || []
          acc[position].push(`${this.nomenclature.types}${ParserDetails.formatDerived(value)}`)
    
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
      code: ParserDetails.tokanizer(encoderTypesEnum, encoderIDsType, encoderCategoryType, encoderCapabilities, encoderEnum),
      metadata: {
        encoderTypesEnum,
        encoderEnum,
        encoderCategoryType,
        encoderCapabilities,
        encoderIDsType
      }
    }
  }

  private generateEnum (name: string, values: TypedBase[]) {
    return `export enum ${name} {\n${values
      .map((item) => `  /*
  * ${item.JSDoc}
  */
  ${item.disableFormat ? item.key : ParserDetails.formatContent(item.key)} = '${item.value}'`)
      .join(',\n')}\n}`
  }
  
  private generateType (name: string, values: TypedBase[]) {
    return `export type ${name} = {\n${values
      .map((item) => `  ${item.disableFormat ? item.key : ParserDetails.formatContent(item.key)}: ${item.value}`)
      .join(',\n')}\n}`
  }

  parserTypes(input: string) {
    const typeRegex = /([A-Za-z.]+) = (.*)/gm
    const types: TypeMetadata[] = []
    let match:RegExpExecArray | null
    
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

  parserMetadata(input: string, typesMap: TypeMetadata[]): EncoderMetadata[] {
    const encoderRegex = /\s*(\d+|[A-Za-z0-9])\s+([a-z0-9]+)\s+(.+)$/gm
    // /^ (\w)(.{5}) (\w+)\s+(.+?)( \(codec .+\))?$/gm
    const encoders: EncoderMetadata[] = []
    let match:RegExpExecArray | null

    const regexParams = /:(.*?)-/s
    const params = input.match(regexParams)?.[1]
    if (!params) return []

    const contents = ParserDetails.analyzePatterns([params])
    if (!contents) return []

    const regexContent = new RegExp(`-{${contents?.[0] ?? 1}}\\s*( .*)`, 's')
    const available = input.match(regexContent)?.[1]
    if (!available) return []
    
    console.log(encoderRegex.exec(input))
    while ((match = encoderRegex.exec(input)) !== null) {
      const [value] = match
      const categories = value.slice(2, contents?.[0] + 2)

      const text = value.slice(contents?.[0] + 2)
      const parsed = /(.+?)\s+(.+)$/.exec(text.trim())
      if (!parsed) continue

      const [, name, description] = parsed
      const flagsDetails: FlagDetails[] =  categories.split('')
        .map((char, index) => {
          if (char === '.') return null
          const type = typesMap.find((t) => t.key === char &&  t.position === index + 1)
          return type
            ? {
              flag: char,
              position: index + 1,
              description: type.description
            }
            : null
        }).filter((flag): flag is FlagDetails => flag !== null)
        
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

  static formatContent = (input: string, comparator?: string) => this.isFirstCharNumber(comparator ?? input) ? `_${input}` : input
  static formatDerived = (input: string, comparator?: string) => this.isFirstCharNumber(comparator ?? input) ? `._${input}` : `.${input}`
  static tokanizer = (...args: string[]) => args.join('\n\n')
}