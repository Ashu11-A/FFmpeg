import { existsSync, mkdirSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { ParserDetails } from './Details'

type FFmpegGroupOption = {
  option: string
  value?: string
  description: string
}

type OptionValue = {
  name: string
  value: number
  tag: string
  description?: string
}

type Option = {
  type: string
  tag: string
  description: string
  values: OptionValue[]
}

type EncoderOptions = {
  [optionName: string]: Option
}

type EncoderOptionsSections = {
  [sectionName: string]: EncoderOptions
}

export class ParseHelp {
  groups: Record<string, FFmpegGroupOption[]>
  params: EncoderOptionsSections
  result: string = ''
  index: string = ''

  constructor (input: string) {
    this.params = this.parseParamsOptions(input)
    this.groups = this.parseOptionsByGroup(input)
    this.result += this.generateEnums(this.groups)

    writeFile(join(process.cwd(), 'src/index.ts'), this.index, { encoding: 'utf-8' })
  }

  private parseOptionsByGroup(text: string): Record<string, FFmpegGroupOption[]> {
    const regexGroup = /^(.+?):\s*$/gm
    const regexOption = /^(-[\w:]+)(?:\s+([^\s]+))? \s+(.*?)$/

    const groups: Record<string, FFmpegGroupOption[]> = {}
    let currentGroup = ''

    const lines = text.split('\n')
    for (const line of lines) {
      const groupMatch = regexGroup.exec(line)

      if (groupMatch) {
        currentGroup = groupMatch[1].trim()
        groups[currentGroup] = []
        continue
      }

      const optionMatch = regexOption.exec(line)

      if (optionMatch) {
        const [, option, value, description] = optionMatch

        groups[currentGroup].push({
          option: option.trim(),
          value: value ? value.trim() : undefined,
          description: description.trim(),
        })
      }
    }

    return groups
  }

  private parseParamsOptions(input: string): EncoderOptionsSections {
    const result: EncoderOptionsSections = {}
    const lines = input.split('\n')
  
    // Expressões regulares
    const sectionRegex = /^([\w\s]+AVOptions):$/
    const optionRegex = /^\s{2}-(\w+)\s+<([^>]+)>\s+([A-Z.]+)\s+(.*)$/
    const valueRegex = /^\s{5}(\w+)\s+(-?\d+)\s+([A-Z.]+)\s*(.*)$/
  
    let currentSection: string | null = null
    let currentOption: string | null = null
  
    // Função auxiliar para processar seções
    const processSection = (line: string): boolean => {
      const sectionMatch = line.match(sectionRegex)
      if (sectionMatch) {
        currentSection = sectionMatch[1]
        if (currentSection) result[currentSection] = {}
        return true
      }
      return false
    }
  
    // Função auxiliar para processar opções
    const processOption = (line: string): boolean => {
      const optionMatch = line.match(optionRegex)
      if (optionMatch && currentSection) {
        const [, name, type, tag, description] = optionMatch
        result[currentSection][name] = {
          type,
          tag,
          description: description.trim(),
          values: [],
        }
        currentOption = name
        return true
      }
      return false
    }
  
    // Função auxiliar para processar valores
    const processValue = (line: string): void => {
      const valueMatch = line.match(valueRegex)
      if (valueMatch && currentSection && currentOption) {
        const [, name, value, tag, description] = valueMatch
  
        // Certifica-se de que o objeto `result[currentSection][currentOption]` existe
        if (
          !result[currentSection] ||
          !result[currentSection][currentOption]
        ) {
          console.warn(
            `Aviso: Opção não encontrada para valor. Seção: ${currentSection}, Opção: ${currentOption}`
          )
          return
        }
  
        result[currentSection][currentOption].values.push({
          name,
          value: parseInt(value),
          tag,
          description: description.trim() || undefined,
        })
      } else {
        console.warn(
          `Aviso: Linha ignorada ao processar valor. Seção: ${currentSection}, Opção: ${currentOption}, Linha: ${line}`
        )
      }
    }
  
    // Itera sobre cada linha do input
    for (const line of lines) {
      if (processSection(line)) continue
      if (processOption(line)) continue
      processValue(line)
    }
  
    // Gera os arquivos e os enums
    this.generateEnumsAndFiles(result)
  
    return result
  }
  
  // Função para gerar enums e salvar os arquivos
  private generateEnumsAndFiles(result: EncoderOptionsSections): void {
    Object.entries(result).forEach(([key, options]) => {
      key = key.replace('AVOptions', '').trim().replaceAll(' ', '_')
      let code = ''
      const constants: Record<string, string> = {}
  
      // Cria enums para cada opção
      Object.entries(options).forEach(([name, option]) => {
        if (option.values.length === 0) return
  
        const enums: string[] = []
        option.values.forEach((value) => {
          if (value.description && value.description.includes('deprecated')) return
  
          if (value.description) {
            enums.push(`  /*\n  * ${value.description}\n  */`)
          }
          enums.push(`  ${ParserDetails.format(value.name)} = ${value.value},`)
        })
  
        if (enums.length === 0) return
        code += `enum ${name} {\n${enums.join('\n')}\n}\n\n`
        constants[name] = name
      })

      if (Object.keys(constants).length === 0) return
  
      // Adiciona os constantes no arquivo
      code += `export const ${key} = {\n${Object.entries(constants)
        .map(([key, value]) => `  ${key}: ${value}`)
        .join(',\n')}\n} as const\n`
  
      if (code.length === 0) return
  
      // Cria o arquivo
      const filePath = join(process.cwd(), `/src/types/AVOptions/${key}.ts`)
      this.index += `import './types/AVOptions/${key}.ts'\n`
      if (!existsSync(dirname(filePath))) mkdirSync(dirname(filePath), { recursive: true })
  
      writeFile(filePath, code, { encoding: 'utf-8' })
    })
  }
  

  generateEnums(groups: Record<string, FFmpegGroupOption[]>): string {
    const enumParts: string[] = []

    for (const [group, options] of Object.entries(groups)) {
      const enumName = `FFmpeg${group.replace(/[^a-zA-Z]/g, '').replaceAll('options', '')}Options`
      const enumValues = options.map((opt) => {
        const optionName = opt.option
          .replace(/[:<>\-[\]\s]/g, '_') // Replace special chars with "_"
          .replace(/_+/g, '_') // Avoid multiple "_"
          .replace(/(^_|_$)/g, '') // Remove leading/trailing "_"
  
        return `  /*
  * ${opt.description}
  */
  ${optionName}: ${opt.value === undefined ? undefined : `'${opt.value}'`},`
      })
  
      if (enumValues.length > 0) {
        enumParts.push(`export const ${enumName} = {\n${enumValues.join('\n')}\n} as const`)
      }
    }

    return enumParts.join('\n\n')
  }
}

const ffmpegText = await readFile('log.txt', { encoding: 'utf-8' })
const result = new ParseHelp(ffmpegText)


await writeFile('args.json', JSON.stringify(result, null, 2))
await writeFile('args.ts', result.result)
