import { mergeAttributes, Node } from '@tiptap/core'
import { Norm } from '../norms/Norm'
import { DefaultNorm } from '../norms/DefaultNorm'
import { Attrs } from '@tiptap/pm/model'
import { TextStyles } from '../norms/styles'
import { clear } from '../norms/utils'

export interface TitleOptions {
	norm: Norm
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    Title: {
      /**
       * Set a title node
       */
      setTitle: () => ReturnType,
      /**
       * Toggle a title node
       */
      toggleTitle: () => ReturnType,
    }
  }
}

export const Title = Node.create<TitleOptions>({
  name: 'title',

  addOptions() {
    return {
			norm: DefaultNorm,
      HTMLAttributes: {},
    }
  },

  content: 'inline*',

  group: 'block',

  defining: true,

  addAttributes() {
    return {
			style: {
				default: this.options.norm.title,
				parseHTML: () => this.options.norm.title,
				renderHTML: (attrs: Attrs) => {
					const style: TextStyles = attrs.style;
					const styleString = clear(`
						line-height: ${style.lineHeight}
						font-size: ${style.font.size}pt
						font-weight: ${style.font.weight}
						font-family: ${style.font.family}
					`);
					return { style: styleString };
				}
			}
    }
  },

  parseHTML() {
    return [{
			tag: 'h1',
		}]
  },

  renderHTML({ HTMLAttributes }) {
		const { title } = this.options.norm;

		const style = { style: clear(`
			line-height: ${title.lineHeight}
			font-size: ${title.font.size}pt
			font-weight: ${title.font.weight}
			font-family: ${title.font.family}
			text-align: ${title.textAlign}
			text-transform: ${title.transform}
		`)};

		const HTMLAttrs = this.options.HTMLAttributes;
		const attrs = mergeAttributes(style, HTMLAttrs, HTMLAttributes);

    return ['h1', attrs, 0]
  },

  addCommands() {
    return {
      setTitle: () => ({ commands }) => {
        return commands.setNode(this.name)
      },
      toggleTitle: () => ({ commands }) => {
        return commands.toggleNode(this.name, 'paragraph')
      },
    }
  },
})
