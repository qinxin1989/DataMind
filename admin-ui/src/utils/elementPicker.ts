/**
 * 元素选择器工具
 * 用于在网页中选择元素并生成CSS选择器
 */

export interface ElementPickerOptions {
  onElementSelected?: (selector: string, element: HTMLElement) => void
  onElementHovered?: (element: HTMLElement) => void
}

export class ElementPicker {
  private enabled = false
  private highlightBox: HTMLDivElement | null = null
  private options: ElementPickerOptions

  constructor(options: ElementPickerOptions = {}) {
    this.options = options
  }

  /**
   * 启用元素选择器
   */
  enable() {
    if (this.enabled) return

    this.enabled = true
    this.createHighlightBox()
    this.attachEventListeners()
  }

  /**
   * 停用元素选择器
   */
  disable() {
    if (!this.enabled) return

    this.enabled = false
    this.removeHighlightBox()
    this.detachEventListeners()
  }

  /**
   * 创建高亮框
   */
  private createHighlightBox() {
    this.highlightBox = document.createElement('div')
    this.highlightBox.style.cssText = `
      position: absolute;
      background: rgba(24, 144, 255, 0.2);
      border: 2px solid #1890ff;
      pointer-events: none;
      z-index: 999999;
      transition: all 0.1s ease;
    `
    document.body.appendChild(this.highlightBox)
  }

  /**
   * 移除高亮框
   */
  private removeHighlightBox() {
    if (this.highlightBox && this.highlightBox.parentNode) {
      try {
        this.highlightBox.parentNode.removeChild(this.highlightBox)
      } catch (e) {
        // Ignore error if already removed
      }
      this.highlightBox = null
    }
  }

  /**
   * 附加事件监听器
   */
  private attachEventListeners() {
    document.addEventListener('mousemove', this.handleMouseMove)
    document.addEventListener('click', this.handleClick, true)
    document.addEventListener('keydown', this.handleKeyDown)
  }

  /**
   * 移除事件监听器
   */
  private detachEventListeners() {
    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('click', this.handleClick, true)
    document.removeEventListener('keydown', this.handleKeyDown)
  }

  /**
   * 处理鼠标移动 - 高亮悬停的元素
   */
  private handleMouseMove = (e: MouseEvent) => {
    if (!this.enabled) return

    const element = e.target as HTMLElement
    if (!element || element === this.highlightBox) return

    this.highlightElement(element)

    if (this.options.onElementHovered) {
      this.options.onElementHovered(element)
    }
  }

  /**
   * 处理点击 - 选择元素
   */
  private handleClick = (e: MouseEvent) => {
    if (!this.enabled) return

    e.preventDefault()
    e.stopPropagation()

    const element = e.target as HTMLElement
    if (!element || element === this.highlightBox) return

    const selector = this.generateSelector(element)

    if (this.options.onElementSelected) {
      this.options.onElementSelected(selector, element)
    }
  }

  /**
   * 处理键盘事件 - ESC键停用选择器
   */
  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.disable()
    }
  }

  /**
   * 高亮元素
   */
  private highlightElement(element: HTMLElement) {
    if (!this.highlightBox) return

    const rect = element.getBoundingClientRect()
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

    if (!this.highlightBox) return

    // Add null check for highlightBox before accessing style
    this.highlightBox.style.top = `${rect.top + scrollTop}px`
    this.highlightBox.style.left = `${rect.left + scrollLeft}px`
    this.highlightBox.style.width = `${rect.width}px`
    this.highlightBox.style.height = `${rect.height}px`
  }

  /**
   * 生成CSS选择器
   * 优先级：id > class > tag + nth-child
   */
  generateSelector(element: HTMLElement): string {
    // 1. 如果有唯一ID，直接使用
    if (element.id) {
      const id = element.id.replace(/[^\w-]/g, '\\$&')
      if (document.querySelectorAll(`#${id}`).length === 1) {
        return `#${id}`
      }
    }

    // 2. 尝试使用class组合
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(c => c)
      if (classes.length > 0) {
        const classSelector = '.' + classes.join('.')
        const tagWithClass = `${element.tagName.toLowerCase()}${classSelector}`

        // 检查是否唯一
        if (document.querySelectorAll(tagWithClass).length === 1) {
          return tagWithClass
        }

        // 如果不唯一，尝试添加父级
        const parent = element.parentElement
        if (parent) {
          const parentSelector = this.getSimpleSelector(parent)
          const fullSelector = `${parentSelector} > ${tagWithClass}`
          if (document.querySelectorAll(fullSelector).length === 1) {
            return fullSelector
          }
        }
      }
    }

    // 3. 使用tag + nth-child
    return this.getNthChildSelector(element)
  }

  /**
   * 获取简单选择器（id或class或tag）
   */
  private getSimpleSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id.replace(/[^\w-]/g, '\\$&')}`
    }

    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(c => c)
      if (classes.length > 0) {
        return '.' + classes[0]
      }
    }

    return element.tagName.toLowerCase()
  }

  /**
   * 获取nth-child选择器
   */
  private getNthChildSelector(element: HTMLElement): string {
    const parent = element.parentElement
    if (!parent) {
      return element.tagName.toLowerCase()
    }

    const siblings = Array.from(parent.children)
    const index = siblings.indexOf(element) + 1
    const tag = element.tagName.toLowerCase()

    const parentSelector = this.getSimpleSelector(parent)
    return `${parentSelector} > ${tag}:nth-child(${index})`
  }
}

/**
 * 创建元素选择器实例
 */
export function createElementPicker(options: ElementPickerOptions = {}): ElementPicker {
  return new ElementPicker(options)
}
