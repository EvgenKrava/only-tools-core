import { describe, expect, it } from 'vitest'
import { appForCostKeys } from './apps'

describe('appForCostKeys', () => {
  it('maps Project tags and the CarLog CloudFormation stack to apps', () => {
    expect(appForCostKeys('Project$gighunter', 'aws:cloudformation:stack-name$')).toBe('gighunter')
    expect(appForCostKeys('Project$onlytools', 'aws:cloudformation:stack-name$')).toBe('core')
    expect(appForCostKeys('Project$', 'aws:cloudformation:stack-name$CarLogStack')).toBe('carlog')
  })
  it('puts untagged and unknown spend in other', () => {
    expect(appForCostKeys('Project$', 'aws:cloudformation:stack-name$')).toBe('other')
    expect(appForCostKeys('Project$salary-calculator', 'aws:cloudformation:stack-name$')).toBe('other')
  })
})
